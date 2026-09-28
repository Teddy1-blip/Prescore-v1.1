import {PRESCORE_INDEX_POLICY_VERSION,type IndexPolicyV1,type IndexComponent} from '../contracts/index.ts';
import {id} from './common.ts';
const policy:IndexPolicyV1={
 version:PRESCORE_INDEX_POLICY_VERSION,
 componentMaximums:{FINANCIAL_STRENGTH:400,OPERATING_BEHAVIOR:300,DEBT_CREDIT:200,LEGAL_CORPORATE:100},
 severityPenaltyRatios:{CRITICAL:.60,HIGH:.35,MEDIUM:.18,LOW:.08,INFO:0},
 riskSeverityCeilings:{CRITICAL:549,HIGH:699,MEDIUM:849,LOW:949,INFO:1000,NONE:1000},
 domainMapping:{FINANCIAL:'FINANCIAL_STRENGTH',CASH_FLOW:'OPERATING_BEHAVIOR',DEBT_SERVICE:'DEBT_CREDIT',CREDIT_HISTORY:'DEBT_CREDIT',CREDIT_PORTFOLIO:'DEBT_CREDIT',LEGAL:'LEGAL_CORPORATE'},
 findingCodeComponentOverrides:{'RISK-CF-DEBT-SERVICE-BURDEN':'DEBT_CREDIT'},
 contextModifiers:{CORROBORATES:.10,MITIGATES:-.10},maximumContextAdjustment:.15,
 scoreableScopes:['CREDIT_RISK'],nonScoreableScopes:['DATA_REVIEW','INFORMATION','GLOBAL_STOP'],
 coverage:{
 FINANCIAL_STRENGTH:{requiredFactCodes:['FIN_EQUITY','FIN_CURRENT_RATIO','FIN_ANNUAL_REVENUE','FIN_ANNUAL_NET_PROFIT'],minimumKnown:2,adequateKnown:4},
 OPERATING_BEHAVIOR:{requiredFactCodes:['BANK_OPERATING_TREND','BANK_TOP1','BANK_COVERAGE_ADEQUATE'],minimumKnown:1,adequateKnown:3},
 DEBT_CREDIT:{requiredFactCodes:['BANK_DEBT_SERVICE_RATIO'],minimumKnown:1,adequateKnown:1},
 LEGAL_CORPORATE:{requiredFactCodes:['LEGAL_LIFECYCLE'],minimumKnown:1,adequateKnown:1}},
 rounding:{pointDecimals:2,finalDecimals:0}
};
function freeze<T>(x:T):T{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
export const INDEX_POLICY=freeze(policy);
export const INDEX_POLICY_FINGERPRINT=id('index-policy',INDEX_POLICY);

// Exact registered finding code first; no substring inference or upstream mutation.
export function resolveIndexComponent(code:string,domain:import('../contracts/risk.ts').RiskFinding['domain'],p:IndexPolicyV1=INDEX_POLICY):IndexComponent|undefined{return Object.hasOwn(p.findingCodeComponentOverrides,code)?p.findingCodeComponentOverrides[code]:p.domainMapping[domain];}
