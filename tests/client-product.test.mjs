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
 const {model}=conclusionFixture(),before=JSON.stringify(model),props={model,choose:()=>{},retry:()=>{}};
 assert.deepEqual(shell.CLIENT_NAV.map(i=>i.label),['Обзор','Анализ Prescore','Финансы','Обязательства','Финансирование','Документы','Заявки','Кредитный аналитик']);
 const overview=render(insights.ExecutiveOverview,props);assert.match(overview,/Обзор компании/);assert.doesNotMatch(overview,/av-scenario-grid|pc-memo|CLIENT.*ANALYSIS V3/);
 for(const section of ['conclusion','factors','capacity','financials','obligations','financing','reconciliation','plan','evidence'])await t.test(section,()=>{const html=render(analysis.FullCreditAnalysis,{...props,initialSection:section});assert.doesNotMatch(html,/NaN|undefined|Infinity/);assert.match(html,/Анализ Prescore/);});
 for(const C of [analysis.FinancingProducts,analysis.DebtPortfolio])assert.doesNotMatch(render(C,props),/NaN|undefined|Infinity/);
 assert.equal(JSON.stringify(model),before,'presentation must not mutate canonical results');
 const basic=structuredClone(model);delete basic.full;basic.entitlement='BASIC';basic.state='READY_BASIC';basic.fullAvailability='LOCKED';basic.basic.bankingFacts.grossInflow={...basic.basic.bankingFacts.grossInflow,value:0,status:'KNOWN'};basic.basic.bankingFacts.operatingInflow={...basic.basic.bankingFacts.operatingInflow,value:987654321,status:'UNKNOWN'};
 const html=render(insights.ExecutiveOverview,{...props,model:basic});assert.match(html,/0 ₽/);assert.doesNotMatch(html,/987|data-credit-index|data-prudential-capacity/);
 for(const C of [analysis.FullCreditAnalysis,analysis.FinancingProducts]){const locked=render(C,{...props,model:basic});assert.match(locked,/Открыть полный анализ/);assert.doesNotMatch(locked,/data-credit-index/);}
 assert.equal(routing.resolveClientView('sources'),'documents');assert.equal(routing.resolveClientView('company'),'documents');assert.equal(routing.resolveClientView('reconciliation'),'analysis');assert.equal(routing.resolveClientView('recommendations'),'analysis');
 assert.ok(!routing.clientAvailableViews({},true).includes('upload'));assert.ok(!routing.clientAvailableViews({report:false},false).includes('analysis'));
 const source=fs.readFileSync('app/components/workspace/client.tsx','utf8');assert.doesNotMatch(source,/CreditConclusion|client-credit-sections|client-overview|client-source-sections|explanation-library/);
 }finally{await rt.close();}
});
test('client source contains no credit formulas or retired analytics',()=>{for(const f of ['client.tsx','client-shell.tsx','client-analysis.tsx','client-insights.tsx','client-financials.tsx'])assert.doesNotMatch(fs.readFileSync('app/components/workspace/'+f,'utf8'),/analysis\.(score|grade)|estimatedLimit|stressLimit|baseMonthlyPaymentCapacity|UnifiedRiskContext|compareCreditPortfolio|buildActionPlan|\/api\/offers/);});
