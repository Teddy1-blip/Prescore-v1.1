import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {conclusionFixture} from './fixtures/credit-conclusion.mjs';

const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));

function readyModel(){
 const {model}=conclusionFixture();
 const value=structuredClone(model);
 value.full.report.hero.globalStop=false;
 value.full.report.hero.cta={label:'Посмотреть полный отчет',target:'full'};
 delete value.full.report.hero.route;
 value.full.canonical.prescoreIndex.value=850;
 value.full.canonical.financingReadiness.status='ASSESSED';
 value.full.canonical.financingReadiness.level='HIGH';
 value.full.canonical.creditAssessment.status='COMPLETE';
 value.full.canonical.creditAssessment.globalStop.status='NOT_PRESENT';
 value.full.canonical.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential=250000;
 if(!value.full.report.productFit.primary.length)value.full.report.productFit.primary=[{id:'synthetic-product',claimId:'synthetic-product-claim',family:'TERM_LOAN',title:'Оборотный кредит',fit:'Подходит',purpose:'Пополнение оборотных средств',capacity:'Соответствует осторожной оценке',requested:'Не указан',missing:[],rank:1}];
 return value;
}

test('client decision route resolves one authoritative next action from canonical outputs',async()=>{
 const rt=await createWorkspaceRuntime();
 try{
  const decision=rt.load('app/components/workspace/client-decision-route.tsx');
  const ready=readyModel(),readyBefore=JSON.stringify(ready);
  const readyRoute=decision.resolveClientDecisionRoute(ready);
  assert.equal(readyRoute.code,'READY_FOR_FINANCING');
  assert.equal(readyRoute.cta.view,'applications');
  assert.match(readyRoute.cta.label,/Создать заявку/);
  assert.match(render(decision.ClientDecisionRoute,{model:ready,choose:()=>{}}),/data-client-route="READY_FOR_FINANCING"[^]*?Создать заявку на финансирование/);
  assert.equal(JSON.stringify(ready),readyBefore,'route projection must not mutate canonical model');

  const preparation=structuredClone(ready);
  preparation.full.report.hero.globalStop=true;
  preparation.full.canonical.creditAssessment.status='NOT_RATABLE_GLOBAL_STOP';
  preparation.full.canonical.creditAssessment.globalStop.status='PRESENT';
  preparation.full.canonical.financingReadiness.status='NOT_RATABLE_GLOBAL_STOP';
  preparation.full.canonical.financingReadiness.level='NOT_READY';
  const preparationRoute=decision.resolveClientDecisionRoute(preparation);
  assert.equal(preparationRoute.code,'NEEDS_PREPARATION');
  assert.equal(preparationRoute.cta.view,'analysis');
  assert.equal(preparationRoute.cta.section,'plan');
  assert.ok(preparationRoute.tasks.length<=3);

  const insufficient=structuredClone(ready);
  insufficient.full.report.hero.globalStop=false;
  insufficient.full.report.hero.cta={label:'Добавить данные',target:'data'};
  insufficient.full.canonical.creditAssessment.status='INSUFFICIENT_DATA';
  insufficient.full.canonical.creditAssessment.globalStop.status='NOT_PRESENT';
  insufficient.full.canonical.financingReadiness.status='INSUFFICIENT_DATA';
  insufficient.full.canonical.financingReadiness.level='UNKNOWN';
  insufficient.full.canonical.prescoreIndex.value=null;
  insufficient.basic.sources.availability=insufficient.basic.sources.availability.filter(source=>!['FINANCIAL_STATEMENTS','CREDIT_HISTORY','QUARTERLY_REPORT'].includes(source.source));
  const insufficientRoute=decision.resolveClientDecisionRoute(insufficient);
  assert.equal(insufficientRoute.code,'INSUFFICIENT_DATA');
  assert.equal(insufficientRoute.cta.view,'documents');
  assert.equal(insufficientRoute.cta.anchor,'source-bfo');
  assert.match(insufficientRoute.cta.label,/бухгалтерскую отчётность/i);

  const launch=rt.load('app/components/workspace/client-launch-overview.tsx');
  const integrated=render(launch.ClientOverview,{model:ready,choose:()=>{},retry:()=>{}});
  assert.equal((integrated.match(/data-client-route="READY_FOR_FINANCING"/g)||[]).length,1);
 }finally{await rt.close();}
});

test('client decision route consumes canonical results and contains no scoring engine',()=>{
 const source=fs.readFileSync('app/components/workspace/client-decision-route.tsx','utf8');
 assert.doesNotMatch(source,/buildPrescoreIndex|buildFinancingReadiness|buildCreditAssessment|buildDebtCapacity|estimatedLimit|baseMonthlyPaymentCapacity|compareCreditPortfolio|analysis\.(score|grade)/);
 assert.match(source,/full\.canonical\.financingReadiness/);
 assert.match(source,/full\.canonical\.creditAssessment/);
 assert.match(source,/full\.canonical\.debtCapacity/);
});
