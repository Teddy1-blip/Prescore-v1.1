/** Select exactly one accounting source sheet. Never concatenate unrelated OSV
 * or account-51 journals from a multi-worksheet workbook. */
export type AccountingSheet={sheet:string;rows:string[][];rowNumbers?:number[]};
export type AccountingFamily='OSV'|'ACCOUNT_51';
const value=(text:unknown)=>String(text??'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
function recognized(sheet:AccountingSheet,family:AccountingFamily){
 const rows=sheet.rows.slice(0,16);
 if(family==='ACCOUNT_51')return rows.some(r=>r.some(c=>/карточка\s+счета\s+51(?:\s|$)/iu.test(value(c))));
 const title=/оборотно[\s-]*сальдовая\s+ведомость\s+по\s+счету\s+(?:60|62|66|67|76)(?:\s|$)/iu;
 if(rows.some(r=>r.some(c=>title.test(value(c)))))return true;
 // Existing normalized import format, already validated downstream by parseLedger.
 const needed=['инн организации','дата остатка','счет','контрагент','договор','дебет, руб.','кредит, руб.'];
 return rows.some(r=>{
  const cells=new Set(r.map(value));
  return needed.every(c=>cells.has(c));
 });
}
export function selectAccountingSheet(sheets:readonly AccountingSheet[],family:AccountingFamily):AccountingSheet{
 if(!Array.isArray(sheets)||sheets.length<1||sheets.length>32)throw Error('ACCOUNTING_XLSX_SHEET_LIMIT');
 const matches=sheets.filter(s=>recognized(s,family));
 if(matches.length!==1)throw Error(matches.length?'ACCOUNTING_XLSX_MULTIPLE_SOURCE_SHEETS':'ACCOUNTING_XLSX_SOURCE_SHEET_NOT_FOUND');
 return {...matches[0],rows:matches[0].rows.map(r=>Array.from({length:r.length},(_,i)=>String(r[i]??'')))};
}
