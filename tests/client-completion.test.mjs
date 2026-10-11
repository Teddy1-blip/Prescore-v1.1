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
