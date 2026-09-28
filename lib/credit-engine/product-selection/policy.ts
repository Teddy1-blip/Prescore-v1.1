import {PRODUCT_SELECTION_POLICY_VERSION,type ProductSelectionPolicyV1,type ProductFamily} from '../contracts/product-selection.ts';
import {freeze,id,stable,fail} from './common.ts';
export const PRODUCT_FAMILIES:ProductFamily[]=freeze(['TERM_LOAN','CREDIT_LINE','REVOLVING_CREDIT_LINE','OVERDRAFT','BANK_GUARANTEE','FACTORING','LEASING']);
export const PRODUCT_SELECTION_POLICY:ProductSelectionPolicyV1=freeze({version:PRODUCT_SELECTION_POLICY_VERSION,supportedProducts:[...PRODUCT_FAMILIES],fitOrder:['STRONG_MATCH','MODERATE_MATCH','CONDITIONAL_MATCH','WEAK_MATCH','NOT_APPLICABLE','UNKNOWN'],maximumPrimaryCandidates:3,statusMapping:{COMPLETE:'ASSESSED',PARTIAL:'PARTIAL',INSUFFICIENT_DATA:'INSUFFICIENT_DATA',NOT_RATABLE_GLOBAL_STOP:'NOT_RATABLE_GLOBAL_STOP'},requestedProductDoesNotAffectRanking:true,capacityConstrainedMaximumFit:'CONDITIONAL_MATCH',conditionalPrimaryFallback:true,stableProductOrder:[...PRODUCT_FAMILIES],contractWithoutEvidenceMaximumFit:'CONDITIONAL_MATCH',minimumDocumentConfidence:'MEDIUM'});
export const productPolicyFingerprint=(p:ProductSelectionPolicyV1)=>id('product-selection-policy',p);
export const PRODUCT_SELECTION_POLICY_FINGERPRINT=productPolicyFingerprint(PRODUCT_SELECTION_POLICY);
export function validateProductPolicy(p:ProductSelectionPolicyV1){if(stable(p)!==stable(PRODUCT_SELECTION_POLICY))fail('POLICY');}
