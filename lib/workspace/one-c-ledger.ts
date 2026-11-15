import {oneCPeriod} from './one-c-period.ts';
import type {LedgerBalance} from './ledger-import.ts';
export function nativePartyLedger(rows:string[][],selectedInn:string,confirmed:boolean):LedgerBalance[]|null{
 const title=rows.slice(0,8).flat().find(s=>/оборотно-сальдовая ведомость по сч[её]ту/i.test(s));
 if(!title)return null;
 const account=title.match(/по сч[её]ту\s+(60|62|76)(?:\s|$)/i)?.[1],period=oneCPeriod(title);
 const i=rows.findIndex(r=>r.some(s=>/^Сальдо на конец периода$/i.test(s.trim())));
 if(!account||!period||i<0||i>20)throw Error('Проверьте счёт, период и конечное сальдо в ОСВ.');
 const header=rows[i],next=rows[i+1]??[],end=header.findIndex(s=>/^Сальдо на конец периода$/i.test(s.trim()));
 if(next[0]?.trim()!=='Контрагенты'||!/^дебет$/i.test(next[end]?.trim())||!/^кредит$/i.test(next[end+1]?.trim())||rows.slice(i+1,i+4).flat().some(s=>/^договоры|^субсчета/i.test(s.trim())))throw Error('Для этой структуры используйте импорт с колонками по контрагенту и договору.');
 const inns=[...rows.slice(0,i).flat().join(' ').matchAll(/ИНН\s*[:№]?\s*(\d{10,12})(?!\d)/gi)].map(m=>m[1]);
 if(inns.some(v=>v!==selectedInn)||(!inns.length&&!confirmed))throw Error('Подтвердите принадлежность ОСВ выбранному досье.');
 const parse=(s:string|undefined)=>{if(!s?.trim())return null;const v=s.replace(/[\s\u00a0]/g,'').replace(',','.');if(!/^-?\d+(?:\.\d{1,2})?$/.test(v)||!Number.isSafeInteger(Math.round(Number(v)*100)))throw Error('Проверьте суммы ОСВ.');return Number(v);};
 const data:LedgerBalance[]=[];const seen=new Set<string>();let base=false,totalSeen=false,expectedDebit:number|null=null,expectedCredit:number|null=null;
 for(let j=i+2;j<rows.length;j++){
   const r=rows[j],party=r[0]?.trim();if(!party)continue;
   if(party===account){if(base)throw Error('В книге несколько сводных таблиц.');base=true;continue;}
   if(/^(?:итого|всего)(?:\s|$)/i.test(party)){if(totalSeen)throw Error('Несколько итоговых строк.');totalSeen=true;expectedDebit=parse(r[end])??0;expectedCredit=parse(r[end+1])??0;continue;}
   if(!base||totalSeen||/^\d{2}(?:\.\d+)*$/.test(party))throw Error('Выгрузите один счёт с группировкой только по контрагентам.');
   let debit=parse(r[end]),credit=parse(r[end+1]);
   if(debit===null&&credit===null){if(!r.slice(1,end).some(v=>!!v.trim()))continue;debit=0;credit=0;}
   if(seen.has(party))throw Error('Повторный контрагент. Уточните группировку ОСВ.');seen.add(party);
   data.push({account,party,asOf:period.to,contract:null,debit,credit,row:j+1});
 }
 if(!base||!totalSeen||!data.length)throw Error('Проверьте итоговую строку и период выгрузки.');
 const sum=(side:'debit'|'credit')=>data.reduce((total,r)=>total+Math.round((r[side]??0)*100),0);
 if(sum('debit')!==Math.round(expectedDebit!*100)||sum('credit')!==Math.round(expectedCredit!*100))throw Error('Конечные остатки строк требуют сверки с итогом ОСВ.');
 return data;
}
