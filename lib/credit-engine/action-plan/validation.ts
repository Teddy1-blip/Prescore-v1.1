import {RECOMMENDATION_ENGINE_VERSION,RECOMMENDATION_METHODOLOGY,RECOMMENDATION_ACTION_TYPES,RECOMMENDATION_CATEGORIES,type RecommendationV1} from '../contracts/recommendations.ts';
import type {ActionPlanInputV1 as Input} from '../contracts/action-plan.ts';
import {RECOMMENDATION_POLICY,RECOMMENDATION_POLICY_FINGERPRINT} from '../recommendations/policy.ts';
import {RECOMMENDATION_REGISTRY,RECOMMENDATION_REGISTRY_FINGERPRINT} from '../recommendations/registry.ts';
import {validateRecommendationInput} from '../recommendations/validation.ts';
import {resolveActionPlanDependencies} from './dependencies.ts';
import {fail,finiteTree,validDate,id,canonical,same,rank} from './common.ts';
const confidences=['HIGH','MEDIUM','LOW','UNKNOWN'];
export function validateActionPlanInput(x:Input):void{
 finiteTree(x);if(!validDate(x.asOfDate))fail('ASOF_DATE');validateRecommendationInput(x);
 const s=x.recommendationSet,p=RECOMMENDATION_POLICY;if(!s||s.version!==RECOMMENDATION_ENGINE_VERSION||s.policyVersion!==p.version||s.policyFingerprint!==RECOMMENDATION_POLICY_FINGERPRINT||s.registryVersion!==RECOMMENDATION_REGISTRY.version||s.registryFingerprint!==RECOMMENDATION_REGISTRY_FINGERPRINT||s.methodology!==RECOMMENDATION_METHODOLOGY||s.mode!=='SHADOW')fail('RECOMMENDATION_VERSION_FINGERPRINT');
 if(s.companyInn!==x.creditAssessment.companyInn||s.asOfDate!==x.asOfDate)fail('COMPANY_OR_ASOF');
 for(const k of ['riskAssessment','contextAssessment','prescoreIndex','financingReadiness','creditAssessment','debtCapacity','productSelection','creditPortfolio']as const){const v=x[k],ref=s.upstreamReferences[k];if(v?(!ref||ref.version!==v.version||ref.fingerprint!==id('recommendation-upstream',canonical(v))):!!ref)fail('RECOMMENDATION_LINEAGE:'+k);}
 if(typeof s.comparable!=='boolean'||!['GENERATED','PARTIAL','INSUFFICIENT_DATA','NOT_RATABLE_GLOBAL_STOP'].includes(s.status)||!confidences.includes(s.confidence)||rank(s.confidence)>rank(x.productSelection.confidence)||s.comparable&&(s.status!=='GENERATED'||!x.productSelection.comparable)||x.creditAssessment.status==='NOT_RATABLE_GLOBAL_STOP'&&s.status!=='NOT_RATABLE_GLOBAL_STOP'||s.status==='NOT_RATABLE_GLOBAL_STOP'&&x.creditAssessment.status!=='NOT_RATABLE_GLOBAL_STOP'||(x.creditAssessment.status==='INSUFFICIENT_DATA'||x.productSelection.status==='INSUFFICIENT_DATA')&&s.status!=='INSUFFICIENT_DATA'||s.status==='GENERATED'&&(x.creditAssessment.status==='PARTIAL'||x.productSelection.status==='PARTIAL'))fail('RECOMMENDATION_STATE');
 const ids=new Set(s.recommendations.map(r=>r.recommendationId));if(ids.size!==s.recommendations.length)fail('DUPLICATE_RECOMMENDATION_ID');
 if(new Set(s.primaryRecommendationIds).size!==s.primaryRecommendationIds.length||s.primaryRecommendationIds.some(v=>!ids.has(v)))fail('PRIMARY_LINEAGE');
 const grouped=s.recommendationGroups.flatMap(g=>g.recommendationIds);if(grouped.length!==ids.size||new Set(grouped).size!==ids.size||grouped.some(v=>!ids.has(v)))fail('GROUP_LINEAGE');
 for(const r of s.recommendations){validateRecommendation(r);if(rank(s.confidence)>rank(r.confidence))fail('CONFIDENCE_PROMOTION');if(s.status==='GENERATED'&&(r.actionability==='BLOCKED_BY_DATA'||['LOW','UNKNOWN'].includes(r.confidence)))fail('IMPOSSIBLE_GENERATED');
 const refs:Array<[string[],string[]]>=[[r.riskFindingIds,x.riskAssessment.findings.map(f=>f.findingId)],[r.riskFactIds,x.riskAssessment.facts.map(f=>f.factId)],[r.contextRelationIds,x.contextAssessment.relations.map(f=>f.relationId)],[r.contextFactIds,x.contextAssessment.facts.map(f=>f.factId)],[r.assessmentDriverIds,x.creditAssessment.drivers.map(f=>f.driverId)],[r.assessmentLimitationIds,x.creditAssessment.limitations.map(f=>f.limitationId)],[r.portfolioObligationIds,x.creditPortfolio?.obligations.map(o=>o.obligationId)??[]]];
 for(const [rs,allowed]of refs)if(rs.some(v=>!allowed.includes(v)))fail('DANGLING_RECOMMENDATION_LINEAGE');
 const capacityRefs=new Set([...x.debtCapacity.headlineCapacity.references,...x.debtCapacity.operatingBasis.canonicalFullMonthAverage.references,...x.debtCapacity.operatingBasis.conservativeOperatingBasis.references,...x.debtCapacity.observedDebtServiceBasis.references,...x.debtCapacity.portfolioScheduledDebtService30d.references].map(e=>e.referenceId));if(r.capacityReferenceIds.some(v=>!capacityRefs.has(v)))fail('CAPACITY_REFERENCE');
 if(r.productFamilies.some(f=>!x.productSelection.candidates.some(c=>c.productFamily===f)))fail('PRODUCT_REFERENCE');
 }
 if(s.summary.recommendationCount!==ids.size||s.summary.primaryCount!==s.primaryRecommendationIds.length||s.summary.suppressedCount!==s.suppressedRecommendations.length)fail('SUMMARY');
 for(const v of p.priorityOrder)if(s.summary.byPriority[v]!==s.recommendations.filter(r=>r.priority===v).length)fail('PRIORITY_SUMMARY');for(const v of p.actionabilityOrder)if(s.summary.byActionability[v]!==s.recommendations.filter(r=>r.actionability===v).length)fail('ACTIONABILITY_SUMMARY');
 resolveActionPlanDependencies(s.recommendations);
}
export function validateRecommendation(r:RecommendationV1):void{
 const p=RECOMMENDATION_POLICY,d=RECOMMENDATION_REGISTRY.definitions.find(d=>d.code===r.definitionCode);if(!d||r.definitionVersion!==d.version||typeof r.recommendationId!=='string'||!/^recommendation:[a-f0-9]{32}$/.test(r.recommendationId))fail('RECOMMENDATION_ID_OR_DEFINITION');
 if(!p.priorityOrder.includes(r.priority)||!p.actionabilityOrder.includes(r.actionability)||!p.remediabilityOrder.includes(r.remediability)||!['LOW','MEDIUM','HIGH'].includes(r.effort)||!confidences.includes(r.confidence)||!p.severityOrder.includes(r.sourceSeverity)||!RECOMMENDATION_CATEGORIES.includes(r.category)||!RECOMMENDATION_ACTION_TYPES.includes(r.actionType))fail('RECOMMENDATION_ENUM');
 for(const k of ['titleRu','actionSummaryRu','whatPrescoreWillRecheckRu','calculationBasis']as const)if(typeof r[k]!=='string'||!r[k].trim())fail('MISSING_COPY');for(const k of ['stepsRu','completionEvidenceRu']as const)if(!Array.isArray(r[k])||!r[k].length||r[k].some(t=>typeof t!=='string'||!t.trim()))fail('MISSING_STEPS_EVIDENCE');
 if(!r.verificationCriteria?.length)fail('MISSING_VERIFICATION');for(const c of r.verificationCriteria)if(!['RISK_FINDING_ABSENT','RISK_FINDING_SEVERITY_BELOW','DATA_REVIEW_ABSENT','FACT_KNOWN','FACT_VALUE_CONDITION','SOURCE_READY','SOURCE_CURRENT','PORTFOLIO_VALUE_KNOWN','PORTFOLIO_CONFLICT_RESOLVED','CAPACITY_STATE','CAPACITY_STATUS','PRODUCT_REQUIREMENT_SATISFIED','CASE_FIELD_KNOWN','DOCUMENT_CONFIRMED','MANUAL_REVIEW_REQUIRED'].includes(c.kind)||!['EQ','GT','GTE','LT','LTE','ABSENT','KNOWN','PRESENT'].includes(c.operator)||!c.sourceCode||!c.calculationBasis)fail('VERIFICATION_ENUM');
 // Text is source-authored, never regenerated. Dedupe in Block 15 may merge
 // criteria and lineage, so do not infer a new identity from the merged source set.
 for(const k of ['titleRu','actionSummaryRu','stepsRu','completionEvidenceRu']as const)if(!same(r[k],d![k]))fail('MUTATED_RECOMMENDATION_COPY');
}
