import type {ClientReportModelV1} from '../contracts/client-report.ts';
import type {CanonicalCreditAnalysisV1} from '../production/orchestrator.ts';
import type {PortfolioValue} from '../contracts/credit-portfolio.ts';

export const ANALYSIS_V3_PRESENTATION_VERSION = 'PRESCORE-CLIENT-ANALYSIS-PRESENTATION-3.0.0';
export type AnalysisV3Value = {value: number|string|null; knowledge: string; origin: string; verification: string; confidence: string; asOf: string|null};
export type AnalysisV3Presentation = {
 version: string;
 observations: {type:string; status:string; receivedAt:string; from:string|null; to:string|null}[];
 financing: {observed:AnalysisV3Value; scheduled:AnalysisV3Value; views:{kind:'RECURRING'|'NEAR_TERM_30D'; operatingBasis:string; operatingAmount:number|null; current:AnalysisV3Value; cautious:number|null; upper:number|null; headroom:number|null; upperHeadroom:number|null; confidence:string}[]};
 scenarios: {id:string; rate:number; months:number; frequency:string; amortization:string; cautious:number|null; upper:number|null; monthlyCautious:number|null; monthlyUpper:number|null; confidence:string; assumptions:{source:string; asOf:string|null; confidence:string}[]}[];
 scheduledPayments?: {days:number;value:number|null}[];
 portfolio: {id:string; type:string; exposure:string; creditor:AnalysisV3Value; status:AnalysisV3Value; principal:AnalysisV3Value; reportedPrincipal?:AnalysisV3Value; limit:AnalysisV3Value; availableLimit?:AnalysisV3Value; originalAmount?:AnalysisV3Value; annualRate?:AnalysisV3Value; reportedTotal?:AnalysisV3Value; sources?:string[]; contingent:AnalysisV3Value; payment:AnalysisV3Value; paymentFrequency:AnalysisV3Value; nextPayment:AnalysisV3Value; nextDate:AnalysisV3Value; maturity?:AnalysisV3Value; overdue:AnalysisV3Value}[];
};
// Server-side allowlisted projection only. No calculations, raw documents,
// contract/account identifiers, evidence payload, weights or policy constants.
export function analysisV3Presentation(r:CanonicalCreditAnalysisV1, m:ClientReportModelV1):AnalysisV3Presentation|undefined {
 if(m.meta.entitlement!=='FULL') return undefined;
 if(m.company.inn!==r.company.inn || m.meta.asOfDate!==r.asOfDate) throw Error('PRESENTATION_IDENTITY_MISMATCH');
 const d=r.debtCapacity;
 const amount=(a:{value:number|null;knowledge:string;confidence:string}):AnalysisV3Value=>({value:a.value,knowledge:a.knowledge,origin:'DERIVED',verification:'UNCONFIRMED',confidence:a.confidence,asOf:r.asOfDate});
 const pv=(v:PortfolioValue<string|number>):AnalysisV3Value=>({value:v.value,knowledge:v.knowledge,origin:v.origin,verification:v.verification,confidence:v.confidence,asOf:v.observedAt});
 return {version:ANALYSIS_V3_PRESENTATION_VERSION,
  observations:r.sourceObservations.map(s=>({type:s.sourceType,status:s.status,receivedAt:s.receivedAt,from:s.periodFrom,to:s.periodTo})),
  financing:{observed:amount(d.observedDebtServiceBasis),scheduled:amount(d.portfolioScheduledDebtService30d),views:[d.recurringView,d.nearTerm30dView].map(v=>({kind:v.kind,operatingBasis:v.operatingBasis,operatingAmount:v.operatingAmount,current:amount(v.existingDebtServiceAnchor),cautious:v.prudentialTotalMonthlyDebtService,upper:v.maximumPolicyMonthlyDebtService,headroom:v.incrementalHeadroom.prudential,upperHeadroom:v.incrementalHeadroom.maximumPolicy,confidence:v.confidence}))},
  scenarios:d.scenarioResults.map(s=>({id:s.scenarioId,rate:s.annualRatePercent,months:s.termMonths,frequency:s.paymentFrequency,amortization:s.amortization,cautious:s.prudentialPrincipalEquivalent,upper:s.maximumPolicyPrincipalEquivalent,monthlyCautious:s.prudentialMonthlyPaymentCapacity,monthlyUpper:s.maximumPolicyMonthlyPaymentCapacity,confidence:s.confidence,assumptions:s.references.filter(e=>e.kind==='SCENARIO').map(e=>({source:e.evidenceIds.includes('synthetic-explicit-test-assumption-not-bank-offer')?'Явное тестовое допущение Credit Lab, не предложение банка':e.evidenceIds.length?'Явно заданные параметры сценария':'Происхождение допущения не подтверждено',asOf:e.asOf,confidence:e.confidence}))})),
  scheduledPayments:[{days:7,value:r.creditPortfolio.summary.scheduledPayments7d.value},{days:30,value:r.creditPortfolio.summary.scheduledPayments30d.value},{days:60,value:r.creditPortfolio.summary.scheduledPayments60d.value}],
  portfolio:(r.creditPortfolio?.obligations??[]).map(o=>({id:o.obligationId,type:o.type,exposure:o.exposureClass,creditor:pv(o.identity.creditorName),status:pv(o.status),principal:pv(o.currentPosition.principalOutstanding),reportedPrincipal:pv([...o.positionHistory].sort((a,b)=>a.asOf.localeCompare(b.asOf)).at(-1)?.position.principalOutstanding??o.currentPosition.principalOutstanding),limit:pv(o.currentTerms.creditLimit),availableLimit:pv(o.currentPosition.availableLimit),originalAmount:pv(o.currentTerms.originalAmount),annualRate:pv(o.currentTerms.annualRate),reportedTotal:pv([...o.positionHistory].sort((a,b)=>a.asOf.localeCompare(b.asOf)).at(-1)?.position.totalOutstanding??o.currentPosition.totalOutstanding),sources:[...new Set(o.identity.creditorName.evidence.map(e=>e.sourceKind))],contingent:pv(o.currentPosition.contingentExposure),payment:pv(o.currentTerms.scheduledPaymentAmount),paymentFrequency:pv(o.currentTerms.scheduledPaymentFrequency),nextPayment:pv(o.currentPosition.nextPaymentAmount),nextDate:pv(o.currentPosition.nextPaymentDate),maturity:pv(o.currentTerms.maturityDate),overdue:pv(o.currentPosition.overdueAmount)}))};
}
