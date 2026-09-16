import type {ProductFamily,ProductSelectionInputV1} from '../contracts/product-selection.ts';
export function existingProductExposure(x:ProductSelectionInputV1,f:ProductFamily){const p=x.creditPortfolio;if(!p)return {present:null,ids:[] as string[],warnings:['PORTFOLIO_NOT_PROVIDED']};
 // Canonical portfolio CREDIT_LINE does not prove revolving mechanics.
 const eligible=p.obligations.filter(o=>o.type===f),current=eligible.filter(o=>o.status.knowledge==='KNOWN'&&o.status.value==='ACTIVE');
 const unknown=eligible.some(o=>o.status.knowledge!=='KNOWN'||o.status.value==='UNKNOWN'||o.status.value==='DETECTED');
 return {present:current.length?true:unknown?null:false,ids:current.map(o=>o.obligationId).sort(),warnings:unknown?['EXISTING_EXPOSURE_STATUS_UNKNOWN']:[]};}
