import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {extractXlsxSheets} from '../lib/credit-engine/server/document-extraction.ts';
import {selectAccountingSheet} from '../lib/workspace/accounting-xlsx-scope.ts';
import {nativePartyLedger} from '../lib/workspace/one-c-ledger.ts';

const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
function xml(title,account){
 const r=(idx,cells)=>'<row r="'+idx+'">'+cells.map(([col,v])=>'<c r="'+col+idx+'" t="str"><v>'+esc(v)+'</v></c>').join('')+'</row>';
 return '<worksheet><sheetData>'+[
  r(1,[['A',title]]),
  r(2,[['A','Организация ТЕСТ']]),
  r(3,[['A','Период с 01.05.2024 по 19.05.2025']]),
  r(4,[['A','Счет'],['F','Сальдо на конец периода']]),
  r(5,[['A','Контрагенты'],['F','Дебет'],['G','Кредит']]),
  r(6,[['A',account],['G','150']]),
  r(7,[['A',account+'.01'],['G','100']]),
  r(8,[['A','ООО Кредитор'],['G','100']]),
  r(9,[['A',account+'.02'],['G','50']]),
  r(10,[['A','ООО Кредитор'],['G','50']]),
  r(11,[['A','Итого'],['G','150']])
 ].join('')+'</sheetData></worksheet>';
}
const book=(...data)=>zipSync(Object.fromEntries(data.map((d,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',strToU8(d)])));

test('Multiple account workbooks cannot mix 60 and 62 into a single counterparty ledger',()=>{
 const bytes=book(xml('Оборотно-сальдовая ведомость по счету 60 за 2025 год','60'),xml('Оборотно-сальдовая ведомость по счету 62 за 2025 год','62'));
 assert.throws(()=>selectAccountingSheet(extractXlsxSheets(bytes),'OSV'),/ACCOUNTING_XLSX_MULTIPLE_SOURCE_SHEETS/);
});
test('Cover sheet plus one native account 67 preserves selected table and reconciles balances',()=>{
 const bytes=book('<worksheet><sheetData><row r="1"><c r="A1" t="str"><v>Обложка</v></c></row></sheetData></worksheet>',xml('Оборотно-сальдовая ведомость по счету 67','67'));
 const sheets=extractXlsxSheets(bytes);const selected=selectAccountingSheet(sheets,'OSV');
 assert.equal(selected.sheet,'sheet2.xml');
 const lines=nativePartyLedger(selected.rows,'7700000000',true,'DEBT_LEDGER','ОСВ по счету 67 за 01.05.2024 - 19.05.2025.xlsx');
 assert.deepEqual(lines.map(x=>x.account),['67.01','67.02']);
 assert.deepEqual(lines.map(x=>x.credit),[100,50]);
 assert.ok(lines.every(x=>x.contract===null));
});
test('Unrelated workbook is not assigned to account 51 or receivables by filename',()=>{
 const bytes=book(xml('Реестр договоров','67'));
 assert.throws(()=>selectAccountingSheet(extractXlsxSheets(bytes),'ACCOUNT_51'),/ACCOUNTING_XLSX_SOURCE_SHEET_NOT_FOUND/);
 assert.throws(()=>selectAccountingSheet(extractXlsxSheets(bytes),'OSV'),/ACCOUNTING_XLSX_SOURCE_SHEET_NOT_FOUND/);
});
