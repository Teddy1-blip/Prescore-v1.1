import { Pool, types } from 'pg';
import { PortableDatabase } from './compatibility.ts';
import catalog from './catalog.json' with {type: 'json'};

// SQLite exposed numbers. Reject unsafe integer conversion instead of losing money precision.
types.setTypeParser(20, value => {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('DATABASE_INTEGER_OUT_OF_RANGE');
  return result;
});
let pool: Pool | undefined;
let database: PortableDatabase | undefined;
export function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !/^postgres(?:ql)?:\/\//.test(connectionString)) throw new Error('DATABASE_CONFIGURATION_MISSING');
  pool = new Pool({connectionString, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 15000});
  if(process.env.PRESCORE_PROCESS_ROLE==='app')process.once('SIGTERM',()=>{void pool?.end();});
  pool.on('error', () => { console.error('POSTGRES_POOL_ERROR'); });
  return pool;
}
export function getDatabase() { return database ??= new PortableDatabase(getPool(), catalog); }
