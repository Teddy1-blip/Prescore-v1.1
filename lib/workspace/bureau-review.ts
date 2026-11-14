import {parseAuthoritativeCreditHistoryText} from '../credit-engine/source-foundation.ts';
import type {CreditSubjectRelationship,CreditHistoryReport} from '../credit-history.ts';
import type {OcrPage} from '../document-poc/local-ocr.ts';
import type {DocumentReview} from '../document-poc/review-fields.ts';
import type {PrivateSource} from './dossier-sources.ts';

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
export function bureauReview(pages:OcrPage[],payload:PrivateSource,warnings:string[]):DocumentReview {
  const base={version:'PRESCORE-BKI-PARSER-2',fields:[],issues:[]};
  if(warnings.length||pages.some(p=>p.method==='UNREADABLE'))return {...base,status:'INCOMPLETE'};
  try {
    const report=readBureau(pages.map(p=>p.text).join('\n\f\n'),payload.envelope.fileName??'',payload.envelope.companyInn!,payload.relationship??'Компания-заёмщик');
    return {...base,status:report.obligations.length?'BUREAU_CONFIRM':'BUREAU_NO_ROWS'};
  }catch{return {...base,status:'BUREAU_IDENTITY_REVIEW'};}
}
