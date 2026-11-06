import assert from 'node:assert/strict';
import test from 'node:test';
import {buildCanonicalCreditAnalysis} from '../lib/credit-engine/production/orchestrator.ts';
import {scenario} from './fixtures/stage5-decision.mjs';

// Numerical expectations for the accepted business corpus come from the independent
// Stage-4 parent. The targeted variants below exercise explicit policy boundaries.
const ordinary='NOT_TRIGGERED_WITH_AVAILABLE_DATA',stop='NOT_RATABLE_GLOBAL_STOP',gap='INSUFFICIENT_DATA',partial='PARTIAL';
const confirm='CONFIRM_NEW_OBLIGATION_TERMS',verify='VERIFY_CURRENT_OVERDUE_BALANCE';
const noProducts=[],wc=['REVOLVING_CREDIT_LINE','CREDIT_LINE','OVERDRAFT'];
const cases=[
 // Case, source variant, stop state, index, readiness, top action, product families
 [1,'ready',ordinary,1000,'MEDIUM',confirm,wc],
 [11,'legacy',ordinary,null,'UNKNOWN','UPLOAD_COMPLETE_BANK_STATEMENT_PERIOD',noProducts],
 [17,'legacy','TRIGGERED',null,'NOT_READY','VERIFY_LIQUIDATION_STAGE',noProducts],
 [1,'bankrupt','TRIGGERED',null,'NOT_READY','VERIFY_BANKRUPTCY_PROCEDURE',noProducts],
 [1,'terminated','TRIGGERED',null,'NOT_READY','VERIFY_ENTITY_TERMINATION',noProducts],
 [1,'rnp','TRIGGERED',null,'NOT_READY','VERIFY_RNP_RECORD',noProducts],
 [1,'excluded',ordinary,1000,'MEDIUM',confirm,noProducts],
 [1,'unverified',gap,1000,'MEDIUM',confirm,noProducts],
 [1,'aggregator',gap,1000,'MEDIUM',confirm,noProducts],
 [1,'delinquent',ordinary,549,'LOW',verify,noProducts],
 [1,'historic',ordinary,699,'LOW','VERIFY_HISTORICAL_DELINQUENCY',noProducts],
 [1,'unknown-principal',ordinary,549,'LOW',verify,noProducts],
 [1,'unknown-overdue',ordinary,699,'LOW','VERIFY_HISTORICAL_DELINQUENCY',noProducts],
 [1,'fssp',ordinary,699,'LOW','RECONCILE_ENFORCEMENT_BALANCE',noProducts],
 [18,'legacy',ordinary,549,'LOW','RECONCILE_EQUITY_COMPONENTS',noProducts],
 [3,'legacy',ordinary,699,'LOW','EXPLAIN_OPERATING_RECEIPTS',noProducts],
 [5,'legacy',ordinary,699,'LOW','QUANTIFY_CUSTOMER_DEPENDENCY',noProducts],
 [5,'concentration',ordinary,699,'LOW','QUANTIFY_CUSTOMER_DEPENDENCY',noProducts],
 [1,'contract',ordinary,1000,'MEDIUM',confirm,['BANK_GUARANTEE','CREDIT_LINE','TERM_LOAN']],
 [6,'legacy',ordinary,1000,'MEDIUM',confirm,noProducts],
 [7,'legacy',ordinary,1000,'MEDIUM',confirm,noProducts],
 [22,'legacy',ordinary,null,'UNKNOWN','UPLOAD_COMPLETE_BANK_STATEMENT_PERIOD',noProducts],
 [1,'partial',ordinary,1000,'MEDIUM','REPLACE_UNREADABLE_SOURCE',noProducts],
 [1,'legacy',ordinary,1000,'MEDIUM',confirm,noProducts],
];
for(const [n,variant,stopState,score,readiness,action,products] of cases) test('Unified decision '+n+' / '+variant,()=>{
  const x=scenario(n,variant),c=buildCanonicalCreditAnalysis(x);
  const state=stopState==='TRIGGERED'?stop:score===null?gap:partial;
  assert.equal(c.riskAssessment.summary.globalStopStatus,stopState);
  assert.deepEqual([c.prescoreIndex.status,c.prescoreIndex.value,c.financingReadiness.level,c.creditAssessment.status,c.debtCapacity.status],
    [state,score,readiness,state,state]);
  assert.deepEqual(c.productSelection.primaryCandidateProducts,products);
  assert.equal(c.productSelection.status,stopState==='TRIGGERED'?stop:products.length?partial:gap);
  assert.equal(c.recommendationSet.recommendations.find(r=>r.recommendationId===c.recommendationSet.primaryRecommendationIds[0]).definitionCode,action);
  assert.equal(c.model.recommendations.primary[0].canonicalId,c.recommendationSet.primaryRecommendationIds[0]);
  const claims=c.explainability.claims, refs=c.explainability.sourceReferences;
  for(const code of ['INDEX_VALUE','READINESS','CAPACITY']){
    const claim=claims.find(k=>k.claimCode===code);
    const used=refs.filter(r=>claim.sourceReferenceIds.includes(r.sourceReferenceId));
    assert.ok(used.length && used.some(r=>r.asOf===c.asOfDate));
    if(code==='INDEX_VALUE')assert.equal(claim.valueBindings[0].rawValue,score);
    if(code==='CAPACITY'&&state===partial)assert.ok(used.some(r=>r.receipts?.some(s=>s.sourceType==='BANK_STATEMENT')));
  }
  assert.equal(c.model.meta.asOfDate,c.asOfDate);
  if(state!==partial)assert.equal(c.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,null);
  if(variant==='rnp'){
    const f=c.riskAssessment.findings.find(f=>f.code==='RISK-LEGAL-RNP-ACTIVE'),claim=claims.find(k=>k.claimCode===f.code);
    assert.match(claim.textRu,/S5-RNP/);assert.match(claim.textRu,/44-ФЗ/);assert.equal(f.scope,'GLOBAL_STOP');
    assert.ok(refs.filter(r=>claim.sourceReferenceIds.includes(r.sourceReferenceId)).some(r=>r.receipts?.some(s=>s.direct&&s.provider==='EIS_DIRECT')));
  }
  if(['delinquent','historic','unknown-principal','unknown-overdue'].includes(variant)){
    assert.equal(c.riskAssessment.findings.some(f=>f.reasonCodes.includes('PRESCORE_CURRENT_90_PLUS_CONSTRAINT')),variant==='delinquent');
  }
  if(variant==='contract'){
    const match=c.contextAssessment.facts.find(f=>f.semanticCode==='CASE_CONTRACT_MATCH');
    assert.equal(match.value,true);assert.equal(match.sourceIds.length,2);
    assert.deepEqual(new Set(match.evidence.map(e=>e.sourceClass)),new Set(['DOCUMENT_REPORTED','CLIENT_DECLARED']));
    const guarantee=c.productSelection.candidates.find(p=>p.productFamily==='BANK_GUARANTEE');
    assert.equal(guarantee.fitLevel,'STRONG_MATCH');assert.ok(guarantee.contextFactIds.includes(match.factId));
    assert.ok(refs.some(r=>r.receipts?.some(s=>s.provider==='CHECKO'&&s.upstream==='EIS'&&!s.direct)));
  }
  if(variant==='concentration')assert.equal(c.contextAssessment.facts.find(f=>f.semanticCode==='CONCENTRATION_CONTRACT_CONTEXT').value,true);
  if(variant==='partial')assert.equal(c.riskAssessment.facts.find(f=>f.semanticCode==='LEGAL_VIOLATIONS_REPORTED').value,null);
  if(variant==='ready')assert.equal(c.model.hero.route,'READY_FOR_FINANCING');
});
test('A change to source status invalidates the decision fingerprint and removes the RNP stop',()=>{
  const input=scenario(1,'rnp'),active=buildCanonicalCreditAnalysis(input);
  const facts=input.companyProfile.externalFacts,record=facts.rnp[0];
  const receipt=facts.receipts.find(r=>r.id===record.receiptId);
  receipt.status='FAILED';
  const failed=buildCanonicalCreditAnalysis(input);
  assert.notEqual(failed.inputFingerprint,active.inputFingerprint);
  assert.equal(failed.riskAssessment.summary.globalStopStatus,gap);
  assert.equal(failed.riskAssessment.facts.find(f=>f.semanticCode==='LEGAL_RNP_CURRENT_RECORD').value,null);
  assert.equal(failed.prescoreIndex.value,1000);
  receipt.status='READY';record.plannedEnd=null;
  assert.equal(buildCanonicalCreditAnalysis(input).riskAssessment.summary.globalStopStatus,gap);
});
