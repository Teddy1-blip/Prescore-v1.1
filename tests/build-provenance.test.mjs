import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fingerprintInputs,prepareProvenance,packageProvenance,verifyCheckout} from '../scripts/release/build-provenance.mjs';
import {readPackagedProvenance} from '../lib/release/build-provenance.ts';
const rootFile=new URL('../lib/release/version.ts',import.meta.url).pathname;
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'prescore-build-provenance-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const dir of ['app','lib/release','.next/standalone','.next'])fs.mkdirSync(path.join(root,dir),{recursive:true});
 for(const [file,text] of Object.entries({'app/page.tsx':'export default 1;','package.json':'{}','package-lock.json':'{"lockfileVersion":3}','Dockerfile':'FROM node:22','.next/BUILD_ID':'isolated-build','.next/standalone/server.js':'// packaged server'}))fs.writeFileSync(path.join(root,file),text);
 return root;
}
test('fingerprint uses real bytes, sorted paths and lockfile, not environment SHA',t=>{
 const r=fixture(t),a=fingerprintInputs(r),b=fingerprintInputs(r);assert.deepEqual(a,b);
 fs.writeFileSync(path.join(r,'app/page.tsx'),'export default 2;');assert.notEqual(a.sha256,fingerprintInputs(r).sha256);
 const c=fingerprintInputs(r);fs.writeFileSync(path.join(r,'package-lock.json'),'{}');assert.notEqual(c.sha256,fingerprintInputs(r).sha256);assert.notEqual(c.lockSha256,fingerprintInputs(r).lockSha256);
});
test('missing git stays unavailable; prepared inputs are preserved in standalone',t=>{
 const r=fixture(t),before=prepareProvenance(r);assert.deepEqual(before.checkout,{status:'UNAVAILABLE',commit:null,tree:null});
 const m=packageProvenance(r),p=path.join(r,'.next/standalone/lib/release/build-provenance.json');
 assert.deepEqual(readPackagedProvenance(p),m);assert.deepEqual(m.inputs,before.inputs);assert.equal(m.buildId,'isolated-build');assert.equal(m.runningImageDigest,null);
});
test('changing a selected input after build preparation rejects packaging',t=>{
 const r=fixture(t);prepareProvenance(r);fs.writeFileSync(path.join(r,'app/page.tsx'),'changed');assert.throws(()=>packageProvenance(r),/BUILD_INPUTS_CHANGED_DURING_BUILD/);
});
test('missing preparation cannot invent post-build provenance',t=>assert.throws(()=>packageProvenance(fixture(t)),/ENOENT/));
test('excluded documentation and build outputs do not alter the defined source scope',t=>{
 const r=fixture(t),before=fingerprintInputs(r);fs.mkdirSync(path.join(r,'docs'));fs.writeFileSync(path.join(r,'docs/status.md'),'report');fs.writeFileSync(path.join(r,'.next/output'),'generated');assert.deepEqual(fingerprintInputs(r),before);
});
test('checkout identity requires matching real Git blob bytes and a clean status',t=>{
 const r=fixture(t),inputs=fingerprintInputs(r),snapshot={commit:'a'.repeat(40),tree:'b'.repeat(40),status:'',listing:inputs.files.map(f=>{const bytes=fs.readFileSync(path.join(r,f.path)),blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');return '100644 blob '+blob+'\t'+f.path+'\0';}).join('')};
 const p=verifyCheckout(r,inputs,snapshot);assert.deepEqual(p,{status:'MATCHED_LOCAL_CHECKOUT',commit:snapshot.commit,tree:snapshot.tree});
 assert.equal(verifyCheckout(r,inputs,{...snapshot,status:' M docs/report.md'}).commit,null);
 fs.writeFileSync(path.join(r,'app/page.tsx'),'dirty');const d=verifyCheckout(r,inputs,snapshot);assert.equal(d.status,'UNVERIFIED_DIRTY_CHECKOUT');assert.equal(d.commit,null);
 assert.equal(verifyCheckout(r,inputs,{...snapshot,commit:null}).status,'UNAVAILABLE');
});
test('runtime variables cannot impersonate missing or packaged artifact provenance; reads are stable',t=>{
 const r=fixture(t),probe=`import {runtimeVersion} from ${JSON.stringify(rootFile)};const a=runtimeVersion({PRESCORE_SOURCE_SHA:'a'.repeat(40),PRESCORE_BUILD_TIMESTAMP:'forged'});process.env.PRESCORE_SOURCE_SHA='b'.repeat(40);console.log(JSON.stringify([a,runtimeVersion()]));`;
 const run=()=>{const p=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',probe],{cwd:r,encoding:'utf8'});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);};
 let [a,b]=run();assert.equal(a.sourceSha,'UNKNOWN');assert.equal(a.buildTimestamp,'UNKNOWN');assert.deepEqual(a,b);assert.equal(a.buildProvenance.status,'UNAVAILABLE');
 prepareProvenance(r);const m=packageProvenance(r);fs.copyFileSync(path.join(r,'.next/standalone/lib/release/build-provenance.json'),path.join(r,'lib/release/build-provenance.json'));
 [a,b]=run();assert.equal(a.sourceSha,'UNKNOWN');assert.equal(a.buildTimestamp,m.packagedAt);assert.deepEqual(a,b);assert.equal(a.buildProvenance.sourceFingerprint,m.inputs.sha256);assert.equal(a.buildProvenance.runningImageDigest,null);
});
test('inconsistent fingerprint or fake git metadata fail closed',t=>{
 const r=fixture(t);prepareProvenance(r);const m=packageProvenance(r),p=path.join(r,'manifest.json');
 for(const change of [x=>x.inputs.files[0].sha256='0'.repeat(64),x=>x.checkout.commit='a'.repeat(40),x=>x.inputs.lockSha256='0'.repeat(64)]){const v=structuredClone(m);change(v);fs.writeFileSync(p,JSON.stringify(v));assert.equal(readPackagedProvenance(p),null);}
});
test('symlinked build inputs are rejected instead of following unbounded paths',t=>{
 const r=fixture(t);fs.symlinkSync('/etc/hosts',path.join(r,'app/linked'));assert.throws(()=>fingerprintInputs(r),/BUILD_INPUT_SYMLINK/);
});
