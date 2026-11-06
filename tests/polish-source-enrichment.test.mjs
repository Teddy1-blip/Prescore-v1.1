import test from 'node:test';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';
import {financialFile,bkiFile,corporateBkiFile} from './fixtures/polish-sources.mjs';
async function create(rt){const r=await rt.request('/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({statements:[{fileName:'bank.txt',text:statementFixture()}]})});assert.equal(r.status,200);const {analysis}=await r.json();await rt.full(analysis.id);await rt.assign(analysis);return analysis;}
async function upload(rt,a,kind,file,user=rt.owner){const form=new FormData();form.set('analysisId',a.id);form.set('sourceType',kind);form.set('relationship','Компания-заёмщик');form.set('file',file);return rt.request('/api/source-documents',{method:'POST',body:form},user);}
async function model(rt,a,user=rt.owner){const r=await rt.request('/api/workspace-model?analysisId='+a.id,{},user);assert.equal(r.status,200);const m=await r.json();assert.equal(m.state,'READY_FULL');return m;}
async function saved(rt,a){return JSON.parse((await rt.db.prepare('SELECT payload FROM analyses WHERE id=?').bind(a.id).first()).payload);}
for(const ext of ['csv','xlsx','pdf'])test('BFO '+ext+' actual bytes → parser → normalized financials → CLIENT/BROKER → reload',async()=>{const rt=await createWorkspaceRuntime();try{const a=await create(rt),before=await model(rt,a);assert.equal(before.full.report.financialAnalysis?.history.length??0,0);const response=await upload(rt,a,'BFO',financialFile(a.companyInn,ext));assert.equal(response.status,200,await response.clone().text());const stored=await saved(rt,a);assert.equal(stored.financialStatementsV2[0].income.REVENUE.value,1200000);assert.equal(stored.financialStatementsV2[0].balance.LONG_TERM_BORROWINGS.value,100000);assert.equal(stored.financialStatementsV2[0].period.kind,'ANNUAL');const after=await model(rt,a);assert.equal(after.full.report.financialAnalysis.history.length,1);const period=after.full.report.financialAnalysis.history[0],metrics=Object.fromEntries(period.groups.flatMap(g=>g.metrics).map(m=>[m.key,m]));for(const [key,value] of Object.entries({REVENUE:1200000,NET_PROFIT:120000,ASSETS_TOTAL:1000000,EQUITY:600000,TOTAL_BORROWINGS:200000,currentRatio:3,equityRatio:0.6,netMargin:0.1}))assert.equal(metrics[key].value,value,key);assert.equal(metrics.roa.status,'PARTIAL');assert.equal(period.quality.balanceReconciled,true);const {FinancialStatements}=rt.load('app/components/workspace/client-financials.tsx');const html=renderToStaticMarkup(React.createElement(FinancialStatements,{model:after}));const limitation=html.match(/<details class="pc-trend-limitations">[\s\S]*?<\/details>/)?.[0];assert.ok(limitation,'unknown dynamics stays available in closed disclosure');assert.doesNotMatch(html.replace(limitation,''),/aria-label="Финансовые тренды"/);assert.deepEqual(after.basic.bankingFacts,before.basic.bankingFacts);assert.deepEqual((await model(rt,a,rt.broker)).full,after.full);assert.deepEqual((await model(rt,a)).full,after.full);}finally{await rt.close();}});
test('incremental bank → BFO years/replacement → credit PDF → quarterly; isolation and current evidence',async()=>{const rt=await createWorkspaceRuntime();try{const a=await create(rt),b=await create(rt),baseB=await model(rt,b),snapshots=[await model(rt,a)];for(const opts of [{period:'2024 год',revenue:1000},{period:'2025 год',revenue:1200},{period:'2025 год',revenue:1300}]){const r=await upload(rt,a,'BFO',financialFile(a.companyInn,'csv',opts));assert.equal(r.status,200,await r.clone().text());}let stored=await saved(rt,a);assert.equal(stored.financialStatementsV2.length,2);
 const retired=stored.sourceManifest.retiredFinancialUploads;
 assert.equal(retired.length,1);
 assert.equal(retired[0].replacedBy,stored.sourceManifest.bfo.sourceId);
 assert.ok(!JSON.stringify(stored.financialAnalysisV2).includes(retired[0].source.sourceId));
 assert.ok(!stored.sourceManifest.financialUploads.some(x=>x.sourceId===retired[0].source.sourceId));
 assert.equal(stored.financialAnalysisV2.latestAnnual.snapshot.income.REVENUE.value,1300000);snapshots.push(await model(rt,a));assert.equal(snapshots[1].full.report.financialAnalysis.history.length,2);const {FinancialStatements}=rt.load('app/components/workspace/client-financials.tsx');const financialHtml=renderToStaticMarkup(React.createElement(FinancialStatements,{model:snapshots[1]})).replace(/<details class="pc-trend-limitations">[\s\S]*?<\/details>/g,'');const visibleTrends=financialHtml.match(/aria-label="Финансовые тренды">[\s\S]*?<\/table>/)?.[0];assert.ok(visibleTrends);assert.match(visibleTrends,/300[\s\u00a0]*000/);assert.match(visibleTrends,/>0 ₽</);assert.ok(stored.financialAnalysisV2.trends.some(t=>t.comparability==='COMPARABLE_ANNUAL_YOY'));let r=await upload(rt,a,'BKI',bkiFile(a.companyInn));assert.equal(r.status,200,await r.clone().text());snapshots.push(await model(rt,a));r=await upload(rt,a,'QUARTERLY',financialFile(a.companyInn,'csv',{period:'Январь - Март 2026 г.'}));assert.equal(r.status,200,await r.clone().text());snapshots.push(await model(rt,a));stored=await saved(rt,a);assert.equal(stored.financialStatementsV2.length,3);assert.ok(stored.creditHistory);for(const snap of snapshots){assert.deepEqual(snap.basic.bankingFacts,snapshots[0].basic.bankingFacts);}assert.deepEqual(await model(rt,b),baseB);assert.deepEqual(await model(rt,a),snapshots[3]);assert.deepEqual((await model(rt,a,rt.broker)).full,snapshots[3].full);assert.ok(snapshots[3].basic.sources.availability.some(s=>s.source==='CREDIT_HISTORY'&&s.status==='READY'));assert.ok(snapshots[3].basic.sources.availability.some(s=>s.source==='FINANCIAL_STATEMENTS'&&s.status==='READY'));assert.ok(snapshots[3].full.report.analysisV3.observations.length>snapshots[0].full.report.analysisV3.observations.length);}finally{await rt.close();}});
test('rejected BFO/duplicate/foreign actor do not alter saved result; missing scale remains unknown',async()=>{const rt=await createWorkspaceRuntime();try{const a=await create(rt);assert.equal((await upload(rt,a,'BFO',financialFile(a.companyInn))).status,200);const before=await model(rt,a);assert.equal((await upload(rt,a,'BFO',financialFile(a.companyInn))).status,409);assert.equal((await upload(rt,a,'BFO',financialFile('7701234567'))).status,400);assert.equal((await upload(rt,a,'BFO',financialFile(a.companyInn),rt.stranger)).status,404);assert.equal((await upload(rt,a,'BFO',new File(['broken'],'broken.xlsx'))).status,400);assert.equal((await upload(rt,a,'BFO',new File([],'empty.csv'))).status,413);assert.equal((await upload(rt,a,'BFO',new File(['other'],'other.txt'))).status,415);assert.deepEqual(await model(rt,a),before);assert.equal((await upload(rt,a,'BFO',financialFile(a.companyInn,'csv',{scale:'не указана'}))).status,200);const s=await saved(rt,a);assert.equal(s.financialStatementsV2[0].income.REVENUE.value,null);assert.equal(s.financialStatementsV2[0].income.REVENUE.status,'UNKNOWN');}finally{await rt.close();}});
test('simultaneous source saves cannot overwrite each other; retry enriches latest payload',async()=>{const rt=await createWorkspaceRuntime();try{const a=await create(rt);const responses=await Promise.all([upload(rt,a,'BFO',financialFile(a.companyInn)),upload(rt,a,'QUARTERLY',financialFile(a.companyInn,'csv',{period:'Январь - Март 2026 г.'}))]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);const retry=responses[0].status===409?['BFO',financialFile(a.companyInn)]:['QUARTERLY',financialFile(a.companyInn,'csv',{period:'Январь - Март 2026 г.'})];assert.equal((await upload(rt,a,...retry)).status,200);const s=await saved(rt,a);assert.equal(s.financialStatementsV2.length,2);assert.ok(s.sourceManifest.bfo);assert.ok(s.sourceManifest.quarterly);assert.equal((await model(rt,a)).full.report.financialAnalysis.history.length,2);}finally{await rt.close();}});

test('corporate credit PDF preserves published balances, dates and overdue; partial remains unknown after reload',async()=>{
 const rt=await createWorkspaceRuntime();try{
  const a=await create(rt),other=await create(rt),otherBefore=await model(rt,other);
  assert.equal((await upload(rt,a,'BKI',corporateBkiFile(a.companyInn))).status,200);
  const first=await model(rt,a),o=first.full.report.analysisV3.portfolio[0];
  assert.equal(o.creditor.value,'Тест Банк');assert.equal(o.reportedPrincipal.value,120000);assert.equal(o.reportedPrincipal.asOf,'2026-08-02');assert.equal(o.principal.value,null);assert.equal(o.limit.value,200000);assert.equal(o.payment.value,null);assert.equal(o.paymentFrequency.value,null);assert.equal(o.nextPayment.value,9000);
  assert.equal(o.nextDate.value,'2026-11-01');assert.equal(o.maturity.value,'2028-01-01');assert.equal(o.overdue.value,0);assert.equal(o.overdue.knowledge,'KNOWN');const ai=rt.load('lib/ai-credit-analyst.ts').buildSanitizedCreditContext('Кредитная история',first);assert.equal(ai.portfolio[0].reportedPrincipal.value,120000);const {SourceAppendix}=rt.load('app/dashboard/report-v2/source-appendix.tsx');const html=renderToStaticMarkup(React.createElement(SourceAppendix,{model:first.full.report}));assert.match(html,/120(?:&#x27;|[\s\u00a0])*000/);assert.match(html,/2026-08-02/);
  assert.deepEqual((await model(rt,a,rt.broker)).full,first.full);assert.deepEqual(await model(rt,a),first);
  assert.equal((await upload(rt,a,'BKI',corporateBkiFile(a.companyInn))).status,409);
  assert.equal((await upload(rt,a,'BKI',corporateBkiFile('7701234567'))).status,400);
  assert.equal((await upload(rt,a,'BKI',corporateBkiFile(a.companyInn,{debt:'100000',reportDate:'03-08-2026'}))).status,200);
  assert.equal((await model(rt,a)).full.report.analysisV3.portfolio[0].reportedPrincipal.value,100000);
  assert.deepEqual(await model(rt,other),otherBefore);
  assert.equal((await upload(rt,other,'BKI',corporateBkiFile(other.companyInn,{debt:'нет данных',overdue:'нет данных',payment:'нет данных'}))).status,200);
  const partial=await model(rt,other),p=partial.full.report.analysisV3.portfolio[0];assert.equal(p.principal.value,null);assert.equal(p.principal.knowledge,'UNKNOWN');assert.equal(p.overdue.value,null);assert.equal(p.payment.value,null);assert.equal(p.limit.value,200000);
  assert.deepEqual(await model(rt,other),partial);assert.deepEqual((await model(rt,other,rt.broker)).full,partial.full);
 }finally{await rt.close();}
});

test('current FAILED financial envelope supersedes READY upload history without losing other years',async()=>{
 const rt=await createWorkspaceRuntime();try{
  const a=await create(rt);
  for(const period of ['2024 год','2025 год'])assert.equal((await upload(rt,a,'BFO',financialFile(a.companyInn,'csv',{period}))).status,200);
  const persisted=await saved(rt,a),before=structuredClone(persisted);
  persisted.sourceManifest.bfo.status='FAILED';
  await rt.db.prepare('UPDATE analyses SET payload = ? WHERE id = ?').bind(JSON.stringify(persisted),a.id).run();
  const current=await model(rt,a);assert.equal(current.full.report.financialAnalysis.history.length,1);assert.equal(current.full.report.financialAnalysis.history[0].period.to,'2024-12-31');
  assert.ok(current.basic.sources.availability.some(s=>s.source==='FINANCIAL_STATEMENTS'&&s.status==='FAILED'));
  const {reconciliationForAnalysis}=rt.load('lib/credit-engine/reconciliation/integration.ts');
  const facts=reconciliationForAnalysis(persisted).reconciliationV1.facts;
  const failed=facts.find(f=>f.semanticCode==='REVENUE'&&f.period.to==='2025-12-31');assert.equal(failed.value,null);assert.equal(failed.status,'UNKNOWN');
  assert.equal(facts.find(f=>f.semanticCode==='REVENUE'&&f.period.to==='2024-12-31').value,1200000);
  assert.equal(before.sourceManifest.financialUploads.length,2);assert.deepEqual((await model(rt,a,rt.broker)).full,current.full);assert.deepEqual(await model(rt,a),current);
 }finally{await rt.close();}
});


test('shared overview shows annual and quarterly enrichment without replacing annual figures',async()=>{
 const rt=await createWorkspaceRuntime();try{
 const a=await create(rt),{ExecutiveOverview}=rt.load('app/components/workspace/client-insights.tsx');
 const render=m=>renderToStaticMarkup(React.createElement(ExecutiveOverview,{model:m,choose:()=>{},retry:()=>{}}));
 assert.doesNotMatch(render(await model(rt,a)),/Годовая отчётность/);
 assert.equal((await upload(rt,a,'BFO',financialFile(a.companyInn,'csv',{period:'2025 год',revenue:1300}))).status,200);
 assert.equal((await upload(rt,a,'QUARTERLY',financialFile(a.companyInn,'csv',{period:'Январь - Март 2026 г.',revenue:300}))).status,200);
 const current=await model(rt,a),html=render(current);
 assert.match(html,/Годовая отчётность/);assert.match(html,/Промежуточная отчётность/);
 assert.match(html,/1[\s\u00a0]*300[\s\u00a0]*000/);assert.match(html,/300[\s\u00a0]*000/);
 const assigned=await model(rt,a,rt.broker);
 assert.deepEqual(assigned.full,current.full);
 const {FinancialSnapshot}=rt.load('app/components/workspace/client-financials.tsx');
 const snapshot=m=>renderToStaticMarkup(React.createElement(FinancialSnapshot,{model:m,choose:()=>{}}));
 assert.equal(snapshot(assigned),snapshot(current));
 assert.ok(html.includes(snapshot(current))&&render(assigned).includes(snapshot(assigned)));
 assert.match(render(assigned),/Открыть заключение/);
 assert.equal(render(await model(rt,a)),html);
 }finally{await rt.close();}
});

test('fresh source changes reset AI context and print consumes the same current report',async()=>{
 const rt=await createWorkspaceRuntime();try{
 const a=await create(rt),b=await create(rt),baseB=await model(rt,b);
 const {PrintReport}=rt.load('app/dashboard/report-v2/print-report.tsx');
 const ai=rt.load('lib/ai-credit-analyst.ts');
 const ask=question=>rt.request('/api/ai-analyst',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({analysisId:a.id,question})});
 assert.equal((await ask('Что известно по выписке?')).status,200);
 for(const [kind,file,question] of [
  ['BFO',financialFile(a.companyInn),'Что изменилось после добавления БФО?'],
  ['BKI',corporateBkiFile(a.companyInn),'Что изменилось после добавления кредитной истории?'],
  ['QUARTERLY',financialFile(a.companyInn,'csv',{period:'Январь - Март 2026 г.'}),'Что известно по отчётности?']
 ]){
  assert.equal((await upload(rt,a,kind,file)).status,200);
  const messages=await(await rt.request('/api/ai-analyst?analysisId='+a.id)).json();assert.deepEqual(messages.messages,[]);
  const current=await model(rt,a),broker=await model(rt,a,rt.broker);assert.deepEqual(broker.full,current.full);
  const context=ai.buildSanitizedCreditContext(question,current);
  if(kind!=='QUARTERLY'){assert.equal(context.enrichment.available,true);assert.match(context.enrichment.comparison,/Предыдущий снимок/);}
  const response=await ask(question);assert.equal(response.status,200);assert.equal((await response.json()).mode,'rules');
  const printed=renderToStaticMarkup(React.createElement(PrintReport,{model:current.full.report,realAnalysisId:a.id}));
  const brokerPrint=renderToStaticMarkup(React.createElement(PrintReport,{model:broker.full.report,realAnalysisId:a.id}));
  assert.equal(printed,brokerPrint);assert.match(printed,/1[\s\u00a0]*200[\s\u00a0]*000/);
  assert.deepEqual((await model(rt,a)).full,current.full);assert.deepEqual(await model(rt,b),baseB);
 }
 }finally{await rt.close();}
});
