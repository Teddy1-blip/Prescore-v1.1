import test from 'node:test';
import assert from 'node:assert/strict';
import './fixtures/client-report/render.mjs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const {PrintReport}=await import('../app/dashboard/report-v2/print-report.tsx');
import {reportAcceptanceModel} from './fixtures/report-local-acceptance.mjs';
import {projectPrintBanking,printPeriod} from '../lib/workspace/print-banking.ts';
const workspace=await reportAcceptanceModel();
const render=()=>renderToStaticMarkup(createElement(PrintReport,{model:workspace.full.report,banking:projectPrintBanking(workspace),realAnalysisId:workspace.analysisId})).replace(/\u00a0|\u202f/g,' ');
test('reproduction: bank outflows have their own label, unit and period in actual PrintReport',()=>{
 const h=render();assert.match(h,/<tr[^>]*>[\s\S]*?Банковские списания[\s\S]*?10 320 000 ₽[\s\S]*?01\.07\.2025 — 30\.06\.2026[\s\S]*?<\/tr>/);
 assert.match(h,/<tr[^>]*>[\s\S]*?Остаток на конец периода[\s\S]*?11 680 000 ₽[\s\S]*?01\.07\.2025 — 30\.06\.2026[\s\S]*?<\/tr>/);
});
test('reproduction: protected real print page exposes screen-only explicit print control',()=>{
 assert.match(render(),/Управление печатью/);assert.match(render(),/Печать \/ сохранить PDF/);
});
test('projection preserves exact facts, zero/unknown and input, without leaking payload or FULL data',()=>{
 const m=structuredClone(workspace),before=JSON.stringify(m);
 const p=projectPrintBanking(m);assert.equal(JSON.stringify(m),before);assert.equal(p.fullMonths,12);
 const row=label=>p.facts.find(f=>f.label===label).fact;
 assert.equal(row('Банковские поступления').value,12000000);assert.equal(row('Банковские списания').value,10320000);assert.equal(row('Остаток на начало периода').value,null);
 m.basic.bankingFacts.grossOutflow.value=0;assert.equal(projectPrintBanking(m).facts[1].fact.value,0);
 m.basic.bankingFacts.grossOutflow.status='UNKNOWN';m.basic.bankingFacts.grossOutflow.value=null;
 const html=renderToStaticMarkup(createElement(PrintReport,{model:m.full.report,banking:projectPrintBanking(m)}));
 const rows=html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g);assert.match(rows.find(r=>r.includes('Банковские списания')),/Не определено/);
 m.entitlement='BASIC';assert.equal(projectPrintBanking(m),null);
 const basic=structuredClone(workspace.full.report);basic.meta.entitlement='BASIC';assert.doesNotMatch(renderToStaticMarkup(createElement(PrintReport,{model:basic,banking:p})),/Банковские списания|11.?680.?000/);
 assert.equal('payload' in p,false);assert.equal('analysisId' in p,false);
});
test('bank source dates join actual identifiers and preserve multiple source periods',()=>{
 const m=structuredClone(workspace),bank=m.basic.sources.availability.find(s=>s.source==='BANK_STATEMENTS');
 const p=projectPrintBanking(m);assert.ok(Object.values(p.sourcePeriods).flat().includes('01.07.2025 — 30.06.2026'));
 m.basic.sources.availability.push({...bank,sourceId:'second-bank',periodFrom:'2024-01-01',periodTo:'2024-12-31'});
 const ref=m.full.canonical.explainability.sourceReferences.find(r=>r.sourceKind==='BANK_STATEMENT');ref.sourceIds.push('second-bank');
 const both=Object.values(projectPrintBanking(m).sourcePeriods).flat();assert.ok(both.includes('01.01.2024 — 31.12.2024'));assert.ok(both.includes('01.07.2025 — 30.06.2026'));
 for(const r of m.full.canonical.explainability.sourceReferences)if(r.sourceKind==='BANK_STATEMENT')r.sourceIds=['unrelated'];
 assert.deepEqual(projectPrintBanking(m).sourcePeriods,{});
 m.basic.sources.availability=m.basic.sources.availability.filter(s=>s.source!=='BANK_STATEMENTS');assert.equal(projectPrintBanking(m),null);
 assert.equal(printPeriod(null,null),'Период не указан');assert.equal(printPeriod('2026-02-30',null),'Период не указан');assert.equal(printPeriod(null,'2026-06-30'),'По 30.06.2026; начало периода не указано');
});
