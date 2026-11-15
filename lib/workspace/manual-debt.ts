import {validDate,id} from '../credit-engine/credit-portfolio/common.ts';
import {validInn} from '../external/checko-inn.ts';
import type {PortfolioObservation,PortfolioObligationType} from '../credit-engine/contracts/credit-portfolio.ts';
export type ManualDebt={creditor:string;creditorInn:string;contract:string;contractDate:string;asOf:string;principal:number;product:PortfolioObligationType;basis:string};
export function manualDebt(raw:Partial<Record<keyof ManualDebt,unknown>>,today:string):ManualDebt|null{
 if(!raw||typeof raw.creditor!=='string'||!raw.creditor.trim()||raw.creditor.length>160||typeof raw.contract!=='string'||!raw.contract.trim()||raw.contract.length>120||typeof raw.basis!=='string'||!raw.basis.trim()||raw.basis.length>320)return null;
 if(typeof raw.creditorInn!=='string'||raw.creditorInn&&!validInn(raw.creditorInn)||!validDate(raw.contractDate)||!validDate(raw.asOf)||raw.contractDate>raw.asOf||raw.asOf>today)return null;
 if(typeof raw.principal!=='number'||raw.principal<0||!Number.isSafeInteger(Math.round(raw.principal*100))||Math.abs(raw.principal-Math.round(raw.principal*100)/100)>1e-9||!['TERM_LOAN','CREDIT_LINE','OVERDRAFT','LEASING','OTHER_DEBT'].includes(String(raw.product)))return null;
 return {creditor:raw.creditor.trim(),creditorInn:raw.creditorInn,contract:raw.contract.trim(),contractDate:raw.contractDate,asOf:raw.asOf,principal:raw.principal,product:raw.product as ManualDebt['product'],basis:raw.basis.trim()};
}
export function manualObservation(m:ManualDebt,inn:string,source:string):PortfolioObservation{
 const oid=id('principal-confirmation',source);
 return {observationId:oid,observationGroupId:source,companyInn:inn,obligationHints:{creditorName:m.creditor,creditorInn:m.creditorInn||undefined,contractNumber:m.contract,contractDate:m.contractDate,productType:m.product},fieldCode:'principalOutstanding',value:m.principal,unit:'RUB',knowledge:'KNOWN',origin:'REPORTED',observedAt:m.asOf,effectiveFrom:null,effectiveTo:null,confidence:'MEDIUM',evidence:[{evidenceId:oid,sourceKind:'USER_CONFIRMATION',sourceId:source,rawField:'principalOutstanding',rawValue:m.principal,observedAt:m.asOf,description:m.basis}],warnings:[]};
}
