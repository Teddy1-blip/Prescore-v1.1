import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {hashPassword} from 'better-auth/crypto';import pg from 'pg';import {randomUUID} from 'node:crypto';import {spawn} from 'node:child_process';import {createServer} from 'node:net';import {tmpdir} from 'node:os';import {join} from 'node:path';import {migrationRegistry,migrate,verifySchema,migrationStatus} from '../../lib/release/migrations.ts';
// Exercise the real startup contract without assuming an unmigrated DB is rejected:
// start.mjs applies migrations; release-candidate rejection serves diagnostics.
async function startupProbe(databaseURL,expectedCode=null){
 const root=await fs.mkdtemp(join(tmpdir(),'prescore-rc-startup-'));
 await fs.writeFile(join(root,'server.js'),"console.log('RC_SYNTHETIC_NEXT_REACHED');\n");
 const reservation=createServer();await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});
 const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const child=spawn(process.execPath,['--experimental-strip-types','scripts/release/start.mjs'],{
  detached:true,stdio:['ignore','pipe','pipe'],env:{...process.env,DATABASE_URL:databaseURL,PRESCORE_RUNTIME_MODE:'release-candidate',PRESCORE_STANDALONE_DIR:root,HOSTNAME:'127.0.0.1',PORT:String(port)},
 });
 let stdout='',stderr='',closed=false,spawnError;
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 child.on('error',e=>{spawnError=e;});const finished=new Promise(resolve=>child.once('close',()=>{closed=true;resolve();}));
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const kill=signal=>{try{process.kill(-child.pid,signal);}catch(e){if(e.code!=='ESRCH')throw e;}};
 try{
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
   if(spawnError)throw spawnError;
   if(!expectedCode&&stdout.includes('RC_SYNTHETIC_NEXT_REACHED'))return {result:'MIGRATED_AND_NEXT_REACHED'};
   if(expectedCode&&stdout.includes('STAGING_DIAGNOSTICS_LISTENING')){
    assert.equal(stdout.includes('RC_SYNTHETIC_NEXT_REACHED'),false,'incompatible schema must never launch Next');
    const base='http://127.0.0.1:'+port;
    const health=await fetch(base+'/api/health',{signal:AbortSignal.timeout(2000)});assert.equal(health.status,200);
    const h=await health.json();assert.equal(h.ready,false);assert.equal(h.startup,'FAILED');assert.equal(h.diagnostic.code,expectedCode);
    const ready=await fetch(base+'/api/ready',{signal:AbortSignal.timeout(2000)});assert.equal(ready.status,503);assert.equal((await ready.json()).diagnostic.code,expectedCode);
    for(const path of ['/dashboard','/api/workspace','/api/auth/session']){const r=await fetch(base+path,{signal:AbortSignal.timeout(2000)});assert.equal(r.status,503);await r.arrayBuffer();}
    return {result:'STARTUP_REJECTED',code:expectedCode};
   }
   if(closed)throw Error('RC_STARTUP_PROBE_EARLY_EXIT:'+String(child.exitCode));
   await pause(50);
  }
  const rejection=stderr.split('\n').find(line=>line.startsWith('{"event":"STARTUP_REJECTED"'));
  throw Error('RC_STARTUP_PROBE_TIMEOUT'+(rejection?':'+JSON.parse(rejection).code:''));
 }finally{
  // spawnSync's timeout sends SIGTERM but can keep waiting forever when the
  // startup parent has installed a handler and its diagnostic listener remains.
  if(child.pid){kill('SIGTERM');await Promise.race([finished,pause(500)]);kill('SIGKILL');}
  if(!closed)await Promise.race([finished,pause(2000).then(()=>{if(!closed)throw Error('RC_STARTUP_PROBE_CLEANUP_TIMEOUT');})]);
  await fs.rm(root,{recursive:true,force:true});
 }
}
const url=new URL(process.env.DATABASE_URL??'');if(process.env.RC_TEST_DATABASE!=='true'||!['localhost','127.0.0.1','postgres'].includes(url.hostname)||!url.pathname.startsWith('/prescore_rc'))throw Error('RC_TEST_DATABASE_REQUIRED');
const pool=new pg.Pool({connectionString:url.href,connectionTimeoutMillis:5000,query_timeout:15000,statement_timeout:15000}),registry=await migrationRegistry(),mode=process.argv[2]??'clean',report={mode,checks:[]};const check=s=>{report.checks.push(s);console.log(JSON.stringify({event:'RC_DATABASE_CHECK',mode,check:s}));};const phase=s=>console.log(JSON.stringify({event:'RC_DATABASE_STEP',mode,step:s}));try{
 phase('initial-migrations');
 if(mode==='upgrade'){const c=await pool.connect();try{await c.query('BEGIN');await c.query('CREATE TABLE prescore_schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');for(const m of registry.slice(0,5)){await c.query(m.sql);await c.query('INSERT INTO prescore_schema_migrations(version,checksum) VALUES($1,$2)',[m.version,m.checksum]);}await c.query('COMMIT');}finally{c.release();}
 // Representative pre-billing rows with all required/default columns populated by the actual legacy schema.
 const tables=['user','account','session','verification','platform_roles','agent_accounts','agent_leads','analyses','client_documents','deals','agent_applications','application_messages','application_status_history','ai_conversations','ai_messages','analysis_entitlements','payment_orders','payments','audit_log','module_settings','control_settings'];
 const manifest={};for(const table of tables){const columns=(await pool.query("SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",[table])).rows;if(!columns.length)continue;const values={},id='legacy-'+table;for(const column of columns){if(column.column_default!==null||column.is_nullable==='YES')continue;const k=column.column_name;values[k]=k==='role'?'CLIENT':['user_id','userId'].includes(k)?'legacy-user':column.data_type.includes('timestamp')?new Date().toISOString():column.data_type==='boolean'?true:['bigint','integer','numeric','double precision'].includes(column.data_type)?0:k==='id'?id:k.includes('email')?'legacy@rc.test':k==='company_inn'?'7700000000':k==='payload'?'{}':'legacy';}if(table==='user')Object.assign(values,{id:'legacy-user',email:'legacy@rc.test',name:'Legacy',emailVerified:true});if(table==='account')Object.assign(values,{accountId:'legacy-user',providerId:'credential',password:await hashPassword('Synthetic-legacy-password-123!')});if(table==='session')Object.assign(values,{token:'synthetic-legacy-session',expiresAt:new Date(Date.now()+86400000).toISOString()});const keys=Object.keys(values);await pool.query(`INSERT INTO "${table}"(${keys.map(k=>'"'+k+'"').join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT DO NOTHING`,Object.values(values));manifest[table]=(await pool.query(`SELECT row_to_json(t) AS row FROM "${table}" t ORDER BY row_to_json(t)::text`)).rows.map(r=>r.row);}
 await migrate(pool,registry);for(const [table,rows] of Object.entries(manifest))assert.deepEqual((await pool.query(`SELECT row_to_json(t) AS row FROM "${table}" t ORDER BY row_to_json(t)::text`)).rows.map(r=>r.row),table==='analyses'?rows.map(row=>({...row,archive_state:'ACTIVE',archived_at:null,archive_batch_id:null})):table==='user'&&registry.some(m=>m.version==='0010_admin_mfa.sql')?rows.map(row=>({...row,twoFactorEnabled:false})):rows,table);check('legacy records/auth/roles/documents/entitlements/accounting preserved');assert.equal(Number((await pool.query('SELECT count(*) AS n FROM billing_subscriptions')).rows[0].n),0);check('no accidental billing subscriptions');
 }else{await Promise.all([migrate(pool,registry),migrate(pool,registry)]);check('two actual PostgreSQL migrators serialized');await migrate(pool,registry);check('safe repeat');}
 phase('rollback-probe');
 const failName='prescore_rc_failure_'+randomUUID().replaceAll('-','');await pool.query('CREATE DATABASE "'+failName+'"');
 const failURL=new URL(url);failURL.pathname='/'+failName;
 const failPool=new pg.Pool({connectionString:failURL.href,connectionTimeoutMillis:5000,query_timeout:15000,statement_timeout:15000});
 try{
  const broken=registry.map(m=>({...m}));broken[2].sql+='\nSELECT * FROM rc_injected_missing_table;';
  await assert.rejects(migrate(failPool,broken));
  assert.equal((await failPool.query("SELECT to_regclass('analyses') AS name")).rows[0].name,null);
  await assert.rejects(verifySchema(failPool,registry),/MIGRATION_REQUIRED/);
  assert.equal((await failPool.query('SELECT pg_try_advisory_xact_lock(6419818) AS acquired')).rows[0].acquired,true);
  check('actual halfway rollback, missing schema rejected, migration lock released');
  phase('startup-applies-pending-migrations');
  assert.equal((await startupProbe(failURL.href)).result,'MIGRATED_AND_NEXT_REACHED');
  await verifySchema(failPool,registry);await migrate(failPool,registry);
  check('actual startup retries rolled-back migration before Next; safe repeat');
  phase('startup-rejects-incompatible-schema');
  await failPool.query("INSERT INTO prescore_schema_migrations(version,checksum) VALUES('9999_future.sql','future')");
  const before=(await failPool.query('SELECT * FROM prescore_schema_migrations ORDER BY version')).rows;
  assert.equal((await startupProbe(failURL.href,'SCHEMA_VERSION_INCOMPATIBLE')).result,'STARTUP_REJECTED');
  assert.deepEqual((await failPool.query('SELECT * FROM prescore_schema_migrations ORDER BY version')).rows,before);
  check('incompatible startup denies ready and product APIs, never launches Next, preserves history');
  await failPool.query("DELETE FROM prescore_schema_migrations WHERE version='9999_future.sql'");
  await migrate(failPool,registry);await verifySchema(failPool,registry);check('rejected startup releases lock and compatible retry succeeds');
 }finally{await failPool.end();await pool.query('DROP DATABASE "'+failName+'"');}
 phase('catalog-and-checksum-guards');
 await verifySchema(pool,registry);check('catalog + append-only guards');const applied=await migrationStatus(pool,registry);assert.equal(applied.applied.length,registry.length);await pool.query('UPDATE prescore_schema_migrations SET checksum=$1 WHERE version=$2',['tampered',registry.at(-1).version]);await assert.rejects(migrate(pool,registry),/CHECKSUM/);await pool.query('UPDATE prescore_schema_migrations SET checksum=$1 WHERE version=$2',[registry.at(-1).checksum,registry.at(-1).version]);check('checksum mismatch rejected');await pool.query("INSERT INTO prescore_schema_migrations(version,checksum) VALUES('9999_future.sql','future')");await assert.rejects(verifySchema(pool,registry),/INCOMPATIBLE/);await pool.query("DELETE FROM prescore_schema_migrations WHERE version='9999_future.sql'");check('unknown future / older application rejected');await assert.rejects(verifySchema(pool,registry.slice(0,6)),/INCOMPATIBLE/);check('old registry against newer schema rejected');report.pass=true;await fs.mkdir(process.env.RC_REPORT_DIR??'/tmp/rc-reports',{recursive:true});await fs.writeFile((process.env.RC_REPORT_DIR??'/tmp/rc-reports')+'/migration-'+mode+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await pool.end();}
