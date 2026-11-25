/** Read-only NBKI old "Счет / Договор / Состояние" status observation.
 * Not a live bank status and never a score/portfolio input.
 */
export type NbkiLegacyState='ACTIVE'|'CLOSED'|'TRANSFERRED'|'UNKNOWN';
export type NbkiLegacyStatusEvidence={
 reportedState:NbkiLegacyState; rawStatus:string|null; statusDate:string|null;
 openedAt:string|null; fulfillmentDate:string|null; lastUpdatedAt:string|null; page:number;
};
function iso(value:string):string|null{
 const m=/^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
 if(!m)return null;
 const date=m[3]+'-'+m[2]+'-'+m[1],parsed=new Date(date+'T00:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date
   &&Number(m[3])>=1991?date:null;
}
function labelled(text:string,label:string):string[]{
 const escaped=label.replaceAll('.','\\.');
 const regex=new RegExp('(?:^|[ \\t]{2,})'+escaped+'[ \\t]*:[ \\t]*([^\\n]*?)(?=[ \\t]{2,}[^:\\n]{2,48}:[ \\t]*|$)','giu');
 return text.split(/\r?\n/u).flatMap(line=>
   [...line.trimStart().matchAll(regex)].map(m=>m[1].trim()).filter(Boolean));
}
function nonempty(raw:string|undefined){
 return !raw||/^(?:Н\/Д|нет данных|не указано|[-—])$/iu.test(raw.trim())?null:raw.trim();
}
function stateOf(raw:string|null):NbkiLegacyState{
 if(!raw)return 'UNKNOWN';
 if(/^сч[её]т закрыт.*перевед[её]н/iu.test(raw))return 'TRANSFERRED';
 if(/^сч[её]т закрыт(?:\s|[.·]|$)/iu.test(raw)||/^погашен(?:\s|$)/iu.test(raw))return 'CLOSED';
 if(/^(?:активный|действующий|сч[её]т открыт)$/iu.test(raw))return 'ACTIVE';
 return 'UNKNOWN';
}
export function nbkiLegacyStatusEvidence(block:string,page:number,reportDate?:string){
 const issues:string[]=[];
 // Never borrow generic status words from a directory or neighbouring account.
 if(!/(?:^|\n)[ \t]*Счет(?=[ \t]{2,}Договор[ \t]{2,}Состояние|[ \t]*(?:\r?\n|$))/im.test(block))
  return {evidence:null as NbkiLegacyStatusEvidence|null,issues};
 const states=labelled(block,'Статус').map(nonempty);
 const known=[...new Set(states.filter((v):v is string=>v!==null))];
 if(known.length>1)issues.push('BUREAU_LEGACY_STATUS_CONFLICT');
 const rawStatus=known.length===1?known[0].slice(0,120):null;
 const date=(label:string)=>{
  const inputs=labelled(block,label).map(nonempty);
  const valid=inputs.map(v=>v?iso(v):null);
  if(inputs.some((v,i)=>v&&!valid[i])||new Set(valid.filter(Boolean)).size>1)
   issues.push('BUREAU_LEGACY_DATE_REVIEW');
  const found=valid.find((v):v is string=>v!==null)??null;
  if(found&&reportDate&&found>reportDate)issues.push('BUREAU_LEGACY_FUTURE_DATE');
  return found;
 };
 const openedAt=date('Открыт'),statusDate=date('Дата статуса'),
   fulfillmentDate=date('Факт.исполн.в полн.объеме'),lastUpdatedAt=date('Последн.обновление');
 if(statusDate&&lastUpdatedAt&&statusDate>lastUpdatedAt)issues.push('BUREAU_LEGACY_DATE_REVIEW');
 if(fulfillmentDate&&openedAt&&fulfillmentDate<openedAt)issues.push('BUREAU_LEGACY_DATE_REVIEW');
 const evidence:NbkiLegacyStatusEvidence={
   page,reportedState:issues.length?'UNKNOWN':stateOf(rawStatus),
   rawStatus,openedAt,statusDate,fulfillmentDate,lastUpdatedAt,
 };
 return {evidence,issues:[...new Set(issues)]};
}
