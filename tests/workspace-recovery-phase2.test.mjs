import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';

test('Recovery B Phase 2 — published credit, portfolio and evidence',async t=>{
 const rt=await createWorkspaceRuntime();
 try{
  const res=await rt.request('/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({statements:[{fileName:'phase2.txt',text:statementFixture()}]})});
  assert.equal(res.status,200);const {analysis}=await res.json();await rt.full(analysis.id);
  const model=await(await rt.request('/api/workspace-model?analysisId='+analysis.id)).json();assert.ok(model.full);
  const {CreditDepth,PortfolioDepth,PublishedValue,CompanyReporting,Evidence,sourceState}=rt.load('app/components/workspace/credit-depth.tsx');
  const render=(C,props)=>renderToStaticMarkup(React.createElement(C,props));
  const credit=m=>render(CreditDepth,{model:m});
  await t.test('Index null is not zero',()=>{const m=structuredClone(model);m.full.canonical.prescoreIndex.value=null;assert.match(credit(m),/data-credit-index="true">Не определён/);m.full.canonical.prescoreIndex.value=0;assert.match(credit(m),/data-credit-index="true">0/);});
  await t.test('Index status and readiness are separate report fields',()=>{const m=structuredClone(model);m.full.report.index.status='СТАТУС ИНДЕКСА';m.full.report.readiness.level='УРОВЕНЬ ГОТОВНОСТИ';const html=credit(m);assert.match(html,/data-index-status="true">СТАТУС ИНДЕКСА/);assert.match(html,/data-credit-readiness="true">УРОВЕНЬ ГОТОВНОСТИ/);});
  await t.test('constraints and primary factors come from current report',()=>{const html=credit(model);assert.ok(model.full.report.readiness.constraints.length);for(const f of [...model.full.report.readiness.constraints,...model.full.report.primaryFactors])assert.ok(html.includes(f.title));});
  await t.test('prudential capacity comes only from canonical headline',()=>{const m=structuredClone(model);m.full.canonical.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential=123456;assert.match(credit(m),/data-prudential-capacity="true">123 456 ₽/);assert.match(credit(m),/не одобренный лимит/);});
  const value={value:0,knowledge:'UNKNOWN',origin:'REPORTED',verification:'UNCONFIRMED',confidence:'LOW',asOf:'2025-01-31'};
  await t.test('UNKNOWN overdue cannot display zero, known zero remains zero',()=>{assert.doesNotMatch(render(PublishedValue,{value,currency:true}),/>0 ₽/);assert.match(render(PublishedValue,{value:{...value,knowledge:'KNOWN'},currency:true}),/>0 ₽/);});
  await t.test('stale observation and dates are explicit',()=>{const m=structuredClone(model);m.full.report.analysisV3.observations=[{type:'BKI',status:'STALE',receivedAt:'2025-02-01',from:null,to:'2025-01-31'}];const html=render(PortfolioDepth,{model:m});assert.match(html,/Требует обновления/);assert.match(html,/01.02.2025/);assert.match(html,/не подтверждает состояние на сегодня/);});
  await t.test('portfolio creditor principal payment and asOf use report',()=>{const m=structuredClone(model),v=x=>({...value,value:x,knowledge:'KNOWN'});m.full.report.analysisV3.portfolio=[{id:'test-obligation',type:'TERM_LOAN',exposure:'FUNDED_DEBT',creditor:v('Банк тестового портфеля'),status:v('ACTIVE'),principal:v(987654),limit:v(null),contingent:v(null),payment:v(54321),paymentFrequency:v('MONTHLY'),nextPayment:v(null),nextDate:v(null),overdue:value}];const html=render(PortfolioDepth,{model:m});for(const text of ['Банк тестового портфеля','987 654 ₽','54 321 ₽','31.01.2025','Просрочка на дату источника'])assert.ok(html.includes(text));assert.doesNotMatch(html,/>0 ₽/);});
  await t.test('missing portfolio never claims no debt',()=>{const m=structuredClone(model);m.full.report.analysisV3.portfolio=[];assert.match(render(PortfolioDepth,{model:m}),/не подтверждает отсутствие долга/);});
  await t.test('READY source does not imply all conclusions consumed it',()=>{const m=structuredClone(model);m.basic.sources.availability=[{source:'FINANCIAL_STATEMENTS',status:'READY',periodFrom:'2025-01-01',periodTo:'2025-12-31'}];const html=render(CompanyReporting,{model:m});assert.match(html,/Обработан/);assert.match(html,/сама по себе не подтверждает его использование во всех выводах/);});
  await t.test('quarterly persisted source status is visible without invented table',()=>{const m=structuredClone(model);m.basic.sources.availability=[{source:'QUARTERLY_REPORT',status:'FAILED',periodFrom:'2025-01-01',periodTo:'2025-03-31'}];const html=render(CompanyReporting,{model:m});assert.match(html,/Квартальная отчётность/);assert.match(html,/Ошибка обработки/);assert.match(html,/31.03.2025/);assert.doesNotMatch(html,/<table/);});
  await t.test('evidence follows actual canonical claim and source references',()=>{const e=model.full.canonical.explainability,c=e.claims.find(c=>c.sourceReferenceIds.length);assert.ok(c);const html=render(Evidence,{model,claimIds:[c.claimId]});assert.ok(html.includes(c.titleRu));for(const ref of e.sourceReferences.filter(s=>c.sourceReferenceIds.includes(s.sourceReferenceId)))assert.ok(html.includes('data-source-ref="'+ref.sourceReferenceId+'"'));assert.doesNotMatch(html,/>explanation-claim:|canonicalPath|bindingCode/);});
  await t.test('source states distinguish empty absent failed partial and stale',()=>{assert.equal(new Set(['READY','PARTIAL','STALE','NOT_REQUESTED','EMPTY','FAILED'].map(sourceState)).size,6);});
  await t.test('FULL unavailable uses retry without checkout',()=>{const m={...model,full:undefined,entitlement:'FULL',fullAvailability:'UNAVAILABLE'};assert.match(credit(m),/Повторить загрузку расчёта/);assert.doesNotMatch(credit(m),/checkout/);});
  await t.test('all published recommendations and plan steps survive',()=>{const html=credit(model);for(const a of [...model.full.report.recommendations.primary,...model.full.report.recommendations.backlog,...model.full.report.actionPlan.horizons.flatMap(h=>h.items)])assert.ok(html.includes(a.title));});
 }finally{await rt.close();}
});
test('Phase 2 introduces no legacy analytics or automatic paid source request',()=>{
 for(const name of ['credit-depth.tsx','presentation.tsx','client.tsx','source-operations.tsx'])assert.doesNotMatch(fs.readFileSync('app/components/workspace/'+name,'utf8'),/analysis\.(?:score|grade|readiness)|estimatedLimit(?:Min|Max)|stressLimitMax|baseMonthlyPaymentCapacity|buildActionPlan\(|compareCreditPortfolio\(|UnifiedRiskContext|\/api\/(?:offers|conclusion)/);
 assert.doesNotMatch(fs.readFileSync('app/components/workspace/source-operations.tsx','utf8'),/useEffect/);
});
