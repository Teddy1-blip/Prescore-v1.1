import {validInn} from '../external/checko-inn.ts';
export type LedgerBalance = {account:string;party:string;contract:string|null;debit:number|null;credit:number|null;asOf:string;row:number;partyInn?:string;component?:string;due?:string};
function amount(text:string) {
  if (!text.trim()) return null;
  const value=text.replace(/[\s\u00a0]/g,'').replace(',','.');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value) || !Number.isSafeInteger(Math.round(Number(value)*100))) throw Error('Неверная сумма в строке ОСВ.');
  return Number(value);
}
// Explicit column mapping. No aggregation of parent/subaccount rows or inference of due dates.
export function parseLedger(text:string, inn:string, purpose:'COUNTERPARTIES'|'DEBT_LEDGER'):LedgerBalance[] {
  const rows=text.trim().replace(/^\uFEFF/,'').split(/\r?\n/).map(row=>row.split('\t').map(cell=>cell.trim()));
  const names=rows.shift()??[];
  const columns=['ИНН организации','Дата остатка','Счёт','Контрагент','Договор','Дебет, руб.','Кредит, руб.'].map(name=>names.indexOf(name));
  if(columns.some(i=>i<0)||new Set(names).size!==names.length)throw Error('Проверьте названия колонок ОСВ.');
  const seen=new Set<string>();
  const data=rows.flatMap((row,i)=>{
    if(row.every(v=>!v))return [];
    const [company,asOf,account,party,contract,dr,cr]=columns.map(index=>row[index]??'');
    if(company!==inn || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf))||new Date(asOf).toISOString().slice(0,10)!==asOf)throw Error('Проверьте ИНН и дату остатка в каждой строке ОСВ.');
    const valid=purpose==='COUNTERPARTIES'?/^(60|62|76)(?:\.\d+)*$/:/^(66|67)(?:\.\d+)*$/;
    if(!valid.test(account)||!party||/^итого|^всего/i.test(party))throw Error('Нужны строки по контрагентам без итогов.');
    const extra=(column:string)=>row[names.indexOf(column)]?.trim()||undefined;
    const partyInn=extra('ИНН контрагента'),component=extra('Вид задолженности'),due=extra('Дата платежа по договору');
    if(partyInn&&!validInn(partyInn))throw Error('Проверьте ИНН контрагента.');
    if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due))throw Error('Проверьте дату платежа по договору.');
    const debit=amount(dr),credit=amount(cr);
    if(debit===null&&credit===null)throw Error('В строке не указан ни один остаток.');
    const key=JSON.stringify([asOf,account,party,contract,component,due]);
    if(seen.has(key)) throw Error('Повторная строка ОСВ. Уточните аналитику по договору.');
    seen.add(key);
    return [{account,party,contract:contract||null,asOf,debit,credit,row:i+2,...(partyInn?{partyInn}:{}),...(component?{component}:{}),...(due?{due}:{})}];
  });
  if(!data.length)throw Error('ОСВ не содержит остатков.');
  return data;
}
