import type {RecommendationInputV1} from '../contracts/recommendations.ts';
import {PRODUCT_SELECTION_VERSION,PRODUCT_SELECTION_METHODOLOGY} from '../contracts/product-selection.ts';
import {PRODUCT_SELECTION_POLICY,productPolicyFingerprint} from '../product-selection/policy.ts';
import {PRODUCT_FAMILY_REGISTRY,productRegistryFingerprint} from '../product-selection/registry.ts';
import {validateProductInput,scanAvailability} from '../product-selection/validation.ts';
import {fail,canonical,id,rank,same} from './common.ts';
export function validateRecommendationInput(x:RecommendationInputV1):void{
 try{validateProductInput(x);}catch(e){fail('UPSTREAM:'+String(e));}
 const p=x.productSelection;if(!p||p.companyInn!==x.creditAssessment.companyInn||p.asOfDate!==x.asOfDate||p.mode!=='SHADOW'||p.version!==PRODUCT_SELECTION_VERSION||p.methodology!==PRODUCT_SELECTION_METHODOLOGY||p.policyVersion!==PRODUCT_SELECTION_POLICY.version||p.policyFingerprint!==productPolicyFingerprint(PRODUCT_SELECTION_POLICY)||p.registryVersion!==PRODUCT_FAMILY_REGISTRY.version||p.registryFingerprint!==productRegistryFingerprint(PRODUCT_FAMILY_REGISTRY))fail('PRODUCT_VERSION_OR_IDENTITY');
 for(const k of ['riskAssessment','contextAssessment','prescoreIndex','financingReadiness','creditAssessment','debtCapacity','creditPortfolio'] as const)if(p.upstreamFingerprints[k]!==id('product-upstream',canonical(x[k]??null)))fail('PRODUCT_UPSTREAM_FINGERPRINT');
 if(!['ASSESSED','PARTIAL','INSUFFICIENT_DATA','NOT_RATABLE_GLOBAL_STOP'].includes(p.status)||!['HIGH','MEDIUM','LOW','UNKNOWN'].includes(p.confidence)||rank(p.confidence)>rank(x.creditAssessment.confidence)||p.comparable&&(p.status!=='ASSESSED'||!x.creditAssessment.comparable)||p.status==='NOT_RATABLE_GLOBAL_STOP'&&x.creditAssessment.status!=='NOT_RATABLE_GLOBAL_STOP'||x.creditAssessment.status==='NOT_RATABLE_GLOBAL_STOP'&&p.status!=='NOT_RATABLE_GLOBAL_STOP')fail('PRODUCT_STATE');
 if(!same(p.creditAssessmentReference,x.debtCapacity.creditAssessmentReference)||!same(p.indexReference,x.creditAssessment.indexReference)||!same(p.readinessReference,x.creditAssessment.readinessReference))fail('PRODUCT_REFERENCES');
 if(p.candidates.length!==7||new Set(p.candidates.map(c=>c.productFamily)).size!==7||p.candidates.some(c=>!PRODUCT_SELECTION_POLICY.supportedProducts.includes(c.productFamily)))fail('PRODUCT_CANDIDATES');
 for(const c of p.candidates){if(!PRODUCT_SELECTION_POLICY.fitOrder.includes(c.fitLevel)||c.dataRequirements.some(q=>!['MISSING','PARTIAL','SATISFIED','NOT_APPLICABLE'].includes(q.status)))fail('PRODUCT_REQUIREMENT');for(const f of c.contextFactIds)if(!x.contextAssessment.facts.some(v=>v.factId===f))fail('PRODUCT_FACT_LINEAGE');for(const o of c.portfolioObligationIds)if(!x.creditPortfolio?.obligations.some(v=>v.obligationId===o))fail('PRODUCT_PORTFOLIO_LINEAGE');}
 if(p.summary.candidateCount!==p.candidates.length||p.summary.status!==p.status||!same(p.primaryCandidateProducts,p.candidates.filter(c=>c.primaryCandidate).map(c=>c.productFamily)))fail('PRODUCT_SUMMARY');
 scanAvailability(x,x.asOfDate);
}
