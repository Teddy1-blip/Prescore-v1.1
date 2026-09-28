import type { CreditOutcomeObservation,CreditLabCaseV0,CreditLabOutcomeSummary } from "../contracts/credit-lab.ts";
import { validDate } from "./common.ts";
export function validateOutcomes(outcomes:CreditOutcomeObservation[],cases:CreditLabCaseV0[]):string[]{
 const errors:string[]=[],byId=new Map(cases.map(c=>[c.caseId,c])),ids=new Set<string>();
 for(const o of outcomes){const c=byId.get(o.caseId);if(!c||c.subjectGroupId!==o.subjectGroupId)errors.push("OUTCOME_SUBJECT_MISMATCH");if(ids.has(o.outcomeId))errors.push("DUPLICATE_OUTCOME");ids.add(o.outcomeId);
  if(!["APPROVED","PARTIALLY_APPROVED","DECLINED","WITHDRAWN","EXPIRED","UNKNOWN"].includes(o.decision))errors.push("OUTCOME_DECISION_INVALID");if(!["ISSUED","NOT_ISSUED","UNKNOWN"].includes(o.fundingStatus))errors.push("FUNDING_STATUS_INVALID");
  if(!["HIGH","MEDIUM","LOW","UNKNOWN"].includes(o.confidence))errors.push("OUTCOME_CONFIDENCE_INVALID");
  for(const d of [o.applicationDate,o.decisionDate])if(d&&(!validDate(d)||c&&d<c.asOfDate))errors.push("OUTCOME_DATE_BEFORE_CUTOFF_OR_INVALID");
  if(o.applicationDate&&o.decisionDate&&o.decisionDate<o.applicationDate)errors.push("OUTCOME_DATE_ORDER");
  for(const n of [o.requestedAmount,o.requestedTermMonths,o.approvedAmount,o.approvedTermMonths,o.annualRate])if(n!==null&&(!Number.isFinite(n)||n<0))errors.push("OUTCOME_NUMBER_INVALID");
 }
 return [...new Set(errors)].sort();
}
export function summarizeOutcomes(outcomes:CreditOutcomeObservation[]):CreditLabOutcomeSummary{
 return {observationCount:outcomes.length,approvedCount:outcomes.filter(o=>o.decision==="APPROVED").length,partiallyApprovedCount:outcomes.filter(o=>o.decision==="PARTIALLY_APPROVED").length,declinedCount:outcomes.filter(o=>o.decision==="DECLINED").length,issuedCount:outcomes.filter(o=>o.fundingStatus==="ISSUED").length,documentedOutcomeCount:outcomes.filter(o=>["BANK_DOCUMENT","BANK_API"].includes(o.sourceType)).length,warnings:["OUTCOME_IS_OBSERVATION_NOT_GOLDEN_TRUTH","NO_PREDICTIVE_ACCURACY_CLAIM"]};
}
