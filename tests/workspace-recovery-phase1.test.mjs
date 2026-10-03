import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';

test('Recovery B Phase 1: bank-first BASIC, FULL, unavailable, zero and navigation',async()=>{
 const rt=await createWorkspaceRuntime();
 try{
  const response=await rt.request('/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({statements:[{fileName:'recovery.txt',text:statementFixture({openingBalance:null,endingBalance:null})}]})});
  assert.equal(response.status,200);
  const {analysis}=await response.json(),url='/api/workspace-model?analysisId='+analysis.id;
  const basic=await(await rt.request(url)).json();
  const {Home,Shell,EmptyHome}=rt.load('app/components/workspace/presentation.tsx');
  const {resolveClientView,clientAvailableViews}=rt.load('app/components/workspace/client.tsx');
  const render=(C,props)=>renderToStaticMarkup(React.createElement(C,props));
  const assertBanking=html=>{
   for(const label of ['Операционные поступления','Внешние поступления','Внешние списания','Чистый внешний денежный поток','Среднедневной остаток','Банковская динамика','Платежи и контрагенты','Социальные взносы','Источники и покрытие'])assert.ok(html.includes(label),label);
   assert.ok(html.indexOf('ws-banking-kpis')<html.indexOf('ws-data-panel'));
   assert.ok(html.indexOf('ws-data-panel')<html.indexOf('ws-banking-details'));
  };
  const basicHtml=render(Home,{model:basic});assertBanking(basicHtml);
  assert.ok(basicHtml.indexOf('ws-banking-details')<basicHtml.indexOf('/checkout'));
  await rt.full(analysis.id);const full=await(await rt.request(url)).json();
  const fullHtml=render(Home,{model:full});assertBanking(fullHtml);
  assert.ok(fullHtml.indexOf('ws-banking-details')<fullHtml.indexOf('ws-credit-overview'));
  assert.ok(fullHtml.indexOf('ws-credit-overview')<fullHtml.indexOf('ws-sources'));
  assert.ok(fullHtml.includes(full.full.report.readiness.level));
  const unavailable={...basic,entitlement:'FULL',fullAvailability:'UNAVAILABLE'};
  const unavailableHtml=render(Home,{model:unavailable});assertBanking(unavailableHtml);
  assert.doesNotMatch(unavailableHtml,/checkout/);assert.match(unavailableHtml,/Повторить загрузку расчёта/);
  const copy=structuredClone(basic);
  copy.basic.bankingFacts.grossInflow={...copy.basic.bankingFacts.grossInflow,value:0,status:'KNOWN'};
  copy.basic.bankingFacts.grossOutflow={...copy.basic.bankingFacts.grossOutflow,value:999,status:'UNKNOWN'};
  const values=render(Home,{model:copy});
  assert.match(values,/Внешние поступления<\/dt><dd>0 ₽/);
  assert.match(values,/Внешние списания<\/dt><dd>Недостаточно данных/);
  for(const query of ['upload','analyze'])assert.equal(resolveClientView(query),'upload');
  assert.equal(resolveClientView('invalid'),'home');
  const allowed=clientAvailableViews({company:false,analyst:false},true);
  assert.ok(!allowed.includes('upload'));assert.ok(!allowed.includes('company'));assert.ok(!allowed.includes('analyst'));
  const shell=render(Shell,{view:'home',choose(){},companyName:'Тестовая компания',availableViews:allowed,children:basicHtml});
  assert.doesNotMatch(shell,/Новый анализ|Кредитный аналитик|Компания и отчётность|Расчётный модуль работает|WorkspaceModelV1|presentation/);
  assert.match(shell,/Тестовая компания/);assert.match(shell,/class="ps-content ws"/);
  assert.doesNotMatch(render(EmptyHome,{}),/<button/);
 }finally{await rt.close();}
});

test('Recovery shell and banking presentation have no legacy analytical dependencies',()=>{
 for(const name of ['client.tsx','presentation.tsx','data-panel.tsx']){
  const source=fs.readFileSync('app/components/workspace/'+name,'utf8');
  assert.doesNotMatch(source,/analysis\.(?:score|grade|readiness)|estimatedLimit(?:Min|Max)|stressLimitMax|baseMonthlyPaymentCapacity|buildActionPlan\(|compareCreditPortfolio\(|UnifiedRiskContext|\/api\/offers/);
 }
});
