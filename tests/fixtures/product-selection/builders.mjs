import {bank,portfolio,scenario,compose,defect as capacityDefect,field,date,refresh} from '../debt-capacity/builders.mjs';
import {material,input as contextInput,financingCase,activeContract} from '../context/builders.mjs';
import {buildContextAssessment} from '../../../lib/credit-engine/context/engine.ts';
import {buildDebtCapacity} from '../../../lib/credit-engine/debt-capacity/engine.ts';
import {buildFinancingReadiness} from '../../../lib/credit-engine/readiness/engine.ts';
import {buildCreditAssessment} from '../../../lib/credit-engine/credit-assessment/engine.ts';
import {finding,removeCore} from '../index/builders.mjs';
export {field,portfolio,scenario,date};
export function finish(x){const debtCapacity=buildDebtCapacity(x);const canonical=Object.fromEntries(Object.entries(x).filter(([k])=>!['bankMetrics','scenarios'].includes(k)));return {...canonical,debtCapacity};}
export function baseline({purpose='WORKING_CAPITAL',requested='CREDIT_LINE',amount=1000000,term=12,urgency='WITHIN_30_DAYS',purposeConfidence='MEDIUM',contract=false,contractConcentration=false,marketplace=false,factoring=false,profile={},debt=0,monthCount=12,creditPortfolio,scenarios=[],risk,missingCore=false,indexValue}={}){
 const b=bank({operating:Array(monthCount).fill(1000000),debt:Array(monthCount).fill(debt)}),m=material();m.analysis.metricsV2=b;Object.assign(m.companyProfile.company,profile);if(contract)activeContract(m);if(contractConcentration)m.companyProfile.contracts.items[0].customer=b.customers.directGroups[0].displayName;if(marketplace)b.customers.intermediatedOperatingShare.value=.8;if(factoring){m.analysis.metricsV2.financing.factoringInflow.value=100000;}
 const cf={financingPurpose:field(purpose,{confidence:purposeConfidence}),requestedProduct:field(requested),requestedAmount:field(amount),requestedTermMonths:field(term),urgency:field(urgency),...(contract?{contractReference:field('SYN-2026/1')}: {})};
 const ci=contextInput(m,financingCase(cf)),raw={riskAssessment:ci.riskAssessment,contextAssessment:buildContextAssessment(ci),asOfDate:date};
 if(risk)finding(raw,risk);if(missingCore)removeCore(raw,['FIN_REVENUE','FIN_EQUITY','FIN_CURRENT_RATIO','BANK_OPERATING_TREND','BANK_OWNER_OUTFLOW_SHARE','BANK_DEBT_SERVICE_RATIO','BKI_OVERDUE','LEGAL_LIFECYCLE']);
 const x={...compose(raw),bankMetrics:b,scenarios,...(creditPortfolio?{creditPortfolio}:{})};
 // Explicit canonical scalar boundary for Index/Readiness-neutrality testing only.
 // It does not assert the source fixture computes these exact Index points.
 if(indexValue!==undefined){x.prescoreIndex.value=indexValue;x.prescoreIndex.confidence='HIGH';x.financingReadiness=buildFinancingReadiness(x);x.creditAssessment=buildCreditAssessment(x);}
 return finish(x);
}
export function defect(){const d=capacityDefect(),withCase=baseline();d.contextAssessment.facts.push(...withCase.contextAssessment.facts.filter(f=>f.domain==='FINANCING_CASE'));return finish({...compose(d),bankMetrics:d.bankMetrics});}
export function reorder(x){const y=structuredClone(x);const walk=v=>{if(Array.isArray(v)){v.reverse();v.forEach(walk);}else if(v&&typeof v==='object')Object.values(v).forEach(walk);};walk(y);return y;}
export const refreshCapacity=x=>finish(refresh(x));
