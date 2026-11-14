// Parse only labelled columns in an OKB / Кредистория report. The lender's INN
// in a deal or in the bureau's signature never identifies the report subject.
import type {CreditHistoryReport, CreditObligation} from './credit-history.ts';
import {validInn} from './external/checko-inn.ts';

type Helpers = {
  date: (value?:string) => string;
  money: (value?:string) => number|null;
};
export function isOkbReport(text:string) {
  return /кредитный отч[её]т/i.test(text) &&
    /(?:объедин[её]нно[а-я]+\s+кредитно[а-я]+\s+бюро|АО\s+«ОКБ»)/i.test(text);
}
function amount(cell:string|undefined,helpers:Helpers) {
  return cell && /(?:р\.|руб\.?|₽|RUB)$/iu.test(cell) ? helpers.money(cell.replace(/\s*р\.$/iu,' ₽')) : null;
}
export function okbFields(text:string,helpers:Helpers) {
  const pages=text.split('\f');
  const cover=pages[0].slice(0,6000);
  const personal=/дата рождения|паспорт гражданина/i.test(cover);
  const corporate=/юридич[а-я]+ лиц[а-я]*|наименование организации/i.test(cover);
  const subjects=[...cover.matchAll(/^[ \t]*ИНН(?: субъекта| организации)?[ \t]*:?[ \t]*(?:\n[^\n\d]{0,160})?\s*(\d{10}(?:\d{2})?)(?!\d)/gim)].map(m=>m[1]);
  const subjectInn=new Set(subjects).size===1 && validInn(subjects[0]) ? subjects[0] : '';
  const reportDate=helpers.date(cover.match(/кредитный отч[её]т\s*\n\s*(?:от|на)\s+([^\n]+)/i)?.[1] ??
    text.match(/(?:^|\n)\s*сформирован\s+([^\n]+)/i)?.[1]);
  const subjectType:CreditHistoryReport['subjectType']=personal!==corporate ?
    (personal?'Физическое лицо':'Юридическое лицо'):'Не определён';
  const obligations:CreditObligation[]=[];
  const seen=new Set<string>();
  const details=new Map<string,string[]>();
  for(const status of ['open','closed']){
    const section=status==='open'?/действующие кредитные договоры/i:/закрытые кредитные договоры/i;
    const text=pages.filter(p=>section.test(p.slice(0,350))).join('\n');
    const headers=[...text.matchAll(/^\s*(\d+)\.\s+([^\n]+?)\s+[-–]\s+(?=договор|кредит|за[её]м|поручительство|гарантия)/gim)];
    for(const [i,h] of headers.entries()){
      const key=status+':'+h[1]+':'+h[2].trim();
      const entries=details.get(key)??[];
      entries.push(text.slice(h.index,headers[i+1]?.index));details.set(key,entries);
    }
  }
  for(const [pageIndex,page] of pages.entries()){
    const lines=page.split('\n').map(l=>l.trim());
    const heading=lines.slice(0,4).join(' ');
    const active=/действующие кредитные договоры/i.test(heading);
    const closed=/закрытые кредитные договоры/i.test(heading);
    if(active===closed)continue;
    let table=false;
    for(const [i,line] of lines.entries()){
      if(/источник данных\s*\/\s*вид обязательств/i.test(line)) { table=true;continue; }
      if(!table)continue;
      if(/^\d+\.\s|^сведения об источнике/i.test(line))break;
      const [number,creditor,face,balance,arrears]=line.split(/\s{2,}/);
      if(!/^\d{1,4}$/.test(number)||!creditor||!face)continue;
      const product=lines[i+1]?.split(/\s{2,}/)[0]??'';
      if(!/^(?:договор|кредит|за[её]м|поручительство|гарантия)/i.test(product))continue;
      const id='okb-'+(active?'open':'closed')+'-'+number;
      if(seen.has(id))throw Error('В отчёте повторяются номера строк одной таблицы.');
      seen.add(id);
      const overdue=active?amount(arrears,helpers):null;
      const total=active?amount(balance,helpers):null;
      const reference='Страница '+(pageIndex+1)+', строка '+number;
      // A summary row alone gives neither a principal balance nor the borrower role.
      // Bind the role and identity only from this deal's uniquely matched detail section.
      const candidates=details.get((active?'open':'closed')+':'+number+':'+creditor)??[];
      const block=candidates.length===1?candidates[0]:'';
      const identity=block.match(/вид участия в сделке[^\n]*идентификатор сделки[^\n]*номер сделки\s*\n\s*([^\n]+)/i)?.[1]?.trim().split(/\s{2,}/)??[];
      const role=identity[0]??'';
      const provenBorrower=/^за[её]мщик$/i.test(role);
      const status=active?'Действующий':balance??'';
      const payable=provenBorrower&&active;
      const original=amount(face,helpers);
      obligations.push({
        id,creditor,product,status,role,openedAt:'',scheduledCloseAt:'',updatedAt:'',
        accountNumber:identity[1]&&/^[a-f0-9-]{32,40}$/i.test(identity[1])?identity[1]:'',
        originalAmount:provenBorrower?original:null,creditLimit:null,outstandingPrincipal:null,
        totalOutstanding:payable?total:null,monthlyPayment:null,nextPaymentAmount:null,nextPaymentDate:'',
        annualRate:null,rateLabel:'',overdueAmount:payable?overdue:null,maxDelinquencyDays:null,
        paymentQuality:'Недостаточно данных',collateral:'',guaranteeAmount:null,sourcePageHint:reference,
        fieldProvenance:payable&&overdue===0?{overdueAmount:{origin:'REPORTED',value:0,reference}}:{}
      });
    }
  }
  return {subjectType,subjectInn,reportDate,obligations};
}
