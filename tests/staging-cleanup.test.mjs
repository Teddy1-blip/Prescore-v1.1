import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
const env={PRESCORE_BASE_URL:'https://prescore-staging-dorogovab.amvera.io',DATABASE_URL:'postgres://test:test@amvera-dorogovab-cnpg-prescore-stage-db-rw/test',AUTH_SECRET:'s'.repeat(40)};
test('one-time cleanup: staging/auth/confirmation/preview/atomic preservation',async()=>{
 const rt=await createWorkspaceRuntime();try{
  await rt.pg.exec(fs.readFileSync('lib/db/migrations/0002_platform_auth.sql','utf8'));
  await rt.pg.exec('CREATE TABLE prescore_schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz DEFAULT now())');
  const m=rt.load('lib/staging-cleanup.ts'),admin={email:m.ADMIN,roles:['CLIENT','AGENT','ADMIN']};
  for(const user of [null,{...admin,roles:['CLIENT']},{...admin,email:'other@test.invalid'}])assert.throws(()=>m.guard(user,env,m.ORIGIN),/FORBIDDEN/);
  assert.doesNotThrow(()=>m.guard(admin,env,m.ORIGIN));
  assert.throws(()=>m.guard(admin,{...env,PRESCORE_BASE_URL:'https://production.invalid'},m.ORIGIN),/STAGING_ORIGIN/);
  assert.throws(()=>m.guard(admin,{...env,DATABASE_URL:'postgres://test:test@production/db'},m.ORIGIN),/STAGING_DATABASE/);
  assert.throws(()=>m.guard(admin,env,'https://evil.invalid'),/STAGING_ORIGIN/);
  assert.ok(m.DELETE_TABLES.every(t=>!m.PRESERVE_TABLES.includes(t)));
  await rt.pg.query('INSERT INTO "user"(id,name,email) VALUES ($1,$2,$3)',['u','Admin',m.ADMIN]);
  for(const role of admin.roles)await rt.pg.query('INSERT INTO platform_roles VALUES ($1,$2)',['u',role]);
  await rt.pg.query('INSERT INTO agent_accounts(user_email,agent_code,name) VALUES ($1,$2,$3)',[m.ADMIN,m.AGENT,'Admin']);
  await rt.pg.query("INSERT INTO module_settings(module_key,label) VALUES ('overview','Overview')");
  await rt.pg.query("INSERT INTO control_settings(control_key,category,label) VALUES ('test','test','Test')");
  // Seed every delete candidate using its actual PostgreSQL column metadata.
  for(const table of m.DELETE_TABLES){
   const cols=(await rt.pg.query("SELECT column_name,data_type,column_default,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",[table])).rows;
   const required=cols.filter(c=>c.is_nullable==='NO'&&c.column_default===null);
   const values=required.map(c=>['bigint','integer'].includes(c.data_type)?1:c.column_name==='id'&&table==='analyses'?m.IDS[0]:c.column_name==='analysis_id'?m.IDS[0]:'test');
   await rt.pg.query(`INSERT INTO "${table}" (${required.map(c=>'"'+c.column_name+'"').join(',')}) VALUES (${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);
  }
  await rt.pg.query("INSERT INTO audit_log VALUES ('old','ANALYSIS','test','CREATE','ADMIN',$1,'{}','now'),('config','MODULE_SETTING','test','TOGGLE','ADMIN',$1,'{}','now')",[m.ADMIN]);
  const preview=await m.maintenance(rt.db.pool,env.AUTH_SECRET,{action:'staging-cleanup-preview'});
  assert.equal(preview.candidates.analyses,1);assert.equal(preview.preserve.user,1);assert.equal(preview.preserve.platform_roles,3);
  assert.equal(preview.knownAnalyses[m.IDS[0]],'FOUND');assert.equal(preview.candidates.audit_log,1);
  assert.equal((await rt.pg.query('SELECT count(*) FROM analyses')).rows[0].count,1);
  for(const confirmation of [undefined,'wrong'])await assert.rejects(()=>m.maintenance(rt.db.pool,env.AUTH_SECRET,{action:'staging-cleanup-execute',previewToken:preview.previewToken,confirmation}),/CONFIRMATION_REQUIRED/);
  await assert.rejects(()=>m.maintenance(rt.db.pool,env.AUTH_SECRET,{action:'staging-cleanup-execute',confirmation:m.PHRASE}),/PREVIEW_REQUIRED/);
  await rt.pg.query("UPDATE analyses SET company_name='changed'");
  await assert.rejects(()=>m.maintenance(rt.db.pool,env.AUTH_SECRET,{action:'staging-cleanup-execute',confirmation:m.PHRASE,previewToken:preview.previewToken}),/PREVIEW_STALE/);
  const current=await m.maintenance(rt.db.pool,env.AUTH_SECRET,{action:'staging-cleanup-preview'});
  // Inject failure after first DELETE and prove rollback leaves all records intact.
  let failed=false;const failurePool={connect:async()=>{const c=await rt.db.pool.connect();return{release:()=>c.release(),query:(sql,v)=>{if(sql.startsWith('DELETE FROM public."ai_messages"')){failed=true;throw Error('INJECTED');}return c.query(sql,v);}};}};
  await assert.rejects(()=>m.maintenance(failurePool,env.AUTH_SECRET,{action:'staging-cleanup-execute',confirmation:m.PHRASE,previewToken:current.previewToken}),/INJECTED/);assert.ok(failed);
  assert.equal((await rt.pg.query('SELECT count(*) FROM ai_usage')).rows[0].count,1);
  const result=await m.maintenance(rt.db.pool,env.AUTH_SECRET,{action:'staging-cleanup-execute',confirmation:m.PHRASE,previewToken:current.previewToken});
  assert.equal(result.committed,true);assert.ok(Object.values(result.after.candidates).every(n=>n===0));assert.equal(result.after.companies,0);
  assert.deepEqual(result.after.preserved,result.before.preserved);assert.deepEqual(result.after.preserve,result.before.preserve);
  assert.equal((await rt.pg.query('SELECT count(*) FROM audit_log')).rows[0].count,2);
  assert.equal((await rt.pg.query("SELECT count(*) FROM audit_log WHERE action='STAGING_CLIENT_DATA_CLEANUP'")).rows[0].count,1);
  const source=fs.readFileSync('app/api/admin/staging-cleanup/route.ts','utf8');assert.doesNotMatch(source,/export.*function GET/);assert.match(source,/guard\(user/);assert.doesNotMatch(source,/ensureSchema|CREATE TABLE/);
  await rt.pg.exec('CREATE TABLE unknown_client_data(id text)');await assert.rejects(()=>m.maintenance(rt.db.pool,env.AUTH_SECRET,{action:'staging-cleanup-preview'}),/UNEXPECTED_TABLE_CATALOG/);
 }finally{await rt.close();}
});
