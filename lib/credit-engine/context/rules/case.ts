import {rule,v} from './factory.ts';
export const caseRules=[
 rule('BUSINESS-PROFILE','BUSINESS_PROFILE','NEUTRAL',['COMPANY_AGE_MONTHS','COMPANY_REGION','COMPANY_OKVED','COMPANY_STATUS'],[],'Factual company age, region, industry and lifecycle; no lending eligibility or prohibited-sector inference'),
 rule('CONTRACT-ACTIVITY','CONTRACTS','NEUTRAL',['ACTIVE_CONTRACT_COUNT','ACTIVE_CONTRACT_AMOUNT'],[],'Reported contract activity; not future revenue or guaranteed repayment'),
 rule('CASE-CONFIRMED-CONTRACT','FINANCING_CASE','NEUTRAL',['CASE_CONTRACT_MATCH'],[],'Unique exact canonical contract reference, documentary support with capped counterparty confidence',f=>v(f,'CASE_CONTRACT_MATCH')===true),
 rule('CASE-UNMATCHED-CONTRACT','FINANCING_CASE','REQUIRES_REVIEW',['CASE_CONTRACT_MATCH'],[],'Client contract reference lacks a unique available canonical match; unverified request remains a declaration',f=>v(f,'CASE_CONTRACT_MATCH')===false),
 rule('CASE-EXPLANATION','FINANCING_CASE','EXPLAINS',['CASE_clientExplanation'],[],'Client explanation only; no independently confirmed cause and no mitigation'),
 rule('CASE-REQUEST','FINANCING_CASE','NEUTRAL',['CASE_requestedAmount','CASE_requestedTermMonths','CASE_financingPurpose','CASE_requestedProduct','CASE_urgency'],[],'Client financing request, not debt capacity, product fit or approval recommendation')
];
