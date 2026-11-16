import {datedNbkiEvidence,type NbkiTermination,type NbkiHistoricalDebt} from './nbki-dated-evidence.ts';
import {nbkiLegacyStatusEvidence,type NbkiLegacyStatusEvidence} from './nbki-legacy-status.ts';

/** Read-only index of corporate NBKI modern IDs and old account cards.
 * Never treats historical nominal amount as current principal or overdue.
 * Cross-format linking requires an exactly printed matching agreement UID.
 */
export const NBKI_STRUCTURE_VERSION='PRESCORE-NBKI-STRUCTURE-INDEX-0.1' as const;
type Page={page:number;text:string};
export type NbkiEvidenceKind='LOAN'|'GUARANTEE'|'UNKNOWN';
export type NbkiModernEntry={
 uid:string;pages:number[];kind:NbkiEvidenceKind;role:'BORROWER'|'GUARANTEE_PRINCIPAL'|'UNKNOWN';
 agreementDate:string|null;nominalRub:number|null;nominalPage:number|null;
 termination:NbkiTermination|null;historicalDebt:NbkiHistoricalDebt|null;
 currentPrincipalRub:null;overdueRub:null;status:'SOURCE_ONLY'|'CONFLICT';
};
export type NbkiLegacyEntry={
 account:string;creditor:string;pages:number[];kind:NbkiEvidenceKind;
 role:'BORROWER'|'PRINCIPAL'|'GUARANTOR'|'UNKNOWN';linkedModernUid:string|null;
 statusEvidence:NbkiLegacyStatusEvidence|null;status:'SOURCE_ONLY'|'CONFLICT';
};
export type NbkiStructureIndex={
 version:typeof NBKI_STRUCTURE_VERSION;modern:NbkiModernEntry[];legacy:NbkiLegacyEntry[];
 exactUidLinks:number;issues:string[];automaticApply:false;
};
const uidPattern=/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-[a-f0-9]/i;
const modernPattern=new RegExp('УИд договора:\\s*('+uidPattern.source+')','giu');
function reportedDate(s:string):string|null{
 const match=/^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
 if(!match)return null;
 const iso=match[3]+'-'+match[2]+'-'+match[1],d=new Date(iso+'T00:00:00Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===iso?iso:null;
}
function nominalTable(body:string):number|null{
 const index=body.search(/(?:^|\n)\s*Сумма[ \t]{2,}Валюта[ \t]{2,}/im);
 if(index<0)return null;
 const region=body.slice(index,index+1800);
 const row=region.match(/(?:^|\n)[ \t]*(\d+(?:[,.]\d{2}))[ \t]+RUB[ \t]{2,}(?:Н\/Д|\d+(?:[,.]\d{2}))(?:[ \t]|$)/im);
 if(!row)return null;
 const amount=Number(row[1].replace(',','.'));
 return Number.isFinite(amount)&&amount>=0&&amount<=1e13?amount:null;
}
function modernKind(block:string):{kind:NbkiEvidenceKind;role:NbkiModernEntry['role'];date:string|null}{
 const lead=block.slice(0,1800);
 if(!/(?:^|\n)\s*Вид участия[ \t]+Дата сделки[ \t]+Тип(?:\s|$)/im.test(lead))
   return {kind:'UNKNOWN',role:'UNKNOWN',date:null};
 const loan=lead.match(/(?:^|\n)\s*За[её]мщик[ \t]+(\d{2}-\d{2}-\d{4})[ \t]+Договор займа(?:[ \t]|\n)/im);
 const guarantee=lead.match(/(?:^|\n)\s*Принципал по[ \t]+(\d{2}-\d{2}-\d{4})[ \t]+Независимая(?:[ \t]|\n)/im);
 if(loan&&guarantee)return {kind:'UNKNOWN',role:'UNKNOWN',date:null};
 if(loan)return {kind:'LOAN',role:'BORROWER',date:reportedDate(loan[1])};
 if(guarantee&&/гарантии[ \t]+гарантия/iu.test(lead))
   return {kind:'GUARANTEE',role:'GUARANTEE_PRINCIPAL',date:reportedDate(guarantee[1])};
 return {kind:'UNKNOWN',role:'UNKNOWN',date:null};
}
function lastLabel(text:string,label:string):string{
 const prefix=label.toLocaleLowerCase('ru')+':';
 return text.split(/\r?\n/u).flatMap(line=>{
   const normalized=line.trimStart();
   return normalized.toLocaleLowerCase('ru').startsWith(prefix)?
     [normalized.slice(prefix.length).split(/[ \t]{2,}/)[0].trim()]:[];
 }).at(-1)??'';
}
function legacyKind(text:string):NbkiEvidenceKind{
 const v=lastLabel(text,'Вид');
 if(/банковская гарантия|независимая гарантия/iu.test(v))return 'GUARANTEE';
 if(/срочный кредит|кредитная карта|кредитная линия|микрокредит|за[её]м|ипотека/iu.test(v))return 'LOAN';
 return 'UNKNOWN';
}
export function nbkiStructureIndex(pages:readonly Page[],reportDate?:string):NbkiStructureIndex{
 const result:NbkiStructureIndex={version:NBKI_STRUCTURE_VERSION,modern:[],legacy:[],exactUidLinks:0,issues:[],automaticApply:false};
 if(pages.length>256||pages.some(p=>!Number.isSafeInteger(p.page)||p.page<1||p.page>256||typeof p.text!=='string')){
   result.issues.push('BUREAU_STRUCTURE_PAGE_LIMIT');return result;
 }
 const ordered=[...pages].sort((a,b)=>a.page-b.page),modern=new Map<string,NbkiModernEntry>();
 for(let i=0;i<ordered.length;i++){
   const page=ordered[i],found=[...page.text.matchAll(modernPattern)];
   for(let n=0;n<found.length;n++){
     const match=found[n],uid=match[1].toLowerCase();
     const block=page.text.slice((match.index??0)+match[0].length,found[n+1]?.index);
     const details=modernKind(block);
     const scopes=[{page:page.page,text:block}];
     if(n===found.length-1&&ordered[i+1]?.page===page.page+1){
       const next=ordered[i+1].text;
       if(!/УИд договора:|(?:^|\n)[ \t]*Сведения об условиях обязательства[ \t]*$/im.test(next))
         scopes.push({page:page.page+1,text:next});
     }
     const dated=datedNbkiEvidence(scopes,details.kind,reportDate);
     result.issues.push(...dated.issues);
     let nominal=nominalTable(block),nominalPage:number|null=nominal===null?null:page.page;
     // One physical continuation page maximum; never cross a different UUID.
     if(nominal===null&&n===found.length-1&&ordered[i+1]?.page===page.page+1){
       const next=ordered[i+1].text;
       if(!/УИд договора:|(?:^|\n)\s*Счет:/im.test(next)){
         nominal=nominalTable(next);
         if(nominal!==null)nominalPage=page.page+1;
       }
     }
     const prior=modern.get(uid);
     if(prior){
       if(!prior.pages.includes(page.page))prior.pages.push(page.page);
       if(dated.issues.length)prior.status='CONFLICT';
       if((prior.kind!=='UNKNOWN'&&details.kind!=='UNKNOWN'&&prior.kind!==details.kind)||
         (prior.role!=='UNKNOWN'&&details.role!=='UNKNOWN'&&prior.role!==details.role)||
         (prior.agreementDate&&details.date&&prior.agreementDate!==details.date)||
         (prior.nominalRub!==null&&nominal!==null&&prior.nominalRub!==nominal)||
         (prior.termination&&dated.termination&&prior.termination.date!==dated.termination.date)||
         (prior.historicalDebt&&dated.historicalDebt&&prior.historicalDebt.asOf===dated.historicalDebt.asOf
          &&(prior.historicalDebt.totalRub!==dated.historicalDebt.totalRub||
             prior.historicalDebt.principalRub!==dated.historicalDebt.principalRub||
             prior.historicalDebt.lastPaymentBasis!==dated.historicalDebt.lastPaymentBasis))){
         prior.status='CONFLICT';result.issues.push('BUREAU_MODERN_UUID_CONFLICT');
       }
       if(prior.kind==='UNKNOWN'&&details.kind!=='UNKNOWN'){prior.kind=details.kind;prior.role=details.role;prior.agreementDate=details.date;}
       if(prior.nominalRub===null&&nominal!==null){prior.nominalRub=nominal;prior.nominalPage=nominalPage;}
       if(prior.termination===null&&dated.termination)prior.termination=dated.termination;
       if(dated.historicalDebt&&(!prior.historicalDebt||dated.historicalDebt.asOf>prior.historicalDebt.asOf))
         prior.historicalDebt=dated.historicalDebt;
       continue;
     }
     modern.set(uid,{uid,pages:[page.page],kind:details.kind,role:details.role,agreementDate:details.date,
       nominalRub:nominal,nominalPage,termination:dated.termination,historicalDebt:dated.historicalDebt,
       currentPrincipalRub:null,overdueRub:null,status:dated.issues.length?'CONFLICT':'SOURCE_ONLY'});
   }
 }
 result.modern=[...modern.values()];
 const legacy=new Map<string,NbkiLegacyEntry>();
 for(const page of ordered){
   for(const match of page.text.matchAll(/(?:^|\n)\s*Счет:\s*([^\n]+)/gim)){
     const account=match[1].split(/[ \t]{2,}/)[0].trim().replace(/[.]+$/,'');
     if(!account||account.length>100||!/^[-\p{L}\d№]/u.test(account))continue;
     const lookback=page.text.slice(Math.max(0,(match.index??0)-1800),match.index);
     const headings=[...lookback.matchAll(/(?:^|\n)[ \t]*Счет(?=[ \t]{2,}Договор[ \t]{2,}Состояние|[ \t]*(?=\r?\n|$))/gim)];
     const lead=headings.length?lookback.slice(headings[headings.length-1].index):lookback.slice(-650);
     const creditor=lastLabel(lead,'Кредитор'),roleText=lastLabel(lead,'Отношение');
     if(!creditor||!roleText||creditor==='Н/Д')continue;
     const role:NbkiLegacyEntry['role']=/принципал/iu.test(roleText)?'PRINCIPAL':
       /поручител/iu.test(roleText)?'GUARANTOR':/за[её]мщик|личный|совместный/iu.test(roleText)?'BORROWER':'UNKNOWN';
     const kind=legacyKind(lead);
     const evidence=nbkiLegacyStatusEvidence(lead,page.page,reportDate);
     result.issues.push(...evidence.issues);
     const tail=page.text.slice((match.index??0)+match[0].length,(match.index??0)+match[0].length+700);
     const explicit=tail.match(/УИД договора\s*\(сделки\):\s*([^\n]+)/iu)?.[1]?.trim().match(uidPattern)?.[0]?.toLowerCase()??null;
     const linkedModernUid=explicit&&modern.has(explicit)?explicit:null;
     const key=creditor.toLocaleLowerCase('ru')+'|'+account.toLocaleLowerCase('ru');
     const prior=legacy.get(key);
     if(prior){
       if(!prior.pages.includes(page.page))prior.pages.push(page.page);
       if(evidence.issues.length)prior.status='CONFLICT';
       if(prior.statusEvidence&&evidence.evidence&&
          prior.statusEvidence.reportedState!=='UNKNOWN'&&evidence.evidence.reportedState!=='UNKNOWN'&&
          prior.statusEvidence.reportedState!==evidence.evidence.reportedState){
         prior.status='CONFLICT';result.issues.push('BUREAU_LEGACY_ACCOUNT_STATUS_CONFLICT');
       }
       if((prior.kind!=='UNKNOWN'&&kind!=='UNKNOWN'&&prior.kind!==kind)||
         (prior.role!=='UNKNOWN'&&role!=='UNKNOWN'&&prior.role!==role)||
         (prior.linkedModernUid&&linkedModernUid&&prior.linkedModernUid!==linkedModernUid)){
         prior.status='CONFLICT';result.issues.push('BUREAU_LEGACY_ACCOUNT_CONFLICT');
       }
       if(prior.kind==='UNKNOWN')prior.kind=kind;
       if(!prior.linkedModernUid)prior.linkedModernUid=linkedModernUid;
       if((!prior.statusEvidence||prior.statusEvidence.reportedState==='UNKNOWN')&&evidence.evidence)
         prior.statusEvidence=evidence.evidence;
       continue;
     }
     legacy.set(key,{account,creditor,pages:[page.page],kind,role,linkedModernUid,
       statusEvidence:evidence.evidence,status:evidence.issues.length?'CONFLICT':'SOURCE_ONLY'});
   }
 }
 result.legacy=[...legacy.values()];
 // Same printed UID is useful evidence, but one UID linked to two distinct
 // legacy cards, or contradictory role/type, is NOT an automatic one-to-one match.
 const links=new Map<string,NbkiLegacyEntry[]>();
 for(const entry of result.legacy)if(entry.linkedModernUid){
   const items=links.get(entry.linkedModernUid)??[];
   items.push(entry);links.set(entry.linkedModernUid,items);
 }
 for(const [uid,items] of links){
   const newer=modern.get(uid);
   const older=items[0]?.statusEvidence;
   const temporalMismatch=!!newer?.termination&&!!older&&(
     (!!older.fulfillmentDate&&older.fulfillmentDate!==newer.termination.date)||
     (older.reportedState==='ACTIVE'&&!!(older.statusDate||older.lastUpdatedAt)&&
       (older.statusDate||older.lastUpdatedAt)!>=newer.termination.date));
   const consistent=items.length===1&&!temporalMismatch&&newer?.status==='SOURCE_ONLY'&&
     items[0].status==='SOURCE_ONLY'&&
     !(newer.kind!=='UNKNOWN'&&items[0].kind!=='UNKNOWN'&&newer.kind!==items[0].kind)&&
     !(newer.role==='BORROWER'&&items[0].role==='PRINCIPAL')&&
     !(newer.role==='GUARANTEE_PRINCIPAL'&&items[0].role==='BORROWER');
   if(consistent){result.exactUidLinks++;continue;}
   for(const entry of items)entry.status='CONFLICT';
   if(newer)newer.status='CONFLICT';
   result.issues.push(temporalMismatch?'BUREAU_CROSS_FORMAT_STATUS_REVIEW':'BUREAU_CROSS_FORMAT_UID_REVIEW');
 }
 if(result.modern.length>256||result.legacy.length>512)result.issues.push('BUREAU_STRUCTURE_RECORD_LIMIT');
 if(result.modern.some(r=>r.kind==='UNKNOWN'))result.issues.push('BUREAU_MODERN_TYPE_REVIEW');
 if(result.legacy.some(r=>r.kind==='UNKNOWN'))result.issues.push('BUREAU_LEGACY_TYPE_REVIEW');
 if(result.modern.length&&result.legacy.length&&result.exactUidLinks===0)result.issues.push('BUREAU_MODERN_LEGACY_UNLINKED');
 result.issues=[...new Set(result.issues)];
 return result;
}
