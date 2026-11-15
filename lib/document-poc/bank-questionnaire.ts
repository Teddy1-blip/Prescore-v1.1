/** Deterministic, read-only review of company and financing fields in bank forms.
 * No personal passport/birth/address/contact fields are returned or filled.
 * Bank templates vary; extracted candidates always require owner review.
 */
export const QUESTIONNAIRE_INTAKE_VERSION='PRESCORE-QUESTIONNAIRE-CELLS-0.1';
export type QuestionnaireRow=readonly (string|number|boolean|null|undefined)[];
export type QuestionnaireKey='COMPANY_NAME'|'COMPANY_OGRN'|'COMPANY_INN'|'REGISTRATION_DATE'|'ACTIVITY'
  |'LEGAL_ADDRESS'|'ACTUAL_ADDRESS'|'REQUESTED_PRODUCT'|'REQUESTED_AMOUNT'|'REQUESTED_PURPOSE'|'REQUESTED_TERM';
export type QuestionnaireField={key:QuestionnaireKey;raw:string;row:number;labelColumn:number;valueColumn:number;status:'CANDIDATE'|'CONFLICT'};
export type QuestionnairePreview={version:typeof QUESTIONNAIRE_INTAKE_VERSION;kind:'BANK_QUESTIONNAIRE'|'UNSUPPORTED';
  fields:QuestionnaireField[];issues:string[];automaticApply:false;personalFieldsExtracted:false};
const codeMap:Readonly<Record<string,QuestionnaireKey>>={
 '1.1':'COMPANY_NAME','1.2':'COMPANY_OGRN','1.3':'REGISTRATION_DATE',
 '1.4':'COMPANY_INN','1.5':'ACTIVITY','1.6':'LEGAL_ADDRESS','1.7':'ACTUAL_ADDRESS',
 '1.11':'REQUESTED_PRODUCT','1.12':'REQUESTED_AMOUNT','1.13':'REQUESTED_PURPOSE','1.14':'REQUESTED_TERM',
};
const text=(v:unknown)=>String(v??'').replace(/[\u00a0\u202f]/gu,' ').trim();
const marker=/^1\s*[.]\s*(1[0-4]|[1-7])\s*[.]?\s+/u;
export function inspectQuestionnaireRows(rows:readonly QuestionnaireRow[]):QuestionnairePreview{
 if(!Array.isArray(rows)||rows.length>20_000||rows.some(r=>r.length>150||r.some(c=>text(c).length>8000)))throw Error('QUESTIONNAIRE_SIZE_LIMIT');
 const supported=rows.slice(0,20).some(r=>r.some(c=>/анкета\s*[-–]?\s*заявка|анкета\s+клиента|анкетирование\s+клиента/iu.test(text(c))));
 const result:QuestionnairePreview={version:QUESTIONNAIRE_INTAKE_VERSION,kind:supported?'BANK_QUESTIONNAIRE':'UNSUPPORTED',fields:[],issues:[],automaticApply:false,personalFieldsExtracted:false};
 if(!supported){result.issues.push('QUESTIONNAIRE_TEMPLATE_NOT_RECOGNIZED');return result;}
 const seen=new Map<QuestionnaireKey,QuestionnaireField>();
 for(let ri=0;ri<rows.length;ri++){
  const row=rows[ri];
  for(let ci=0;ci<row.length;ci++){
   const label=text(row[ci]);const match=marker.exec(label);if(!match)continue;
   const key=codeMap['1.'+match[1]];
   if(!key)continue;
   let valueColumn=-1,value='';
   for(let j=ci+1;j<Math.min(row.length,ci+11);j++){
    const next=text(row[j]);if(!next)continue;
    if(marker.test(next)||/^(?:валюта\s+кредита|дата\s+регистрации\s*:|инн\s*:)/iu.test(next))break;
    value=next;valueColumn=j;break;
   }
   if(!value){result.issues.push('QUESTIONNAIRE_VALUE_MISSING:'+key);continue;}
   if(key==='COMPANY_INN'&&!/^\d{10}(?:\d{2})?$/.test(value.replace(/\s/g,''))){
     result.issues.push('QUESTIONNAIRE_INN_NEEDS_REVIEW');continue;
   }
   const prior=seen.get(key);
   const entry:QuestionnaireField={key,raw:value,row:ri+1,labelColumn:ci+1,valueColumn:valueColumn+1,status:prior&&prior.raw!==value?'CONFLICT':'CANDIDATE'};
   if(prior&&prior.raw!==value){prior.status='CONFLICT';result.issues.push('QUESTIONNAIRE_DUPLICATE_CONFLICT:'+key);}
   result.fields.push(entry);
   if(!prior)seen.set(key,entry);
  }
 }
 if(!result.fields.length)result.issues.push('QUESTIONNAIRE_NO_COMPANY_FIELDS');
 return result;
}
