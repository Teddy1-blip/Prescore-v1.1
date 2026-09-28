import {PRODUCT_FAMILY_REGISTRY_VERSION,type ProductFamilyRegistryV1,type ProductFamily,type ProductFitLevel,type ProductPurpose,type ProductFamilyDefinitionV1} from '../contracts/product-selection.ts';
import {FINANCING_PURPOSES} from '../contracts/context.ts';
import {PRODUCT_FAMILIES} from './policy.ts';
import {freeze,id,stable,fail} from './common.ts';
// Ordered categorical affinities: no points, lender conditions or bank term limits.
const mapping:Record<ProductPurpose,Array<[ProductFamily,ProductFitLevel]>>={
 WORKING_CAPITAL:[['REVOLVING_CREDIT_LINE','STRONG_MATCH'],['CREDIT_LINE','STRONG_MATCH'],['OVERDRAFT','MODERATE_MATCH'],['TERM_LOAN','MODERATE_MATCH'],['FACTORING','CONDITIONAL_MATCH']],
 CONTRACT_EXECUTION:[['BANK_GUARANTEE','STRONG_MATCH'],['CREDIT_LINE','STRONG_MATCH'],['TERM_LOAN','MODERATE_MATCH'],['REVOLVING_CREDIT_LINE','MODERATE_MATCH'],['FACTORING','CONDITIONAL_MATCH']],
 REFINANCING:[['TERM_LOAN','STRONG_MATCH'],['CREDIT_LINE','WEAK_MATCH']],
 INVESTMENT:[['TERM_LOAN','STRONG_MATCH'],['LEASING','MODERATE_MATCH'],['CREDIT_LINE','MODERATE_MATCH']],
 EQUIPMENT:[['LEASING','STRONG_MATCH'],['TERM_LOAN','STRONG_MATCH'],['CREDIT_LINE','MODERATE_MATCH']],
 SEASONAL_NEED:[['REVOLVING_CREDIT_LINE','STRONG_MATCH'],['CREDIT_LINE','STRONG_MATCH'],['OVERDRAFT','MODERATE_MATCH'],['TERM_LOAN','MODERATE_MATCH'],['FACTORING','CONDITIONAL_MATCH']],
 LIQUIDITY_GAP:[['OVERDRAFT','STRONG_MATCH'],['REVOLVING_CREDIT_LINE','STRONG_MATCH'],['CREDIT_LINE','STRONG_MATCH'],['FACTORING','CONDITIONAL_MATCH'],['TERM_LOAN','WEAK_MATCH']],OTHER:[],UNKNOWN:[]};
const mechanics:Record<ProductFamily,Pick<ProductFamilyDefinitionV1,'mechanicsClass'|'capacityRelevance'|'cashFunding'|'requiredDataCodes'>>={
 TERM_LOAN:{mechanicsClass:'FUNDED_AMORTIZING',capacityRelevance:'DIRECT_SERVICEABILITY',cashFunding:true,requiredDataCodes:['DEBT_CAPACITY_REQUIRED_FOR_FUNDED_PRODUCT','EXPLICIT_RATE_TERM_SCENARIO_REQUIRED_FOR_PRINCIPAL_REFERENCE']},
 CREDIT_LINE:{mechanicsClass:'FUNDED_LINE',capacityRelevance:'GENERIC_HEADROOM_SUPPORT',cashFunding:true,requiredDataCodes:['DEBT_CAPACITY_REQUIRED_FOR_FUNDED_PRODUCT','PRODUCT_SPECIFIC_LIMIT_NOT_MODELED']},
 REVOLVING_CREDIT_LINE:{mechanicsClass:'FUNDED_REVOLVING',capacityRelevance:'GENERIC_HEADROOM_SUPPORT',cashFunding:true,requiredDataCodes:['DEBT_CAPACITY_REQUIRED_FOR_FUNDED_PRODUCT','PRODUCT_SPECIFIC_LIMIT_NOT_MODELED']},
 OVERDRAFT:{mechanicsClass:'FUNDED_REVOLVING_SHORT_LIQUIDITY',capacityRelevance:'GENERIC_HEADROOM_SUPPORT',cashFunding:true,requiredDataCodes:['DEBT_CAPACITY_REQUIRED_FOR_FUNDED_PRODUCT','PRODUCT_SPECIFIC_LIMIT_NOT_MODELED']},
 BANK_GUARANTEE:{mechanicsClass:'CONTINGENT',capacityRelevance:'INDIRECT',cashFunding:false,requiredDataCodes:['CONTRACT_EVIDENCE_REQUIRED','PRODUCT_SPECIFIC_LIMIT_NOT_MODELED']},
 FACTORING:{mechanicsClass:'RECEIVABLES_FINANCE',capacityRelevance:'INDIRECT',cashFunding:true,requiredDataCodes:['RECEIVABLES_OR_INVOICE_EVIDENCE_REQUIRED','PRODUCT_SPECIFIC_LIMIT_NOT_MODELED']},
 LEASING:{mechanicsClass:'ASSET_FINANCE',capacityRelevance:'DIRECT_SERVICEABILITY',cashFunding:false,requiredDataCodes:['DEBT_CAPACITY_REQUIRED_FOR_FUNDED_PRODUCT','ASSET_SPECIFICATION_REQUIRED','PRODUCT_SPECIFIC_LIMIT_NOT_MODELED']}};
export const PRODUCT_FAMILY_REGISTRY:ProductFamilyRegistryV1=freeze({version:PRODUCT_FAMILY_REGISTRY_VERSION,products:PRODUCT_FAMILIES.map(productFamily=>({productFamily,...mechanics[productFamily],purposeAffinity:Object.fromEntries(FINANCING_PURPOSES.map(p=>[p,mapping[p].find(([f])=>f===productFamily)?.[1]??(p==='UNKNOWN'?'UNKNOWN':p==='OTHER'?'WEAK_MATCH':'NOT_APPLICABLE')])) as Record<ProductPurpose,ProductFitLevel>,conditionalityCodes:productFamily==='FACTORING'?['RECEIVABLES_OR_INVOICE_EVIDENCE_REQUIRED']:productFamily==='BANK_GUARANTEE'?['CONTRACT_EVIDENCE_REQUIRED']:[],calculationBasis:'GENERIC_PRODUCT_MECHANICS_NOT_BANK_ELIGIBILITY'})),purposeOrder:Object.fromEntries(FINANCING_PURPOSES.map(p=>[p,[...mapping[p].map(([f])=>f),...PRODUCT_FAMILIES.filter(f=>!mapping[p].some(([n])=>n===f))]])) as Record<ProductPurpose,ProductFamily[]>});
export const productRegistryFingerprint=(r:ProductFamilyRegistryV1)=>id('product-family-registry',r);
export const PRODUCT_FAMILY_REGISTRY_FINGERPRINT=productRegistryFingerprint(PRODUCT_FAMILY_REGISTRY);
export function validateProductRegistry(r:ProductFamilyRegistryV1){if(stable(r)!==stable(PRODUCT_FAMILY_REGISTRY))fail('REGISTRY');}
