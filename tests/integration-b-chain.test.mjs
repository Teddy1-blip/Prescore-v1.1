import test from 'node:test';
import assert from 'node:assert/strict';
import {integrationB,integrationBManifest as fixture} from './fixtures/integration-b.mjs';
import {buildCanonicalCreditAnalysis as build} from '../lib/credit-engine/production/orchestrator.ts';
import {buildActionPlan} from '../lib/credit-engine/action-plan/engine.ts';
import {loadWorkspaceModelV1} from '../lib/workspace/service.ts';
import {savedCanonicalInput,parseFinancingRequest} from '../lib/workspace/financing-request.ts';
import {obligationScheduleGuidance} from '../lib/workspace/credit-coverage-guidance.ts';
import {publicCanonicalModel} from '../lib/credit-engine/production/public-model.ts';

test('integration B: real statement processing, 12 months, independent arithmetic and all downstream blocks',()=>{
 const input=integrationB(),before=JSON.stringify(input),r=build(input),m=input.analysis.metricsV2,e=fixture.expected;
 assert.equal(m.period.fullMonths,e.months);
 assert.equal(m.cashFlow.grossExternalCashInflow.value,e.grossInflow);
 assert.equal(m.cashFlow.grossExternalCashOutflow.value,e.grossOutflow);
 assert.equal(m.liquidity.endingBalance.value,e.endingBalance);
 assert.equal(r.debtCapacity.operatingBasis.centralOperatingBasis.value,e.monthlyOperatingReceipts);
 assert.equal(r.debtCapacity.operatingBasis.conservativeOperatingBasis.value,e.monthlyOperatingReceipts);
 assert.equal(r.debtCapacity.observedDebtServiceBasis.value,e.monthlyObservedDebtService);
 assert.equal(r.debtCapacity.portfolioScheduledDebtService30d.value,e.scheduled30d);
 assert.equal(r.creditPortfolio.obligations[0].currentPosition.principalOutstanding.value,e.historicalAndCurrentPrincipalAtCutoff);
 assert.ok(r.prescoreIndex.coverage.components.every(c=>c.state==='ADEQUATE'));
 assert.equal(r.prescoreIndex.value,e.index);
 // Source matching still needs review: adequate core facts are not a claim of complete evidence.
 assert.equal(r.prescoreIndex.status,'PARTIAL');assert.equal(r.financingReadiness.level,'MEDIUM');
 assert.equal(r.financingReadiness.caseDefinition.status,'DEFINED');
 assert.equal(r.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,e.prudentialMonthlyHeadroom);
 assert.equal(r.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.maximumPolicy,e.maximumPolicyMonthlyHeadroom);
 assert.equal(r.debtCapacity.scenarioResults[0].prudentialPrincipalEquivalent,1200000);
 assert.equal(r.debtCapacity.scenarioResults[0].maximumPolicyPrincipalEquivalent,1800000);
 assert.ok(r.productSelection.candidates.length);assert.ok(r.recommendationSet.recommendations.length);
 assert.ok(r.actionPlan.items.length);assert.ok(r.explainability);assert.ok(r.model);
 assert.equal(r.financialAnalysis.history.find(h=>h.snapshot.period.year===2025).snapshot.income.REVENUE.value,e.annualRevenue);
 const interim=r.financialAnalysis.history.find(h=>h.snapshot.sourceType==='QUARTERLY');
 assert.equal(interim.snapshot.income.REVENUE.value,e.interimRevenue);assert.equal(interim.snapshot.period.monthsCovered,6);
 assert.equal(JSON.stringify(input),before);assert.deepEqual(build(input),r);
});
for(const months of [6,5,1])test(`integration B: actual ${months}-month source respects the six-month policy`,()=>{
 const r=build(integrationB({months}));assert.equal(r.debtCapacity.operatingBasis.fullMonthCount,months);
 if(months>=6){assert.equal(r.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,100000);assert.equal(r.debtCapacity.status,'PARTIAL');}
 else{assert.equal(r.debtCapacity.status,'INSUFFICIENT_DATA');assert.equal(r.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,null);}
});
test('integration B: legal OTHER source is explicit offline provenance; no legal source never becomes ACTIVE',()=>{
 const input=integrationB();assert.ok(input.companyProfile.sourceManifest.external.every(s=>s.sourceType==='OTHER'&&s.warnings.includes('SYNTHETIC_OFFLINE_REGISTRY_FIXTURE_NOT_EXTERNAL_VERIFICATION')));
 const r=build(integrationB({noLegal:true}));assert.equal(r.prescoreIndex.value,null);assert.equal(r.financingReadiness.level,'UNKNOWN');
 assert.ok(r.prescoreIndex.coverage.components.find(c=>c.component==='LEGAL_CORPORATE').missingFactCodes.includes('LEGAL_LIFECYCLE'));
 assert.equal(r.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,null);
 input.companyProfile.sourceManifest.external.find(s=>s.sourceId.startsWith('external:company:')).status='FAILED';
 assert.equal(build(input).prescoreIndex.value,null);
});
test('integration B: unknown principal stays null while a separately reported payment remains known',()=>{
 const r=build(integrationB({unknownPrincipal:true})),o=r.creditPortfolio.obligations[0];
 assert.equal(o.currentPosition.principalOutstanding.value,null);assert.equal(o.currentPosition.principalOutstanding.knowledge,'UNKNOWN');
 assert.equal(o.currentPosition.nextPaymentAmount.value,100000);assert.equal(r.debtCapacity.portfolioScheduledDebtService30d.value,100000);
 assert.ok(r.riskAssessment.findings.some(f=>f.code==='RISK-DATA-PORTFOLIO-OUTSTANDING-UNKNOWN'));
});
test('integration B: excluded credit limit retains its payment and a concrete display explanation',()=>{
 const r=build(integrationB({creditLimit:true})),o=r.creditPortfolio.obligations[0],schedule=r.debtCapacity.portfolioScheduledDebtService30d;
 assert.equal(o.exposureClass,'CREDIT_LIMIT');assert.deepEqual(schedule.excludedObligationIds,[o.obligationId]);assert.equal(schedule.value,null);
 assert.equal(o.currentPosition.nextPaymentAmount.value,100000);
 const before=JSON.stringify(r),copy=obligationScheduleGuidance(o.obligationId,o.exposureClass,schedule);
 assert.match(copy,/лимит кредитной линии/);assert.match(copy,/платёж сохраняется/);assert.equal(JSON.stringify(r),before);
});
test('integration B: current competing financial evidence reaches reconciliation without duplicating calculated history',()=>{
 const r=build(integrationB({conflict:true}));
 assert.ok(r.reconciliation.findings.some(f=>f.outcome==='CONFLICT'&&f.requiresDataReview));
 assert.ok(r.riskAssessment.findings.some(f=>f.code==='RISK-DATA-FINANCIAL-SAME-FACT-CONFLICT'));
 assert.equal(r.financialAnalysis.history.filter(h=>h.snapshot.period.year===2025).length,1);
 assert.equal(r.prescoreIndex.status,'PARTIAL');
});
test('integration B: foreign company and invalid INN fail before publishing a model',()=>{
 assert.throws(()=>build(integrationB({wrongProfile:true})),e=>e.stage==='SOURCES'&&e.reason==='SOURCE_IDENTITY_MISMATCH');
 const input=integrationB();input.analysis.companyInn='not-an-inn';assert.throws(()=>build(input),e=>e.reason==='SOURCE_IDENTITY_MISMATCH');
});
test('scenario lineage reaches Action Plan, but a forged capacity reference is still rejected',()=>{
 const r=build(integrationB()),scenarioIds=new Set(r.debtCapacity.scenarioResults.flatMap(s=>s.references.map(e=>e.referenceId)));
 assert.ok(r.recommendationSet.recommendations.some(rec=>rec.capacityReferenceIds.some(id=>scenarioIds.has(id))));
 const changed=structuredClone(Object.fromEntries(['asOfDate','riskAssessment','contextAssessment','prescoreIndex','financingReadiness','creditAssessment','debtCapacity','productSelection','creditPortfolio','recommendationSet'].map(k=>[k,r[k]])));changed.recommendationSet.recommendations[0].capacityReferenceIds.push('capacity-reference:forged');
 assert.throws(()=>buildActionPlan(changed),/ACTION_PLAN_INPUT_INVALID:CAPACITY_REFERENCE/);
});
test('integration B: Workspace FULL and report use the same saved financing case; access precedes engine',async()=>{
 const b=integrationB();b.analysis.financingRequestV1=parseFinancingRequest({purpose:'WORKING_CAPITAL',product:'TERM_LOAN',amount:1000000,termMonths:12,annualRatePercent:0,urgency:'WITHIN_30_DAYS'},fixture.asOfDate);
 const canonical=build(savedCanonicalInput(b.analysis,b.companyProfile)),payload=JSON.stringify(b.analysis),deps={readAccess:async()=>({access:'owner',row:{companyInn:b.analysis.companyInn,ownerEmail:'synthetic@integration.invalid',payload}}),readTier:async()=>'FULL',readProfile:async()=>b.companyProfile,readOperations:async()=>({})};
 const workspace=await loadWorkspaceModelV1(b.analysis.id,deps);assert.equal(workspace.state,'READY_FULL');
 assert.deepEqual(workspace.full.report,publicCanonicalModel(canonical.model,canonical));assert.equal(workspace.full.canonical.financingReadiness.caseDefinition.status,'DEFINED');
 assert.equal(workspace.basic.financingRequest.urgency,'WITHIN_30_DAYS');assert.equal(JSON.stringify(b.analysis),payload);
 assert.equal((await loadWorkspaceModelV1(b.analysis.id,{...deps,readAccess:async()=>null,readProfile:async()=>{throw Error('MUST_NOT_READ');}})).state,'NOT_FOUND');
});

test('integration B: later saved declaration advances knowledge without refreshing historical debt',()=>{
 const b=integrationB();
 b.analysis.financingRequestV1=parseFinancingRequest({purpose:'WORKING_CAPITAL',product:'TERM_LOAN',amount:1000000,termMonths:12,annualRatePercent:0,urgency:'WITHIN_30_DAYS'},'2026-07-02T12:00:00.000Z');
 const input=savedCanonicalInput(b.analysis,b.companyProfile),before=JSON.stringify(input),r=build(input);
 assert.equal(r.asOfDate,'2026-07-02');assert.equal(r.financingReadiness.caseDefinition.status,'DEFINED');
 assert.ok(r.financingReadiness.caseDefinition.facts.every(f=>f.sourceClass==='CLIENT_DECLARED'&&f.evidence.every(e=>e.asOf==='2026-07-02')));
 const principal=r.creditPortfolio.obligations[0].currentPosition.principalOutstanding;
 assert.equal(principal.value,null);assert.equal(principal.knowledge,'UNKNOWN');
 assert.ok(principal.evidence.some(e=>e.rawValue===1500000&&e.observedAt==='2026-06-30'));
 assert.equal(r.debtCapacity.operatingBasis.fullMonthCount,12);assert.equal(r.debtCapacity.portfolioScheduledDebtService30d.value,100000);
 assert.equal(JSON.stringify(input),before);assert.deepEqual(build(input),r);
 const corrupt=structuredClone(b.analysis);corrupt.financingRequestV1.receivedAt='invalid';
 assert.throws(()=>savedCanonicalInput(corrupt,b.companyProfile),e=>e.stage==='SOURCE_DATES'&&e.reason==='INVALID_SOURCE_DATES');
});
