/** Review-only contract candidates derived from local OCR; NOT verified legal or accounting facts. */
import type {OcrPage} from './local-ocr.ts';
export type ContractFactKey='CONTRACT_DATE'|'CONTRACT_AMOUNT'|'ADVANCE_MAX_PERCENT'|'ADVANCE_MAX_ESTIMATE'|'ADVANCE_TIMING'|'INTERIM_PAYMENT'|'FINAL_PAYMENT'|'WORK_START'|'WORK_END'|'CONTRACT_DURATION'|'ASSIGNMENT'|'TITLE_TRANSFER'|'PAYMENT_SCHEDULE';
export type ContractFact={key:ContractFactKey;value:string|null;status:'REVIEW'|'UNKNOWN';pdfPage:number|null;logicalPage:number|null;sourceText:string|null;note:string};
export type ContractExtractionV1={version:'CONTRACT-CASHFLOW-REVIEW-0.1';facts:ContractFact[];warnings:string[];automaticAccountingPostings:false;automaticCreditDecision:false};
const months:Record<string,number>={января:1,февраля:2,марта:3,апреля:4,мая:5,июня:6,июля:7,августа:8,сентября:9,октября:10,ноября:11,декабря:12};
const money=(s:string)=>{const digits=s.replace(/\s/g,'');return /^\d{4,15}$/.test(digits)?Number(digits):null};
const roundCents=(n:number)=>String(Math.round((n+Number.EPSILON)*100)/100);
const clean=(v:string)=>v.replace(/\s+/g,' ').trim();
function snippet(page:OcrPage,index:number,count=4){const lines=page.text.split(/\n/).map(s=>s.trim()).filter(Boolean);return clean(lines.slice(Math.max(0,index-1),Math.min(lines.length,index+count)).join(' ')).slice(0,950)}
function find(pages:OcrPage[],re:RegExp){for(const page of pages){const lines=page.text.split(/\n/).map(s=>s.trim()).filter(Boolean);for(let i=0;i<lines.length;i++){const context=clean(lines.slice(i,Math.min(lines.length,i+6)).join(' '));if(re.test(context))return {page,context,sourceText:snippet(page,i,7)};}}return null;}
function clause(pages:OcrPage[],num:string){const marker=new RegExp(`^${num.replace('.','[.,]')}\\.?\\s+`,'i');for(const page of pages){const lines=page.text.split(/\n/).map(s=>s.trim()).filter(Boolean);const i=lines.findIndex(s=>marker.test(s));if(i>=0){const next=lines.findIndex((s,j)=>j>i&&/^\d{1,2}[.,]\d{1,2}[.,]?\s+/.test(s));const end=next>i?next:Math.min(i+26,lines.length);return {page,sourceText:clean(lines.slice(i,end).join(' ')).slice(0,2400),index:i};}}return null;}
function fact(key:ContractFactKey,value:string|null,evidence:{page:OcrPage;sourceText:string}|null,note:string):ContractFact{return {key,value,status:value===null?'UNKNOWN':'REVIEW',pdfPage:evidence?.page.page??null,logicalPage:evidence?.page.logicalPage??null,sourceText:evidence?.sourceText??null,note};}
export function extractContractReview(pages:OcrPage[]):ContractExtractionV1{
 const ordered=[...pages].sort((a,b)=>a.logicalPage-b.logicalPage),facts:ContractFact[]=[];
 const first=ordered.filter(p=>p.logicalPage<=2);
 const date=find(first,/(?:«|\b)\d{1,2}»?\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+20\d{2}/iu);
 let dateValue:string|null=null;
 if(date){const m=date.context.match(/(\d{1,2})»?\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(20\d{2})/iu);if(m&&Number(m[1])<=31)dateValue=`${m[3]}-${String(months[m[2].toLowerCase()]).padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
 facts.push(fact('CONTRACT_DATE',dateValue,date,'Дата, извлечённая из скана; проверить по подлиннику.'));
 const price=find(ordered,/цена\s+договора\s+составля[ею]т\s+[\d\s]{5,}/iu);
 const amount=price?money(price.context.match(/цена\s+договора\s+составля[ею]т\s+([\d ]{5,21})(?=\s*\()/iu)?.[1]??''):null;
 facts.push(fact('CONTRACT_AMOUNT',amount===null?null:String(amount),price,'Цена договора, а не сумма текущей дебиторской задолженности.'));
 const a=clause(ordered,'5.1')??find(ordered,/аванс.{0,80}\d{1,2}\s*%/iu);
 const percentage=a?.sourceText.match(/аванс.{0,130}?(?:до|ло)\s*(\d{1,2}(?:[.,]\d+)?)\s*%/iu)
  ??a?.sourceText.match(/аванс.{0,130}?(\d{1,2}(?:[.,]\d+)?)\s*%/iu);
 const pct=percentage?Number(percentage[1].replace(',','.')):null;
 const validPct=pct!==null&&pct>=0&&pct<=100?pct:null;
 facts.push(fact('ADVANCE_MAX_PERCENT',validPct===null?null:String(validPct),a,'Предельный аванс; слово «вправе» не подтверждает перечисление.'));
 facts.push(fact('ADVANCE_MAX_ESTIMATE',amount!==null&&validPct!==null?roundCents(amount*validPct/100):null,a,'Расчётная верхняя граница по распознанной цене и проценту, НЕ факт авансового платежа.'));
 const advanceDays=a?.sourceText.match(/в\s+течени[еи]\s*(\d{1,3})\s*\([^)]*\)\s*рабочих\s+д[нйи][а-яё]{1,6}/iu)??a?.sourceText.match(/в\s+течени[еи]\s*(\d{1,3})\s*рабочих\s+д[нйи][а-яё]{1,6}/iu);
 facts.push(fact('ADVANCE_TIMING',advanceDays?`до ${advanceDays[1]} рабочих дней от указанного в условии события`:null,a,'Право перечислить аванс, а не подтверждённая дата поступления.'));
 const interim=clause(ordered,'5.2')??find(ordered,/оплату за фактически.{0,100}работ/iu);
 const interimDays=interim?.sourceText.match(/(\d{1,3})\s*\([^)]*\)\s*рабочих\s+дн[еийё]/iu);
 facts.push(fact('INTERIM_PAYMENT',interimDays?`${interimDays[1]} рабочих дней после подтверждения выполненных работ (КС-2/КС-3); требуется проверить условия`:null,interim,'Дата фактического подписания документов должна быть известна.'));
 const final=clause(ordered,'5.3')??find(ordered,/окончательн[а-яё]*\s+расч[её]т/iu);
 const finalDays=final?.sourceText.match(/(\d{1,3})\s*\([^)]*\)\s*рабочих\s+дн[еийё]/iu);
 facts.push(fact('FINAL_PAYMENT',finalDays?`не позднее ${finalDays[1]} рабочих дней после договорных условий приёмки/устранения недостатков`:null,final,'Не выводить дату поступления из планового окончания работ.'));
 const workSections=ordered.map(p=>({page:p,matched:clause([p],'2.1')})).filter(x=>x.matched).map(x=>x.matched!);
 const work=workSections.find(x=>/окончани[ея].{0,75}\d{2}[.,]\d{2}[.,]20\d{2}/iu.test(x.sourceText))??workSections[0]??find(ordered,/окончани[ея]\s+[—-]?\s*не\s+позднее/iu);
 const workText=work?.sourceText??'';
 const workStart=workText.match(/начал[оа].{0,75}?(\d{2}[.,]\d{2}[.,]20\d{2})/iu)?.[1]?.replace(/,/g,'.')??null;
 const workEnd=workText.match(/окончани[ея].{0,75}?(\d{2}[.,]\d{2}[.,]20\d{2})/iu)?.[1]?.replace(/,/g,'.')??null;
 facts.push(fact('WORK_START',workStart,work,'Начало работ — не дата оплаты.'));
 facts.push(fact('WORK_END',workEnd,work,'Плановое окончание работ не является датой окончательной оплаты.'));
 const term=clause(ordered,'11.1')??find(ordered,/договор\s+вступает\s+в\s+силу.{0,110}действу[её]т\s+до\s+полн[а-яё]+\s+исполнен/iu)??find(ordered,/договор.{0,40}действу[её]т.{0,40}исполнен/iu);
 const long=term?.sourceText.match(/действу[её]т.{0,100}?(?:полн[а-яё]{0,15}\s+исполнен[а-яё]{0,12}\s+(?:сторон|обязательств)|исполнени[ея]\s+сторон[а-яё]{0,15}\s+обязательств)/iu);
 facts.push(fact('CONTRACT_DURATION',long?'до полного исполнения обязательств сторонами':null,term,'Проверить также изменения и дополнительные соглашения.'));
 const assign=find(ordered,/(?:уступк[аиуе]|цессия|уступа[ею]т.{0,60}требован)/iu);
 facts.push(fact('ASSIGNMENT',null,assign,'Юридическая возможность уступки НЕ определяется отсутствием запрета в OCR; требуется оценка юриста и основания требования.'));
 const title=find(ordered,/переход.{0,35}права собственности|право собственности.{0,35}переход/iu);
 facts.push(fact('TITLE_TRANSFER',null,title,'Условие может отсутствовать или относиться к иному предмету договора.'));
 const schedule=find(ordered,/график.{0,40}(?:платежей|оплаты|расч[её]тов)/iu);
 facts.push(fact('PAYMENT_SCHEDULE',null,schedule,'Календарный график не подтверждён. Условия 5.1–5.3 формируют только событийные платежи, пока нет КС-2/КС-3 и факта оплаты.'));
 return {version:'CONTRACT-CASHFLOW-REVIEW-0.1',facts,warnings:['OCR_UNVERIFIED','PAYMENT_EVENTS_NOT_PROVEN','FINANCIAL_MODEL_NOT_UPDATED','ASSIGNMENT_NOT_LEGAL_OPINION'],automaticAccountingPostings:false,automaticCreditDecision:false};
}
