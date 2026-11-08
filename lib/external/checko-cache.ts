import type { PortableDatabase } from '../db/compatibility.ts';
import type { CompanyProfileData } from '../company-profile.ts';
import { cachedProfile } from './checko-profile.ts';
import { acquireChecko, providerError } from './checko-provider.ts';
import { DAY } from './records.ts';

export function validInn(value: string) {
  if (!/^\d{10}$|^\d{12}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const checksum = (weights: number[]) => weights.reduce((sum, weight, index) => sum + weight * digits[index], 0) % 11 % 10;
  if (digits.length === 10) return checksum([2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[9];
  return checksum([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[10]
    && checksum([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[11];
}

export function checkoKey(env:Record<string,unknown>) {
  if (env.PRESCORE_RUNTIME_MODE==='release-candidate' && env.PRESCORE_CHECKO_ENABLED!=='1') return '';
  return typeof env.CHECKO_API_KEY==='string'?env.CHECKO_API_KEY.trim():'';
}

export type CheckoState={status:'READY'|'PARTIAL'|'STALE'|'NOT_CONFIGURED'|'NOT_REQUESTED'|'RETRY_LATER'|'FAILED';fetchedAt:string|null};
export function checkoState(result:Result):CheckoState {
  return {status:result.status==='READY' && result.profile?.failedMethods?.length?'PARTIAL':result.status,fetchedAt:result.profile?.fetchedAt??null};
}
type Row = { payload: string; updated_at: string; fetched_at: string };
type Result = {
  profile?: CompanyProfileData;
  status: 'READY' | 'STALE' | 'NOT_CONFIGURED' | 'NOT_REQUESTED' | 'RETRY_LATER' | 'FAILED';
  reason?: string;
};
const pending = new WeakMap<PortableDatabase, Map<string, Promise<Result>>>();
const select = 'SELECT payload,fetched_at,updated_at FROM checko_profiles WHERE inn=$1';
const age = (time: string) => Date.now() - Date.parse(time);

export async function loadChecko(
  db: PortableDatabase,
  inn: string,
  options: { key: string; cacheOnly: boolean; fetcher?: typeof fetch },
): Promise<Result> {
  function existing(row: Row | undefined): Result | undefined {
    const p = row && cachedProfile(row.payload, inn);
    if (p && age(p.fetchedAt) >= 0 && age(p.fetchedAt) < DAY)
      return { profile: { ...p, cached: true }, status: 'READY' };
    const stale = p ? { profile: { ...p, cached: true }, status: 'STALE' as const } : undefined;
    if (!options.key || options.cacheOnly)
      return stale ?? { status: !options.key ? 'NOT_CONFIGURED' : 'NOT_REQUESTED' };
    if (row && age(row.updated_at) >= 0 && age(row.updated_at) < 10 * 60_000)
      return stale ? { ...stale, reason: 'RETRY_LATER' } : { status: 'RETRY_LATER' };
  }
  const row = (await db.pool.query(select, [inn])).rows[0] as Row | undefined;
  const hit = existing(row);
  if (hit) return hit;
  let requests = pending.get(db);
  if (!requests) {
    requests = new Map();
    pending.set(db, requests);
  }
  const running = requests.get(inn);
  if (running) return running;
  async function refresh(): Promise<Result> {
    const connection = await db.pool.connect();
    try {
      await connection.query('BEGIN');
      const held = await connection.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS held', [
        'prescore:checko:' + inn,
      ]);
      const current = (await connection.query(select, [inn])).rows[0] as Row | undefined;
      const cached = existing(current);
      if (cached || !held.rows[0]?.held) {
        await connection.query('COMMIT');
        return cached ?? { status: 'RETRY_LATER' };
      }
      let acquired: Awaited<ReturnType<typeof acquireChecko>>;
      try {
        acquired = await acquireChecko(inn, options.key, options.fetcher);
      } catch (e) {
        const reason = providerError(e),
          now = new Date().toISOString(),
          prior = current && cachedProfile(current.payload, inn);
        await connection.query(
          'INSERT INTO checko_profiles (inn,payload,fetched_at,updated_at) VALUES ($1,$2,$3,$3) ON CONFLICT (inn) DO UPDATE SET updated_at=excluded.updated_at',
          [inn, JSON.stringify({ inn, failureOnly: true, reason }), now],
        );
        await connection.query('COMMIT');
        return prior
          ? { profile: { ...prior, cached: true }, status: 'STALE', reason }
          : { status: 'FAILED', reason };
      }
      const { profile, raw } = acquired;
      await connection.query(
        'INSERT INTO checko_profiles (inn,payload,raw_payload,fetched_at,updated_at) VALUES ($1,$2,$3,$4,$4) ON CONFLICT (inn) DO UPDATE SET payload=excluded.payload,raw_payload=excluded.raw_payload,fetched_at=excluded.fetched_at,updated_at=excluded.updated_at',
        [inn, JSON.stringify(profile), raw, profile.fetchedAt],
      );
      await connection.query('COMMIT');
      return { profile, status: 'READY' };
    } catch (e) {
      await connection.query('ROLLBACK');
      throw e;
    } finally {
      connection.release();
    }
  }
  const promise = refresh();
  requests.set(inn, promise);
  try {
    return await promise;
  } finally {
    requests.delete(inn);
  }
}
