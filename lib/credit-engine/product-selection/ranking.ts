import type {ProductCandidateV1,ProductSelectionPolicyV1,ProductFamilyRegistryV1,ProductPurpose,ProductSelectionStatus,RequestedProduct,RequestedProductAlignment} from '../contracts/product-selection.ts';
export function rankProducts(candidates:ProductCandidateV1[],purpose:ProductPurpose,status:ProductSelectionStatus,p:ProductSelectionPolicyV1,r:ProductFamilyRegistryV1){
 const blocked=['INSUFFICIENT_DATA','NOT_RATABLE_GLOBAL_STOP'].includes(status);
 // A unique purpose order precedes capacity/evidence tie breakers. Requested amount
 // alignment never breaks this total order, including across valid annuity scenarios.
 const out=candidates.map(c=>({...c})).sort((a,b)=>blocked?p.stableProductOrder.indexOf(a.productFamily)-p.stableProductOrder.indexOf(b.productFamily):p.fitOrder.indexOf(a.fitLevel)-p.fitOrder.indexOf(b.fitLevel)||r.purposeOrder[purpose].indexOf(a.productFamily)-r.purposeOrder[purpose].indexOf(b.productFamily)||p.stableProductOrder.indexOf(a.productFamily)-p.stableProductOrder.indexOf(b.productFamily));
 const good=out.filter(c=>['STRONG_MATCH','MODERATE_MATCH'].includes(c.fitLevel)),fallback=!blocked&&!good.length&&p.conditionalPrimaryFallback;
 const primary=blocked?[]:(good.length?good:fallback?out.filter(c=>c.fitLevel==='CONDITIONAL_MATCH'):[]).slice(0,p.maximumPrimaryCandidates).map(c=>c.productFamily);
 for(let i=0;i<out.length;i++){out[i].rank=blocked?null:i+1;out[i].primaryCandidate=primary.includes(out[i].productFamily);if(blocked)out[i].fitLevel='UNKNOWN';}
 return {candidates:out,primary,warnings:fallback&&primary.length?['ONLY_CONDITIONAL_PRODUCT_MATCHES_AVAILABLE']:[]};
}
export function requestedAlignment(c:ProductCandidateV1|undefined,requested:RequestedProduct):RequestedProductAlignment{if(!c||requested==='UNKNOWN'||requested==='OTHER'||c.rank===null||c.fitLevel==='UNKNOWN')return 'UNKNOWN';if(c.fitLevel==='CONDITIONAL_MATCH')return 'CONDITIONAL';if(c.primaryCandidate)return 'ALIGNED_WITH_PRIMARY';if(c.fitLevel==='MODERATE_MATCH'||c.fitLevel==='STRONG_MATCH')return 'ALIGNED_WITH_CANDIDATE';return 'NOT_ALIGNED_WITH_MODELED_PURPOSE';}
