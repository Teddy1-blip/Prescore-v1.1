import test from 'node:test';import assert from 'node:assert/strict';
import {selectAccountingSheet} from '../lib/workspace/accounting-xlsx-scope.ts';
const a=(sheet,title)=>({sheet,rows:[[title],['Счет','Сальдо на конец периода']]});
test('OSV 60 and 62 from two tabs must never be merged',()=>{
 const data=[a('sheet1','Оборотно-сальдовая ведомость по счету 60 за 2025 год'),a('sheet2','Оборотно-сальдовая ведомость по счету 62 за 2025 год')];
 assert.throws(()=>selectAccountingSheet(data,'OSV'),/ACCOUNTING_XLSX_MULTIPLE_SOURCE_SHEETS/);
});
test('Card 51 and separate bank schedule do not merge',()=>{
 const data=[a('sheet1','Карточка счета 51 за 2025 год'),a('sheet2','График платежей')];
 assert.equal(selectAccountingSheet(data,'ACCOUNT_51').sheet,'sheet1');
});
test('OSV 66 with an unrelated cover page is supported',()=>{
 const data=[a('sheet1','Отчёт'),a('sheet2','Оборотно-сальдовая ведомость по счету 66 за 2025 год')];
 assert.equal(selectAccountingSheet(data,'OSV').sheet,'sheet2');
});
test('Two account 51 cards with different periods are not silently consolidated',()=>{
 const data=[a('sheet1','Карточка счета 51 за 2024 год'),a('sheet2','Карточка счета 51 за 2025 год')];
 assert.throws(()=>selectAccountingSheet(data,'ACCOUNT_51'),/ACCOUNTING_XLSX_MULTIPLE_SOURCE_SHEETS/);
});
test('No recognized accounting source cannot borrow its identity from filename',()=>{
 assert.throws(()=>selectAccountingSheet([a('sheet1','Договор поставки')],'OSV'),/ACCOUNTING_XLSX_SOURCE_SHEET_NOT_FOUND/);
});
test('Single normalized OSV ledger sheet remains supported',()=>{
 const header=['ИНН организации','Дата остатка','Счёт','Контрагент','Договор','Дебет, руб.','Кредит, руб.'];
 const sheets=[a('cover','Титульная страница'),{sheet:'ledger',rows:[header,['7701000000','2025-06-30','62','ООО ТЕСТ','Т-1','1200','']] }];
 assert.equal(selectAccountingSheet(sheets,'OSV').sheet,'ledger');
});
test('Two different recognized normalized ledgers never merge',()=>{
 const header=['ИНН организации','Дата остатка','Счёт','Контрагент','Договор','Дебет, руб.','Кредит, руб.'];
 assert.throws(()=>selectAccountingSheet([{sheet:'60',rows:[header]},{sheet:'62',rows:[header]}],'OSV'),/ACCOUNTING_XLSX_MULTIPLE_SOURCE_SHEETS/);
});
test('Sparse XLSX row cells become empty strings without changing nonempty values',()=>{
 const rows=[[undefined,'Карточка счета 51 за 2024 год'],['Период',undefined,'2024']];
 const parsed=selectAccountingSheet([{sheet:'card',rows}],'ACCOUNT_51');
 assert.deepEqual(parsed.rows,[['','Карточка счета 51 за 2024 год'],['Период','','2024']]);
});
