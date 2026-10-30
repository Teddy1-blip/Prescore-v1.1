import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {previewArchive,executeArchive,verifyArchive,restoreArchive,assertOwnerArchiveEnvironment} from '../lib/release/analysis-archive.ts';

const cutoff='2026-10-30T00:00:00.000Z';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={kind:'OWNER_EXPLICIT_IDS',ownerEmail:'owner@workspace.test',analysisIds:[id(1)],protectedAnalysisIds:[id(2)],targetBaseUrl:'https://prescore-staging-dorogovab.msk1.amvera.tech'};
const poolFor=rt=>({query:async(sql,args)=>{const r=await rt.pg.query(sql,args);return {rows:r.rows,rowCount:r.affectedRows};},async connect(){return {query:this.query,release(){}};}});
async function seed(rt){
 for(const [n,owner]of [[1,rt.owner.email],[2,rt.owner.email],[3,rt.stranger.email],[4,'']])await rt.pg.query('INSERT INTO analyses(id,company_name,company_inn,file_name,period_from,period_to,score,grade,readiness,payload,owner_email,created_at) VALUES($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11)',[id(n),'SYNTHETIC '+n,'990000000'+n,'synthetic.txt','2026-01-01','2026-06-30','UNKNOWN','PARTIAL',JSON.stringify({synthetic:true,banking:{value:100000}}),owner,'2026-10-01T00:00:00.000Z']);
 await rt.full(id(1));
 await rt.pg.query("INSERT INTO client_documents(id,company_inn,analysis_id,category,file_name,content_base64,owner_email) VALUES('fixture-doc','9900000001',$1,'TEST','fixture.txt','VEVTVA==',$2)",[id(1),rt.owner.email]);
}
test('explicit owner archive preserves QA, other/unassigned analyses and all source payloads; reversible and idempotent',async()=>{
 const rt=await createWorkspaceRuntime();try{
  await seed(rt);const pool=poolFor(rt);
  const before=(await rt.pg.query('SELECT id,payload,owner_email FROM analyses ORDER BY id')).rows;
  const entitlement=(await rt.pg.query('SELECT * FROM analysis_entitlements ORDER BY analysis_id')).rows;
  const documents=(await rt.pg.query('SELECT * FROM client_documents ORDER BY id')).rows;
  const plan=await previewArchive(pool,cutoff,scope);
  assert.equal(plan.version,'PRESCORE_ARCHIVE_V2');assert.deepEqual(plan.records.map(r=>r.id),[id(1)]);
  assert.equal((await executeArchive(pool,plan)).status,'ARCHIVED');
  assert.equal((await executeArchive(pool,plan)).status,'ALREADY_ARCHIVED');
  assert.equal((await verifyArchive(pool,plan)).count,1);
  assert.deepEqual((await rt.pg.query("SELECT id FROM analyses WHERE archive_state='ACTIVE' ORDER BY id")).rows.map(r=>r.id),[id(2),id(3),id(4)]);
  assert.deepEqual((await rt.pg.query('SELECT id,payload,owner_email FROM analyses ORDER BY id')).rows,before);
  assert.deepEqual((await rt.pg.query('SELECT * FROM analysis_entitlements ORDER BY analysis_id')).rows,entitlement);
  assert.deepEqual((await rt.pg.query('SELECT * FROM client_documents ORDER BY id')).rows,documents);
  for(let reload=0;reload<2;reload++)assert.deepEqual((await(await rt.request('/api/workspace?projection=summary')).json()).analyses.map(a=>a.id),[id(2)]);
  assert.equal((await rt.request('/api/workspace-model?analysisId='+id(1))).status,404);
  assert.equal((await restoreArchive(pool,plan.fingerprint)).status,'RESTORED');
  assert.equal((await restoreArchive(pool,plan.fingerprint)).status,'ALREADY_RESTORED');
  assert.deepEqual((await rt.pg.query('SELECT id,payload,owner_email FROM analyses ORDER BY id')).rows,before);
 }finally{await rt.close();}
});
test('preview rejects protected, foreign, unowned, missing and duplicate IDs',async()=>{
 const rt=await createWorkspaceRuntime();try{await seed(rt);const pool=poolFor(rt);
  for(const analysisIds of [[id(2)],[id(3)],[id(4)],[id(9)],[id(1),id(1)]])await assert.rejects(previewArchive(pool,cutoff,{...scope,analysisIds}),/ARCHIVE_(SCOPE_INVALID|SCOPE_MISMATCH)/);
  assert.equal((await rt.pg.query('SELECT count(*) AS n FROM analysis_archive_batches')).rows[0].n,0);
 }finally{await rt.close();}
});
test('owner change or tampering after preview aborts atomically',async()=>{
 const rt=await createWorkspaceRuntime();try{await seed(rt);const pool=poolFor(rt),plan=await previewArchive(pool,cutoff,scope);
  await assert.rejects(executeArchive(pool,{...plan,scope:{...scope,ownerEmail:rt.stranger.email}}),/ARCHIVE_PREVIEW_INVALID/);
  await rt.pg.query('UPDATE analyses SET owner_email=$1 WHERE id=$2',[rt.stranger.email,id(1)]);
  await assert.rejects(executeArchive(pool,plan),/ARCHIVE_SCOPE_MISMATCH/);
  assert.equal((await rt.pg.query('SELECT count(*) AS n FROM analysis_archive_batches')).rows[0].n,0);
 }finally{await rt.close();}
});
test('broker company assignment or application blocks owner archive, including a link added after preview',async()=>{
 const rt=await createWorkspaceRuntime();try{await seed(rt);const pool=poolFor(rt),plan=await previewArchive(pool,cutoff,scope);
  await rt.assign({id:id(1),companyName:'SYNTHETIC',companyInn:'9900000001'});
  const before=(await rt.pg.query('SELECT * FROM agent_leads')).rows;
  await assert.rejects(executeArchive(pool,plan),/ARCHIVE_BROKER_LINKED/);
  assert.deepEqual((await rt.pg.query('SELECT * FROM agent_leads')).rows,before);
  await rt.pg.query('DELETE FROM agent_leads'); // isolated fixture only
  await rt.pg.query("INSERT INTO agent_applications(id,agent_code,lead_id,analysis_id,company_name,bank,product) VALUES('fixture','qa-broker','fixture',$1,'SYNTHETIC','TEST','TEST')",[id(1)]);
  await assert.rejects(previewArchive(pool,cutoff,scope),/ARCHIVE_BROKER_LINKED/);
  assert.equal((await rt.pg.query("SELECT count(*) AS n FROM analyses WHERE archive_state='ACTIVE'")).rows[0].n,4);
 }finally{await rt.close();}
});
test('admin personal GET neither lists nor claims unassigned analyses',async()=>{
 const rt=await createWorkspaceRuntime();try{await seed(rt);
  for(const url of ['/api/workspace?projection=summary','/api/workspace']){
   const response=await rt.request(url,{},rt.admin);assert.equal(response.status,200);
   assert.deepEqual((await response.json()).analyses,[]);
  }
  assert.equal((await rt.pg.query('SELECT owner_email FROM analyses WHERE id=$1',[id(4)])).rows[0].owner_email,'');
 }finally{await rt.close();}
});

test('owner maintenance refuses production, wrong origins and a missing runtime context',()=>{
 const env={PRESCORE_RUNTIME_MODE:'release-candidate',PRESCORE_BASE_URL:scope.targetBaseUrl};
 assert.doesNotThrow(()=>assertOwnerArchiveEnvironment(scope,env));
 for(const input of [{},{...env,PRESCORE_RUNTIME_MODE:'production'},{...env,PRESCORE_BASE_URL:'https://prescore.ru'}])assert.throws(()=>assertOwnerArchiveEnvironment(scope,input),/ARCHIVE_ENVIRONMENT_MISMATCH/);
});
