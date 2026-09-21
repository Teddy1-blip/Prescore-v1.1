import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeBankStatements, analysisForStorage} from '../lib/prescore.ts';
import {statementFixture} from './fixtures/block1-statements.mjs';
import {buildCanonicalCreditAnalysis} from '../lib/credit-engine/production/orchestrator.ts';
import {loadCanonicalReport} from '../lib/credit-engine/production/report-service.ts';
function input() {
 // Anonymous reproduction: multiple accounts with a partial boundary month, coverage starts in the month
 // before the first transaction. No client transactions, amounts or identifiers.
 return analyzeBankStatements([1,2].map(n=>({fileName:`anonymous-${n}.txt`,text:statementFixture({inn:'9900000001',account:`4070281011111000000${n}`,periodFrom:'30.06.2025',periodTo:'31.07.2025',transactionDate:'07.07.2025',number:String(n)})})));
}
test('source-period integration covers zero-transaction boundary month without changing legacy period',()=>{
 const a=input();assert.equal(a.periodFrom,'2025-07-07');
 assert.equal(a.metricsV2.period.from,'2025-06-30');assert.equal(a.metricsV2.period.to,'2025-07-31');
 assert.equal(a.metricsV2.monthly[0].month,'2025-06');assert.equal(a.metricsV2.monthly[0].coverage,'PARTIAL');
 assert.equal(a.metricsV2.monthly[1].coverage,'FULL');
 assert.equal(a.metricsV2.period.overlapMonths,0);
 const c=buildCanonicalCreditAnalysis({analysis:analysisForStorage(a)});
 assert.equal(c.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,null);
 assert.equal(c.financingReadiness.level,'UNKNOWN');assert.equal(c.prescoreIndex.value,null);
});
test('every metric uses declared period; daily balance includes days without transactions',()=>{
 const a=analyzeBankStatements([{fileName:'anonymous.txt',text:statementFixture({inn:'9900000001'})}]);
 assert.equal(a.metricsV2.period.from,'2026-07-01');assert.equal(a.metricsV2.period.to,'2026-07-31');
 assert.equal(a.metricsV2.liquidity.averageDailyBalance.periodFrom,'2026-07-01');
 const expected=(14*50000+17*150000)/31;
 assert.ok(Math.abs(a.metricsV2.liquidity.averageDailyBalance.value-expected)<0.01);
 assert.doesNotThrow(()=>buildCanonicalCreditAnalysis({analysis:analysisForStorage(a)}));
});
test('real failure shape: stored calendar outside old transaction period remains explicit and read-only',async()=>{
 const a=analysisForStorage(input());a.metricsV2.period.from=a.periodFrom;a.metricsV2.period.to=a.periodTo;
 const payload=JSON.stringify(a);let sourceReads=0;
 const r=await loadCanonicalReport(a.id,{readAccess:async()=>({row:{payload,companyInn:a.companyInn},access:'owner'}),readTier:async()=> 'FULL',readProfile:async()=>undefined,includeInputDiagnostics:true,readSourceAvailability:async()=>{sourceReads++;return {documents:0,inlineDocuments:0,storedDocuments:0,analysisDocuments:0};}});
 assert.equal(r.diagnostic.stage,'CAPACITY');assert.equal(r.diagnostic.reason,'MONTH_OUTSIDE_BANK_PERIOD');
 assert.equal(r.inputSummary.profilePresent,false);assert.equal(sourceReads,1);assert.equal(JSON.stringify(a),payload);
});
