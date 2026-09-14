import {FINANCING_READINESS_VERSION,READINESS_METHODOLOGY,type ReadinessInputV1,type ReadinessPolicyV1,type ReadinessLevel,type ReadinessConstraintV1,type FinancingCaseDefinitionV1,type FinancingReadinessV1,type ReadinessSummaryV1} from '../contracts/readiness.ts';
import {READINESS_POLICY} from './policy.ts';
import {validateReadinessInput,validateReadinessPolicy} from './validation.ts';
import {readinessConstraints,readinessContextExplanations} from './constraints.ts';
import {readinessCaseDefinition} from './case.ts';
import {id,unique,weakest,levelRank} from './common.ts';
export function readinessLevel(value:number,p:ReadinessPolicyV1=READINESS_POLICY):ReadinessLevel{return value>=p.highIndexMinimum?'HIGH':value>=p.mediumIndexMinimum?'MEDIUM':'LOW';}
export function resolveReadiness(x:ReadinessInputV1,cs:ReadinessConstraintV1[],p:ReadinessPolicyV1=READINESS_POLICY){
 const i=x.prescoreIndex;let status=p.statusMapping[i.status];
 const dataReview=cs.some(c=>c.kind==='DATA_REVIEW'),contextReview=cs.some(c=>c.kind==='CONTEXT_REVIEW'&&c.relevantToAssessment),coverageLimited=i.coverage.components.some(c=>c.state!=='ADEQUATE');
 if(status==='ASSESSED'&&(dataReview||contextReview||coverageLimited))status='PARTIAL';
 const baseLevel:ReadinessLevel=status==='NOT_RATABLE_GLOBAL_STOP'?p.globalStopBehavior.level:status==='INSUFFICIENT_DATA'?'UNKNOWN':readinessLevel(i.value!,p);let level=baseLevel;
 const reasons:string[]=[];
 if(status==='PARTIAL'){reasons.push(...(i.status==='PARTIAL'?['INDEX_PARTIAL']:[]),...(dataReview?['DATA_REVIEW_REQUIRED']:[]),...(contextReview?['MATERIAL_CONTEXT_REVIEW']:[]),...(coverageLimited?['INDEX_COVERAGE_LIMITED']:[]));if(levelRank[level]>levelRank[p.partialMaximumLevel])level=p.partialMaximumLevel;}
 if(['ASSESSED','PARTIAL'].includes(status)&&['LOW','UNKNOWN'].includes(i.confidence)){reasons.push(i.confidence==='LOW'?'LOW_INDEX_CONFIDENCE':'UNKNOWN_INDEX_CONFIDENCE');if(levelRank[level]>levelRank[p.lowConfidenceMaximumLevel])level=p.lowConfidenceMaximumLevel;}
 const confidence=weakest(i.confidence,...i.coverage.components.map(c=>c.confidence),...cs.filter(c=>c.relevantToAssessment).map(c=>c.evidenceConfidence),...(status==='PARTIAL'?[p.reviewMaximumConfidence]:[]));
 return {status,baseLevel,level,confidence,comparable:status==='ASSESSED'&&i.comparable,uncertaintyCapApplied:level!==baseLevel,uncertaintyCapReasons:unique(reasons)};
}
export function finalizeReadiness(x:ReadinessInputV1,cs:ReadinessConstraintV1[],caseDefinition:FinancingCaseDefinitionV1,state:ReturnType<typeof resolveReadiness>,p:ReadinessPolicyV1=READINESS_POLICY):FinancingReadinessV1{
 const credit=cs.filter(c=>c.kind==='CREDIT_RISK'),data=cs.filter(c=>c.kind==='DATA_REVIEW'),context=cs.filter(c=>c.kind==='CONTEXT_REVIEW');
 const warnings=unique(['READINESS_SHADOW_PRE_CALIBRATION','ANALYTICAL_READINESS_NOT_BANK_APPROVAL',...x.prescoreIndex.warnings,...(state.status!=='ASSESSED'?['READINESS_NOT_COMPARABLE']:[])]);
 const summary:ReadinessSummaryV1={...state,indexValue:x.prescoreIndex.value,indexStatus:x.prescoreIndex.status,criticalRiskCount:credit.filter(c=>c.severity==='CRITICAL').length,highRiskCount:credit.filter(c=>c.severity==='HIGH').length,mediumRiskCount:credit.filter(c=>c.severity==='MEDIUM').length,lowRiskCount:credit.filter(c=>c.severity==='LOW').length,globalStopCount:cs.filter(c=>c.kind==='GLOBAL_STOP').length,dataReviewCount:data.length,contextReviewCount:context.length,materialCreditConstraintCount:credit.filter(c=>c.severity&&p.materialRiskSeverities.includes(c.severity)).length,assessmentLimitationCount:data.length+context.length,dataReviewRequired:data.length>0,dataReviewFindingIds:unique(data.flatMap(c=>c.riskFindingIds)),caseDefinitionStatus:caseDefinition.status,warnings:[...warnings]};
 const i=x.prescoreIndex;
 return {version:FINANCING_READINESS_VERSION,policyVersion:p.version,policyFingerprint:id('readiness-policy',p),methodology:READINESS_METHODOLOGY,mode:'SHADOW',companyInn:i.companyInn,asOfDate:x.asOfDate,...state,indexReference:{version:i.version,policyVersion:i.policyVersion,policyFingerprint:i.policyFingerprint,value:i.value,status:i.status},constraints:cs,contextExplanations:readinessContextExplanations(x),caseDefinition,summary,warnings};
}
export function buildFinancingReadiness(x:ReadinessInputV1,p:ReadinessPolicyV1=READINESS_POLICY):FinancingReadinessV1{validateReadinessPolicy(p);validateReadinessInput(x);const cs=readinessConstraints(x,p),definition=readinessCaseDefinition(x,p),state=resolveReadiness(x,cs,p);return finalizeReadiness(x,cs,definition,state,p);}
