import {validInn} from '../external/checko-inn.ts';
import {creditAgreement} from './agreement.ts';
import {financialStatement} from './financial.ts';
import {extractContractReview} from './contract-facts.ts';
import {EXTRACTOR_VERSION,type Field,type Input} from './fields.ts';
import {routeDocument,type EvidencePage,type UploadFamily} from './document-routing.ts';
export type ReviewField={key:string;label:string;value:string|null;unit:string;page:number|null;fragment:string|null;status:string};
export type DocumentReview={version:string;status:string;fields:ReviewField[];issues:string[]};
const terms:Record<string,[string,string]>={
 creditor:['Кредитор',''],borrower:['Заёмщик',''],agreement_number:['Номер договора',''],agreement_date:['Дата договора',''],
 currency:['Валюта',''],credit_amount:['Сумма кредита',''],credit_limit:['Лимит по договору',''],interest_rate:['Процентная ставка','%'],
 start_date:['Дата начала',''],maturity_date:['Срок погашения',''],product_type:['Вид кредита',''],fees:['Комиссия',''],collateral:['Обеспечение','']};
const contractLabels:Record<string,string>={CONTRACT_DATE:'Дата договора',CONTRACT_AMOUNT:'Цена договора',ADVANCE_MAX_PERCENT:'Предельный аванс',ADVANCE_TIMING:'Срок аванса',FINAL_PAYMENT:'Окончательный расчёт',WORK_END:'Завершение работ',ASSIGNMENT:'Уступка',PAYMENT_SCHEDULE:'График платежей'};
export function reviewFields(id:string,pages:EvidencePage[],total:number,family:UploadFamily,layout:'SINGLE'|'TWO_UP_ROTATED',warnings:string[]=[],tables?:Input['financialTables']):DocumentReview{
 const routing=routeDocument({pages,totalPhysicalPages:total,expectedFamily:family,layout,extractionWarnings:warnings});
 const result:DocumentReview={version:EXTRACTOR_VERSION,status:routing.status,fields:[],issues:[...routing.warnings]};
 if(routing.status!=='READY_FOR_REVIEW'||!routing.parser)return result;
 const input:Input={id,issues:[],financialTables:tables,lines:pages.flatMap(p=>p.text.split(/\r?\n/).map(text=>({text,confidence:p.method==='TEXT'?'HIGH':'MEDIUM',page:p.page,pdf:true})))};
 function add(key:string,label:string,unit:string,f:Field<unknown>){result.fields.push({key,label,unit,value:f.value==null?null:String(f.value),page:f.source_page,fragment:f.source_text,status:f.status});}
 if(routing.parser==='CREDIT_AGREEMENT'){
  const agreement=creditAgreement(input);
  const identity=input.lines.flatMap(l=>{const m=l.text.trim().match(/^ИНН\s+за[её]мщика\s*[:|]\s*(\d{10}(?:\d{2})?)$/i);return m&&validInn(m[1])?[{line:l,inn:m[1]}]:[];});
  if(identity.length&&new Set(identity.map(i=>i.inn)).size===1){const {line,inn}=identity[0];result.fields.push({key:'borrower_inn',label:'ИНН заёмщика',unit:'',value:inn,page:line.page,fragment:line.text,status:'READ'});}
  for(const [key,f] of Object.entries(agreement.terms)){
    if(!terms[key])continue;const [label,unit]=terms[key];
    add(key,label,key==='credit_amount'||key==='credit_limit'?agreement.terms.currency.value??'':unit,f);
  }
 }else if(routing.parser==='FINANCIAL_STATEMENT'){
  const bfo=financialStatement(input);
  const metadata=bfo.metadata;
  add('company_inn','ИНН организации','',metadata.inn);
  add('statement_date','Отчётная дата','',metadata.reporting_date);
  add('period_start','Начало периода','',metadata.period_start);
  add('period_end','Конец периода','',metadata.period_end);
  add('statement_unit','Единица отчётности','',metadata.unit);
  for(const row of bfo.rows){const code=row.line_code.value;if(code)add(code,'Строка '+code,String(row.unit.value??''),row.current_period_value);}
 }else{
  const contract=extractContractReview(pages.map(p=>({...p,segment:p.segment??'FULL'})));
  for(const f of contract.facts)if(contractLabels[f.key])result.fields.push({key:f.key,label:contractLabels[f.key],unit:f.key==='CONTRACT_AMOUNT'?'₽':f.key==='ADVANCE_MAX_PERCENT'?'%':'',value:f.value,page:f.pdfPage,fragment:f.sourceText,status:f.status});
 }
 result.issues.push(...input.issues.map(i=>i.code));
 return result;
}
