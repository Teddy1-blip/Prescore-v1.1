import {validDate} from '../credit-engine/reconciliation/periods.ts';
import type {SourceRow} from './dossier-sources.ts';

/** Read-only coverage of uploaded evidence. NEVER aggregates financial figures.
 * An overlap is a review task; it does not prove duplicate transactions.
 */
export const SOURCE_PERIOD_AUDIT_VERSION='PRESCORE-SOURCE-PERIOD-AUDIT-0.1' as const;
export type AuditMode='CONTINUOUS'|'ANNUAL'|'STANDALONE'|'CUMULATIVE_YTD'|'SNAPSHOT'|'EVENT';
export type AuditSpan={sourceId:string;from:string;to:string;name:string;preliminary:boolean};
export type AuditGap={from:string;to:string;days:number;action:string};
export type AuditOverlap={from:string;to:string;sourceIds:string[];kind:'SAME_PERIOD'|'PARTIAL_OVERLAP'|'SAME_DATE'};
export type AuditGroup={id:string;kind:string;scope:string;mode:AuditMode;spans:AuditSpan[];
 gaps:AuditGap[];overlaps:AuditOverlap[];note:string};
export type AuditUnknown={sourceId:string;kind:string;reason:string};
export type SourcePeriodAudit={version:typeof SOURCE_PERIOD_AUDIT_VERSION;groups:AuditGroup[];
 unknown:AuditUnknown[];requiresRecalculationReview:boolean;automaticApply:false};
const dayMs=86400000;
const day=(date:string)=>Date.parse(date);
const iso=(time:number)=>new Date(time).toISOString().slice(0,10);
const addDays=(date:string,n:number)=>iso(day(date)+n*dayMs);
const display=(date:string)=>date.slice(8,10)+'.'+date.slice(5,7)+'.'+date.slice(0,4);
type Candidate={sourceId:string;kind:string;scope:string;mode:AuditMode;from:string;to:string;name:string;preliminary:boolean};
const good=(from:string|null|undefined,to:string|null|undefined)=>
 validDate(from)&&validDate(to)&&from<=to&&day(to)-day(from)<=dayMs*366*30;
const str=(s:string|undefined|null)=>s?.trim()??'';
const safeScope=(account:string)=>'Счёт ••••'+account.slice(-4);
function note(mode:AuditMode,kind:string){
 if(mode==='CONTINUOUS')return kind==='ACCOUNT_51'
  ?'Карточки 51 отражают учёт 1С; без номера отдельного банковского счёта пересечение только для сверки, не для сложения.'
  :'Покрытие относится к одному банковскому счёту. Пересекающиеся операции нужно сверить по первичным реквизитам.';
 if(mode==='ANNUAL')return 'Годовая БФО — версии одного года; суммы не складываются. Исправление требует проверки исходного отчёта.';
 if(mode==='STANDALONE')return 'Отдельные кварталы, без накопления с начала года; внутренний пробел требует дозагрузки.';
 if(mode==='CUMULATIVE_YTD')return 'Отчётность нарастающим итогом: перекрытие месяцев закономерно, такие суммы не складываются.';
 if(mode==='SNAPSHOT')return 'Снимки на разные даты не задают непрерывного покрытия между датами.';
 return 'Договоры, анкеты и другие документы фиксируют события, не непрерывные дни наблюдения.';
}
export function sourcePeriodAudit(rows:readonly SourceRow[],companyInn:string):SourcePeriodAudit{
 const candidates:Candidate[]=[],unknown:AuditUnknown[]=[];
 const used=new Set<string>();
 function add(c:Candidate){
  const key=[c.sourceId,c.kind,c.scope,c.mode,c.from,c.to].join('|');
  if(used.has(key))return;used.add(key);
  if(!good(c.from,c.to)){
   unknown.push({sourceId:c.sourceId,kind:c.kind,reason:'PERIOD_NOT_VERIFIED'});return;
  }
  candidates.push(c);
 }
 for(const row of rows){
  const e=row.payload.envelope,kind=row.kind;
  if(e.companyInn!==companyInn)continue;
  const sourceId=row.id,name=e.fileName??e.sourceName??kind;
  if(kind==='BANK_STATEMENT'){
   // A transaction-first/last window is not proof of daily bank coverage.
   if(e.periodBasis==='OBSERVED_ONLY'){
    unknown.push({sourceId,kind,reason:'BANK_DECLARED_COVERAGE_NOT_CONFIRMED'});continue;
   }
   // Never invent a single union interval across multiple settlement accounts.
   const accounts=e.accountCoverage?.filter(c=>c.account&&str(c.periodFrom)&&str(c.periodTo))??[];
   if(!accounts.length){unknown.push({sourceId,kind,reason:'BANK_ACCOUNT_OR_DECLARED_PERIOD_MISSING'});continue;}
   for(const a of accounts)add({sourceId,kind,scope:'BANK:'+a.account,mode:'CONTINUOUS',from:str(a.periodFrom),to:str(a.periodTo),name,preliminary:e.status!=='READY'});
  }else if(kind==='BANK_XLSX'){
   const sheets=row.payload.bankXlsxReview?.sheets??[];
   if(!sheets.length){unknown.push({sourceId,kind,reason:'PRELIMINARY_BANK_SHEET_MISSING'});continue;}
   for(const s of sheets){
    if(!s.account){unknown.push({sourceId,kind,reason:'BANK_ACCOUNT_NOT_CONFIRMED'});continue;}
    add({sourceId,kind,scope:'BANK:'+s.account,mode:'CONTINUOUS',from:str(s.periodFrom),to:str(s.periodTo),name:name+' · '+s.name,preliminary:true});
   }
  }else if(kind==='ACCOUNT_51'){
   const a=row.payload.account51;
   if(!a){unknown.push({sourceId,kind,reason:'ACCOUNT51_PERIOD_UNAVAILABLE'});continue;}
   add({sourceId,kind,scope:'ACCOUNTING:51',mode:'CONTINUOUS',from:a.from,to:a.to,name,preliminary:a.requiresReview});
  }else if(kind==='BFO'||kind==='QUARTERLY'){
   const p=row.payload.snapshot?.period;
   const start=str(p?.from??e.periodFrom),end=str(p?.to??e.periodTo);
   const mode:AuditMode=p?.flowPeriodType==='CUMULATIVE_YTD'?'CUMULATIVE_YTD':
    p?.flowPeriodType==='STANDALONE_PERIOD'?'STANDALONE':
    kind==='BFO'&&p?.kind==='ANNUAL'?'ANNUAL':'SNAPSHOT';
   if(mode==='SNAPSHOT'){
    const asOf=str(p?.asOf??e.periodTo);
    add({sourceId,kind,scope:kind+':ASOF',mode,from:asOf,to:asOf,name,preliminary:e.status!=='READY'});
   }else add({sourceId,kind,scope:kind+':'+mode,mode,from:start,to:end,name,preliminary:e.status!=='READY'});
  }else if(kind==='BKI'||kind==='DEBT_LEDGER'||kind==='COUNTERPARTIES'||kind==='CHECKO'){
   // Use only the date of the observation, never the file upload timestamp.
   const dates=kind==='BKI'?[row.payload.bki?.reportDate??null]:
    kind==='DEBT_LEDGER'||kind==='COUNTERPARTIES'
     ?[...new Set(row.payload.ledger?.map(v=>v.asOf)??[])]
     :[e.informationDate??null];
   if(!dates.some(d=>validDate(d))){unknown.push({sourceId,kind,reason:'SNAPSHOT_DATE_UNAVAILABLE'});continue;}
   for(const d of dates)if(validDate(d))add({sourceId,kind,scope:kind==='BKI'?'BKI:SUBJECT:'+(row.payload.bki?.subjectInn??sourceId):kind+':ASOF',mode:'SNAPSHOT',from:d,to:d,name,preliminary:e.status!=='READY'});
  }else{
   // Contracts/agreements/schedules/questionnaires are events, not daily streams.
   const eventDate=row.payload.verified?.agreement_date?.value;
   if(eventDate&&validDate(eventDate))add({sourceId,kind,scope:kind+':EVENT',mode:'EVENT',from:eventDate,to:eventDate,name,preliminary:false});
   else unknown.push({sourceId,kind,reason:'EVENT_DOCUMENT_NO_CONTINUOUS_PERIOD'});
  }
 }
 const grouped=new Map<string,AuditGroup>();
 for(const c of candidates){
  // Preliminary XLSX stays separate from canonical TXT statements.
  const kind=c.kind==='BANK_XLSX'?'BANK_XLSX_PREVIEW':c.kind;
  const key=[kind,c.scope,c.mode].join('|');
  let g=grouped.get(key);
  if(!g){
   g={id:key,kind,scope:c.scope.startsWith('BANK:')?safeScope(c.scope.slice(5)):
     c.scope==='ACCOUNTING:51'?'Учёт 1С · счёт 51':kind,mode:c.mode,
     spans:[],gaps:[],overlaps:[],note:note(c.mode,c.kind)};
   grouped.set(key,g);
  }
  g.spans.push({sourceId:c.sourceId,from:c.from,to:c.to,name:c.name,preliminary:c.preliminary});
 }
 const groups=[...grouped.values()];
 for(const g of groups){
  g.spans.sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to)||a.sourceId.localeCompare(b.sourceId));
  if(g.mode==='EVENT')continue;
  if(g.mode==='SNAPSHOT'){
   for(let i=1;i<g.spans.length;i++){
    const prior=g.spans[i-1],current=g.spans[i];
    if(prior.from===current.from&&prior.sourceId!==current.sourceId&&g.overlaps.length<32)
     g.overlaps.push({from:current.from,to:current.from,sourceIds:[prior.sourceId,current.sourceId],kind:'SAME_DATE'});
   }
   continue;
  }
  let end='';let active:AuditSpan[]=[];
  for(const s of g.spans){
   if(end&&s.from>addDays(end,1)&&['CONTINUOUS','STANDALONE','ANNUAL'].includes(g.mode)&&g.gaps.length<32){
    const from=addDays(end,1),to=addDays(s.from,-1),days=(day(to)-day(from))/dayMs+1;
    const action=g.mode==='ANNUAL'
     ?'Дозагрузите годовую БФО за '+from.slice(0,4)+(from.slice(0,4)!==to.slice(0,4)?'–'+to.slice(0,4):'')+' год.'
     :'Дозагрузите '+(g.kind==='BANK_STATEMENT'?'банковскую выписку':g.kind==='ACCOUNT_51'?'карточку 51':'отчёт')+' за '+display(from)+'–'+display(to)+'.';
    g.gaps.push({from,to,days,action});
   }
   active=active.filter(x=>x.to>=s.from);
   for(const other of active){
    if(other.sourceId===s.sourceId||g.overlaps.length>=32)continue;
    const from=other.from>s.from?other.from:s.from,to=other.to<s.to?other.to:s.to;
    if(from<=to)g.overlaps.push({from,to,sourceIds:[other.sourceId,s.sourceId],
     kind:other.from===s.from&&other.to===s.to?'SAME_PERIOD':'PARTIAL_OVERLAP'});
   }
   active.push(s);
   end=s.to>end?s.to:end;
  }
  // YTD six and nine months overlap by design: only equal full periods compete.
  if(g.mode==='CUMULATIVE_YTD')g.overlaps=g.overlaps.filter(x=>x.kind==='SAME_PERIOD');
 }
 groups.sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
 return {version:SOURCE_PERIOD_AUDIT_VERSION,groups,unknown,
  requiresRecalculationReview:groups.some(g=>g.gaps.length>0||g.overlaps.length>0),automaticApply:false};
}
