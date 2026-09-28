import {classifyEconomicTransaction} from '../classification/classifier.ts';
import {documentIdentity,documentVersion,TRANSACTION_CONFLICT_VERSION,type TransactionConflict} from '../normalization/conflicts.ts';
import type {BankStatementMetricsV2,MetricResult,MonthlyCashFlowV2} from '../contracts/metrics.ts';
const operating=['SALE_PROCEEDS','CUSTOMER_ADVANCE','ACQUIRING_SETTLEMENT','MARKETPLACE_SETTLEMENT'];
export const CONFLICT_WARNING='UNRESOLVED_TRANSACTION_CONFLICT';
export function conflictImpact(groups:TransactionConflict[]){
 const observations=groups.flatMap(g=>g.variants.flatMap(v=>v.observations));
 const categories=new Set(observations.map(t=>classifyEconomicTransaction(t).primaryCategory));
 const incoming=observations.some(t=>t.direction==='IN'),outgoing=observations.some(t=>t.direction==='OUT');
 const op=operating.some(c=>categories.has(c as never));
 const fields:Partial<Record<keyof MonthlyCashFlowV2,string[]>>={};
 const add=(k:keyof MonthlyCashFlowV2,predicate:(t:typeof observations[number])=>boolean)=>{const months=[...new Set(observations.filter(predicate).map(t=>t.date!.slice(0,7)))].sort();if(months.length)fields[k]=months;};
 add('operatingReceipts',t=>operating.includes(classifyEconomicTransaction(t).primaryCategory));
 add('externalInflows',t=>t.direction==='IN');add('externalOutflows',t=>t.direction==='OUT');
 for(const [field,cs] of Object.entries({debtService:['LOAN_PRINCIPAL_PAYMENT','INTEREST_PAYMENT','DEBT_SERVICE_UNSPLIT','LEASING_PAYMENT'],supplierPayments:['SUPPLIER_PAYMENT'],taxPayments:['TAX_PAYMENT','SOCIAL_CONTRIBUTION'],payrollPayments:['PAYROLL'],unclearIndividualAndCash:['INDIVIDUAL_UNCLEAR_PAYMENT','CASH_WITHDRAWAL'],unknownInflows:['UNKNOWN_INFLOW']}))add(field as keyof MonthlyCashFlowV2,t=>cs.includes(classifyEconomicTransaction(t).primaryCategory));
 return {categories,incoming,outgoing,op,fields};
}
export function applyConflictKnowledge(m:BankStatementMetricsV2,groups:TransactionConflict[]){
 if(!groups.length)return;
 const impact=conflictImpact(groups);
 m.conflicts={version:TRANSACTION_CONFLICT_VERSION,groups:structuredClone(groups),undisputedOperatingReceipts:m.operating.operatingCashReceipts.value!,affectedMonthlyFields:impact.fields};
 const invalidate=(v:MetricResult)=>{v.value=null;v.status='UNKNOWN';v.confidence='UNKNOWN';v.warnings=[...new Set([...v.warnings,CONFLICT_WARNING])];};
 // Category totals only lose knowledge when their own possible category is in conflict.
 for(const [section,values] of Object.entries(m)){
  if(!values||typeof values!=='object'||Array.isArray(values))continue;
  for(const [key,value] of Object.entries(values)){
   if(!value||typeof value!=='object'||!('code'in value))continue;const v=value as MetricResult;
   const dependency=v.includedCategories.some(c=>impact.categories.has(c)) ||
    impact.op&&(section==='customers'||section==='operating'&&['observedMonthlyOperatingAverage','fullMonthOperatingAverage','operatingReceiptsTrend','operatingReceiptsVolatility','peakToAverageRatio','seasonalityEligibility'].includes(key)||['debtServiceToOperatingReceipts','taxToOperatingCashReceipts','payrollToOperatingReceipts'].includes(key)) ||
    section==='liquidity'||section==='cashFlow'&&(key==='netExternalCashFlow'||key==='grossExternalCashInflow'&&impact.incoming||key==='grossExternalCashOutflow'&&impact.outgoing)||
    impact.incoming&&key==='unknownInflowShare'||impact.outgoing&&['unknownOutflowShare','unclearIndividualAndCashShare'].includes(key);
   if(dependency)invalidate(v);
  }
 }
 if(impact.op){m.operating.trendStatus='INSUFFICIENT_DATA';m.operating.seasonalityStatus='INSUFFICIENT_HISTORY';m.customers.directGroups=[];m.customers.platformGroups=[];}
 if(impact.incoming)m.quality.unknownInflowShare=null;
 for(const row of m.monthly)for(const [key,months] of Object.entries(impact.fields))if(months.includes(row.month)){(row as unknown as Record<string,unknown>)[key]=null;row.warnings=[...new Set([...row.warnings,CONFLICT_WARNING])];}
 m.quality.warnings=[...new Set([...m.quality.warnings,CONFLICT_WARNING])];
}
export function validateConflictKnowledge(m:BankStatementMetricsV2){
 const c=m.conflicts;if(!c)return;
 const fail=()=>{throw Error('INVALID_TRANSACTION_CONFLICT_LINEAGE');};
 if(c.version!==TRANSACTION_CONFLICT_VERSION||!c.groups.length||!Number.isFinite(c.undisputedOperatingReceipts)||c.undisputedOperatingReceipts<0)fail();
 for(const g of c.groups){if(g.version!==c.version||g.status!=='UNRESOLVED'||g.variants.length<2||new Set(g.variants.map(v=>v.versionKey)).size!==g.variants.length)fail();for(const v of g.variants){if(!v.observations.length)fail();for(const t of v.observations)if(documentIdentity(t)!==g.identity||documentVersion(t)!==v.versionKey||!t.sourceId||t.amount===null||t.amount<=0)fail();}}
 const impact=conflictImpact(c.groups);
 if(JSON.stringify(impact.fields)!==JSON.stringify(c.affectedMonthlyFields))fail();
 for(const [key,months]of Object.entries(impact.fields))for(const month of months){const row=m.monthly.find(r=>r.month===month);if(!row||(row as unknown as Record<string,unknown>)[key]!==null||!row.warnings.includes(CONFLICT_WARNING))fail();}
 if(impact.op&&[m.operating.operatingCashReceipts,m.operating.fullMonthOperatingAverage,m.operating.observedMonthlyOperatingAverage].some(v=>v.value!==null||v.status!=='UNKNOWN'||!v.warnings.includes(CONFLICT_WARNING)))fail();
}
