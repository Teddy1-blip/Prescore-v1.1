import test from 'node:test';import assert from 'node:assert/strict';
import {loadBusiness} from '../lib/credit-engine/credit-lab/business-corpus.mjs';
import {buildCanonicalCreditAnalysis} from '../lib/credit-engine/production/orchestrator.ts';
import {analyzeBankStatements,analysisForStorage} from '../lib/prescore.ts';
import {analyzeCalendarCoverage} from '../lib/credit-engine/source-foundation.ts';
import {adaptUploadedBki} from '../lib/credit-engine/credit-portfolio/bki-adapter.ts';
import {deduplicateTransactions} from '../lib/credit-engine/normalization/deduplication.ts';
import {assertIsolatedConflict} from '../lib/credit-engine/credit-lab/conflict-oracle.mjs';
import {validateConflictKnowledge} from '../lib/credit-engine/metrics/conflicts.ts';
const eq=assert.deepEqual;
const b22=loadBusiness('CL-RU-BUS-022');
const tx=b22.full.deduplication.conflicts[0].variants.map(v=>v.observations[0]);
const source=(sourceId,account,periodFrom='2025-01-01',periodTo='2025-12-31')=>({sourceId,periodFrom,periodTo,accountCoverage:[{account,periodFrom,periodTo}]});
for(const [name,ss,expected]of [
 ['one full account',[source('a','1')],12],['two full accounts',[source('a','1'),source('b','2')],12],
 ['same account overlapping files',[source('a','1'),source('b','1')],0],['exact repeated source',[source('a','1'),source('a','1')],12],
 ['one account has missing first half',[source('a','1'),source('b','2','2025-07-01')],6],
 ['disjoint split of account',[source('a','1','2025-01-01','2025-06-30'),source('b','1','2025-07-01')],12]])test('010 '+name,()=>eq(analyzeCalendarCoverage(ss).filter(m=>m.status==='FULL').length,expected));
test('010 gaps on different days do not invent common covered days',()=>{const c=analyzeCalendarCoverage([source('a','1','2025-01-01','2025-01-15'),source('b','2','2025-01-16','2025-01-31')]);eq(c[0].daysCovered,0);eq(c[0].status,'PARTIAL');});
test('010 own transfers neutral; covered zero month FULL',()=>{const b=loadBusiness('CL-RU-BUS-010');eq(b.full.metricsV2.period.fullMonths,12);eq(b.full.metricsV2.operating.operatingCashReceipts.value,12000000);const own=b.full.transactions.filter(t=>t.classification.primaryCategory==='INTERNAL_TRANSFER');eq(own.length,24);eq(own.reduce((s,t)=>s+(t.direction==='in'?t.amount:-t.amount),0),0);const z=loadBusiness('CL-RU-BUS-023');eq(z.full.metricsV2.monthly[0].coverage,'FULL');eq(z.full.metricsV2.monthly[0].operatingReceipts,0);});
const b13=loadBusiness('CL-RU-BUS-013');
for(const [name,value,provenance,expected]of [
 ['reported zero',0,{origin:'REPORTED',value:0,reference:'source:history'},0],['missing',undefined,undefined,null],['null',null,undefined,null],
 ['bare default zero',0,undefined,null],['tagged parser default',0,{origin:'PARSER_DEFAULT',value:0,reference:'default'},null],
 ['estimated zero',0,{origin:'ESTIMATED',value:0,reference:'estimate'},null],['conflicted zero',0,{origin:'CONFLICTED',value:0,reference:'conflict'},null],
 ['positive history',60,undefined,60],['stale provenance',0,{origin:'REPORTED',value:60,reference:'source:history'},null]])test('013 '+name,()=>{
 const r=structuredClone(b13.input.analysis.creditHistory),o=r.obligations[0];delete o.fieldProvenance;if(value===undefined)delete o.maxDelinquencyDays;else o.maxDelinquencyDays=value;
 if(provenance)o.fieldProvenance={maxDelinquencyDays:provenance};const before=JSON.stringify(r);
 const s=adaptUploadedBki(r,{companyInn:r.subjectInn,source:b13.input.analysis.sourceManifest.bki});eq(s.obligations[0].fields.delinquencyDays.value,expected);eq(s.obligations[0].fields.overdueAmount.value,1000);eq(JSON.stringify(r),before);
});
test('013 production current overdue independent of confirmed zero history',()=>{const r=buildCanonicalCreditAnalysis(b13.input);eq(r.riskAssessment.facts.find(f=>f.semanticCode==='BKI_OVERDUE').value,1000);eq(r.riskAssessment.facts.find(f=>f.semanticCode==='BKI_HISTORY_DAYS').value,0);});
test('022 strict approved invariant through report model',()=>assertIsolatedConflict(b22,buildCanonicalCreditAnalysis(b22.input)));
test('022 exact copies, different documents/accounts, insufficient identity, immutable inputs',()=>{
 const before=JSON.stringify(tx);eq(deduplicateTransactions([tx[0],structuredClone(tx[0])]).retained.length,1);
 eq(deduplicateTransactions(tx).retained.length,0);eq(deduplicateTransactions(tx).conflicts[0].variants.length,2);
 for(const changed of [{bankDocumentId:'different-document'},{companyAccount:'another-account'},{bankDocumentId:null}]){const out=deduplicateTransactions([tx[0],{...structuredClone(tx[1]),...changed}]);eq(out.conflicts.length,0);eq(out.retained.length,2);}
 const sameAmountDifferentDocument={...structuredClone(tx[0]),bankDocumentId:'legitimate-second',transactionId:'another'};eq(deduplicateTransactions([tx[0],sameAmountDifferentDocument]).retained.length,2);eq(JSON.stringify(tx),before);
});
test('022 permutation and repeated versions preserve subtotal, UNKNOWN and unique evidence versions',()=>{
 const before=JSON.stringify(b22.statements);
 for(const statements of [[...b22.statements].reverse(),[...b22.statements,b22.statements[0]],[...b22.statements,b22.statements[1]]]){
  const full=analyzeBankStatements(statements),input={...b22.input,analysis:{...b22.input.analysis,...analysisForStorage(full),creditHistory:b22.input.analysis.creditHistory,financialStatementsV2:b22.input.analysis.financialStatementsV2,sourceManifest:{...b22.input.analysis.sourceManifest,bankStatements:full.sourceManifest.bankStatements.map(s=>({...s,receivedAt:b22.caseSpec.asOfDate}))}}};
  const bundle={...b22,statements,full,input};assertIsolatedConflict(bundle,buildCanonicalCreditAnalysis(input));
 }eq(JSON.stringify(b22.statements),before);
});
for(const amount of [200000,201000])test('022 explicit isolated resolution '+amount,()=>{
 const group=b22.full.deduplication.conflicts[0],v=group.variants.find(v=>v.observations[0].amount===amount);
 const full=analyzeBankStatements(b22.statements,{conflictResolutions:[{identity:group.identity,versionKey:v.versionKey,confirmationReference:'test-only-explicit-confirmation'}]});
 eq(full.metricsV2.operating.operatingCashReceipts.value,11800000+amount);eq(full.deduplication.conflicts,undefined);
 eq(full.transactions.filter(t=>t.bankDocumentId==='00-S-0000').length,1);
});
test('022 null monthly amount requires actual conflict provenance; numeric invention rejected',()=>{
 const m=structuredClone(b22.full.metricsV2);validateConflictKnowledge(m);m.monthly[0].operatingReceipts=12000000;assert.throws(()=>validateConflictKnowledge(m),/CONFLICT_LINEAGE/);
});
test('healthy controls retain numeric operating totals and capacity; missing-data control remains unknown',()=>{
 const b=loadBusiness('CL-RU-BUS-001'),r=buildCanonicalCreditAnalysis(b.input);eq(b.full.metricsV2.operating.operatingCashReceipts.value,12000000);eq(r.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,100000);
 const missing=buildCanonicalCreditAnalysis(loadBusiness('CL-RU-BUS-016').input);eq(missing.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,null);
});

test('011 absent account period does not supply a representative company average',()=>{const b=loadBusiness('CL-RU-BUS-011');eq(b.full.metricsV2.operating.fullMonthOperatingAverage.value,null);assert.ok(b.full.metricsV2.operating.fullMonthOperatingAverage.warnings.includes('UNOBSERVED_ACCOUNT_PERIOD'));});
test('022 fabricated null without conflict evidence still fails the capacity validator',()=>{const input=structuredClone(b22.input);delete input.analysis.metricsV2.conflicts;assert.throws(()=>buildCanonicalCreditAnalysis(input),e=>e.stage==='CAPACITY');});
