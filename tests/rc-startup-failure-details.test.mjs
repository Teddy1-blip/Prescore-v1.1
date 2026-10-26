/** Actual startup driver/HTTP diagnostics with synthetic import/DB boundaries.
 * No deployed endpoints, real credentials, PostgreSQL, migrations or retries. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFile} from 'node:child_process';
import * as diagnostic from '../scripts/release/startup-diagnostic.mjs';
const secret='postgresql://private:SECRET_SENTINEL@private-host/db SELECT private_table';

for(const [nativeCode,expected] of [
 ['ECONNRESET','DATABASE_CONNECTION_RESET'],['EPIPE','DATABASE_CONNECTION_CLOSED'],
 ['ENOENT','RUNTIME_FILE_NOT_FOUND'],['ERR_MODULE_NOT_FOUND','RUNTIME_MODULE_NOT_FOUND'],
 ['ERR_PACKAGE_PATH_NOT_EXPORTED','RUNTIME_PACKAGE_EXPORT_MISSING'],
 ['42P01','DATABASE_UNDEFINED_TABLE'],['42703','DATABASE_UNDEFINED_COLUMN'],
 ['42501','DATABASE_PERMISSION_DENIED'],['23505','DATABASE_UNIQUE_VIOLATION'],
 ['57014','DATABASE_QUERY_CANCELLED'],['57P01','DATABASE_ADMIN_SHUTDOWN'],
 ['57P03','DATABASE_NOT_READY'],['53300','DATABASE_CONNECTION_LIMIT'],
])test(`startup classifies ${nativeCode} without error content`,()=>{
 const error=Object.assign(Error(secret),{code:nativeCode});
 assert.equal(diagnostic.classifyStartupFailure(error),expected);
 const details=diagnostic.startupFailureDetails(error);
 assert.deepEqual(details,{errorType:'Error',nativeCode});
 assert.ok(!JSON.stringify(details).includes('SECRET_SENTINEL'));
});

test('nested and AggregateError causes are bounded and identified without logging children',()=>{
 const root=Object.assign(Error(secret),{code:'ECONNREFUSED'});
 const wrapped=new AggregateError([new Error(secret,{cause:root})],secret);
 assert.equal(diagnostic.classifyStartupFailure(wrapped),'DATABASE_CONNECTION_REFUSED');
 assert.deepEqual(diagnostic.startupFailureDetails(wrapped),{errorType:'AggregateError',nativeCode:'ECONNREFUSED'});
 const cyclic=Error(secret);cyclic.cause=cyclic;
 assert.equal(diagnostic.classifyStartupFailure(cyclic),'OPERATION_FAILED');
 assert.deepEqual(diagnostic.startupFailureDetails(cyclic),{errorType:'Error'});
});

test('exact code-less connection errors are classified; arbitrary text stays private',()=>{
 for(const message of ['Connection terminated due to connection timeout','timeout exceeded when trying to connect']){
  assert.equal(diagnostic.classifyStartupFailure(Error(message)),'DATABASE_CONNECTION_TIMEOUT');
 }
 assert.equal(diagnostic.classifyStartupFailure(Error('Connection terminated unexpectedly')),'DATABASE_CONNECTION_TERMINATED');
 assert.equal(diagnostic.classifyStartupFailure(Error('Connection terminated '+secret)),'OPERATION_FAILED');
 assert.equal(diagnostic.classifyStartupFailure(Error('MIGRATION_CHECKSUM_MISMATCH')),'MIGRATION_CHECKSUM_MISMATCH');
});

test('new public diagnostic fields use finite allowlists and discard forged fields',()=>{
 const r=diagnostic.safeStartupReport({stage:'DATABASE_MIGRATION',step:'MIGRATION_APPLY',code:'DATABASE_UNDEFINED_TABLE',nativeCode:'42P01',errorType:'Error',message:secret,stack:secret,detail:secret,query:secret});
 assert.equal(r.version,'PRESCORE-STARTUP-DIAGNOSTIC-2');
 assert.equal(r.step,'MIGRATION_APPLY');assert.equal(r.nativeCode,'42P01');assert.equal(r.errorType,'Error');
 assert.ok(!JSON.stringify(r).includes('SECRET_SENTINEL'));
 for(const field of ['step','nativeCode','errorType']){
  const bad=diagnostic.safeStartupReport({[field]:'PRIVATE_SECRET'});
  assert.equal(Object.hasOwn(bad,field),false);
 }
});

test('real health/ready carry the same safe failure details and never enable product routes',async()=>{
 const report={stage:'DATABASE_MIGRATION',step:'DB_CLIENT_IMPORT',code:'OPERATION_FAILED',errorType:'SyntaxError',message:secret,stack:secret};
 const server=await diagnostic.startStartupDiagnosticServer(report,{host:'127.0.0.1',port:0});
 const url='http://127.0.0.1:'+server.address().port;
 try{
  const health=await fetch(url+'/api/health'),h=await health.json();
  assert.equal(health.status,200);assert.equal(h.ready,false);assert.equal(h.startup,'FAILED');
  assert.equal(h.diagnostic.step,'DB_CLIENT_IMPORT');assert.equal(h.diagnostic.errorType,'SyntaxError');
  assert.ok(!JSON.stringify(h).includes('SECRET_SENTINEL'));
  const ready=await fetch(url+'/api/ready'),r=await ready.json();
  assert.equal(ready.status,503);assert.deepEqual(r.diagnostic,h.diagnostic);
  const blocked=await fetch(url+'/api/analysis',{method:'POST',body:'{}'});
  assert.equal(blocked.status,503);assert.deepEqual(await blocked.json(),{error:'SERVICE_UNAVAILABLE'});
 }finally{await new Promise(resolve=>server.close(resolve));}
});

async function runDriver(failure,code='42P01') {
 const root=await mkdtemp(join(tmpdir(),'prescore-startup-probe-'));
 const put=async(p,body)=>{await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),body);};
 const checkpoint=(step)=>`mark('${step}');${step===failure?`throw Object.assign(new Error(${JSON.stringify(secret)}),{code:${JSON.stringify(code)}});`:''}`;
 const prelude="import{appendFileSync}from'node:fs';const mark=x=>appendFileSync('events.txt',x+'\\n');\n";
 try{
  for(const p of ['start.mjs','startup-diagnostic.mjs'])await put('scripts/release/'+p,await readFile(new URL('../scripts/release/'+p,import.meta.url)));
  await put('package.json','{"type":"module"}');
  await put('lib/platform/environment.ts',prelude+checkpoint('ENVIRONMENT_IMPORT')+`export function validateEnvironment(){${checkpoint('ENVIRONMENT_VALIDATE')}return [];}`);
  await put('lib/db/client.ts',prelude+checkpoint('DB_CLIENT_IMPORT')+`export function getPool(){${checkpoint('POOL_CREATE')}return {async end(){mark('POOL_END');}};}`);
  await put('lib/release/migrations.ts',prelude+checkpoint('MIGRATIONS_IMPORT')+`export async function migrationRegistry(){${checkpoint('MIGRATION_REGISTRY')}return [{version:'SYNTHETIC'}];}export async function migrate(pool,registry){if(registry[0].version!=='SYNTHETIC')throw Error('INVALID_TEST_REGISTRY');${checkpoint('MIGRATION_APPLY')}}export function safeOperationalCode(){return 'OPERATION_FAILED';}`);
  await put('lib/release/readiness.ts',prelude+checkpoint('READINESS_IMPORT')+`export async function readiness(){${checkpoint('READINESS_CHECK')}return {ready:true};}`);
  await put('server.js',prelude+"mark('NEXT_STARTED');");
  const result=await new Promise(resolve=>execFile(process.execPath,['--experimental-strip-types','scripts/release/start.mjs'],{
   cwd:root,timeout:5000,env:{PATH:process.env.PATH,PRESCORE_RUNTIME_MODE:'production',HOSTNAME:'127.0.0.1',PORT:'0'},
  },(error,stdout,stderr)=>resolve({exit:error?error.code:0,stdout,stderr})));
  const events=(await readFile(join(root,'events.txt'),'utf8')).trim().split('\n');
  const line=result.stderr.split('\n').find(s=>s.startsWith('{"event":"STARTUP_REJECTED"'));
  return {...result,events,report:line?JSON.parse(line):null};
 }finally{await rm(root,{recursive:true,force:true});}
}

for(const step of ['ENVIRONMENT_IMPORT','ENVIRONMENT_VALIDATE','DB_CLIENT_IMPORT','MIGRATIONS_IMPORT','READINESS_IMPORT','POOL_CREATE','MIGRATION_REGISTRY','MIGRATION_APPLY','READINESS_CHECK']){
 test(`actual startup reports ${step} and does not launch Next after failure`,async()=>{
  const r=await runDriver(step,'42P01');
  assert.equal(r.exit,1);assert.equal(r.report.step,step);assert.equal(r.report.nativeCode,'42P01');
  assert.equal(r.report.code,'DATABASE_UNDEFINED_TABLE');assert.equal(r.events.includes('NEXT_STARTED'),false);
  assert.ok(!(r.stdout+r.stderr).includes('SECRET_SENTINEL'));
  if(r.events.includes('MIGRATION_REGISTRY'))assert.equal(r.events.at(-1),'POOL_END');
 });
}

test('successful actual startup retains registry → migration → readiness → pool close → Next order',async()=>{
 const r=await runDriver(null);
 assert.equal(r.exit,0);assert.equal(r.report,null);
 assert.deepEqual(r.events,['ENVIRONMENT_IMPORT','ENVIRONMENT_VALIDATE','DB_CLIENT_IMPORT','MIGRATIONS_IMPORT','READINESS_IMPORT','POOL_CREATE','MIGRATION_REGISTRY','MIGRATION_APPLY','READINESS_CHECK','POOL_END','NEXT_STARTED']);
});

test('uncoded import failure still identifies exact step while withholding raw error',async()=>{
 const r=await runDriver('DB_CLIENT_IMPORT','UNRECOGNIZED_SECRET');
 assert.equal(r.exit,1);assert.equal(r.report.step,'DB_CLIENT_IMPORT');
 assert.equal(r.report.code,'OPERATION_FAILED');assert.equal(r.report.errorType,'Error');
 assert.equal(Object.hasOwn(r.report,'nativeCode'),false);
 assert.ok(!(r.stdout+r.stderr).includes('SECRET_SENTINEL'));assert.ok(!r.stderr.includes('UNRECOGNIZED_SECRET'));
});
