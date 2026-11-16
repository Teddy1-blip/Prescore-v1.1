import {parseAuthoritativeCreditHistoryText} from '../credit-engine/source-foundation.ts';
import type {CreditSubjectRelationship,CreditHistoryReport} from '../credit-history.ts';
import type {OcrPage} from '../document-poc/local-ocr.ts';
import type {DocumentReview} from '../document-poc/review-fields.ts';
import type {PrivateSource} from './dossier-sources.ts';
import {validInn} from '../external/checko-inn.ts';
import {nbkiStructureIndex} from './nbki-structure-index.ts';

export const bureauRoles=['Компания-заёмщик','ИП-заёмщик','Собственник','Руководитель','Поручитель'] as const;
export function readBureau(text:string,name:string,inn:string,role:CreditSubjectRelationship) {
  const report=parseAuthoritativeCreditHistoryText({text,fileName:name,analysisInn:inn,relationship:role});
  if(!report.reportDate||!report.subjectInn||report.subjectType==='Не определён')
    throw Error('Нужны ИНН субъекта и дата отчёта.');
  if(report.subjectType==='Юридическое лицо'&&role!=='Компания-заёмщик')
    throw Error('Укажите роль компании-заёмщика для отчёта юридического лица.');
  if(report.subjectType==='Физическое лицо'&&(role==='Компания-заёмщик'||role==='ИП-заёмщик'&&!report.affectsCompanyDebt))
    throw Error('Укажите роль физического лица, которому принадлежит отчёт.');
  return report;
}
export function bureauEnvelope(payload:PrivateSource,report:CreditHistoryReport) {
  return {...payload.envelope,sourceType:'BKI' as const,status:'READY' as const,periodTo:report.reportDate,
    confidence:report.parserConfidence,warnings:report.warnings,parserVersion:'PRESCORE-BKI-PARSER-2'};
}
// Read-only review of the post-2022 NBKI corporate layout. The source may mix
// primary contract UUID sections, legacy account cards, guarantees and
// assignments. A reported summary is not an independently reconciled portfolio.
export function modernNbkiSummaryReview(pages:OcrPage[],payload:PrivateSource):DocumentReview|null {
 const cover=pages.find(p=>p.page===1);
 if(!cover || !/^\s*Субъект кредитной истории\s*$/im.test(cover.text)
     || !/^\s*Кредитный отчет для субъекта\s*$/im.test(cover.text)
     || !/При наличии вопросов обращайтесь в НБКИ/iu.test(cover.text))return null;
 const base:DocumentReview={version:'PRESCORE-NBKI-STRUCTURE-0.1',status:'BUREAU_IDENTITY_REVIEW',
   fields:[],issues:['BUREAU_2023_RECONCILIATION_REQUIRED']};
 const header=cover.text.split(/Субъект кредитной истории/iu)[0];
 const taxpayer=[...cover.text.matchAll(/^\s*Номер налогоплательщика:\s*(\d{10}(?:\d{2})?)\s*$/gim)];
 const dateMatches=[...header.matchAll(/Предоставлен[^\n]*\n[^\n]*?\b(\d{2}-\d{2}-\d{4})\b/giu)];
 const date=dateMatches.length===1?dateMatches[0][1].split('-').reverse().join('-'):'';
 const fromReport=taxpayer.length===1?taxpayer[0][1]:'';
 const expected=payload.envelope.companyInn;
 const role=payload.relationship??'Компания-заёмщик';
 if(!validInn(fromReport)||!expected||fromReport!==expected||role!=='Компания-заёмщик'
     || !date||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date){
   base.issues.push('BUREAU_SUBJECT_OR_DATE_NOT_CONFIRMED');return base;
 }
 const summaries=pages.filter(p=>/^\s*Сводка\s*$/im.test(p.text)
   && /^\s*Счета\s*$/im.test(p.text)&&/Задолженность/iu.test(p.text));
 if(summaries.length!==1){
   base.status='INCOMPLETE';base.issues.push('BUREAU_SUMMARY_NOT_UNIQUE');return base;
 }
 const summary=summaries[0],start=summary.text.search(/^\s*Сводка\s*$/im);
 const remaining=summary.text.slice(start,Math.min(summary.text.length,start+2500));
 const cutoff=remaining.search(/^\s*Запросы\s*$/im);
 const section=cutoff>=0?remaining.slice(0,cutoff):remaining;
 if(!/(?:^|\s)Договоры(?:\s|$)/iu.test(section)||!/(?:^|\s)Задолженность(?:\s|$)/iu.test(section)){
   base.status='INCOMPLETE';base.issues.push('BUREAU_SUMMARY_COLUMNS_MISSING');return base;
 }
 const specs=[
  {key:'nbki_reported_accounts',label:'Счетов за всю историю',unit:'',pattern:/^\s*Всего:\s*(\d+)\b/iu},
  {key:'nbki_reported_open',label:'Открытых счетов по сводке',unit:'',pattern:/^\s*Открытых:\s*(\d+)\b/iu},
  {key:'nbki_reported_30plus',label:'Счетов с исторической просрочкой 30+',unit:'',pattern:/^\s*С просрочкой 30\+ дней:\s*(\d+)\b/iu},
  {key:'nbki_reported_lifetime',label:'Сумма обязательств за всю историю',unit:'₽',pattern:/Сумма обязательств за всю историю:\s*RUB\s*(\d+(?:[.,]\d{1,2})?)(?!\d)/iu},
  {key:'nbki_reported_next',label:'Следующий платёж по сводке',unit:'₽',pattern:/Следующий плат[её]ж:\s*RUB\s*(\d+(?:[.,]\d{1,2})?)(?!\d)/iu},
  {key:'nbki_reported_current',label:'Текущая задолженность по сводке',unit:'₽',pattern:/(?:^|\s)Текущая:\s*RUB\s*(\d+(?:[.,]\d{1,2})?)(?!\d)/iu},
  {key:'nbki_reported_overdue',label:'Просроченная задолженность по сводке',unit:'₽',pattern:/(?:^|\s)Просроченная:\s*RUB\s*(\d+(?:[.,]\d{1,2})?)(?!\d)/iu},
 ] as const;
 for(const spec of specs){
   const candidates=section.split(/\r?\n/u).flatMap(line=>{
     const match=line.match(spec.pattern);
     if(!match)return [];
     const value=Number(match[1].replace(',','.'));
     return Number.isFinite(value)&&value>=0&&value<=1e13?[{value,line:line.trim()}]:[];
   });
   if(candidates.length!==1){base.issues.push('BUREAU_SUMMARY_FIELD_NOT_UNIQUE:'+spec.key);continue;}
   const {value,line}=candidates[0];
   base.fields.push({key:spec.key,label:spec.label,value:String(value),unit:spec.unit,
     page:summary.page,fragment:line.slice(0,300),status:'SOURCE_ONLY'});
 }
 const structure=nbkiStructureIndex(pages,date);
 base.nbkiStructure=structure;
 base.issues.push(...structure.issues);
 const declared=base.fields.find(f=>f.key==='nbki_reported_accounts');
 if(declared?.value){
   const count=structure.modern.length+structure.legacy.length-structure.exactUidLinks;
   if(count!==Number(declared.value))base.issues.push('BUREAU_ACCOUNTS_UNRECONCILED');
 }
 base.status='BUREAU_STRUCTURE_REVIEW';
 if(base.fields.length!==specs.length)base.issues.push('BUREAU_SUMMARY_PARTIAL');
 return base;
}

export function bureauReview(pages:OcrPage[],payload:PrivateSource,warnings:string[]):DocumentReview {
  const base={version:'PRESCORE-BKI-PARSER-2',fields:[],issues:[]};
  if(warnings.length||pages.some(p=>p.method==='UNREADABLE'))return {...base,status:'INCOMPLETE'};
  const modern=modernNbkiSummaryReview(pages,payload);
  if(modern)return modern;
  try {
    const report=readBureau(pages.map(p=>p.text).join('\n\f\n'),payload.envelope.fileName??'',payload.envelope.companyInn!,payload.relationship??'Компания-заёмщик');
    return {...base,status:report.obligations.length?'BUREAU_CONFIRM':'BUREAU_NO_ROWS'};
  }catch{return {...base,status:'BUREAU_IDENTITY_REVIEW'};}
}
