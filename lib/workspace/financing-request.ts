import type {AnalysisResult} from '../prescore.ts';
import type {CompanyProfileData} from '../company-profile.ts';
import {FINANCING_PURPOSES,REQUESTED_PRODUCTS,CASE_URGENCIES,type FinancingCaseField,type FinancingCaseInputV1} from '../credit-engine/contracts/context.ts';
import {canonicalAsOf,type CanonicalSavedInput} from '../credit-engine/production/orchestrator.ts';

export type FinancingRequestV1={purpose:typeof FINANCING_PURPOSES[number];product:typeof REQUESTED_PRODUCTS[number];amount:number|null;termMonths:number|null;annualRatePercent:number|null;urgency?:typeof CASE_URGENCIES[number];receivedAt:string};
export function parseFinancingRequest(value:unknown,receivedAt:string):FinancingRequestV1{
 if(!value||typeof value!=='object')throw Error('Укажите параметры финансирования');
 const input=value as Record<string,unknown>;
 if(!FINANCING_PURPOSES.includes(input.purpose as never)||!REQUESTED_PRODUCTS.includes(input.product as never))throw Error('Выберите цель и продукт из списка');
 function number(key:string,maximum:number,integer=false){const v=input[key];if(v==null||v==='')return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>maximum||integer&&!Number.isInteger(v))throw Error('Проверьте сумму, срок и ставку');return v;}
 const urgency=input.urgency??'UNKNOWN';
 if(!CASE_URGENCIES.includes(urgency as never))throw Error('Выберите срочность из списка');
 const amount=number('amount',1e12),termMonths=number('termMonths',600,true),annualRatePercent=number('annualRatePercent',1000);
 if(termMonths!==null&&termMonths<1)throw Error('Срок должен быть не меньше одного месяца');
 if(annualRatePercent!==null&&termMonths===null)throw Error('Для сценария со ставкой укажите срок');
 return {purpose:input.purpose as FinancingRequestV1['purpose'],product:input.product as FinancingRequestV1['product'],amount,termMonths,annualRatePercent,urgency:urgency as typeof CASE_URGENCIES[number],receivedAt};
}

// Adapt persisted declarations to the existing canonical input contracts, not new formulas.
export function savedCanonicalInput(analysis:AnalysisResult,companyProfile?:CompanyProfileData):CanonicalSavedInput{
 const input={analysis,companyProfile},r=analysis.financingRequestV1;
 if(!r)return input;
 const asOfDate=canonicalAsOf(input),field=<T>(value:T|null):FinancingCaseField<T>=>({value,source:'CLIENT_DECLARED',status:value===null?'UNKNOWN':'KNOWN',confidence:value===null?'UNKNOWN':'MEDIUM',evidenceAsOf:r.receivedAt.slice(0,10),warnings:['CLIENT_DECLARED_NOT_INDEPENDENT_PROOF']});
 const financingCase:FinancingCaseInputV1={caseId:'client-request-'+analysis.id,companyInn:analysis.companyInn,asOfDate,requestedAmount:field(r.amount),requestedTermMonths:field(r.termMonths),financingPurpose:field(r.purpose==='UNKNOWN'?null:r.purpose),requestedProduct:field(r.product==='UNKNOWN'?null:r.product),urgency:field<typeof CASE_URGENCIES[number]>(!r.urgency||r.urgency==='UNKNOWN'?null:r.urgency)};
 return {...input,financingCase,scenarios:r.annualRatePercent!==null&&r.termMonths!==null?[{scenarioId:'client-scenario-'+analysis.id,annualRatePercent:r.annualRatePercent,termMonths:r.termMonths,paymentFrequency:'MONTHLY',amortization:'ANNUITY',scenarioSource:'Явно заданные клиентом ставка и срок, не предложение банка',evidenceAsOf:r.receivedAt.slice(0,10),confidence:'MEDIUM'}]:[]};
}
