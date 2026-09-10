import {FINANCING_PURPOSES,REQUESTED_PRODUCTS,CASE_URGENCIES,type FinancingCaseInputV1,type ContextFactV1,type ContextShadowInput} from '../contracts/context.ts';
import {contextFact,dateEligible,id,weakest} from './common.ts';
export function normalizeFinancingCase(input:FinancingCaseInputV1,companyInn:string,asOfDate:string):FinancingCaseInputV1{
 if(!input.caseId||input.companyInn!==companyInn||input.asOfDate!==asOfDate)throw Error('CONTEXT_CASE_INPUT_MISMATCH');
 const c=structuredClone(input);
 for(const k of ['requestedAmount','requestedTermMonths','financingPurpose','requestedProduct','urgency','contractReference','collateralInformation','clientExplanation']as const){const f=c[k];if(!f){if(['requestedAmount','requestedTermMonths','financingPurpose','requestedProduct','urgency'].includes(k))throw Error(`CONTEXT_CASE_FIELD_MISSING:${k}`);continue;}
 if(!['KNOWN','PARTIAL','UNKNOWN','NOT_APPLICABLE'].includes(f.status)||!['HIGH','MEDIUM','LOW','UNKNOWN'].includes(f.confidence)||!['CANONICAL_OBSERVED','DOCUMENT_REPORTED','CLIENT_DECLARED','DERIVED_RELATIONSHIP'].includes(f.source))throw Error(`CONTEXT_CASE_FIELD_INVALID:${k}`);
 // Input fields alone are declarations: document confirmation is a separate canonical match below.
 f.source='CLIENT_DECLARED';f.confidence=weakest(f.confidence,'MEDIUM');f.warnings=[...(f.warnings??[]),'CLIENT_DECLARED_NOT_INDEPENDENT_PROOF'];
 if(!dateEligible(f.evidenceAsOf,asOfDate)){f.value=null;f.status='UNKNOWN';f.warnings.push('CONTEXT_CASE_AVAILABILITY_UNSUPPORTED');}
 if(['UNKNOWN','NOT_APPLICABLE'].includes(f.status)||f.value==null){f.value=null;if(f.status!=='NOT_APPLICABLE')f.status='UNKNOWN';continue;}
 if(k==='requestedAmount'||k==='requestedTermMonths'){if(typeof f.value!=='number'||!Number.isFinite(f.value)||f.value<0||k==='requestedTermMonths'&&!Number.isInteger(f.value))throw Error(`CONTEXT_CASE_NUMBER_INVALID:${k}`);}
 else if(typeof f.value!=='string'||!f.value.trim())throw Error(`CONTEXT_CASE_TEXT_INVALID:${k}`);
 const allowed=k==='financingPurpose'?FINANCING_PURPOSES:k==='requestedProduct'?REQUESTED_PRODUCTS:k==='urgency'?CASE_URGENCIES:null;if(allowed&&!allowed.includes(f.value as never))throw Error(`CONTEXT_CASE_ENUM_INVALID:${k}`);
 }
 return c;
}
export const normalizeContract=(s:string)=>s.trim().replace(/^№\s*/,'').normalize('NFKC').replace(/\s+/g,' ').toUpperCase();
export function caseFacts(input:ContextShadowInput,warnings:string[]):ContextFactV1[]{
 if(!input.financingCase)return [];
 const c=normalizeFinancingCase(input.financingCase,input.analysis.companyInn,input.asOfDate),out:ContextFactV1[]=[];
 for(const k of ['requestedAmount','requestedTermMonths','financingPurpose','requestedProduct','urgency','contractReference','collateralInformation','clientExplanation']as const){const f=c[k];if(!f)continue;const original=input.financingCase[k];if(original?.evidenceAsOf&&!dateEligible(original.evidenceAsOf,input.asOfDate))warnings.push(`CONTEXT_FUTURE_INFORMATION_EXCLUDED:case:${k}`);
 out.push(contextFact(c.companyInn,`CASE_${k}`, 'FINANCING_CASE',f.value,{status:f.status,confidence:f.confidence,sourceClass:'CLIENT_DECLARED',unit:k==='requestedAmount'?'RUB':k==='requestedTermMonths'?'MONTHS':'TEXT',period:{from:null,to:null,asOf:dateEligible(f.evidenceAsOf,input.asOfDate)?f.evidenceAsOf:null},sourceIds:[`case:${c.caseId}`],evidence:[{evidenceId:id('case-evidence',c.caseId,k),sourceId:`case:${c.caseId}`,sourceType:'USER_DECLARATION',sourceClass:'CLIENT_DECLARED',metricCode:null,factCode:k,portfolioObligationId:null,reconciliationFindingId:null,value:f.value,unit:null,periodFrom:null,periodTo:null,asOf:dateEligible(f.evidenceAsOf,input.asOfDate)?f.evidenceAsOf:null,confidence:f.confidence,calculationBasis:'Client declaration; not independent documentary proof'}],warnings:f.warnings}));
 }
 return out;
}
