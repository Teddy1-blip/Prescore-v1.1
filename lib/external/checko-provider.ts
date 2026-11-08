import { boundedBytes } from './provider-http.ts';
import { checkoMethods, checkedBody, type Bodies, type Failures } from './checko.ts';
import { normalizeProfile } from './checko-profile.ts';
const SAFE_ERRORS = new Set([
  'PROVIDER_SIZE_LIMIT',
  'SOURCE_IDENTITY_UNKNOWN',
  'SOURCE_IDENTITY_MISMATCH',
  'SOURCE_SHAPE_UNSUPPORTED',
]);
export function providerError(e: unknown) {
  return e instanceof Error && (SAFE_ERRORS.has(e.message) || /^PROVIDER_HTTP_[45]\d{2}$/.test(e.message))
    ? e.message
    : 'PROVIDER_RESPONSE_FAILED';
}
export async function acquireChecko(inn: string, key: string, fetcher: typeof fetch = fetch) {
  const methods = checkoMethods(inn),
    bodies: Bodies = {},
    failures: Failures = {};
  async function request(method: string) {
    const [path, law] = method.split(':');
    const params: Record<string, unknown> = { key, inn };
    if (law) Object.assign(params, { law, sort: '-date' });
    const res = await fetcher('https://api.checko.ru/v2/' + path, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw Error('PROVIDER_HTTP_' + res.status);
    }
    const bytes = await boundedBytes(res, 2 * 1024 * 1024);
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (body?.meta?.status !== 'ok') throw Error('PROVIDER_RESPONSE_FAILED');
    checkedBody(method, body, inn);
    // Keep only the established data envelope; billing metadata and error text are never retained.
    bodies[method] = {
      data: body.data,
      company: body.company,
      entrepreneur: body.entrepreneur,
      ...(method === 'finances'
        ? {
            meta: {
              ...('currency' in body.meta ? { currency: body.meta.currency } : {}),
              ...('scale' in body.meta ? { scale: body.meta.scale } : {}),
            },
          }
        : {}),
    };
  }
  await request(methods[0]);
  await Promise.all(
    methods.slice(1).map(async (m) => {
      try {
        await request(m);
      } catch (e) {
        failures[m] = providerError(e);
      }
    }),
  );
  const at = new Date().toISOString();
  return {
    profile: normalizeProfile(inn, bodies, failures, at),
    raw: JSON.stringify({ retrievedAt: at, responses: bodies }),
  };
}
