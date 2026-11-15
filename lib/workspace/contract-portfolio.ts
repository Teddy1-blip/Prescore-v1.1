import type {DebtDocumentObservationBatch,PortfolioObservation,PortfolioIdentityHints} from '../credit-engine/contracts/credit-portfolio.ts';
import {id,validDate} from '../credit-engine/credit-portfolio/common.ts';
import {productType} from '../credit-engine/credit-portfolio/bki-adapter.ts';
import {numeric} from '../document-poc/fields.ts';
import type {SourceRow} from './dossier-sources.ts';

// A verified contractual amount or limit never populates an outstanding balance.
export function verifiedCreditDocument(row:SourceRow,inn:string):DebtDocumentObservationBatch|null {
 const verified=row.payload.verified,review=row.payload.review;
 if(row.kind!=='CREDIT_DOCUMENT'||!row.documentId||row.payload.envelope.companyInn!==inn||review?.status!=='READY_FOR_REVIEW'||!verified)return null;
 const read=(key:string)=>verified[key]?.value;
 const creditor=read('creditor'),number=read('agreement_number'),date=read('agreement_date');
 if(!creditor||!number||!validDate(date)||!read('borrower')||read('borrower_inn')!==inn)return null;
 const observedAt=row.payload.envelope.receivedAt.slice(0,10);
 const hints:PortfolioIdentityHints={creditorName:creditor,contractNumber:number,contractDate:date,productType:productType(read('product_type')??'')};
 const observations:PortfolioObservation[]=[];
 const mappings=[['agreement_date','openedAt','DATE'],['maturity_date','maturityDate','DATE'],['credit_amount','originalAmount','RUB'],['credit_limit','creditLimit','RUB'],['interest_rate','annualRate','PERCENT']] as const;
 for(const [key,fieldCode,unit] of mappings){
   const selected=verified[key];if(!selected||!selected.fragment||unit==='RUB'&&read('currency')!=='RUB')continue;
   const value=unit==='DATE'?validDate(selected.value)?selected.value:null:numeric(selected.value);
   if(value===null||typeof value==='number'&&value<0)continue;
   const evidenceId=id('verified-field',row.id,key,selected.page,value);
   observations.push({observationId:evidenceId,observationGroupId:row.id,companyInn:inn,obligationHints:hints,fieldCode,value,unit,knowledge:'KNOWN',origin:'REPORTED',observedAt,effectiveFrom:null,effectiveTo:null,confidence:'HIGH',
     evidence:[{evidenceId,sourceKind:'USER_CONFIRMATION',sourceId:row.id,documentId:row.documentId,pageHint:String(selected.page),rawField:key,rawValue:selected.value,observedAt,description:selected.fragment}],warnings:[]});
 }
 return observations.length?{documentId:row.documentId,sourceId:row.id,documentKind:'CREDIT_AGREEMENT',companyInn:inn,observedAt,obligationHints:hints,observations,parserConfidence:'HIGH',warnings:[]}:null;
}
