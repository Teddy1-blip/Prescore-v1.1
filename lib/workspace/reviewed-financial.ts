import type {PrivateSource} from './dossier-sources.ts';
import {nullableFinancialNumber,normalizeSnapshot} from '../credit-engine/financial-analysis/normalizer.ts';
import {annualPeriod,parseFinancialPeriod} from '../credit-engine/financial-analysis/periods.ts';
import {BALANCE_CODES,INCOME_CODES} from '../credit-engine/contracts/financial-statements.ts';

// Explicitly confirmed RAS rows only. A partial form never implies zeros in missing rows.
export function reviewedFinancial(source:PrivateSource,inn:string){
 const fields=source.verified;
 if(!fields||source.review?.status!=='READY_FOR_REVIEW'||source.envelope.companyInn!==inn)return;
 // Server-verified values must retain the page and exact source fragment from
 // this document's review. A field injected into the stored confirmation map
 // or copied from another report must never become a financial source fact.
 const confirmed=(key:string):string|null=>{
   const value=fields[key];
   if(!value||!Number.isSafeInteger(value.page)||value.page<1||
      !value.fragment?.trim())return null;
   const matches=source.review!.fields.filter(x=>x.key===key);
   if(matches.length!==1||matches[0].page!==value.page||
      matches[0].fragment!==value.fragment)return null;
   return value.value;
 };
 if(confirmed('company_inn')!==inn)return;
 const unit=confirmed('statement_unit');
 const scale=unit==='₽'?1:unit==='тыс. ₽'?1000:unit==='млн ₽'?1000000:null;
 const start=confirmed('period_start'),end=confirmed('period_end');
 const year=Number(start?.slice(0,4));
 if(!scale||!year||!start||!end||confirmed('statement_date')!==end)return;
 const periods=[annualPeriod(year),...[3,6,9].map(m=>parseFinancialPeriod(m+' месяцев '+year))];
 const period=periods.find(p=>p.from===start&&p.to===end);
 if(!period)return;
 const codes=new Set<string>([...Object.values(BALANCE_CODES),...Object.values(INCOME_CODES)]);
 const rawLines=Object.fromEntries(Object.keys(fields).filter(k=>codes.has(k)).flatMap(k=>{
    const value=nullableFinancialNumber(confirmed(k));return value===null?[]:[[k,value]];
 }));
 if(!Object.keys(rawLines).length)return;
 const envelope={...source.envelope,sourceType:period.kind==='ANNUAL'?'BFO' as const:'QUARTERLY' as const,status:'READY' as const,
   periodFrom:period.from!,periodTo:period.to!,parserVersion:source.review.version};
 return normalizeSnapshot({source:envelope,period,scale,rawLines,accountingStandard:'RAS'});
}
