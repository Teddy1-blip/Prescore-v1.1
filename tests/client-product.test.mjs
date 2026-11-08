import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {conclusionFixture} from './fixtures/credit-conclusion.mjs';
const render=(C,props)=>renderToStaticMarkup(React.createElement(C,props));
test('commercial client uses one navigation and separate executive/analysis paths',async t=>{
 const rt=await createWorkspaceRuntime();try{
 const shell=rt.load('app/components/workspace/client-shell.tsx'),insights=rt.load('app/components/workspace/client-insights.tsx'),analysis=rt.load('app/components/workspace/client-analysis.tsx'),routing=rt.load('app/components/workspace/client.tsx');
 const {model,canonical}=conclusionFixture(),before=JSON.stringify(model),props={model,choose:()=>{},retry:()=>{}};
 assert.deepEqual(shell.CLIENT_NAV.map(i=>i.label),['Обзор','Финансы','Кредитный профиль','Финансирование','Документы','Заявки','Мониторинг','Контрагенты','Контракты']);
 const overview=render(insights.ExecutiveOverview,props);assert.match(overview,/Финансовая картина/);assert.match(overview,/ДЕНЬГИ/);assert.doesNotMatch(overview,/av-scenario-grid|pc-memo|CLIENT.*ANALYSIS V3/);
 for(const section of ['conclusion','factors','expertise','capacity','financials','obligations','financing','reconciliation','recommendations','plan','evidence','history'])await t.test(section,()=>{const html=render(analysis.FullCreditAnalysis,{...props,initialSection:section});assert.doesNotMatch(html,/NaN|undefined|Infinity/);assert.match(html,/Кредитный профиль/);});
 const profile=(section)=>render(analysis.FullCreditAnalysis,{...props,initialSection:section});
 const riskPage=profile('factors');
 for(const finding of canonical.riskAssessment.findings){
  const claim=model.full.canonical.explainability.claims.find(c=>c.status===finding.scope && c.riskFindingIds.includes(finding.findingId) && c.claimCode===finding.code);
  assert.ok(claim, finding.code);
  assert.ok(riskPage.includes('data-claim-id="'+claim.claimId+'"'),finding.code);
 }
 const stop=conclusionFixture('CL-RU-BUS-017');
 assert.ok(stop.canonical.riskAssessment.findings.some(f=>f.scope==='GLOBAL_STOP'));
 assert.match(render(analysis.FullCreditAnalysis,{...props,model:stop.model,initialSection:'factors'}),/>Стоп-факторы</);
 assert.match(profile('expertise'),/Факт и влияние/);
 assert.match(profile('recommendations'),/Приоритетные рекомендации/);
 assert.match(profile('plan'),/Сейчас/);
 const projected=model.full.report.analysisV3;

 assert.deepEqual(projected.scheduledPayments.map(s=>s.value),[7,30,60].map(d=>canonical.creditPortfolio.summary['scheduledPayments'+d+'d'].value));
 for(const o of projected.portfolio)assert.equal(o.annualRate.value,canonical.creditPortfolio.obligations.find(x=>x.obligationId===o.id).currentTerms.annualRate.value);
 for(const C of [analysis.FinancingProducts,analysis.DebtPortfolio])assert.doesNotMatch(render(C,props),/NaN|undefined|Infinity/);
 assert.equal(JSON.stringify(model),before,'presentation must not mutate canonical results');
 const basic=structuredClone(model);delete basic.full;basic.entitlement='BASIC';basic.state='READY_BASIC';basic.fullAvailability='LOCKED';basic.basic.bankingFacts.grossInflow={...basic.basic.bankingFacts.grossInflow,value:0,status:'KNOWN'};basic.basic.bankingFacts.operatingInflow={...basic.basic.bankingFacts.operatingInflow,value:987654321,status:'UNKNOWN'};
 const html=render(insights.ExecutiveOverview,{...props,model:basic});assert.match(html,/0 ₽/);assert.doesNotMatch(html,/987|data-credit-index|data-prudential-capacity/);
 assert.doesNotMatch(html,/Индекс не определён|Недостаточно данных|Пока не определён|Кредитные факторы формируются только каноническим анализом Prescore/);
 for(const localDecision of ['Высокая концентрация поступлений','Наблюдается обслуживание долга','Периоды низкой ликвидности','Существенные переводы физическим лицам'])assert.doesNotMatch(html,new RegExp(localDecision));
 for(const C of [analysis.FullCreditAnalysis,analysis.FinancingProducts]){const locked=render(C,{...props,model:basic});assert.match(locked,/Открыть полный анализ/);assert.doesNotMatch(locked,/data-credit-index/);}
 assert.equal(routing.resolveClientView('sources'),'documents');assert.equal(routing.resolveClientView('company'),'documents');assert.equal(routing.resolveClientView('reconciliation'),'analysis');assert.equal(routing.resolveClientView('recommendations'),'analysis');
 assert.ok(!routing.clientAvailableViews({},true).includes('upload'));assert.ok(!routing.clientAvailableViews({report:false},false).includes('analysis'));
 const source=fs.readFileSync('app/components/workspace/client.tsx','utf8');assert.doesNotMatch(source,/CreditConclusion|client-credit-sections|client-overview|client-source-sections|explanation-library/);
 }finally{await rt.close();}
});
test('client source contains no credit formulas or retired analytics',()=>{for(const f of ['client.tsx','client-shell.tsx','client-analysis.tsx','client-insights.tsx','client-financials.tsx'])assert.doesNotMatch(fs.readFileSync('app/components/workspace/'+f,'utf8'),/analysis\.(score|grade)|estimatedLimit|stressLimit|baseMonthlyPaymentCapacity|UnifiedRiskContext|compareCreditPortfolio|buildActionPlan|\/api\/offers/);});

test('bank-first overview retains known zero and groups unknown credit outputs without changing the model',async()=>{
 const rt=await createWorkspaceRuntime();try{
 const {ExecutiveOverview}=rt.load('app/components/workspace/client-insights.tsx');
 const {model}=conclusionFixture();
 model.full.canonical.prescoreIndex.value=null;
 model.full.canonical.financingReadiness.level='UNKNOWN';
 model.full.canonical.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential=null;
 model.basic.bankingFacts.taxPayments={...model.basic.bankingFacts.taxPayments,value:0,status:'KNOWN'};
 model.basic.bankingFacts.endingBalance={...model.basic.bankingFacts.endingBalance,value:987654321,status:'UNKNOWN'};
 const before=JSON.stringify(model),html=render(ExecutiveOverview,{model,choose:()=>{},retry:()=>{}});
 assert.match(html,/Финансовая картина/);assert.match(html,/ДЕНЬГИ/);
 assert.equal((html.match(/class="pc-assessment-limit"/g)||[]).length,0);
 assert.doesNotMatch(html,/data-credit-index|data-credit-readiness|data-prudential-capacity|987\s*654\s*321/);
 assert.equal(JSON.stringify(model),before);
 model.full.canonical.prescoreIndex.value=0;
 assert.match(render(ExecutiveOverview,{model,choose:()=>{},retry:()=>{}}),/data-credit-index="true">0/);
 }finally{await rt.close();}
});

test('public explanations replace implementation wording and print deduplicates without mutating the report',async()=>{
 const rt=await createWorkspaceRuntime();try{
 const {model}=conclusionFixture(),{publicText:clientText}=rt.load('lib/credit-engine/client-report/copy.ts');
 for(const text of ['Используется исходная причина ограничения.','Контекст требует дополнительной проверки и не является положительным фактором.']){
  const publicText=clientText(text);assert.notEqual(publicText,text);assert.match(publicText,/проверьте/i);
 }
 const {printPresentation}=rt.load('app/dashboard/report-v2/print-report.tsx'),report=structuredClone(model.full.report);
 const f=report.limitations[0]??report.primaryFactors[0]??report.readiness.constraints[0];assert.ok(f);
 report.dataQuality=[f];report.limitations=[{...f,id:'duplicate-copy',claimId:'duplicate-claim'}];
 const before=JSON.stringify(report),printed=printPresentation(report);
 const rows=[...printed.primaryFactors,...printed.contextHighlights,...printed.capacity.details,...printed.dataQuality,...printed.limitations,...printed.readiness.constraints,...printed.detailedSections.flatMap(s=>s.factors)];
 assert.equal(rows.filter(x=>x.title===f.title&&x.text===f.text&&x.status.tone===f.status.tone).length,1);
 assert.equal(JSON.stringify(report),before);
 }finally{await rt.close();}
});

test('CLIENT product recovery keeps history out of the visible cabinet and protects the 19-block engine boundary',()=>{
 const client=fs.readFileSync('app/components/workspace/client.tsx','utf8');
 const overview=fs.readFileSync('app/components/workspace/client-insights.tsx','utf8');
 assert.doesNotMatch(client,/Версия анализа|Последние активные анализы|Тестовые данные · \{qaAnalyses/);
 assert.match(client,/const latest=rows\.filter\(a=>a\.historyPurpose!==['"]QA['"]\)/);
 for(const required of ['Финансовая картина','ДЕНЬГИ','СЕЙЧАС В ФОКУСЕ','ФИНАНСИРОВАНИЕ','РЕКОМЕНДАЦИИ'])assert.ok(overview.includes(required),required);
 assert.doesNotMatch(overview,/buildPrescoreIndex|buildFinancingReadiness|buildCreditAssessment|buildDebtCapacity|estimatedLimit|stressLimit|baseMonthlyPaymentCapacity/);
});

test('the dashboard keeps the incomplete FULL decision visible and limits cash drilldown to covered FULL values',async()=>{
 const rt=await createWorkspaceRuntime();
 try {
  const {model}=conclusionFixture();
  const {ClientOverview}=rt.load('app/components/workspace/client-launch-overview.tsx');
  const {CashTrend}=rt.load('app/components/workspace/client-insights.tsx');
  model.full.report.hero.route='INSUFFICIENT_DATA';
  model.full.canonical.prescoreIndex.value=null;
  const props={model,choose:()=>{},retry:()=>{}};
  const home=render(ClientOverview,props);
  assert.equal((home.match(/data-client-route="INSUFFICIENT_DATA"/g)||[]).length,1);
  assert.doesNotMatch(home,/data-credit-index/);

  const sample=model.basic.bankingFacts.monthly[0];
  model.basic.bankingFacts.monthly=[
   {...sample,month:'2026-01',coverage:'MISSING',externalInflows:98123456},
   {...sample,month:'2026-02',coverage:'FULL',externalInflows:0},
  ];
  const fullChart=render(CashTrend,{model,compact:true});
  assert.match(fullChart,/Нет покрытия/);
  assert.doesNotMatch(fullChart,/98.?123.?456|aria-label="Внешние поступления · 01.2026 · 0/);
  assert.match(fullChart,/aria-label="Внешние поступления · 02.2026 · 0 ₽"/);
  model.entitlement='BASIC';delete model.full;
  const basicChart=render(CashTrend,{model,compact:true});
  assert.doesNotMatch(basicChart,/<button[^>]*aria-label="Внешние поступления/);
  assert.doesNotMatch(render(ClientOverview,props),/data-client-route=/);
 } finally { await rt.close(); }
});
