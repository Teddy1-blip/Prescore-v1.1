import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {verifyStorage} from '../lib/release/readiness.ts';
import {runtimeVersion} from '../lib/release/version.ts';

test('startup storage verifies write/read and rejects symlink escape',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rc-root-'));
 try{
  assert.equal(await verifyStorage(root),'READY');
  assert.deepEqual(fs.readdirSync(root),[]);
  fs.symlinkSync(root,root+'-link');
  await assert.rejects(verifyStorage(root+'-link'),/SYMLINK/);
  fs.unlinkSync(root+'-link');
  await assert.rejects(verifyStorage('/'),/INVALID/);
 }finally{
  fs.rmSync(root,{recursive:true,force:true});
 }
});

test('portable artifact includes one app/worker image, PostgreSQL 17 backup tools and public version excludes secrets',()=>{
 const version=runtimeVersion({DATABASE_URL:'must-not-leak',AUTH_SECRET:'must-not-leak',PRESCORE_SOURCE_SHA:'a'.repeat(40)});
 assert.equal(version.sourceSha,'a'.repeat(40));
 assert.equal(version.schemaVersion,'0009_analysis_archive.sql');
 assert.ok(!JSON.stringify(version).includes('must-not-leak'));
 const docker=fs.readFileSync('Dockerfile','utf8');
 assert.match(docker,/USER node/);
 assert.match(docker,/npm ci/);
 assert.match(docker,/package-runtime/);
 assert.match(docker,/postgresql-client-17/);
 assert.match(docker,/pg_dump --version/);
 assert.match(docker,/prescore\.schema="0009_analysis_archive\.sql"/);
 assert.doesNotMatch(docker,/COPY.*\.env|AUTH_SECRET=/);
 assert.match(fs.readFileSync('docker-compose.rc.yml','utf8'),/prescore-worker:/);
});

test('app and worker apply pending migrations before readiness',()=>{
 for(const file of ['scripts/release/start.mjs','scripts/billing/payout-worker.mjs']){
  const source=fs.readFileSync(file,'utf8');
  assert.match(source,/await migrate\(pool,await migrationRegistry\(\)\)/,`${file} must run the canonical migration registry`);
  const migration=source.indexOf('await migrate(');
  const ready=source.indexOf('await readiness(');
  assert.ok(migration>=0&&ready>migration,`${file} must migrate before checking readiness`);
  assert.match(source,/safeOperationalCode\(error\)/,`${file} must expose only safe operational failure codes`);
 }
});
