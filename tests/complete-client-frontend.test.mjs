import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {businessCatalog,loadBusiness} from '../lib/credit-engine/credit-lab/business-corpus.mjs';
import {buildCanonicalCreditAnalysis} from '../lib/credit-engine/production/orchestrator.ts';
import {publicCanonicalModel} from '../lib/credit-engine/production/public-model.ts';
import {projectWorkspaceBasic,WORKSPACE_MODEL_V1} from '../lib/workspace/model.ts';
import {buildClientReportModel} from '../lib/credit-engine/client-report/adapter.ts';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
function workspace(input){const c=buildCanonicalCreditAnalysis(input);return {version:WORKSPACE_MODEL_V1,state:'READY_FULL',analysisId:c.analysisId,access:{role:'OWNER',readOnly:false},entitlement:'FULL',fullAvailability:'READY',basic:projectWorkspaceBasic(input.analysis),full:{report:publicCanonicalModel(c.model,c),canonical:{prescoreIndex:c.prescoreIndex,financingReadiness:c.financingReadiness,creditAssessment:c.creditAssessment,debtCapacity:c.debtCapacity,productSelection:c.productSelection,recommendations:c.recommendationSet,actionPlan:c.actionPlan,explainability:c.explainability,expertise:null}}};}
test('complete CLIENT renders current business corpus with field coverage and immutable canonical data',async t=>{
 const rt=await createWorkspaceRuntime();try{
 const sections=rt.load('app/components/workspace/client-credit-sections.tsx'),sources=rt.load('app/components/workspace/client-source-sections.tsx'),{ClientOverview}=rt.load('app/components/workspace/client-overview.tsx'),{BankingAnalysis}=rt.load('app/components/workspace/presentation.tsx'),{PortfolioDepth}=rt.load('app/components/workspace/credit-depth.tsx'),{bankingFieldLabels}=rt.load('app/components/workspace/banking-ledger.tsx');
 const screens=[ClientOverview,BankingAnalysis,sections.CreditAnalysisScreen,sources.FinancialAnalysisScreen,PortfolioDepth,sources.ReconciliationScreen,sections.ProductFitScreen,sections.RecommendationsScreen,sections.SourcesScreen];
 const render=(C,model)=>renderToStaticMarkup(React.createElement(C,{model}));
 for(const entry of businessCatalog())await t.test(entry.caseId,()=>{
  const input=loadBusiness(entry.caseId).input,model=workspace(input),before=JSON.stringify(model),r=model.full.report;
  const html=screens.map(C=>render(C,model)).join('\n');assert.equal(JSON.stringify(model),before);
  assert.doesNotMatch(html,/NaN|undefined|Infinity/);
  for(const key of Object.keys(model.basic.bankingFacts))assert.ok(key==='monthly'||key==='topCounterparties'||key==='seasonality'||key==='balanceCheck'||key==='operationListTruncated'||key in bankingFieldLabels,'unclassified basic banking field '+key);
  assert.ok(html.includes('Устойчивость поступлений и сезонность'));
  for(const key of Object.keys(bankingFieldLabels)){
   const fact=model.basic.bankingFacts[key];
   const published=fact.value!==null&&Number.isFinite(fact.value)&&!['UNKNOWN','NOT_APPLICABLE'].includes(fact.status);
   assert.equal(html.includes('data-banking-fact="'+key+'"'),published,key);
  }
  for(const f of [...r.primaryFactors,...r.contextHighlights,...r.readiness.constraints,...r.capacity.details,...r.dataQuality,...r.limitations,...r.detailedSections.flatMap(s=>s.factors),...r.actionPlan.rerun].filter(f=>model.full.canonical.explainability.claims.find(c=>c.claimId===f.claimId)?.claimKind!=='INDEX_CONTRIBUTION'))assert.ok(html.includes(escape(f.title)),'factor missing '+f.id);
  for(const c of r.index.components){assert.ok(html.includes(escape(c.label)));assert.ok(html.includes(escape(c.score.value===null?'Не определено':c.score.display)));assert.ok(html.includes(escape(c.maximum.value===null?'Не опубликован':c.maximum.display)));}
  for(const a of [...r.recommendations.primary,...r.recommendations.backlog,...r.actionPlan.horizons.flatMap(h=>h.items)]){assert.ok(html.includes(escape(a.title)));for(const text of [a.summary,a.why,...a.steps,...a.evidence,a.recheck])assert.ok(html.includes(escape(text)),'action text missing '+a.id);}
  for(const p of [...r.productFit.primary,...r.productFit.other])for(const text of [p.title,p.fit,p.purpose,p.capacity,p.requested,...p.missing])assert.ok(html.includes(escape(text)),'product missing '+p.id);
  for(const s of r.sources)assert.ok(html.includes(escape(s.label)));
  for(const i of r.expertise?.items??[])for(const text of [i.title,i.fact,i.interpretation,i.impact,i.limitation,...i.closure])assert.ok(html.includes(escape(text)),'expertise missing '+i.id);
  for(const period of r.financialAnalysis?.history??[])for(const g of period.groups)for(const m of g.metrics)assert.ok(html.includes(escape(m.label)));
  for(const f of r.reconciliation?.findings??[])assert.ok(html.includes(escape(f.title)));
  const sharedHome=render(rt.load('app/components/workspace/client-insights.tsx').ExecutiveOverview,model);
  for(const finding of r.externalSummary??[]) assert.ok(sharedHome.includes(escape(finding.label))&&sharedHome.includes(escape(finding.value)));
  const riskDetails=render(rt.load('app/components/workspace/profile-sections.tsx').RiskSections,model);
  for(const rule of r.bankRuleCoverage??[]) {
   assert.ok(rule.reasons.length,'missing rule diagnostics '+rule.code);
   assert.ok(riskDetails.includes(rule.code)&&riskDetails.includes(escape(rule.reasons.join(', '))));
  }
  if(r.checko){
   const external=render(rt.load('app/components/workspace/profile-overview.tsx').CheckoOverview,model);
   assert.ok(external.includes('Checko'));
   for(const row of r.checko.rows)assert.ok(external.includes(escape(row.value))&&row.sourceId);
  }
  const allowed=new Set(['checko','bankRuleCoverage','externalSummary','hero','index','readiness','capacity','primaryFactors','contextHighlights','productFit','recommendations','actionPlan','dataQuality','detailedSections','sources','limitations','expertise','analysisV3','financialAnalysis','reconciliation','visual','meta','company','printMeta','technical']);
  assert.deepEqual(Object.keys(r).filter(k=>!allowed.has(k)),[],'new report field needs presentation classification');
 });
 await t.test('A → B → A rendering retains no preceding model',()=>{const a=workspace(loadBusiness('CL-RU-BUS-001').input),b=workspace(loadBusiness('CL-RU-BUS-002').input);a.basic.analysis.company.name='COMPANY_A_SENTINEL';b.basic.analysis.company.name='COMPANY_B_SENTINEL';const first=render(ClientOverview,a),second=render(ClientOverview,b),again=render(ClientOverview,a);assert.equal(first,again);assert.ok(!second.includes('COMPANY_A_SENTINEL'));assert.ok(second.includes('COMPANY_B_SENTINEL'));});
 await t.test('known zero and unknown never merge',()=>{const m=workspace(loadBusiness('CL-RU-BUS-001').input);m.basic.bankingFacts.grossInflow.value=0;m.basic.bankingFacts.grossInflow.status='KNOWN';m.basic.bankingFacts.grossOutflow.value=987654321;m.basic.bankingFacts.grossOutflow.status='UNKNOWN';const html=render(ClientOverview,m);assert.match(html,/Внешние поступления<\/dt><dd>0 ₽/);assert.match(html,/Внешние списания<\/dt><dd>Не определено/);assert.ok(!html.includes('987'));});
 await t.test('internal contribution and modifier bindings never render as client evidence',()=>{const m=workspace(loadBusiness('CL-RU-BUS-001').input),c=m.full.canonical.explainability.claims.find(c=>c.claimKind!=='INDEX_CONTRIBUTION');c.valueBindings.push({bindingCode:'contextModifierPercent',rawValue:654321,unit:'PERCENT',formattedValueRu:'INTERNAL_MODIFIER_SENTINEL',sourceReferenceIds:[],canonicalPath:[]});const {Evidence}=rt.load('app/components/workspace/credit-depth.tsx');const html=renderToStaticMarkup(React.createElement(Evidence,{model:m,claimIds:[c.claimId]}));assert.ok(!html.includes('INTERNAL_MODIFIER_SENTINEL'));});
 await t.test('all new deep links and readonly gates resolve',()=>{const {resolveClientView,clientAvailableViews}=rt.load('app/components/workspace/client.tsx');for(const view of ['banking','analysis','obligations','financing','applications','documents','analyst','upload'])assert.equal(resolveClientView(view),view);assert.equal(resolveClientView('unknown'),'home');assert.ok(!clientAvailableViews({},true).includes('upload'));assert.ok(!clientAvailableViews({report:false},false).includes('banking'));});
 }finally{await rt.close();}
});
test('public financial/reconciliation extension copies values and excludes raw sources and formulas',()=>{
 for(const entry of businessCatalog()){const c=buildCanonicalCreditAnalysis(loadBusiness(entry.caseId).input),before=JSON.stringify(c),p=publicCanonicalModel(c.model,c);assert.equal(JSON.stringify(c),before);
  for(const [i,h]of (p.financialAnalysis?.history??[]).entries())for(const g of h.groups)for(const metric of g.metrics){const original=c.financialAnalysis.history[i][g.key][metric.key];for(const key of ['value','unit','status','confidence','origin','periodFrom','periodTo','asOf'])assert.deepEqual(metric[key],original[key]);}
  assert.deepEqual(p.reconciliation.findings.map(f=>f.outcome),c.reconciliation.findings.map(f=>f.outcome));
  assert.doesNotMatch(JSON.stringify({financial:p.financialAnalysis,reconciliation:p.reconciliation}),/rawValue|rawLabel|contentHash|calculationBasis|confirmedScale|accountNumber|contractNumber|policyFingerprint/);
  const free=publicCanonicalModel(buildClientReportModel(c,{entitlement:'FREE'}),c);assert.equal(free.financialAnalysis,undefined);assert.equal(free.reconciliation,undefined);
 }
});
test('new CLIENT modules introduce no analytical formulas, legacy fields or network side effects',()=>{
 for(const file of ['client-overview.tsx','client-credit-sections.tsx','client-source-sections.tsx','banking-ledger.tsx']){const s=fs.readFileSync('app/components/workspace/'+file,'utf8');assert.doesNotMatch(s,/analysis\.(?:score|grade|readiness|factors)|estimatedLimit|stressLimit|baseMonthlyPaymentCapacity|UnifiedRiskContext|compareCreditPortfolio|fetch\(|\/engine|\?\?\s*0|\|\|\s*0/);}
});

test('four explicit source sets preserve bank results and reveal only existing financial/portfolio outputs',async()=>{
 const {analyzeBankStatements}=await import('../lib/prescore.ts');
 const {statementFixture}=await import('./fixtures/block1-statements.mjs');
 const {bank}=await import('./fixtures/debt-capacity/builders.mjs');
 const {profile,snapshot,source,bki,row,inn,date}=await import('./fixtures/credit-lab/builders.mjs');
 for(const [name,financial,credit,legal]of [['BANK_ONLY',false,false,false],['BANK_BFO',true,false,false],['BANK_BKI',false,true,false],['FULL_SOURCE_SET',true,true,true]]){
  const a=analyzeBankStatements([{fileName:'coverage.txt',text:statementFixture({inn})}]);a.id=name;a.periodFrom='2025-07-01';a.periodTo=date;a.metricsV2=bank();a.sourceManifest.bankStatements=[source('BANK_STATEMENT',{sourceId:'cap-bank',periodFrom:a.periodFrom,periodTo:date})];a.debtPaymentObservationsV1=[];a.creditPortfolioV1=undefined;
  if(financial){const s=snapshot();a.sourceManifest.bfo=s.source;a.financialStatementsV2=[s];}
  if(credit){a.creditHistory=bki({obligations:[row({overdueAmount:0,maxDelinquencyDays:0,monthlyPayment:100000,nextPaymentAmount:100000,nextPaymentDate:'2026-07-15'})]});a.sourceManifest.bki=source('BKI');}
  const m=workspace({analysis:a,...(legal?{companyProfile:profile()}:{})});assert.notEqual(m.basic.bankingFacts.operatingInflow.value,null,name);assert.equal(Boolean(m.full.report.financialAnalysis?.history.length),financial,name);assert.equal(Boolean(m.full.report.analysisV3.portfolio.length),credit,name);
 }
});
