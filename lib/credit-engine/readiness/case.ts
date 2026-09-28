import type {ReadinessInputV1,ReadinessPolicyV1,FinancingCaseDefinitionV1} from '../contracts/readiness.ts';
import {READINESS_POLICY} from './policy.ts';
import {unique,canonicalClone,stable} from './common.ts';
export function readinessCaseDefinition(x:ReadinessInputV1,p:ReadinessPolicyV1=READINESS_POLICY):FinancingCaseDefinitionV1{
 const codes=[...p.caseRequiredFactCodes,...p.caseOptionalFactCodes];
 const facts=x.contextAssessment.facts.filter(f=>codes.includes(f.semanticCode)).map(f=>({...canonicalClone(f),sourceIds:unique(f.sourceIds),sourceMetricCodes:unique(f.sourceMetricCodes),sourceRiskFactIds:unique(f.sourceRiskFactIds),portfolioObligationIds:unique(f.portfolioObligationIds),reconciliationFindingIds:unique(f.reconciliationFindingIds),warnings:unique(f.warnings),evidence:f.evidence.map(canonicalClone).sort((a,b)=>a.evidenceId.localeCompare(b.evidenceId)||stable(a).localeCompare(stable(b)))})).sort((a,b)=>a.semanticCode.localeCompare(b.semanticCode)||a.factId.localeCompare(b.factId));
 const knownFactCodes=unique(facts.filter(f=>f.status==='KNOWN'&&f.value!==null&&f.value!==''&&f.value!=='UNKNOWN').map(f=>f.semanticCode)),missingFactCodes=p.caseRequiredFactCodes.filter(c=>!knownFactCodes.includes(c));
 return {status:missingFactCodes.length===0?'DEFINED':facts.some(f=>['KNOWN','PARTIAL'].includes(f.status)&&f.value!==null&&f.value!==''&&f.value!=='UNKNOWN')?'PARTIAL':'NOT_PROVIDED',requiredFactCodes:[...p.caseRequiredFactCodes],knownFactCodes,missingFactCodes,facts,warnings:['CASE_DEFINITION_INFORMATIONAL_ONLY','REQUESTED_AMOUNT_NOT_CAPACITY','REQUESTED_PRODUCT_NOT_RECOMMENDATION']};
}
