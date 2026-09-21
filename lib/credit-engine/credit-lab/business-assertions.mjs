import assert from 'node:assert/strict';
import {analyzeBankStatements} from '../../prescore.ts';
import {buildCanonicalCreditAnalysis} from '../production/orchestrator.ts';
import {principalEquivalent} from '../debt-capacity/scenarios.ts';
const equal=(a,b)=>assert.deepEqual(a,b);
export function businessAssertions(bundle,r){
 const {caseSpec:c,input,full,statements}=bundle,a=input.analysis,m=a.metricsV2,d=r.debtCapacity,f=r.riskAssessment.facts,findings=r.riskAssessment.findings;
 const cap=d.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential;
 const op=m.operating.operatingCashReceipts.value;
 const rows=[];const check=(id,fn)=>{try{fn();rows.push({id,status:'PASS'});}catch(e){rows.push({id,status:'FAIL',classification:e.code==='ERR_ASSERTION'?'PRIOR_BLOCK_DEFECT_FOUND':'TEST_IMPLEMENTATION_ERROR',expected:e.expected??'Independent stated invariant',actual:e.actual??e.message});}};
 const noPromise=()=>{assert.ok(r.model.disclaimers?.length || JSON.stringify(r.model).includes('не является'));assert.doesNotMatch(JSON.stringify(r.model),/Кредит гарантирован|Одобрение гарантировано|Банк одобрил/);assert.ok(d.scenarioResults.every(s=>s.warnings.includes('NOT_BANK_APPROVAL')));};
 const lineage=()=>{const ids=new Set(r.explainability.claims.map(x=>x.claimId));assert.ok(ids.size);assert.ok(r.model.technical.claimIds.every(id=>ids.has(id)));function visit(x){if(!x||typeof x!=='object')return;if(x.claimId)assert.ok(ids.has(x.claimId));Object.values(x).forEach(visit);}visit(r.model);};
 const canonical=()=>{equal(r.model.index.value?.value??null,r.prescoreIndex.value);equal(r.model.capacity.headline?.value??null,cap);equal(r.model.company.inn,c.companyInn);};
 const trace=()=>assert.ok(f.filter(x=>x.status==='KNOWN'&&x.semanticCode.startsWith('BANK_')).every(x=>x.evidence.length&&x.sourceIds.length));
 const noLegacy=()=>{const x=structuredClone(input);x.analysis.score=-999;x.analysis.readiness='LEGACY_SENTINEL';x.analysis.metrics.estimatedLimitMax=999999999;equal(buildCanonicalCreditAnalysis(x),r);};
 const sameOperating=()=>equal(op,12000000);
 const noBki=()=>{assert.ok(f.filter(x=>x.semanticCode==='BKI_OVERDUE').every(x=>x.value===null));assert.ok(!findings.some(x=>x.code==='RISK-BKI-CURRENT-OVERDUE'));assert.ok(!a.creditHistory);};
 const rules={
 REPORT_COMPUTED_FROM_SOURCES:()=>equal(m,full.metricsV2), PAYMENT_ANCHOR_FROM_EVIDENCE:()=>{equal(d.recurringView.existingDebtServiceAnchor.value,100000);assert.ok(d.recurringView.existingDebtServiceAnchor.references.length);},
 MODEL_EQUALS_CANONICAL_OUTPUT:canonical,EXPLAINABILITY_HAS_LINEAGE:lineage,NO_BANK_APPROVAL_PROMISE:noPromise,NO_PROMISED_APPROVAL:noPromise,NO_APPROVAL_INFERENCE:noPromise,
 COMPARABLE_TREND_ONLY:()=>{equal(m.period.fullMonths,12);assert.ok(m.operating.operatingReceiptsTrend.value>0);},
 DECLINE_FROM_REAL_MONTHS:()=>{equal(m.monthly.slice(-3).map(x=>x.operatingReceipts),[500000,500000,500000]);assert.ok(m.operating.operatingReceiptsTrend.value<0);},NO_LEGACY_SUBSTITUTION:noLegacy,
 SEASONALITY_NEEDS_COMPARABLE_HISTORY:()=>{equal(m.monthly.length,24);equal(m.monthly.slice(0,12).map(x=>x.operatingReceipts),m.monthly.slice(12).map(x=>x.operatingReceipts));},NO_FORCED_DECLINE_LABEL:()=>assert.ok(!findings.some(x=>x.code==='RISK-CF-OPERATING-RECEIPTS-DECLINE')),
 TOP1_IS_ACTUAL_BUYER:()=>{equal(m.customers.directCustomerTop1.value,0.7);equal(m.customers.directGroups.length,5);},SOURCE_TRACEABILITY:trace,
 INTERMEDIARY_NOT_ULTIMATE_BUYER:()=>equal(m.customers.acquiringShare.value,1),PLATFORM_NOT_ULTIMATE_BUYER:()=>equal(m.customers.marketplaceShare.value,1),NO_FAKE_DIRECT_TOP1:()=>{equal(m.customers.directGroups,[]);equal(m.customers.directCustomerTop1.value,null);},
 OWNER_FUNDING_NOT_REVENUE:()=>{sameOperating();equal(m.ownerFunding.ownerContributionAmount.value,5000000);},CAPACITY_NOT_INFLATED_BY_FUNDING:()=>equal(d.operatingBasis.canonicalFullMonthAverage.value,1000000),
 LOAN_INFLOW_NOT_REVENUE:()=>{sameOperating();equal(m.financing.bankLoanInflow.value,5000000);},BORROWING_IS_NOT_OPERATING_GROWTH:()=>equal(m.operating.operatingReceiptsTrend.value,0),
 OWN_TRANSFER_NET_ZERO:()=>{const own=full.transactions.filter(t=>t.classification?.primaryCategory==='INTERNAL_TRANSFER');equal(own.length,24);equal(own.reduce((n,t)=>n+(t.direction==='in'?t.amount:-t.amount),0),0);equal(m.cashFlow.grossExternalCashInflow.value,12000000);},MULTI_ACCOUNT_IS_NOT_DUPLICATED_SALES:sameOperating,
 COVERAGE_PER_ACCOUNT_REVIEW:()=>{equal(new Set(c.bankDocuments.map(x=>x.accountFixture)).size,2);equal(m.period.fullMonths,12);},
 PRESERVE_ACCOUNT_SPECIFIC_COVERAGE:()=>{equal(a.sourceManifest.bankStatements.map(s=>s.periodFrom).sort(),c.bankDocuments.map(s=>s.periodFrom).sort());equal(new Set(c.bankDocuments.map(x=>x.accountFixture)).size,3);},NO_ZERO_FOR_UNOBSERVED_ACCOUNT:()=>assert.ok(m.monthly.some(x=>x.coverage!=='FULL')&&d.operatingBasis.canonicalFullMonthAverage.value===null),
 DEBT_ANCHOR_FROM_BANK_AND_BKI:()=>{equal(d.observedDebtServiceBasis.value,500000);equal(d.recurringView.existingDebtServiceAnchor.value,500000);},NO_COMFORTABLE_LABEL_WITHOUT_BASIS:()=>{assert.ok(cap===null||cap<=0);assert.notEqual(r.financingReadiness.level,'HIGH');},
 CURRENT_OVERDUE_NOT_HISTORY_DAYS:()=>{assert.ok(f.some(x=>x.semanticCode==='BKI_OVERDUE'&&x.value===1000));assert.ok(f.some(x=>x.semanticCode==='BKI_HISTORY_DAYS'&&x.value===0));},
 NO_FABRICATED_DELINQUENCY_BAND:()=>assert.ok(!findings.some(x=>x.reasonCodes?.some(y=>/30_59|60_PLUS/.test(y)))),
 PRESERVE_REPORTED_HISTORY:()=>assert.ok(f.some(x=>x.semanticCode==='BKI_HISTORY_DAYS'&&x.value===60)),NO_DOUBLE_COUNT_SAME_OBLIGATION:()=>equal(r.creditPortfolio.obligations.length,1),
 UNKNOWN_DEBT_NOT_ZERO:noBki,NO_INVENTED_CLEAN_CREDIT_HISTORY:noBki,
 UNKNOWN_NOT_ZERO:()=>{assert.ok(f.filter(x=>x.semanticCode.startsWith('FIN_')).every(x=>x.value===null));equal(cap,null);},PARTIAL_REPORT_NOT_SOFTWARE_FAILURE:canonical,NO_FORCED_NUMERIC_INDEX:()=>equal(r.prescoreIndex.value,null),
 GLOBAL_STOP_FROM_EXPLICIT_SOURCE:()=>assert.ok(findings.some(x=>x.scope==='GLOBAL_STOP'&&x.evidenceConfidence==='HIGH')),NO_OPTIMISTIC_CAPACITY_COPY:()=>{equal(r.financingReadiness.level,'NOT_READY');assert.ok(cap===null||cap===0);},
 BALANCE_RECONCILES:()=>{for(const s of a.financialStatementsV2)equal(s.balance.ASSETS_TOTAL.value,s.balance.BALANCE_TOTAL.value);},NEGATIVE_EQUITY_NOT_GLOBAL_STOP:()=>{assert.ok(f.some(x=>x.semanticCode==='FIN_EQUITY'&&x.value<0));assert.ok(!findings.some(x=>x.scope==='GLOBAL_STOP'));},NO_DUPLICATED_LOSS_FACTOR:()=>assert.ok(findings.filter(x=>/LOSS/.test(x.code)).length<=1),
 DO_NOT_COMPARE_6M_TO_12M_AS_DECLINE:()=>assert.ok(!findings.some(x=>x.code==='RISK-FIN-REVENUE-DECLINE')),NO_SILENT_ANNUALIZATION:()=>{const s=a.financialStatementsV2.find(x=>x.period.kind==='INTERIM');equal(s.period.monthsCovered,6);equal(s.income.REVENUE.value,5500000);},
 MISSING_MONTH_NOT_ZERO_MONTH:()=>equal(m.monthly.find(x=>x.month==='2025-12')?.coverage,'MISSING'),DATA_COVERAGE_NOT_BORROWER_WEAKNESS:()=>assert.ok(findings.filter(x=>/COVERAGE|MISSING|INTEGRITY/.test(x.code)).every(x=>x.scope!=='CREDIT_RISK')),
 BYTE_DUPLICATE_IDEMPOTENT:()=>equal(op,analyzeBankStatements(statements.slice(0,1)).metricsV2.operating.operatingCashReceipts.value),SAME_TOTALS_AS_SINGLE_SOURCE:sameOperating,
 CONFLICT_REVIEW_NOT_SILENT_SELECTION:()=>assert.ok(r.riskAssessment.summary.dataReviewRequired),NO_SILENT_DOUBLE_COUNT:()=>assert.ok(op>=12000000&&op<=12001000,`Operating receipts ${op} exceed either source version`),
 COVERED_ZERO_MONTH_NOT_MISSING:()=>{equal(m.monthly[0].coverage,'FULL');equal(m.monthly[0].operatingReceipts,0);},HEADER_PERIOD_BEFORE_FIRST_TRANSACTION:()=>{equal(m.period.from,'2025-07-01');assert.ok(a.periodFrom>'2025-07-31');},
 CANONICAL_METRICS_FROM_ALL_ROWS:()=>{equal(full.transactions.length,12072);equal(a.transactions.length,10000);equal(a.transactionsTruncated,true);sameOperating();equal(a.metricsV2,full.metricsV2);},NEVER_RECOMPUTE_FROM_TRUNCATED_DISPLAY_ROWS:()=>{const x=structuredClone(input);x.analysis.transactions=[];equal(buildCanonicalCreditAnalysis(x),r);}
 };
 for(const id of c.expected.mustCheck)check(id,()=>{assert.ok(rules[id],`UNIMPLEMENTED_ASSERTION:${id}`);rules[id]();});
 check('DETERMINISM_AT_EXPLICIT_ASOF',()=>equal(buildCanonicalCreditAnalysis(input),r));
 check('SCENARIO_ENGINE_AND_UNITS',()=>{equal(d.scenarioResults.map(s=>s.termMonths).sort((a,b)=>a-b),[12,24,36]);for(const s of d.scenarioResults){equal(s.annualRatePercent,20);equal(s.prudentialMonthlyPaymentCapacity,cap);equal(s.prudentialPrincipalEquivalent,cap===null?null:principalEquivalent(cap,20,s.termMonths));}const ss=[...d.scenarioResults].sort((a,b)=>a.termMonths-b.termMonths);if(cap!==null&&cap>0)assert.ok(ss[0].prudentialPrincipalEquivalent<ss[1].prudentialPrincipalEquivalent&&ss[1].prudentialPrincipalEquivalent<ss[2].prudentialPrincipalEquivalent);});
 return rows;
}
