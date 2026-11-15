/** Conservative bank XLSX intake for an already-extracted Excel cell matrix.
 * The raw source is never rewritten as a fictitious 1C bank statement.
 * A preview cannot affect B-Score until source/owner/coverage are independently verified.
 */
export const BANK_XLSX_INTAKE_VERSION = 'PRESCORE-BANK-XLSX-INTAKE-0.1';
export type BankXlsxRow = readonly (string | number | boolean | null | undefined)[];
export type BankXlsxOperation = {
  row: number;
  postedAt: string;
  direction: 'IN' | 'OUT';
  amountMinor: number;
  purpose: string;
  documentNumber: string | null;
  debitAccountText: string | null;
  creditAccountText: string | null;
};
export type BankXlsxPreview = {
  version: typeof BANK_XLSX_INTAKE_VERSION;
  format: 'SBER_BUSINESS_OPERATIONS_XLSX' | 'UNSUPPORTED';
  status: 'REVIEW_REQUIRED' | 'UNSUPPORTED';
  account: string | null;
  ownerInn: null;
  periodFrom: string | null;
  periodTo: string | null;
  currency: 'RUB' | null;
  operations: BankXlsxOperation[];
  totalInMinor: number;
  totalOutMinor: number;
  warnings: string[];
  automaticApply: false;
  scoreUpdated: false;
};
const cell=(row:BankXlsxRow|undefined,index:number)=>String(row?.[index]??'').trim();
const single=(s:string)=>s.replace(/[\s\u00a0\u202f]+/gu,' ').trim();
const date=(s:string):string|null=>{
  const m=/^(\d{4})-(\d{2})-(\d{2})(?=[ T]|$)/.exec(s)
    ?? /^(\d{2})\.(\d{2})\.(\d{4})(?=\s|$)/.exec(s);
  if(!m)return null;
  const iso=(m[1].length===4?[m[1],m[2],m[3]]:[m[3],m[2],m[1]]).join('-');
  const d=new Date(iso+'T00:00:00Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:null;
};
function amount(s:string):number|null{
  const txt=s.replace(/[\s\u00a0\u202f]/gu,'').replace(',','.');
  if(!txt)return null;
  if(!/^\d+(?:\.\d{1,2})?$/.test(txt))throw Error('BANK_XLSX_BAD_AMOUNT');
  const n=Math.round(Number(txt)*100);
  if(!Number.isSafeInteger(n)||n<=0)throw Error('BANK_XLSX_BAD_AMOUNT');
  return n;
}
const accountPattern=/(?:^|[^\d])((?:40[5-8]|42[0-3])\d{17})(?!\d)/g;
export function inspectSberBusinessXlsxRows(rows:readonly BankXlsxRow[],rowNumbers?:readonly number[]):BankXlsxPreview{
  if(!Array.isArray(rows)||rows.length>100_000)throw Error('BANK_XLSX_ROW_LIMIT');
  const output:BankXlsxPreview={version:BANK_XLSX_INTAKE_VERSION,format:'UNSUPPORTED',status:'UNSUPPORTED',
    account:null,ownerInn:null,periodFrom:null,periodTo:null,currency:null,operations:[],
    totalInMinor:0,totalOutMinor:0,warnings:[],automaticApply:false,scoreUpdated:false};
  if(rows.some(r=>r.length>120||r.some(c=>String(c??'').length>15_000)))throw Error('BANK_XLSX_CELL_LIMIT');
  const head=rows.slice(0,35);
  const sber=head.some(r=>r.some(c=>/сбербизнес|пао\s+сбербанк/iu.test(String(c??''))));
  const headerIndex=head.findIndex(r=>r.some(c=>/дата\s+проводки/iu.test(String(c??'')))
     &&r.some(c=>/сумма\s+по\s+дебету/iu.test(String(c??'')))
     &&r.some(c=>/сумма\s+по\s+кредиту/iu.test(String(c??''))));
  if(!sber||headerIndex<0){output.warnings.push('BANK_XLSX_FORMAT_UNSUPPORTED');return output;}
  output.format='SBER_BUSINESS_OPERATIONS_XLSX';output.status='REVIEW_REQUIRED';
  const hdr=rows[headerIndex];
  const column=(name:RegExp)=>hdr.findIndex(c=>name.test(single(String(c??''))));
  const dateCol=column(/дата\s+проводки/iu),debitCol=column(/сумма\s+по\s+дебету/iu),creditCol=column(/сумма\s+по\s+кредиту/iu);
  const docCol=column(/^№\s*документа/iu),purposeCol=column(/назначение\s+платежа/iu);
  if([dateCol,debitCol,creditCol,purposeCol].some(x=>x<0))throw Error('BANK_XLSX_HEADER_INCOMPLETE');
  const namedAccounts=new Set<string>();
  for(const r of head.slice(0,headerIndex))for(const c of r){
    const s=String(c??'');for(const m of s.matchAll(accountPattern))namedAccounts.add(m[1]);
    if(/российский\s+рубль|\bRUB\b|\b643\b/iu.test(s))output.currency='RUB';
  }
  if(namedAccounts.size===1)output.account=[...namedAccounts][0];
  else output.warnings.push(namedAccounts.size>1?'BANK_XLSX_MULTIPLE_OWN_ACCOUNTS':'BANK_XLSX_ACCOUNT_NOT_PROVEN');
  if(!output.currency)output.warnings.push('BANK_XLSX_CURRENCY_UNCONFIRMED');
  output.warnings.push('BANK_XLSX_OWNER_INN_UNCONFIRMED');
  const accountCol=column(/^сч[её]т$/iu);
  const next=rows[headerIndex+1]??[];
  const debitPartyCol=accountCol>=0&&/^дебет$/iu.test(cell(next,accountCol))?accountCol:-1;
  const creditPartyCol=accountCol>=0?next.findIndex((s,i)=>i>accountCol&&/^кредит$/iu.test(single(String(s??'')))):-1;
  const hasSecondaryHeader=next.some(c=>/^(?:дебет|кредит)$/iu.test(single(String(c??''))));
  let totalIn=0,totalOut=0,seenDates:string[]=[];
  for(let i=headerIndex+(hasSecondaryHeader?2:1);i<rows.length;i++){
    const row=rows[i],rawDate=cell(row,dateCol),debitText=cell(row,debitCol),creditText=cell(row,creditCol);
    if(!rawDate&&!debitText&&!creditText)continue;
    const d=date(rawDate);
    if(!d){if(debitText||creditText)throw Error('BANK_XLSX_TRANSACTION_DATE_INVALID');continue;}
    const db=amount(debitText),cr=amount(creditText);
    if(db!==null&&cr!==null)throw Error('BANK_XLSX_BOTH_DIRECTIONS');
    if(db===null&&cr===null)throw Error('BANK_XLSX_TRANSACTION_AMOUNT_MISSING');
    const purpose=cell(row,purposeCol);
    if(!purpose)throw Error('BANK_XLSX_PURPOSE_MISSING');
    const minor=db??cr!;
    if(db!==null)totalOut+=minor;else totalIn+=minor;
    if(!Number.isSafeInteger(totalIn)||!Number.isSafeInteger(totalOut))throw Error('BANK_XLSX_TOTAL_OVERFLOW');
    output.operations.push({row:rowNumbers?.[i]??i+1,postedAt:d,direction:db!==null?'OUT':'IN',amountMinor:minor,
      purpose,documentNumber:docCol<0?null:cell(row,docCol)||null,
      debitAccountText:debitPartyCol<0?null:cell(row,debitPartyCol)||null,
      creditAccountText:creditPartyCol<0?null:cell(row,creditPartyCol)||null});
    seenDates.push(d);
  }
  output.totalInMinor=totalIn;output.totalOutMinor=totalOut;
  if(!output.operations.length)output.warnings.push('BANK_XLSX_NO_OPERATIONS');
  if(seenDates.length){seenDates.sort();output.periodFrom=seenDates[0];output.periodTo=seenDates.at(-1)!;}
  return output;
}

export type BankXlsxBookPreview={
 version:typeof BANK_XLSX_INTAKE_VERSION;
 format:'SBER_BUSINESS_XLSX_WORKBOOK'|'UNSUPPORTED';
 status:'REVIEW_REQUIRED'|'UNSUPPORTED';
 sheets:Array<{name:string;preview:BankXlsxPreview}>;
 totalOperations:number;
 accountCount:number;
 warnings:string[];
 automaticApply:false;
 scoreUpdated:false;
};
export function inspectSberBusinessWorkbook(sheets:readonly {sheet:string;rows:readonly BankXlsxRow[];rowNumbers?:readonly number[]}[]):BankXlsxBookPreview{
 if(!sheets.length||sheets.length>32)throw Error('BANK_XLSX_SHEET_LIMIT');
 const previews=sheets.map(s=>({name:s.sheet,preview:inspectSberBusinessXlsxRows(s.rows,s.rowNumbers)}));
 const accepted=previews.filter(s=>s.preview.format==='SBER_BUSINESS_OPERATIONS_XLSX');
 const accounts=new Set(accepted.map(s=>s.preview.account).filter((x):x is string=>!!x));
 const totalOperations=accepted.reduce((sum,s)=>sum+s.preview.operations.length,0);
 const warnings=[...new Set([...previews.flatMap(s=>s.preview.warnings),
  ...(previews.length!==accepted.length?['BANK_XLSX_UNSUPPORTED_SHEETS']:[]),
  ...(accepted.some(s=>!s.preview.account)?['BANK_XLSX_SHEET_ACCOUNT_UNCONFIRMED']:[]),
  ...(totalOperations===0?['BANK_XLSX_NO_OPERATIONS']:[])])];
 return {version:BANK_XLSX_INTAKE_VERSION,format:accepted.length?'SBER_BUSINESS_XLSX_WORKBOOK':'UNSUPPORTED',
  status:accepted.length?'REVIEW_REQUIRED':'UNSUPPORTED',sheets:previews,totalOperations,
  accountCount:accounts.size,warnings,automaticApply:false,scoreUpdated:false};
}
