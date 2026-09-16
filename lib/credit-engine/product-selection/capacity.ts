import type {ProductSelectionInputV1,ProductFamilyDefinitionV1,ProductPrincipalReferenceV1,ProductCapacityAlignment} from '../contracts/product-selection.ts';
import {unique} from './common.ts';
export function productCapacity(x:ProductSelectionInputV1,p:ProductFamilyDefinitionV1){const d=x.debtCapacity,h=d.headlineCapacity.monthlyIncrementalDebtServiceCapacity,indirect=p.capacityRelevance==='INDIRECT';
 let alignment:ProductCapacityAlignment=indirect?'INDIRECT_NOT_PRODUCT_LIMIT':p.capacityRelevance==='NOT_APPLICABLE'?'NOT_APPLICABLE':h.state==='ZERO'?'CONSTRAINED':h.state==='POSITIVE'?'SUPPORTED':'UNKNOWN';
 const principalReferences:ProductPrincipalReferenceV1[]=[];
 if(p.productFamily==='TERM_LOAN')for(const s of d.scenarioResults){const term=x.creditAssessment.financingCase.requestedTermMonths;const applicable=term?.status==='KNOWN'&&term.value===s.termMonths&&!s.warnings.includes('SCENARIO_TERM_MISMATCH');if(!applicable||s.prudentialPrincipalEquivalent===null||s.maximumPolicyPrincipalEquivalent===null)continue;
 principalReferences.push({scenarioId:s.scenarioId,termMonths:s.termMonths,annualRatePercent:s.annualRatePercent,requestedAmountCoverage:s.requestedAmountCoverage,confidence:s.confidence,serviceablePrincipalEquivalent:{prudential:s.prudentialPrincipalEquivalent,maximumPolicy:s.maximumPolicyPrincipalEquivalent},capacityReferenceIds:unique(s.references.map(e=>e.referenceId)),calculationBasis:'BLOCK13_GENERIC_ANNUITY_REFERENCE_NOT_BANK_LIMIT'});}
 // Amount affects alignment only; never candidate fit or ranking.
 if(principalReferences.length&&principalReferences.every(s=>s.requestedAmountCoverage==='ABOVE_MODELED_CAPACITY'))alignment='CONSTRAINED';
 const coverages=unique(principalReferences.map(s=>s.requestedAmountCoverage));
 const requestedAmountAlignment=p.productFamily!=='TERM_LOAN'?'NOT_APPLICABLE' as const:coverages.length===1?principalReferences[0].requestedAmountCoverage:'UNKNOWN' as const;
 return {alignment,requestedAmountAlignment,principalReferences:principalReferences.sort((a,b)=>a.scenarioId.localeCompare(b.scenarioId)),referenceIds:indirect?[]:unique(d.headlineCapacity.references.map(e=>e.referenceId)),zero:!indirect&&h.state==='ZERO'};
}
