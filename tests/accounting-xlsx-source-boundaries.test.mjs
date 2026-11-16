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

test('physical Excel row number for grouped 1C OSV is preserved across missing sheet rows',()=>{
 const r=(idx,cells)=>'<row r="'+idx+'">'+cells.map(([col,v])=>'<c r="'+col+idx+'" t="str"><v>'+esc(v)+'</v></c>').join('')+'</row>';
 const cells=[
   r(1,[['A','Оборотно-сальдовая ведомость по счету 67 за 01.01.2024 - 21.05.2025']]),
   r(4,[['A','Счет'],['F','Сальдо на конец периода']]),
   r(5,[['A','Контрагенты'],['F','Дебет'],['G','Кредит']]),
   r(6,[['A','Контрагенты.ИНН']]),
   r(8,[['A','67'],['G','150']]),
   r(10,[['A','67.01'],['G','150']]),
   r(13,[['A','Банк Контрольный'],['G','100']]),
   r(14,[['A','7707083893'],['G','100']]),
   r(17,[['A','Контрагент без ИНН'],['G','50']]),
   r(18,[['A',''],['G','50']]),
   r(20,[['A','Итого'],['G','150']]),
 ];
 const original=book('<worksheet><sheetData>'+cells.join('')+'</sheetData></worksheet>');
 const selected=selectAccountingSheet(extractXlsxSheets(original),'OSV');
 const balances=nativePartyLedger(selected.rows,'7700000000',true,'DEBT_LEDGER','',selected.rowNumbers);
 assert.deepEqual(balances.map(x=>x.row),[13,17]);
 assert.deepEqual(balances.map(x=>x.credit),[100,50]);
 assert.equal(balances[0].partyInn,'7707083893');
 assert.equal(balances[1].partyInn,undefined,'blank tax id must not be invented');
 assert.ok(balances.every(x=>x.asOf==='2025-05-21'));
});
test('source row map must match matrix and be strictly increasing',()=>{
 const selected=selectAccountingSheet(extractXlsxSheets(book(xml('Оборотно-сальдовая ведомость по счету 67','67'))),'OSV');
 for(const invalid of [selected.rowNumbers.slice(1),selected.rowNumbers.map(()=>1),
                         selected.rowNumbers.map((v,i)=>i===3?0:v)]){
   assert.throws(()=>nativePartyLedger(selected.rows,'7700000000',true,'DEBT_LEDGER','ОСВ по счету 67 за 01.05.2024 - 19.05.2025.xlsx',invalid),
     /ACCOUNTING_XLSX_SOURCE_ROWS_INVALID/);
 }
});
