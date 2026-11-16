import {validInn} from '../external/checko-inn.ts';
import {creditAgreement} from './agreement.ts';
import {financialStatement} from './financial.ts';
import {extractContractReview} from './contract-facts.ts';
import {capture,plain,EXTRACTOR_VERSION,type Field,type Input} from './fields.ts';
import {routeDocument,type EvidencePage,type UploadFamily} from './document-routing.ts';
export type ReviewField={key:string;label:string;value:string|null;unit:string;page:number|null;fragment:string|null;status:string};
export type DocumentReview={anchor?:'paragraph';version:string;status:string;fields:ReviewField[];issues:string[];
 nbkiStructure?:import('../workspace/nbki-structure-index.ts').NbkiStructureIndex};
const terms:Record<string,[string,string]>={
 creditor:['Кредитор',''],borrower:['Заёмщик',''],agreement_number:['Номер договора',''],agreement_date:['Дата договора',''],
 currency:['Валюта',''],credit_amount:['Сумма кредита',''],credit_limit:['Лимит по договору',''],interest_rate:['Процентная ставка','%'],
 start_date:['Дата начала',''],maturity_date:['Срок погашения',''],product_type:['Вид кредита',''],rate_type:['Тип ставки',''],variable_rate_formula:['Формула ставки',''],fees:['Комиссия',''],collateral:['Обеспечение','']};
const contractLabels:Record<string,string>={INTERIM_PAYMENT:'Промежуточный платёж',WORK_START:'Начало работ',CONTRACT_DURATION:'Срок действия',TITLE_TRANSFER:'Переход права собственности',CONTRACT_DATE:'Дата договора',CONTRACT_AMOUNT:'Цена договора',ADVANCE_MAX_PERCENT:'Предельный аванс',ADVANCE_TIMING:'Срок аванса',FINAL_PAYMENT:'Окончательный расчёт',WORK_END:'Завершение работ',ASSIGNMENT:'Уступка',PAYMENT_SCHEDULE:'График платежей'};
export function reviewFields(id:string,pages:EvidencePage[],total:number,family:UploadFamily,layout:'SINGLE'|'TWO_UP_ROTATED',warnings:string[]=[],tables?:Input['financialTables']):DocumentReview{
 const routing=routeDocument({pages,totalPhysicalPages:total,expectedFamily:family,layout,extractionWarnings:warnings});
 const result:DocumentReview={version:EXTRACTOR_VERSION,status:routing.status,fields:[],issues:[...routing.warnings]};
 if(routing.subtypes.includes('CREDIT_OFFER'))result.issues.push('CREDIT_OFFER_ACCEPTANCE_UNVERIFIED');
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
  for(const [i,c] of agreement.covenants.entries())add('covenant_'+i,'Ковенант','',c.condition);
  for(const [i,r] of agreement.schedule.rows.entries()){
    add('schedule_date_'+i,'Дата платежа','',r.date);
    add('schedule_principal_'+i,'Погашение основного долга',agreement.terms.currency.value??'',r.principal);
    add('schedule_interest_'+i,'Проценты по графику',agreement.terms.currency.value??'',r.interest);
    add('schedule_total_'+i,'Итого платёж по графику',agreement.terms.currency.value??'',r.total);
  }
 }else if(routing.parser==='FINANCIAL_STATEMENT'){
  // Appendices in a single annual filing can carry prior-year headings and the
  // same row codes. Only F1/F2 and their continuation pages feed their review.
  const eligible=new Set<number>();
  const supportingPages=new Set<number>();
  let inStatements=false,seenBfo=false,serviceBoundary=false,mixedPhysicalPage=false;
  for(const page of pages){
    // The original package is preserved in full; only the F1/F2 review scope
    // is restricted. Tax service receipts can contain other companies' INNs
    // and quotes of balance-sheet figures.
    const lead=page.text.split(/\r?\n/).slice(0,18).join('\n');
    const financialStart=/(?:^|\n)\s*(?:упрощ[её]нный )?(?:бухгалтерский баланс|отч[её]т о финансовых результатах)(?:\s|$)/im.test(lead);
    const fnsService=/(?:^|\n)\s*(?:(?:(?:код|форма)\s+по\s+)?кнд\s+116(?:600[27]|700[245])(?:\s|$)|информационное сообщение о представительстве|подтверждение даты отправки|квитанция о при[её]ме|извещение о (?:вводе сведений|получении электронного документа))(?:\s|$)/im.test(lead);
    if(seenBfo&&fnsService)serviceBoundary=true;
    if(serviceBoundary){
      supportingPages.add(page.page);
      if(financialStart||eligible.has(page.page))mixedPhysicalPage=true;
      continue; // Never re-enter F1/F2 on an annex that quotes its contents.
    }
    if(financialStart){inStatements=true;seenBfo=true;}
    else if(/(?:^|\n)\s*(?:отч[её]т (?:об изменениях капитала|о движении денежных средств|о целевом использовании)|пояснения к |аудиторское заключение)/im.test(lead))inStatements=false;
    if(inStatements)eligible.add(page.page);
  }
  if(mixedPhysicalPage){
    result.status='INCOMPLETE';
    result.issues.push('BFO_MIXED_FINANCIAL_AND_SUPPORTING_PAGE_REVIEW');
    return result;
  }
  if(supportingPages.size)result.issues.push('BFO_FNS_SUPPORTING_DOCUMENTS_SEPARATE_REVIEW');
  if(!eligible.size){
    result.status='INCOMPLETE';
    result.issues.push('BFO_FINANCIAL_PAGE_BOUNDARY_UNVERIFIED');
    return result;
  }
  const lines=input.lines.filter(l=>eligible.has(l.page));
  const financialTables=tables?.filter(t=>eligible.has(t.line.page));
  const bfo=financialStatement({...input,lines,financialTables});
  const metadata=bfo.metadata;
  add('company_inn','ИНН организации','',metadata.inn);
  add('statement_date','Отчётная дата','',metadata.reporting_date);
  add('period_start','Начало периода','',metadata.period_start);
  add('period_end','Конец периода','',metadata.period_end);
  add('statement_unit','Единица отчётности','',metadata.unit);
  for(const row of bfo.rows){const code=row.line_code.value;if(code)add(code,'Строка '+code,String(row.unit.value??''),row.current_period_value);}
  // Independent OCR variants disagree on a dated financial cell. Other
  // source values remain visible, but the document cannot appear fully ready.
  if(warnings.some(w=>w.startsWith('OCR_FINANCIAL_PASS_CONFLICT:'))){
    result.status='INCOMPLETE';
    result.issues.push('BFO_OCR_PASS_DISAGREEMENT');
  }
  // Tables on scanned F1/F2 continuation pages may omit printed column
  // headings. Do not silently claim that those financial rows were covered.
  const unboundPages=warnings.flatMap(w=>{
    const match=/^OCR_FINANCIAL_ROWS_UNBOUND:(\d+)(?::|$)/.exec(w);
    return match?[Number(match[1])]:[];
  });
  if(unboundPages.some(p=>eligible.has(p))){
    result.status='INCOMPLETE';
    result.issues.push('BFO_CONTINUATION_ROWS_UNBOUND');
  }
  // A recognized document heading or a successful OCR response is not proof
  // that even one current-period financial value was read accurately.
  const readable = bfo.rows.filter(row=>row.current_period_value.value!==null && row.current_period_value.status==='READ');
  if(!readable.length){
    result.status='INCOMPLETE';
    result.issues.push('BFO_CURRENT_VALUES_UNVERIFIED');
  }
  // Balance 1600 alone is insufficient: the asset and liability totals must
  // both be present as independent readable source rows before readiness.
  if(metadata.forms.some(form=>form.value==='Бухгалтерский баланс') &&
      !['1600','1700'].every(code=>readable.some(row=>row.line_code.value===code))){
    result.status='INCOMPLETE';
    result.issues.push('BFO_BALANCE_TOTALS_UNVERIFIED');
  }
  // A column may be read perfectly and still be arithmetically incompatible
  // with the other fields. The review must never look complete in that case.
  // Preserve source values and page fragments for manual verification.
  if(input.issues.some(issue=>issue.status==='INVALID')){
    result.status='INCOMPLETE';
    result.issues.push('BFO_INTEGRITY_REVIEW_REQUIRED');
    for(const item of result.fields){
      if(/^\d{4}$/.test(item.key)&&item.status==='READ')item.status='REVIEW';
    }
  }
 }else{
  for(const [key,label,regex] of [
    ['contract_number','Номер договора',/^(?:(?:государственный |муниципальный )?контракт|договор)[^№\n]{0,90}№\s*([\p{L}\d._/-]+)(?=\s|$)/iu],
    ['customer','Заказчик или покупатель',/^(?:заказчик|покупатель)\s*[:|]\s*(.+)$/iu],
    ['supplier','Исполнитель или поставщик',/^(?:исполнитель|поставщик|подрядчик)\s*[:|]\s*(.+)$/iu],
  ] as const)add(key,label,'',capture(input,regex,plain));
  const contract=extractContractReview(pages.map(p=>({...p,segment:p.segment??'FULL'})));
  for(const f of contract.facts)if(contractLabels[f.key])result.fields.push({key:f.key,label:contractLabels[f.key],unit:f.key==='CONTRACT_AMOUNT'?'₽':f.key==='ADVANCE_MAX_PERCENT'?'%':'',value:f.value,page:f.pdfPage,fragment:f.sourceText,status:f.status});
 }
 result.issues.push(...input.issues.map(i=>i.code));
 return result;
}
