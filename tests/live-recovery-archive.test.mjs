import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';
import {previewArchive,executeArchive,verifyArchive,restoreArchive} from '../lib/release/analysis-archive.ts';

function poolFor(rt){const query=async(sql,args)=>{const r=await rt.pg.query(sql,args);return {rows:r.rows,rowCount:r.affectedRows};};return {query,connect:async()=>({query,release(){}})};}
async function create(rt,inn,date){const r=await rt.request('/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({statements:[{fileName:'synthetic.txt',text:statementFixture({inn,company:'SYNTHETIC RECOVERY'})}]})});assert.equal(r.status,200);const a=(await r.json()).analysis;await rt.db.prepare('UPDATE analyses SET created_at=? WHERE id=?').bind(date,a.id).run();await rt.full(a.id);await rt.assign(a);await rt.db.prepare('UPDATE agent_leads SET created_at=? WHERE id=?').bind(date,'lead-'+a.id).run();return a;}
const cutoff='2026-10-18T00:00:00.000Z';
test('archive preview is read-only; exact boundary, idempotence, unchanged payload and explicit ADMIN archive access',async()=>{
 const rt=await createWorkspaceRuntime();try{
  const old=await create(rt,'9900000012','2026-10-17T23:59:59.000Z'),fresh=await create(rt,'9900000020',cutoff),pool=poolFor(rt);
  const payload=(await rt.db.prepare('SELECT payload FROM analyses WHERE id=?').bind(old.id).first()).payload;
  const plan=await previewArchive(pool,cutoff);assert.deepEqual(plan.records.map(r=>r.id),[old.id]);assert.equal(plan.count,1);
  assert.equal((await rt.db.prepare("SELECT count(*) AS n FROM analyses WHERE archive_state='ACTIVE'").first()).n,2);
  assert.equal((await executeArchive(pool,plan)).status,'ARCHIVED');assert.equal((await executeArchive(pool,plan)).status,'ALREADY_ARCHIVED');assert.equal((await verifyArchive(pool,plan)).postCutoverIncluded,0);
  assert.equal((await rt.db.prepare('SELECT payload FROM analyses WHERE id=?').bind(old.id).first()).payload,payload);
  const list=await(await rt.request('/api/workspace')).json();assert.deepEqual(list.analyses.map(a=>a.id),[fresh.id]);
  for(const user of [rt.owner,rt.broker,rt.admin])assert.equal((await rt.request('/api/workspace-model?analysisId='+old.id,{},user)).status,404);
  assert.equal((await rt.request('/api/workspace?client='+old.id,{},rt.broker)).status,404);
  assert.equal((await rt.request('/api/ai-analyst?analysisId='+old.id)).status,404);
  assert.equal((await rt.request('/api/ai-analyst',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({analysisId:old.id,question:'Что изменилось после добавления БФО?'})})).status,404);
  const active=await(await rt.request('/api/admin?resource=analyses',{},rt.admin)).json();assert.equal(active.total,1);
  const archived=await(await rt.request('/api/admin?resource=analyses&archive=archived',{},rt.admin)).json();assert.equal(archived.total,1);assert.equal(archived.items[0].archiveState,'LEGACY_PREPRODUCTION');
  assert.equal((await rt.request('/api/admin?resource=canonical&archive=archived&analysisId='+old.id,{},rt.admin)).status,200);
  assert.equal((await rt.request('/api/admin?resource=canonical&archive=archived&analysisId='+old.id,{},rt.owner)).status,403);
  const broker=await(await rt.request('/api/agent',{},rt.broker)).json();assert.ok(broker.leads.every(l=>l.companyInn!==old.companyInn));assert.ok(broker.leads.some(l=>l.analysisId===fresh.id));
  await rt.db.prepare("INSERT INTO agent_leads (id,agent_code,company_name,company_inn,email,created_at,consent_at) VALUES (?,?,?,?,?,?,?)").bind('new-lead-same-company','qa-broker','NEW REQUEST',old.companyInn,rt.owner.email,cutoff,cutoff).run();
  const renewed=await(await rt.request('/api/agent',{},rt.broker)).json();assert.ok(renewed.leads.some(l=>l.id==='new-lead-same-company'&&!l.analysisId),'new lead remains visible without exposing archived dossier');
  assert.equal((await rt.db.prepare('SELECT count(*) AS n FROM analysis_entitlements').first()).n,2);
  assert.equal((await restoreArchive(pool,plan.fingerprint)).status,'RESTORED');assert.equal((await restoreArchive(pool,plan.fingerprint)).status,'ALREADY_RESTORED');
  assert.equal((await rt.request('/api/workspace-model?analysisId='+old.id)).status,200);
 }finally{await rt.close();}
});
test('changed or tampered preview aborts atomically; post-cutover record is never included',async()=>{
 const rt=await createWorkspaceRuntime();try{const pool=poolFor(rt);await create(rt,'9900000012','2026-10-17T23:00:00.000Z');const plan=await previewArchive(pool,cutoff);
  await assert.rejects(executeArchive(pool,{...plan,count:2}),/ARCHIVE_PREVIEW_INVALID/);
  await create(rt,'9900000020','2026-10-17T22:00:00.000Z');await assert.rejects(executeArchive(pool,plan),/ARCHIVE_PREVIEW_CHANGED/);
  assert.equal((await rt.db.prepare('SELECT count(*) AS n FROM analysis_archive_batches').first()).n,0);
  assert.equal((await rt.db.prepare("SELECT count(*) AS n FROM analyses WHERE archive_state='ACTIVE'").first()).n,2);
  await assert.rejects(previewArchive(pool,'yesterday'),/ARCHIVE_CUTOVER_INVALID/);
 }finally{await rt.close();}
});
