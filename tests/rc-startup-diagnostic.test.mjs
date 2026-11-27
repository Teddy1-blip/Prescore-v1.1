import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {startStartupDiagnosticServer,classifyStartupFailure,safeStartupReport} from '../scripts/release/startup-diagnostic.mjs';

test('RC startup diagnostics report only whitelisted codes and never secrets',()=>{
 const sensitive='postgresql://private:password@secret-host/db';
 const report=safeStartupReport({stage:'CONFIGURATION',code:'CONFIGURATION_INVALID',issues:[
  {variable:'DATABASE_URL',code:'DATABASE_URL_INVALID_OR_MISSING',value:sensitive},
  {variable:sensitive,code:sensitive},
 ]});
 const json=JSON.stringify(report);
 assert.ok(!json.includes(sensitive));
 assert.deepEqual(report.issues[0],{variable:'DATABASE_URL',code:'DATABASE_URL_INVALID_OR_MISSING'});
 assert.deepEqual(report.issues[1],{variable:'UNKNOWN',code:'CONFIGURATION_INVALID'});
 assert.equal(classifyStartupFailure({code:'ENOTFOUND',message:sensitive}),'DATABASE_HOST_NOT_FOUND');
 assert.equal(classifyStartupFailure({code:'28P01',message:sensitive}),'DATABASE_AUTH_FAILED');
 assert.equal(classifyStartupFailure(Error(sensitive)),'OPERATION_FAILED');
});

test('diagnostic HTTP serves health and denies readiness and all product endpoints',async()=>{
 const server=await startStartupDiagnosticServer({stage:'DATABASE_MIGRATION',code:'DATABASE_HOST_NOT_FOUND'},{host:'127.0.0.1',port:0});
 try{
  const address=server.address(),base='http://127.0.0.1:'+address.port;
  const health=await fetch(base+'/api/health');
  assert.equal(health.status,200);
  const h=await health.json();
  assert.equal(h.releaseId,'PRESCORE-V1-RC3-20261019');
  assert.equal(h.startup,'FAILED');
  assert.equal(h.ready,false);
  assert.equal(h.diagnostic.code,'DATABASE_HOST_NOT_FOUND');
  const ready=await fetch(base+'/api/ready');
  assert.equal(ready.status,503);
  assert.equal((await ready.json()).ready,false);
  for(const target of ['/dashboard','/api/auth/session','/api/analysis']){
   const response=await fetch(base+target);
   assert.equal(response.status,503);
   assert.deepEqual(await response.json(),{error:'SERVICE_UNAVAILABLE'});
  }
  const mutate=await fetch(base+'/api/analysis',{method:'POST'});
  assert.equal(mutate.status,503);
 }finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});

test('startup preflight preserves migration before readiness and production fail-closed',async()=>{
 const start=await readFile(new URL('../scripts/release/start.mjs',import.meta.url),'utf8');
 assert.match(start,/await migrate\(pool,await migrationRegistry\(\)\)/);
 assert.ok(start.indexOf('await readiness(pool)')>start.indexOf('await migrate(pool,await migrationRegistry())'));
 assert.match(start,/safeOperationalCode\(error\)/);
 assert.match(start,/if\(!isStaging\)\{process.exitCode=1;return;\}/);
});

test('release artifact packages diagnostics and Docker probes process health separately',async()=>{
 const pack=await readFile(new URL('../scripts/release/package-runtime.mjs',import.meta.url),'utf8');
 const validator=await readFile(new URL('../scripts/platform/validate-artifact.mjs',import.meta.url),'utf8');
 const docker=await readFile(new URL('../Dockerfile',import.meta.url),'utf8');
 assert.match(pack,/scripts\/release/);
 assert.match(validator,/scripts\/release\/startup-diagnostic\.mjs/);
 assert.match(docker,/HEALTHCHECK.*\/api\/health/);
});
