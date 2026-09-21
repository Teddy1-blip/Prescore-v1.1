import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyzeBankStatements, analysisForStorage} from '../lib/prescore.ts';
import {statementFixture} from './fixtures/block1-statements.mjs';
import {bank as fullBank, scenario} from './fixtures/debt-capacity/builders.mjs';
import {profile, snapshot, source, bki, row, inn, date} from './fixtures/credit-lab/builders.mjs';
import {buildCanonicalCreditAnalysis, canonicalAsOf, canonicalExplanationContext, CanonicalUnavailable} from '../lib/credit-engine/production/orchestrator.ts';
import {loadCanonicalReport} from '../lib/credit-engine/production/report-service.ts';
import {buildClientReportModel} from '../lib/credit-engine/client-report/adapter.ts';
import {resolveAnalysisTier} from '../lib/entitlements.ts';
function actualParserInput() {
 const first=statementFixture({inn,periodFrom:'01.06.2026',periodTo:'30.06.2026',transactionDate:'01.06.2026'});
 const last=statementFixture({inn,periodFrom:'01.06.2026',periodTo:'30.06.2026',transactionDate:'30.06.2026',number:'2'});
 const analysis=analyzeBankStatements([{text:first.replace('КонецФайла',last.slice(last.indexOf('СекцияДокумент'))),fileName:'synthetic-wiring.txt'}]);
 // Test observation time is explicit and fixed, never a production clock override.
 analysis.sourceManifest.bankStatements.forEach(s=>s.receivedAt=date);
 return analysis;
}
function dataset({bfo=false,legal=false,credit=false}={}) {
 const analysis=actualParserInput();analysis.id='wiring-test';analysis.periodFrom='2025-07-01';analysis.periodTo=date;
 analysis.metricsV2=fullBank();analysis.sourceManifest.bankStatements=[source('BANK_STATEMENT',{sourceId:'cap-bank',periodFrom:'2025-07-01',periodTo:date})];
 analysis.debtPaymentObservationsV1=[];analysis.creditPortfolioV1=undefined;
 if(bfo){const s=snapshot();analysis.sourceManifest.bfo=s.source;analysis.financialStatementsV2=[s];}
 if(credit){analysis.creditHistory=bki({obligations:[row({overdueAmount:0,maxDelinquencyDays:0,monthlyPayment:100000,nextPaymentAmount:100000,nextPaymentDate:'2026-07-15'})]});analysis.sourceManifest.bki=source('BKI');}
 return {analysis,...(legal?{companyProfile:profile()}: {})};
}
for(const [name,options] of [['A bank only',{}],['B bank + BFO',{bfo:true}],['C bank + BFO + legal',{bfo:true,legal:true}],['D bank + BFO + BKI',{bfo:true,credit:true}],['E complete available source families',{bfo:true,legal:true,credit:true}]]) {
 test(name,()=>{const x=dataset(options),before=JSON.stringify(x),c=buildCanonicalCreditAnalysis(x);assert.equal(c.model.company.inn,inn);assert.equal(c.model.index.value?.value,c.prescoreIndex.value);assert.equal(c.model.capacity.headline?.value,c.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential);assert.equal(JSON.stringify(x),before);assert.deepEqual(buildCanonicalCreditAnalysis(x),c);assert.equal(c.actionPlan.day7.checkpointDate,'2026-07-07');});
}
test('real parser → storage projection → canonical report, without fixture fallback',()=>{const a=analysisForStorage(actualParserInput());const c=buildCanonicalCreditAnalysis({analysis:a});assert.equal(c.model.company.name,a.companyName);assert.equal(c.prescoreIndex.status,'INSUFFICIENT_DATA');assert.equal(c.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,null);});
test('F absent evidence is unknown, absent scenarios stay absent',()=>{const c=buildCanonicalCreditAnalysis(dataset());assert.equal(c.prescoreIndex.value,null);assert.equal(c.financingReadiness.level,'UNKNOWN');assert.equal(c.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,null);assert.deepEqual(c.debtCapacity.scenarioResults,[]);assert.ok(c.riskAssessment.facts.filter(f=>f.semanticCode.startsWith('FIN_')).every(f=>f.value===null));assert.ok(c.model.dataQuality.length);});
test('missing bank canonical metrics fails closed, never legacy fallback',()=>{const x=dataset();delete x.analysis.metricsV2;assert.throws(()=>buildCanonicalCreditAnalysis(x),e=>e instanceof CanonicalUnavailable&&e.stage==='BANK_METRICS_REQUIRED');});
test('G invalid source date and reversed period fail closed',()=>{const x=dataset();x.analysis.sourceManifest.bankStatements[0].receivedAt='2026-02-30';assert.throws(()=>buildCanonicalCreditAnalysis(x),CanonicalUnavailable);x.analysis.sourceManifest.bankStatements[0].receivedAt=date;x.analysis.periodFrom='2027-01-01';assert.throws(()=>buildCanonicalCreditAnalysis(x),CanonicalUnavailable);});
test('stored full-month/transaction-range defect is reported, never silently rewritten',()=>{const a=analyzeBankStatements([{text:statementFixture(),fileName:'synthetic-defect.txt'}]);assert.throws(()=>buildCanonicalCreditAnalysis({analysis:a}),e=>e.stage==='CAPACITY');});
test('cutoff uses source observations and preserves separate bank period',()=>{const x=dataset({legal:true});x.companyProfile.fetchedAt='2026-07-02T12:00:00Z';assert.equal(canonicalAsOf(x),'2026-07-02');const c=buildCanonicalCreditAnalysis(x);assert.equal(c.asOfDate,'2026-07-02');assert.equal(c.riskAssessment.facts.find(f=>f.semanticCode==='BANK_TOP1').period.to,date);});
test('legacy scores, limits, and display transactions cannot influence canonical output',()=>{const x=dataset({bfo:true,legal:true,credit:true}),c=buildCanonicalCreditAnalysis(x);x.analysis.score=-999;x.analysis.readiness='LEGACY_SENTINEL';x.analysis.metrics.estimatedLimitMax=999999999;x.analysis.transactions=[];x.analysis.transactionsTruncated=true;assert.deepEqual(buildCanonicalCreditAnalysis(x),c);});
test('scenario calculation only with explicit evidence-backed rate and term',()=>{const x=dataset({bfo:true,legal:true,credit:true});x.scenarios=[12,24,36].map(n=>scenario({scenarioId:'explicit-'+n,termMonths:n}));const c=buildCanonicalCreditAnalysis(x);assert.deepEqual(c.debtCapacity.scenarioResults.map(s=>s.termMonths).sort((a,b)=>a-b),[12,24,36]);});
test('J report model uses actual upstream outputs and has explainability lineage',()=>{const c=buildCanonicalCreditAnalysis(dataset({bfo:true,legal:true,credit:true}));assert.deepEqual(buildClientReportModel(c,{entitlement:'FULL',mode:'SAVED_ANALYSIS'}),c.model);const claims=new Set(c.explainability.claims.map(c=>c.claimId));assert.ok(c.model.technical.claimIds.every(id=>claims.has(id)));assert.deepEqual(canonicalExplanationContext(c).report,c.model);});
test('I FREE projection contains no paid fields',()=>{const c=buildCanonicalCreditAnalysis(dataset());const free=buildClientReportModel(c,{entitlement:'FREE'});assert.equal(free.index.value,null);assert.equal(free.capacity.headline,null);assert.deepEqual(free.actionPlan.horizons,[]);});
function deps(access,tier='FULL') {return {readAccess:async()=>access,readTier:async()=>tier,readProfile:async()=>undefined};}
const owned=()=>({row:{payload:JSON.stringify(dataset().analysis),companyInn:inn,ownerEmail:'fixture@example.test'},access:'owner'});
test('H unauthorized lookup stops before profile/calculation',async()=>{const d=deps(null);d.readTier=()=>assert.fail('tier before access');d.readProfile=()=>assert.fail('profile before access');assert.deepEqual(await loadCanonicalReport('other',d),{status:'NOT_FOUND'});});
test('I FREE denies calculation and never loads full inputs',async()=>{const d=deps(owned(),'FREE');d.readProfile=()=>assert.fail('profile for FREE');assert.deepEqual(await loadCanonicalReport('wiring-test',d),{status:'LOCKED'});});
for(const access of ['owner','agent','admin'])test('authorized '+access+' receives only presentation',async()=>{const a=owned();a.access=access;const r=await loadCanonicalReport('wiring-test',deps(a));assert.equal(r.status,'READY');assert.deepEqual(Object.keys(r).sort(),['model','status']);});
test('saved identity cannot cross clients',async()=>{assert.equal((await loadCanonicalReport('other',deps(owned()))).status,'UNAVAILABLE');});
test('read-only entitlement resolves existing paid access without writes',async()=>{let writes=0;const db={prepare:sql=>({bind(){return this},run:async()=>{writes++;throw Error('write forbidden')},first:async()=>sql.includes('SELECT tier')?{tier:'FULL'}:null})};assert.equal(await resolveAnalysisTier(db,{analysisId:'test',userEmail:'fixture@example.test',companyInn:inn,readOnly:true}),'FULL');assert.equal(writes,0);});
test('real route has access/entitlement boundary and fixture branch is explicit',()=>{const s=fs.readFileSync('app/dashboard/report-v2/page.tsx','utf8');assert.ok(s.includes('requireApiUser()'));assert.ok(s.includes('readableAnalysis(db, id, user)'));assert.ok(s.includes('readOnly: true'));assert.ok(s.indexOf('if (query.analysisId)')<s.indexOf('if (query.sample)'));assert.ok(!/UPDATE |INSERT |CREATE |ALTER /.test(s));});
test('public model redacts policy constants without changing numeric results',async()=>{const r=await loadCanonicalReport('wiring-test',deps(owned()));assert.equal(r.status,'READY');assert.equal(r.model.meta.mode,'SAVED_ANALYSIS');assert.doesNotMatch(JSON.stringify(r.model),/20_PERCENT|25_PERCENT|обслуживания 20%|обслуживания 25%/);});
