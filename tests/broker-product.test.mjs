import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';
const json=body=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
test('broker applications remain authorized, idempotent and consistent after reload',async t=>{
 const rt=await createWorkspaceRuntime();try{
 const a=(await(await rt.request('/api/analysis',json({statements:[{fileName:'bank.txt',text:statementFixture()}]}))).json()).analysis;await rt.full(a.id);await rt.assign(a);
 const owner=await(await rt.request('/api/workspace-model?analysisId='+a.id)).json(),broker=await(await rt.request('/api/workspace-model?analysisId='+a.id,{},rt.broker)).json();
 await t.test('same canonical/report and read-only access',()=>{assert.deepEqual(owner.full.canonical,broker.full.canonical);assert.deepEqual(owner.full.report,broker.full.report);assert.equal(broker.access.readOnly,true);});
 await t.test('owner admin assigned stranger authorization',async()=>{for(const user of [rt.owner,rt.admin,rt.broker])assert.equal((await rt.request('/api/workspace-model?analysisId='+a.id,{},user)).status,200);assert.equal((await rt.request('/api/workspace-model?analysisId='+a.id,{},rt.stranger)).status,404);});
 const data=await(await rt.request('/api/agent',{},rt.broker)).json(),lead=data.leads[0],offer=data.offerOptions[0];
 const app={type:'application',leadId:lead.id,analysisId:a.id,companyName:lead.companyName,bank:offer.bank,product:offer.product,requestedAmount:1000000,calculatedLimit:0,nextAction:'Проверить документы'};
 const saved=await rt.request('/api/agent',json(app),rt.broker);assert.equal(saved.status,201);const id=(await saved.json()).id;
 await t.test('initial status equals the client application',async()=>{const b=(await(await rt.request('/api/agent',{},rt.broker)).json()).applications.find(a=>a.id===id),c=(await(await rt.request('/api/workspace')).json()).deals.find(a=>a.id===id);assert.equal(b.status,c.status);});
 await t.test('concurrent retry returns one logical application and one history event',async()=>{const results=await Promise.all([rt.request('/api/agent',json(app),rt.broker),rt.request('/api/agent',json(app),rt.broker)]);for(const r of results)assert.equal((await r.json()).id,id);const reloaded=await(await rt.request('/api/agent',{},rt.broker)).json();assert.equal(reloaded.applications.filter(a=>a.id===id).length,1);assert.equal((await rt.db.prepare('SELECT COUNT(*) AS count FROM application_status_history WHERE application_id = ?').bind(id).first()).count,1);});
 await t.test('stranger cannot mutate broker application',async()=>{assert.equal((await rt.request('/api/agent',{...json({id,status:'Одобрена',entity:'application'}),method:'PATCH'},rt.stranger)).status,403);});
 await t.test('status history and client/broker next actions survive reload',async()=>{assert.equal((await rt.request('/api/agent',{...json({id,status:'Требуются документы',entity:'application'}),method:'PATCH'},rt.broker)).status,200);const b=(await(await rt.request('/api/agent',{},rt.broker)).json()).applications.find(a=>a.id===id),c=(await(await rt.request('/api/workspace')).json()).deals.find(a=>a.id===id);assert.equal(b.status,c.status);assert.equal(b.nextAction,c.nextAction);assert.equal(c.statusHistory.length,2);});
 await t.test('chat persists and is shared by owner and assigned broker',async()=>{assert.equal((await rt.request('/api/communications',json({applicationId:id,message:'Уточните комплект документов'}),rt.broker)).status,201);const b=await(await rt.request('/api/communications?applicationId='+id,{},rt.broker)).json(),c=await(await rt.request('/api/communications?applicationId='+id)).json();assert.deepEqual(b.messages,c.messages);assert.ok(c.messages.some(m=>m.message==='Уточните комплект документов'));assert.equal((await rt.request('/api/communications?applicationId='+id,{},rt.stranger)).status,403);});
 }finally{await rt.close();}
});
