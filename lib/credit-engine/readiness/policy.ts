import {READINESS_POLICY_VERSION,type ReadinessPolicyV1} from '../contracts/readiness.ts';
import {freeze,id} from './common.ts';
export const READINESS_POLICY:ReadinessPolicyV1=freeze({
 version:READINESS_POLICY_VERSION,highIndexMinimum:850,mediumIndexMinimum:700,
 partialMaximumLevel:'MEDIUM',lowConfidenceMaximumLevel:'MEDIUM',materialRiskSeverities:['CRITICAL','HIGH','MEDIUM'],
 globalStopBehavior:{status:'NOT_RATABLE_GLOBAL_STOP',level:'NOT_READY'},
 statusMapping:{CALCULATED:'ASSESSED',PARTIAL:'PARTIAL',INSUFFICIENT_DATA:'INSUFFICIENT_DATA',NOT_RATABLE_GLOBAL_STOP:'NOT_RATABLE_GLOBAL_STOP'},
 caseRequiredFactCodes:['CASE_requestedAmount','CASE_requestedTermMonths','CASE_financingPurpose','CASE_requestedProduct','CASE_urgency'],
 caseOptionalFactCodes:['CASE_contractReference','CASE_collateralInformation','CASE_clientExplanation'],reviewMaximumConfidence:'MEDIUM'
});
export const READINESS_POLICY_FINGERPRINT=id('readiness-policy',READINESS_POLICY);
