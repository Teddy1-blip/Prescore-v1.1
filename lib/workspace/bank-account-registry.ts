import {validDate} from '../credit-engine/reconciliation/periods.ts';
import type {SourceRow} from './dossier-sources.ts';
import type {AuditGap,SourcePeriodAudit} from './source-period-audit.ts';

/** Read-only presentation of bank source coverage. It NEVER reconciles transactions
 * or declares that the account is still open. Uses the existing period audit.
 */
export const BANK_ACCOUNT_REGISTER_VERSION='PRESCORE-BANK-ACCOUNT-REGISTER-0.1' as const;
export type BankAccountCoverage={
 id:string; bankName:string|null;bankNameConflict:boolean;accountMask:string;
 kind:'BANK_STATEMENT'|'BANK_XLSX_PREVIEW';preview:boolean;
 periods:{from:string;to:string;file:string;sourceId:string}[];
 coverage:{from:string;to:string}[];
 firstCovered:string;latestCovered:string;
 internalGaps:AuditGap[];overlapCount:number;
 refreshGap:AuditGap|null;state:'REVIEW'|'GAP'|'UPDATE_NEEDED'|'UP_TO_REFERENCE'|'PREVIEW';
};
export type BankAccountRegister={
 version:typeof BANK_ACCOUNT_REGISTER_VERSION;referenceDate:string;
 referenceDescription:string;accounts:BankAccountCoverage[];
 unverifiedFiles:number;automaticApply:false;
};
const msDay=86_400_000;
const plus=(date:string,n:number)=>new Date(Date.parse(date)+n*msDay).toISOString().slice(0,10);
const format=(date:string)=>date.slice(8,10)+'.'+date.slice(5,7)+'.'+date.slice(0,4);
export function lastCompletedMoscowDay(now=new Date()):string{
 // Prescore's first Russian installation uses the last completed Moscow
 // calendar day, not the operator's browser timezone or the timestamp of a transaction.
 const fields=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'})
  .formatToParts(now);
 const part=(key:string)=>fields.find(x=>x.type===key)?.value??'';
 const today=part('year')+'-'+part('month')+'-'+part('day');
 return validDate(today)?plus(today,-1):new Date(now.getTime()-msDay).toISOString().slice(0,10);
}
export function bankAccountRegister(rows:readonly SourceRow[],companyInn:string,
 audit:SourcePeriodAudit,referenceDate=lastCompletedMoscowDay()):BankAccountRegister{
 const cutoff=validDate(referenceDate)?referenceDate:lastCompletedMoscowDay();
 const byId=new Map(rows.filter(x=>x.payload.envelope.companyInn===companyInn).map(x=>[x.id,x]));
 const accounts:BankAccountCoverage[]=[];
 for(const group of audit.groups){
  if(group.kind!=='BANK_STATEMENT'&&group.kind!=='BANK_XLSX_PREVIEW')continue;
  if(group.mode!=='CONTINUOUS'||!group.spans.length)continue;
  const names=[...new Set(group.spans.flatMap(s=>{
    const source=byId.get(s.sourceId)?.payload.envelope;
    const name=source?.sourceName?.trim();
    return name&&name.length<=120?[name]:[];
  }))];
  const coverage:{from:string;to:string}[]=[];
  for(const s of group.spans){
    const prior=coverage.at(-1);
    if(prior&&s.from<=plus(prior.to,1)){
      if(s.to>prior.to)prior.to=s.to;
    }else coverage.push({from:s.from,to:s.to});
  }
  const latest=coverage.at(-1)?.to;
  const first=coverage[0]?.from;
  if(!latest||!first)continue;
  const refreshGap:AuditGap|null=latest<cutoff?{
    from:plus(latest,1),to:cutoff,
    days:(Date.parse(cutoff)-Date.parse(latest))/msDay,
    action:'Дозагрузите выписку за '+format(plus(latest,1))+'–'+format(cutoff)+'.',
  }:null;
  const preview=group.kind==='BANK_XLSX_PREVIEW';
  const state:BankAccountCoverage['state']=preview?'PREVIEW':
    latest>cutoff||names.length>1||group.overlaps.length>0?'REVIEW':
    group.gaps.length>0?'GAP':refreshGap?'UPDATE_NEEDED':'UP_TO_REFERENCE';
  accounts.push({
    id:group.id,bankName:names.length===1?names[0]:null,bankNameConflict:names.length>1,
    accountMask:group.scope,kind:group.kind as BankAccountCoverage['kind'],preview,
    periods:group.spans.map(s=>({from:s.from,to:s.to,file:s.name,sourceId:s.sourceId})),
    coverage,firstCovered:first,latestCovered:latest,
    internalGaps:group.gaps,overlapCount:group.overlaps.length,
    refreshGap,state,
  });
 }
 accounts.sort((a,b)=>a.accountMask.localeCompare(b.accountMask,'ru')||
    a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
 const unverifiedFiles=audit.unknown.filter(u=>
   u.kind==='BANK_STATEMENT'||u.kind==='BANK_XLSX').length;
 return {version:BANK_ACCOUNT_REGISTER_VERSION,referenceDate:cutoff,
  referenceDescription:'Последний завершённый день по московскому времени',
  accounts,unverifiedFiles,automaticApply:false};
}
