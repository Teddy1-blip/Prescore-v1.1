import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {loadBusiness} from '../lib/credit-engine/credit-lab/business-corpus.mjs';
const text=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
test('review cases preserve canonical values, warnings and distinct source completeness meaning',async()=>{
 const rt=await createWorkspaceRuntime();try{
 const {Home,Flow,missingSourceLabels}=rt.load('app/components/workspace/presentation.tsx');
 const {buildCanonicalCreditAnalysis}=rt.load('lib/credit-engine/production/orchestrator.ts');
 const {loadWorkspaceModelV1}=rt.load('lib/workspace/service.ts');
 for(const suffix of ['001','011','013','016','017','022']){
  const b=loadBusiness('CL-RU-BUS-'+suffix),analysis=b.input.analysis;
  const canonical=buildCanonicalCreditAnalysis({analysis,companyProfile:b.input.companyProfile});
  const model=await loadWorkspaceModelV1(analysis.id,{readAccess:async()=>({row:{payload:JSON.stringify(analysis),companyInn:analysis.companyInn,ownerEmail:rt.owner.email},access:'owner'}),readTier:async()=>'FULL',readProfile:async()=>b.input.companyProfile,readOperations:async()=>({documents:{status:'UNKNOWN',count:null,analysisCount:null},applications:{status:'UNKNOWN',count:null,activeCount:null,statuses:null}})});
  assert.equal(model.state,'READY_FULL',suffix);
  assert.deepEqual(model.full.canonical.prescoreIndex,canonical.prescoreIndex,suffix);
  assert.deepEqual(model.full.canonical.debtCapacity,canonical.debtCapacity,suffix);
  const html=renderToStaticMarkup(React.createElement(Home,{model})),visible=text(html);
  assert.ok(visible.includes(model.full.report.hero.headline),suffix);
  assert.ok(visible.includes(model.full.report.index.status),suffix);
  assert.ok(visible.includes(model.full.report.readiness.level),suffix);
  assert.match(visible,/Заполненность банковских данных/);
  assert.doesNotMatch(visible,/Полнота данных:/);
  if(canonical.prescoreIndex.value===null){assert.match(visible,/Не определён/);assert.doesNotMatch(visible,/0 из 1000/);}
  if(canonical.prescoreIndex.status!=='CALCULATED')assert.match(html,/ws-assessment-status/);
  const flow=renderToStaticMarkup(React.createElement(Flow,{model}));
  for(const row of model.basic.bankingFacts.monthly??[])assert.ok(flow.includes(row.month.split('-').reverse().join('.')));
  if(model.basic.bankingFacts.monthly.length>3)assert.match(flow,/Все месяцы/);
 }
 assert.deepEqual(missingSourceLabels(['BFO','BFO','FINANCIAL_STATEMENTS','BKI','PRIVATE_X','PRIVATE_Y']),{known:['Бухгалтерская отчётность','Кредитная история'],unknown:true});
 }finally{await rt.close();}
});
test('FULL calculation unavailable retains known banking facts without checkout in Home and Financing',async()=>{
 const rt=await createWorkspaceRuntime();try{
 const b=loadBusiness('CL-RU-BUS-001');
 const uploaded=await(await rt.request('/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({statements:b.statements})})).json();
 const id=uploaded.analysis.id;
 const basic=await(await rt.request('/api/workspace-model?analysisId='+id)).json();
 const {Home,Financing,EmptyHome}=rt.load('app/components/workspace/presentation.tsx');
 assert.match(renderToStaticMarkup(React.createElement(Home,{model:basic})),/\/checkout\?/);
 const saved={...b.input.analysis,id};saved.sourceManifest.bfo.companyInn='0000000000';
 await rt.db.prepare('UPDATE analyses SET payload = ? WHERE id = ?').bind(JSON.stringify(saved),id).run();await rt.full(id);
 const unavailable=await(await rt.request('/api/workspace-model?analysisId='+id)).json();
 assert.equal(unavailable.entitlement,'FULL');assert.equal(unavailable.fullAvailability,'UNAVAILABLE');assert.equal(unavailable.state,'READY_BASIC');assert.equal(unavailable.basic.bankingFacts.operatingInflow.status,'KNOWN');
 for(const C of [Home,Financing]){const html=renderToStaticMarkup(React.createElement(C,{model:unavailable}));assert.doesNotMatch(html,/\/checkout\?/);assert.match(html,/Повторная оплата не требуется/);assert.match(html,/Повторить загрузку расчёта/);}
 assert.match(renderToStaticMarkup(React.createElement(EmptyHome,{start(){}})),/Загрузить выписку/);
 }finally{await rt.close();}
});
test('real operational handlers: assigned broker status and shared chat, owner document and cancellation',async()=>{
 const rt=await createWorkspaceRuntime();try{
 const b=loadBusiness('CL-RU-BUS-001');const uploaded=await(await rt.request('/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({statements:b.statements})})).json();const a=uploaded.analysis;await rt.assign(a);
 const post=async(url,data,user=rt.owner,method='POST')=>rt.request(url,{method,headers:{'content-type':'application/json'},body:JSON.stringify(data)},user);
 const doc=await post('/api/documents',{companyInn:a.companyInn,analysisId:a.id,category:'Прочее',fileName:'qa.txt',mimeType:'text/plain',sizeBytes:4,contentBase64:Buffer.from('test').toString('base64'),uploadedBy:'Клиент'});assert.equal(doc.status,201,await doc.clone().text());
 const listing=await(await rt.request('/api/documents?inn='+a.companyInn)).json();assert.ok(listing.documents.some(d=>d.fileName==='qa.txt'));
 const response=await post('/api/workspace',{type:'applications',analysisId:a.id,companyInn:a.companyInn,companyName:a.companyName,consentAt:new Date().toISOString(),applications:[{bank:'QA банк',product:'Оборотный кредит',amount:250000}]});assert.equal(response.status,201,await response.clone().text());const id=(await response.json()).deals[0].id;
 for(const user of [rt.owner,rt.broker]){const r=await post('/api/communications',{applicationId:id,authorRole:user===rt.owner?'client':'broker',authorName:'QA',message:user===rt.owner?'Client request':'Broker reply'},user);assert.equal(r.status,201,await r.clone().text());}
 const messages=await(await rt.request('/api/communications?applicationId='+id)).json();assert.equal(messages.messages.length,2);
 const updated=await post('/api/agent',{id,status:'Требуются документы',entity:'application'},rt.broker,'PATCH');assert.equal(updated.status,200,await updated.clone().text());
 const agent=await(await rt.request('/api/agent',{},rt.broker)).json();assert.equal(agent.applications.find(a=>a.id===id).status,'Требуются документы');
 const cancelled=await post('/api/workspace',{id,status:'Отменена клиентом'},rt.owner,'PATCH');assert.equal(cancelled.status,200,await cancelled.clone().text());
 const own=await(await rt.request('/api/workspace')).json();assert.equal(own.deals.find(d=>d.id===id).status,'Отменена клиентом');
 }finally{await rt.close();}
});
