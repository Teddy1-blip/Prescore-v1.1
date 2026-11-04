import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {migrationRegistry,migrate,migrationStatus,verifySchema} from '../lib/release/migrations.ts';import {bootstrapAdmin} from '../lib/release/bootstrap.ts';
async function fixture(){const pg=new PGlite();const q=async(s,v)=>{if(s.includes('pg_advisory_xact_lock'))return {rows:[]};if(/CREATE TABLE|ALTER TABLE|CREATE INDEX|CREATE OR REPLACE|CREATE TRIGGER/.test(s)&&!v){await pg.exec(s);return{rows:[]};}const r=await pg.query(s,v);return {rows:r.rows,rowCount:r.affectedRows};};return {pg,pool:{query:q,connect:async()=>({query:q,release(){}})}};}
test('migration registry, clean catalog, repeat and explicit idempotent admin bootstrap',async()=>{const {pg,pool}=await fixture();try{const registry=await migrationRegistry();assert.equal((await migrationStatus(pool,registry)).current,false);await migrate(pool,registry);assert.equal((await verifySchema(pool,registry)).current,true);await pg.query('DROP INDEX analyses_owner_company_date');await assert.rejects(verifySchema(pool,registry),/INDEX_MISSING/);await pg.query('CREATE INDEX analyses_owner_company_date ON analyses(owner_email,company_inn,created_at DESC,id)');await migrate(pool,registry);assert.equal((await pg.query('SELECT count(*) AS n FROM prescore_schema_migrations')).rows[0].n,registry.length);await pg.query(`INSERT INTO "user"(id,name,email,"emailVerified") VALUES('u','Owner','owner@rc.test',true)`);assert.equal((await bootstrapAdmin(pool,' OWNER@RC.TEST ')).state,'APPLIED');assert.equal((await bootstrapAdmin(pool,'owner@rc.test')).state,'ALREADY_APPLIED');assert.equal((await pg.query('SELECT count(*) AS n FROM audit_log')).rows[0].n,1);await pg.query("UPDATE prescore_schema_migrations SET checksum='changed' WHERE version=$1",[registry[0].version]);await assert.rejects(migrate(pool,registry),/CHECKSUM/);}finally{await pg.close();}});
test('failed migration rolls back history/data and retry works; unknown future schema fails closed',async()=>{const {pg,pool}=await fixture();try{const registry=await migrationRegistry();const broken=registry.map(m=>({...m}));broken[2].sql+='\nSELECT * FROM no_such_table;';await assert.rejects(migrate(pool,broken));assert.equal((await pg.query("SELECT to_regclass('analyses') AS n")).rows[0].n,null);await migrate(pool,registry);await pg.query("INSERT INTO prescore_schema_migrations(version,checksum) VALUES('9999_future.sql','unknown')");await assert.rejects(verifySchema(pool,registry),/INCOMPATIBLE/);}finally{await pg.close();}});

test('0009 to 0010: interrupted MFA migration rolls back, preserves data and retries once',async()=>{
 const {pg,pool}=await fixture();const registry=await migrationRegistry(),previous=registry.slice(0,-1),last=registry.at(-1);
 try{
  assert.equal(last.version,'0010_admin_mfa.sql');
  await pg.exec('CREATE TABLE prescore_schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const m of previous){await pg.exec(m.sql);await pg.query('INSERT INTO prescore_schema_migrations(version,checksum) VALUES($1,$2)',[m.version,m.checksum]);}
  await pg.query(`INSERT INTO "user"(id,name,email,"emailVerified") VALUES('mfa-owner','Synthetic','mfa-owner@rc.test',true)`);
  await pg.query(`INSERT INTO platform_roles(user_id,role) VALUES('mfa-owner','ADMIN')`);
  await pg.query(`INSERT INTO "session"(id,"userId",token,"expiresAt") VALUES('mfa-session','mfa-owner','synthetic-only',now()+interval '1 day')`);
  await pg.query(`INSERT INTO analyses(id,company_name,company_inn,file_name,period_from,period_to,score,grade,readiness,payload,owner_email) VALUES('mfa-analysis','Synthetic','9900000010','synthetic.txt','2026-01-01','2026-06-30',0,'UNKNOWN','UNKNOWN','{"provenance":"synthetic","amount":123.45}','mfa-owner@rc.test')`);
  await pg.query(`INSERT INTO client_documents(id,company_inn,analysis_id,category,file_name,mime_type,size_bytes,content_base64,uploaded_by,owner_email) VALUES('mfa-doc','9900000010','mfa-analysis','OTHER','synthetic.txt','text/plain',1,'eA==','mfa-owner@rc.test','mfa-owner@rc.test')`);
  const preserved=['user','session','platform_roles','analyses','client_documents','prescore_schema_migrations'];
  const snapshot=async()=>Object.fromEntries(await Promise.all(preserved.map(async table=>[table,(await pg.query(`SELECT * FROM "${table}" ORDER BY 1`)).rows])));
  const before=await snapshot();
  const interrupt={query:pool.query,connect:async()=>({release(){},query:async(sql,params)=>{
   if(sql.startsWith('INSERT INTO prescore_schema_migrations')&&params?.[0]===last.version)throw Error('SYNTHETIC_INTERRUPTION_AFTER_MFA_DDL');
   return pool.query(sql,params);
  }})};
  await assert.rejects(migrate(interrupt,registry),/SYNTHETIC_INTERRUPTION/);
  assert.deepEqual(await snapshot(),before);
  assert.equal((await pg.query(`SELECT to_regclass('"twoFactor"') AS factor,to_regclass('platform_admin_mfa_sessions') AS proof`)).rows[0].factor,null);
  assert.equal((await migrationStatus(pool,registry)).pending[0],last.version);
  await migrate(pool,registry);await verifySchema(pool,registry);
  const after=await snapshot();for(const table of preserved){if(table==='prescore_schema_migrations'){assert.deepEqual(after[table].slice(0,-1),before[table]);continue;}assert.deepEqual(after[table],table==='user'?before[table].map(row=>({...row,twoFactorEnabled:false})):before[table],table);}
  await migrate(pool,registry);assert.deepEqual(await snapshot(),after);
  await assert.rejects(verifySchema(pool,previous),/SCHEMA_VERSION_INCOMPATIBLE/);
  await pg.query(`INSERT INTO "twoFactor"(id,"userId",secret,"backupCodes") VALUES('factor','mfa-owner','synthetic-encrypted-secret','synthetic-encrypted-codes')`);
  await assert.rejects(pg.query(`INSERT INTO "twoFactor"(id,"userId",secret,"backupCodes") VALUES('duplicate','mfa-owner','x','y')`),/unique/i);
  await assert.rejects(pg.query(`UPDATE "twoFactor" SET "failedVerificationCount"=-1`),/check/i);
  await assert.rejects(pg.query(`INSERT INTO platform_admin_mfa_sessions VALUES('missing','mfa-owner',now(),'TOTP')`),/foreign key/i);
  await assert.rejects(pg.query(`INSERT INTO platform_admin_mfa_sessions VALUES('mfa-session','mfa-owner',now(),'PASSWORD')`),/check/i);
  await pg.query(`INSERT INTO platform_admin_mfa_sessions VALUES('mfa-session','mfa-owner',now(),'BACKUP')`);
  await pg.query(`DELETE FROM "session" WHERE id='mfa-session'`);assert.equal((await pg.query('SELECT * FROM platform_admin_mfa_sessions')).rows.length,0);
  assert.equal((await pg.query('SELECT secret FROM "twoFactor"')).rows[0].secret,'synthetic-encrypted-secret');
  for(const ddl of ['DROP INDEX prescore_admin_mfa_user_idx','ALTER TABLE "twoFactor" DROP CONSTRAINT "twoFactor_userId_key"','ALTER TABLE platform_admin_mfa_sessions DROP CONSTRAINT platform_admin_mfa_sessions_session_id_fkey','ALTER TABLE platform_admin_mfa_sessions DROP CONSTRAINT platform_admin_mfa_sessions_method_check','ALTER TABLE "user" ALTER COLUMN "twoFactorEnabled" SET DEFAULT true','ALTER TABLE "twoFactor" ALTER COLUMN "backupCodes" DROP NOT NULL']){
   await pg.query('BEGIN');try{await pg.query(ddl);await assert.rejects(verifySchema(pool,registry),/SCHEMA_MFA_/);}finally{await pg.query('ROLLBACK');}
  }
  await verifySchema(pool,registry);
 }finally{await pg.close();}
});
