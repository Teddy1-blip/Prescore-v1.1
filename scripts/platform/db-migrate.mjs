import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getPool } from '../../lib/db/client.ts';
const dir=new URL('../../lib/db/migrations/',import.meta.url);
const files=(await readdir(dir)).filter(x=>/^\d+_[a-z_]+\.sql$/.test(x)).sort();
if(process.argv.includes('--dry-run')){console.log(JSON.stringify({mode:'DRY_RUN',files}));process.exit(0);}
const pool=getPool(),client=await pool.connect();
try{
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(6419818)');
 await client.query('CREATE TABLE IF NOT EXISTS prescore_schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
 for(const file of files){
  const sql=await readFile(new URL(file,dir),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
  const previous=await client.query('SELECT checksum FROM prescore_schema_migrations WHERE version=$1',[file]);
  if(previous.rows.length){if(previous.rows[0].checksum!==checksum)throw new Error('MIGRATION_CHECKSUM_MISMATCH');continue;}
  await client.query(sql);await client.query('INSERT INTO prescore_schema_migrations(version,checksum) VALUES($1,$2)',[file,checksum]);
 }
 await client.query('COMMIT');console.log(JSON.stringify({status:'APPLIED',versions:files}));
}catch{await client.query('ROLLBACK');console.error('MIGRATION_FAILED_ROLLED_BACK');process.exitCode=1;}
finally{client.release();await pool.end();}
