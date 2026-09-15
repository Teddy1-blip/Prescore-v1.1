import type {DebtCapacityInputV1,DebtCapacityPolicyV1,ObservedDebtServiceBasisV1,PortfolioDebtServiceBasisV1,DebtServiceAnchorV1} from '../contracts/debt-capacity.ts';
import {DEBT_CAPACITY_POLICY} from './policy.ts';
import {eligibleMonths} from './operating-basis.ts';
import {average,amount,reference,rank,money,weakest,refs,unique} from './common.ts';
export function observedDebtService(x:DebtCapacityInputV1,p:DebtCapacityPolicyV1=DEBT_CAPACITY_POLICY):ObservedDebtServiceBasisV1{
 const ms=eligibleMonths(x),m=x.bankMetrics.debtService.debtServiceCashOutflow,adequate=m.status==='KNOWN'&&m.value!==null&&rank(m.confidence)>=rank(p.minimumEvidenceConfidence),v=adequate?average(ms.map(m=>m.debtService)):null;
 const references=[reference('BANK_METRIC','bankMetrics.debtService.debtServiceCashOutflow',m.value,m.confidence,{sourceMetricCode:m.code,asOf:m.periodTo,evidenceIds:m.evidence??[]}),...ms.map(v=>reference('BANK_MONTH',`bankMetrics.monthly[${v.month}].debtService`,v.debtService,m.confidence,{month:v.month,asOf:x.bankMetrics.period.to,sourceMetricCode:m.code}))];
 return {...amount(v===null?null:money(v),m.confidence,references,'AVERAGE_OBSERVED_DEBT_SERVICE_FULL_MONTHS_ONLY',[...m.warnings,...(!adequate?['OBSERVED_DEBT_SERVICE_UNKNOWN']:[]),'UNSPLIT_PAYMENT_NOT_PRINCIPAL_REDUCTION']),eligibleMonths:ms.map(m=>m.month),sourceMetricCodes:[m.code]};
}
export function debtServiceAnchors(observed:ObservedDebtServiceBasisV1,portfolio:PortfolioDebtServiceBasisV1):{recurring:DebtServiceAnchorV1;nearTerm:DebtServiceAnchorV1}{
 const recurring:DebtServiceAnchorV1={...observed,kind:'RECURRING',portfolioNumericallyUsed:false};
 // A partial schedule is a supported lower bound, never a statement of zero missing payments.
 const knownSchedule=portfolio.value!==null,ov=observed.value,pv=portfolio.value;
 const value=ov!==null&&knownSchedule?Math.max(ov,pv!):ov??pv;
 const used=knownSchedule;const references=refs([...(ov!==null?observed.references:[]),...(used?portfolio.references:[])]);
 const confidence=value===null?'UNKNOWN':weakest(...(ov!==null?[observed.confidence]:[]),...(used?[portfolio.confidence]:[]));
 const warnings=unique([...observed.warnings,...portfolio.warnings,...(ov===null?['OBSERVED_ANCHOR_UNAVAILABLE']:[]),...(!knownSchedule?['NEAR_TERM_OBSERVED_ANCHOR_ONLY']:[])]);
 return {recurring,nearTerm:{...amount(value,confidence,references,ov!==null&&knownSchedule?'MAX_OBSERVED_KNOWN_SCHEDULE_30D':ov!==null?'OBSERVED_ONLY':'KNOWN_SCHEDULE_ONLY',warnings,used&&!portfolio.complete),kind:'NEAR_TERM_30D',portfolioNumericallyUsed:used}};
}
