import type {DebtCapacityInputV1,DebtCapacityPolicyV1,PortfolioDebtServiceBasisV1} from '../contracts/debt-capacity.ts';
import type {PortfolioValue} from '../contracts/credit-portfolio.ts';
import {DEBT_CAPACITY_POLICY} from './policy.ts';
import {amount,reference,weakest,rank,money,unique,addDays} from './common.ts';
const supported=(v:PortfolioValue<unknown>,p:DebtCapacityPolicyV1)=>v.knowledge==='KNOWN'&&v.value!==null&&v.verification!=='CONFLICTED'&&rank(v.confidence)>=rank(p.minimumEvidenceConfidence)&&!!(v.observedAt||v.evidence.some(e=>e.observedAt));
export function portfolioSchedule(x:DebtCapacityInputV1,p:DebtCapacityPolicyV1=DEBT_CAPACITY_POLICY):PortfolioDebtServiceBasisV1{
 const pf=x.creditPortfolio,eligible:string[]=[],unknown:string[]=[],excluded:string[]=[],eventIds:string[]=[],references:ReturnType<typeof reference>[]=[],confidences:PortfolioValue<unknown>['confidence'][]=[];
 if(!pf)return {...amount(null,'UNKNOWN',[],'PORTFOLIO_NOT_PROVIDED',['PORTFOLIO_SCHEDULE_UNAVAILABLE']),knownScheduledAmount:0,eligibleObligationIds:[],unknownObligationIds:[],excludedObligationIds:[],usedScheduledEventIds:[],complete:true};
 const until=addDays(x.asOfDate,p.nearTermDays);let total=0;
 for(const o of [...pf.obligations].sort((a,b)=>a.obligationId.localeCompare(b.obligationId))){
  if(['BANK_GUARANTEE','GUARANTORSHIP','FACTORING'].includes(o.type)||!p.eligiblePortfolioExposureClasses.includes(o.exposureClass)){excluded.push(o.obligationId);continue;}
  if(!supported(o.status,p)||rank(o.identityConfidence)<rank(p.minimumEvidenceConfidence)){unknown.push(o.obligationId);continue;}
  if(o.status.value!=='ACTIVE'){excluded.push(o.obligationId);continue;}
  eligible.push(o.obligationId);const payments=o.schedule.filter(e=>e.type==='PAYMENT_DUE');let supportedCalendar=false,hasUnknown=false;
  for(const e of payments.sort((a,b)=>(a.dueDate??'').localeCompare(b.dueDate??'')||a.scheduledEventId.localeCompare(b.scheduledEventId))){
   if(!e.dueDate){hasUnknown=true;continue;}if(e.dueDate<=x.asOfDate)continue;
   if(!supported(e.amount,p)||e.status==='UNKNOWN'){hasUnknown=true;continue;}supportedCalendar=true;
   if(e.dueDate>until){confidences.push(e.amount.confidence,o.identityConfidence,o.status.confidence);references.push(reference('PORTFOLIO_EVENT',`creditPortfolio.obligations[${o.obligationId}].schedule[${e.scheduledEventId}].outside30d`,0,e.amount.confidence,{obligationId:o.obligationId,scheduledEventId:e.scheduledEventId,asOf:e.amount.observedAt??e.amount.evidence.find(v=>v.observedAt)?.observedAt??null,evidenceIds:unique([...e.evidence,...e.amount.evidence].map(v=>v.evidenceId))}));continue;}
   total+=e.amount.value!;eventIds.push(e.scheduledEventId);confidences.push(e.amount.confidence,o.identityConfidence,o.status.confidence);
   references.push(reference('PORTFOLIO_EVENT',`creditPortfolio.obligations[${o.obligationId}].schedule[${e.scheduledEventId}].amount`,e.amount.value,e.amount.confidence,{obligationId:o.obligationId,scheduledEventId:e.scheduledEventId,asOf:e.amount.observedAt??e.amount.evidence.find(v=>v.observedAt)?.observedAt??null,evidenceIds:unique([...e.evidence,...e.amount.evidence,...o.status.evidence].map(v=>v.evidenceId))}));
  }
  if(!supportedCalendar||hasUnknown)unknown.push(o.obligationId);
 }
 const complete=!unknown.length,known=references.length>0||(complete&&eligible.length>0);
 // Empty or entirely excluded portfolios do not assert a complete company debt calendar.
 const confidence=known?weakest(...(confidences.length?confidences:[pf.summary.confidence])):'UNKNOWN';
 return {...amount(known?money(total):null,confidence,references,'SUM_KNOWN_ACTIVE_FUNDED_OR_LEASE_PAYMENT_DUE_AFTER_CUTOFF_WITHIN_30D',unique([...(excluded.length?['CONTINGENT_FACTORING_OTHER_EXPOSURES_EXCLUDED']:[]),...(!known||!complete?['PORTFOLIO_SCHEDULE_INCOMPLETE']:[]),...(!complete&&known?['KNOWN_SCHEDULE_LOWER_BOUND']:[])]),!complete),knownScheduledAmount:money(total),eligibleObligationIds:unique(eligible),unknownObligationIds:unique(unknown),excludedObligationIds:unique(excluded),usedScheduledEventIds:unique(eventIds),complete:known&&complete};
}
