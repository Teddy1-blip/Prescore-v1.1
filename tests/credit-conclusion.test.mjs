import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertClientOverviewRouting} from './fixtures/client-overview-contract.mjs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {conclusionFixture} from './fixtures/credit-conclusion.mjs';
test('credit conclusion uses full-source calculated results without changing them',async()=>{
 const rt=await createWorkspaceRuntime();try{const {CreditConclusion}=rt.load('app/components/workspace/credit-conclusion.tsx');const {model,canonical:c}=conclusionFixture();const before=JSON.stringify(model),html=renderToStaticMarkup(React.createElement(CreditConclusion,{model}));assert.equal(JSON.stringify(model),before);assert.ok(!html.includes('Для полной оценки не хватает'));
 const missing=structuredClone(model);missing.full.report.analysisV3.observations=missing.full.report.analysisV3.observations.filter(o=>o.type!=='BKI');assert.ok(renderToStaticMarkup(React.createElement(CreditConclusion,{model:missing})).includes('Для полной оценки не хватает'));

 for(const type of ['BANK_STATEMENT','BFO','QUARTERLY','BKI'])assert.ok(c.sourceObservations.some(s=>s.sourceType===type));
 assert.equal(typeof c.prescoreIndex.value,'number');assert.equal(typeof c.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,'number');
 for(const title of ['Кредитное заключение','Сильные стороны','Риски и ограничения','Возможность нового долга','Сценарии финансирования','БКИ и кредитный портфель','Финансовая оценка','Сверка источников','Подходящее финансирование','Следующие действия','Посмотреть полный план','Почему Prescore сделал такой вывод?'])assert.ok(html.includes(title),title);
 assert.ok(html.includes('data-credit-index="true">'+c.prescoreIndex.value));assert.ok(html.includes(model.full.report.readiness.level));assert.ok(html.includes(model.full.report.hero.headline));for(const p of model.full.report.productFit.other)assert.ok(html.includes(p.title));
 assert.ok(c.financialAnalysis.history.length>=3);assert.ok(c.creditPortfolio.obligations.length);assert.ok(c.reconciliation.findings.length);assert.ok(c.explainability.claims.length);
 for(const [amount,status]of [[null,'UNKNOWN'],[0,'KNOWN']]){model.full.canonical.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential=amount;const text=renderToStaticMarkup(React.createElement(CreditConclusion,{model}));assert.ok(text.includes(status==='UNKNOWN'?'data-prudential-capacity="true">Не подтверждён':'data-prudential-capacity="true">0 ₽'));}
 }finally{await rt.close();}
});
test('conclusion cannot introduce legacy scoring or side effects',()=>{
 const forbidden=/analysis\.(score|grade)|estimatedLimit|stressLimit|baseMonthlyPaymentCapacity|UnifiedRiskContext|compareCreditPortfolio|fetch\(|\?\?\s*0|\|\|\s*0/;
 const conclusion=fs.readFileSync('app/components/workspace/credit-conclusion.tsx','utf8');
 const client=fs.readFileSync('app/components/workspace/client.tsx','utf8');
 const overview=fs.readFileSync('app/components/workspace/client-launch-overview.tsx','utf8');
 assert.doesNotMatch(conclusion,forbidden);
 assert.doesNotMatch(overview,forbidden);
 assert.doesNotMatch(client,/CreditConclusion/);
 assert.match(client,/view==='home'[\s\S]*?<ClientOverview/);
 // Verify the actual FREE/FULL branches and props, independent of JSX wrappers.
 assertClientOverviewRouting(overview);
 // Keep the model-presence guard; runtime branches are covered by client-navigation-recovery.
 assert.match(client,/view\s*===\s*['"]analysis['"]\s*&&\s*model\s*&&\s*<FullCreditAnalysis\b/);
});

test('completed purge and temporary verification removed; ordinary health is read-only',()=>{
 for(const f of ['instrumentation.ts','lib/staging-history-purge.ts','scripts/platform/staging-reset.mjs'])assert.equal(fs.existsSync(f),false);
 assert.doesNotMatch(fs.readFileSync('Dockerfile','utf8'),/staging-reset/);
 const health=fs.readFileSync('app/api/health/route.ts','utf8');assert.doesNotMatch(health,/DELETE FROM|TRUNCATE|DROP TABLE|INSERT INTO|UPDATE public/);assert.doesNotMatch(health,/getPool|SELECT 1/);assert.doesNotMatch(health,/STAGING_HISTORY_PURGE|STAGING_CLIENT_DATA_RESET|verification/);
});
