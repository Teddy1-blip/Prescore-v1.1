import test from 'node:test';import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {extractXlsxSheets} from '../lib/credit-engine/server/document-extraction.ts';
import {inspectSberBusinessWorkbook} from '../lib/workspace/bank-xlsx-intake.ts';
const sheet=(account)=>{
 const c=(ref,txt)=>'<c r="'+ref+'" t="str"><v>'+txt+'</v></c>';
 const row=(n,cells)=>'<row r="'+n+'">'+cells.join('')+'</row>';
 return '<worksheet><sheetData>'+
 row(1,[c('B1','ПАО СБЕРБАНК'),c('C1','СберБизнес'),c('M1',account)])+
 row(2,[c('D2','Российский рубль')])+
 row(3,[c('B3','Дата проводки'),c('K3','Сумма по дебету'),c('O3','Сумма по кредиту'),c('V3','Назначение платежа')])+
 row(4,[])+
 row(5,[c('B5','2025-05-01 09:00:00'),c('O5','1234.50'),c('V5','Оплата по договору')])+
 row(6,[c('B6','2025-05-02 12:00:00'),c('K6','200.75'),c('V6','Оплата услуг')])+'</sheetData></worksheet>';
};
const bytes=zipSync(Object.fromEntries(['40702810205500005040','40702810505500005041','40702810905500005042'].map((a,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',strToU8(sheet(a))])));
test('Three-sheet bank workbook preserves each settlement account and no-score boundary',()=>{
 const r=inspectSberBusinessWorkbook(extractXlsxSheets(bytes));
 assert.equal(r.format,'SBER_BUSINESS_XLSX_WORKBOOK');assert.equal(r.accountCount,3);
 assert.equal(r.totalOperations,6);assert.equal(r.automaticApply,false);assert.equal(r.scoreUpdated,false);
 assert.ok(r.sheets.every(s=>s.preview.operations.length===2));
});
test('Unrecognized worksheet never silently joins a recognized bank statement',()=>{
 const sheets=extractXlsxSheets(bytes);sheets[1].rows[0]=['Другой банк'];
 const r=inspectSberBusinessWorkbook(sheets);
 assert.equal(r.totalOperations,4);assert.ok(r.warnings.includes('BANK_XLSX_UNSUPPORTED_SHEETS'));
});
