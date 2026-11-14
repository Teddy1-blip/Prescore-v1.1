import type {PrivateSource} from './dossier-sources.ts';
import {nullableFinancialNumber,normalizeSnapshot} from '../credit-engine/financial-analysis/normalizer.ts';
import {annualPeriod,parseFinancialPeriod} from '../credit-engine/financial-analysis/periods.ts';
import {BALANCE_CODES,INCOME_CODES} from '../credit-engine/contracts/financial-statements.ts';

// Explicitly confirmed RAS rows only. A partial form never implies zeros in missing rows.
export function reviewedFinancial(source:PrivateSource,inn:string){
 const fields=source.verified;
 if(!fields||source.review?.status!=='READY_FOR_REVIEW'||fields.company_inn?.value!==inn)return;
 const unit=fields.statement_unit?.value,scale=unit==='₽'?1:unit==='тыс. ₽'?1000:unit==='млн ₽'?1000000:null;
 const year=Number(fields.period_start?.value.slice(0,4)),end=fields.period_end?.value;
 if(!scale||!year||!end||fields.statement_date?.value!==end)return;
 const periods=[annualPeriod(year),...[3,6,9].map(m=>parseFinancialPeriod(m+' месяцев '+year))];
 const period=periods.find(p=>p.from===fields.period_start.value&&p.to===end);
 if(!period)return;
 const codes=new Set<string>([...Object.values(BALANCE_CODES),...Object.values(INCOME_CODES)]);
 const rawLines=Object.fromEntries(Object.entries(fields).filter(([k])=>codes.has(k)).flatMap(([k,f])=>{
    const value=nullableFinancialNumber(f.value);return value===null?[]:[[k,value]];
 }));
 if(!Object.keys(rawLines).length)return;
 const envelope={...source.envelope,sourceType:period.kind==='ANNUAL'?'BFO' as const:'QUARTERLY' as const,status:'READY' as const,
   periodFrom:period.from!,periodTo:period.to!,parserVersion:source.review.version};
 return normalizeSnapshot({source:envelope,period,scale,rawLines,accountingStandard:'RAS'});
}
