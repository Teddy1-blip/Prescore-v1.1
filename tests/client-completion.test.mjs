import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';
import {conclusionFixture} from './fixtures/credit-conclusion.mjs';
const json=body=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));

test('lost response and concurrent retries preserve one draft and one history entry',async()=>{
 const rt=await createWorkspaceRuntime();try{
  const a=(await(await rt.request('/api/analysis',json({statements:[{fileName:'test.txt',text:statementFixture()}]}))).json()).analysis;
  const deal={id:crypto.randomUUID(),analysisId:a.id,companyName:a.companyName,bank:'Партнёр',product:'Оборотный кредит',amount:12345,status:'Черновик',nextAction:'Проверить документы'};
  const responses=await Promise.all([rt.request('/api/workspace',json({type:'deal',deal})),rt.request('/api/workspace',json({type:'deal',deal}))]);
  assert.ok(responses.every(r=>r.ok));
  const replay=await rt.request('/api/workspace',json({type:'deal',deal}));assert.equal((await replay.json()).replayed,true);
  const list=(await(await rt.request('/api/workspace')).json()).deals;
  assert.equal(list.length,1);assert.equal(list[0].statusHistory.length,1);
  assert.equal((await rt.request('/api/workspace',json({type:'deal',deal:{...deal,amount:999}}))).status,409);
  assert.equal((await rt.request('/api/workspace',json({type:'deal',deal}),rt.stranger)).status,403);
 }finally{await rt.close();}
});

test('recipient request deduplicates repeated bank and replays safely after concurrent retry',async()=>{
 const rt=await createWorkspaceRuntime();try{
  const a=(await(await rt.request('/api/analysis',json({statements:[{fileName:'test.txt',text:statementFixture()}]}))).json()).analysis;
  const body={type:'applications',requestId:crypto.randomUUID(),analysisId:a.id,companyName:a.companyName,companyInn:a.companyInn,consentAt:new Date().toISOString(),applications:[{bank:' Банк ',product:'Факторинг',amount:456},{bank:'банк',product:'Факторинг',amount:456}]};
  const responses=await Promise.all([rt.request('/api/workspace',json(body)),rt.request('/api/workspace',json(body))]);
  assert.ok(responses.every(r=>r.ok));
  const replay=await(await rt.request('/api/workspace',json(body))).json();assert.equal(replay.replayed,true);assert.equal(replay.deals.length,1);
  const list=(await(await rt.request('/api/workspace')).json()).deals;assert.equal(list.length,1);assert.equal(list[0].statusHistory.length,1);
  assert.equal((await rt.request('/api/workspace',json({...body,applications:[{bank:'Другой банк',product:'Факторинг',amount:456}]}))).status,409);
 }finally{await rt.close();}
});

test('dossier exposes maturity from canonical portfolio; unknown values never become zero',async()=>{
 const rt=await createWorkspaceRuntime();try{
  const {model,canonical}=conclusionFixture('CL-RU-BUS-019');
  for(const obligation of model.full.report.analysisV3.portfolio){const actual=canonical.creditPortfolio.obligations.find(o=>o.obligationId===obligation.id);assert.deepEqual(obligation.maturity.value,actual.currentTerms.maturityDate.value);assert.equal(obligation.maturity.knowledge,actual.currentTerms.maturityDate.knowledge);}
  const {PublishedValue}=rt.load('app/components/workspace/credit-depth.tsx');
  const value={value:0,knowledge:'UNKNOWN',origin:'REPORTED',verification:'UNCONFIRMED',confidence:'UNKNOWN',asOf:null};
  assert.doesNotMatch(render(PublishedValue,{value,currency:true}),/0 ₽/);
  assert.match(render(PublishedValue,{value:{...value,knowledge:'KNOWN'},currency:true}),/0 ₽/);
  assert.match(render(PublishedValue,{value:{...value,value:'2027-12-31',knowledge:'KNOWN'},dateValue:true}),/31.12.2027/);
  const {Crm}=rt.load('app/components/workspace/client-operations.tsx');
  const html=render(Crm,{readOnly:true,deals:[{id:'1',analysisId:'a',companyName:'Компания',product:'Факторинг',bank:'Банк',amount:123,status:'Черновик',owner:'Клиент',nextAction:'Проверить'}],analyses:[],selected:null,addDeal:async()=>{},updateDeal:async()=>{}});
  assert.match(html,/Факторинг/);assert.match(html,/Режим просмотра/);assert.doesNotMatch(html,/Новая заявка|Отменить|Чат<\/button>/);
 }finally{await rt.close();}
});


test('active application counter deduplicates mirrored records and retains unknown statuses',async()=>{
 const {readWorkspaceOperations}=await import('../lib/workspace/service.ts');
 const run=async rows=>readWorkspaceOperations({prepare:()=>({bind:()=>({first:async()=>({count:0,analysis_count:0}),all:async()=>({results:rows})})})},'analysis','inn',{email:'owner',isAdmin:false});
 const model=await run([{id:'1',status:'Подготовка документов',source:'deal'},{id:'1',status:'Подготовка заявки',source:'agent'},{id:'2',status:'Закрыта',source:'deal'}]);
 assert.equal(model.applications.count,2);assert.equal(model.applications.activeCount,1);
 assert.equal((await run([])).applications.activeCount,0);
 assert.equal((await run([{id:'1',status:'Неизвестный статус',source:'deal'}])).applications.activeCount,null);
});

test('client financing parameters persist into one canonical workspace, print report and explicit scenario',async()=>{
 const rt=await createWorkspaceRuntime();try{
  const {loadBusiness}=await import('../lib/credit-engine/credit-lab/business-corpus.mjs');const bundle=loadBusiness('CL-RU-BUS-001');
  const a=(await(await rt.request('/api/analysis',json({statements:bundle.statements}))).json()).analysis;
  const stored={...bundle.input.analysis,id:a.id,createdAt:a.createdAt};await rt.db.prepare('UPDATE analyses SET payload = ? WHERE id = ?').bind(JSON.stringify(stored),a.id).run();await rt.full(a.id);await rt.assign(a);
  const request={type:'financing-request',analysisId:a.id,financingRequest:{purpose:'WORKING_CAPITAL',product:'CREDIT_LINE',amount:1000000,termMonths:12,annualRatePercent:0}};
  assert.equal((await rt.request('/api/workspace',json(request),rt.broker)).status,404);
  assert.equal((await rt.request('/api/workspace',json({...request,financingRequest:{...request.financingRequest,termMonths:null}}))).status,400);
  assert.equal((await rt.request('/api/workspace',json(request))).status,200);
  const workspace=await(await rt.request('/api/workspace-model?analysisId='+a.id)).json();assert.equal(workspace.state,'READY_FULL');assert.equal(workspace.basic.financingRequest.annualRatePercent,0);
  assert.equal(workspace.full.canonical.productSelection.financingPurpose.value,'WORKING_CAPITAL');
  assert.equal(workspace.full.canonical.productSelection.financingPurpose.status,'KNOWN');
  assert.equal(workspace.full.report.analysisV3.scenarios[0].rate,0);assert.equal(workspace.full.report.analysisV3.scenarios[0].months,12);
  const row=await rt.db.prepare('SELECT payload, company_inn AS companyInn, owner_email AS ownerEmail FROM analyses WHERE id = ?').bind(a.id).first();
  const {loadCanonicalReport}=await import('../lib/credit-engine/production/report-service.ts');
  const print=await loadCanonicalReport(a.id,{readAccess:async()=>({access:'owner',row}),readTier:async()=>'FULL',readProfile:async()=>undefined});assert.equal(print.status,'READY');assert.deepEqual(print.model,workspace.full.report);
  assert.equal(JSON.parse(row.payload).financingRequestV1.amount,1000000);
  assert.ok(workspace.basic.sources.availability.some(s=>s.source==='CLIENT_DECLARATION'));
  assert.equal((await rt.request('/api/workspace',json({...request,financingRequest:{purpose:'WORKING_CAPITAL',product:'UNKNOWN',amount:null,termMonths:null,annualRatePercent:null}}))).status,200);
  const cleared=await(await rt.request('/api/workspace-model?analysisId='+a.id)).json();assert.equal(cleared.basic.financingRequest.amount,null);assert.deepEqual(cleared.full.report.analysisV3.scenarios,[]);
 }finally{await rt.close();}
});
