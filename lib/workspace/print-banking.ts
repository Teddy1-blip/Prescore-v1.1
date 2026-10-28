import type {WorkspaceModelV1, WorkspaceFactV1} from './model.ts';
import {sourceGroup} from '../credit-engine/client-report/adapter.ts';

export type PrintBankingV1 = {
  periodFrom:string|null; periodTo:string|null; fullMonths:number|null;
  facts: Array<{label:string; fact:WorkspaceFactV1}>;
  sourcePeriods:Record<string,string[]>;
};
export function printDate(value:string|null|undefined):string|null {
  if(!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value)return null;
  return value.split('-').reverse().join('.');
}
export function printPeriod(from:string|null|undefined,to:string|null|undefined):string {
 const a=printDate(from),b=printDate(to);
 return a&&b?`${a} — ${b}`:a?`С ${a}; конец периода не указан`:b?`По ${b}; начало периода не указано`:'Период не указан';
}
/** Copy only permitted, already calculated bank facts. Never derive an opening balance.
 * Source dates require exact manifest sourceId -> canonical reference -> report group identity. */
export function projectPrintBanking(model:WorkspaceModelV1):PrintBankingV1|null {
 if(model.entitlement!=='FULL'||model.state!=='READY_FULL'||model.fullAvailability!=='READY'||!model.full||model.full.report.meta.entitlement!=='FULL')return null;
 const b=model.basic, sources=b.sources.availability.filter(s=>s.source==='BANK_STATEMENTS');
 if(!sources.length)return null;
 const sourcePeriods:Record<string,string[]>={};
 for(const ref of model.full.canonical.explainability.sourceReferences){
  if(ref.sourceKind!=='BANK_STATEMENT'||!ref.sourceIds.length)continue;
  const dates=ref.sourceIds.map(id=>sources.find(s=>s.sourceId===id)).filter(s=>s!==undefined).map(s=>printPeriod(s.periodFrom,s.periodTo));
  if(dates.length!==ref.sourceIds.length)continue; // Do not fill an incompletely linked group.
  const key=sourceGroup(ref); sourcePeriods[key]=[...new Set([...(sourcePeriods[key]??[]),...dates])];
 }
 const facts:PrintBankingV1['facts']=(['grossInflow','grossOutflow','endingBalance','netCashFlow'] as const).map((key,i)=>({label:['Банковские поступления','Банковские списания','Остаток на конец периода','Чистое движение средств'][i],fact:{...b.bankingFacts[key]}}));
 facts.splice(2,0,{label:'Остаток на начало периода',fact:{value:null,unit:'RUB',status:'UNKNOWN',confidence:'UNKNOWN',periodFrom:null,periodTo:null}});
 return {periodFrom:b.sources.statements.periodFrom,periodTo:b.sources.statements.periodTo,fullMonths:model.full.canonical.debtCapacity.operatingBasis.fullMonthCount,facts,sourcePeriods};
}
