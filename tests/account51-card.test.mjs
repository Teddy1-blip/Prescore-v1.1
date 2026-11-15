import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAccount51Card} from '../lib/workspace/account51-card.ts';
import {extractXlsxRows} from '../lib/credit-engine/server/document-extraction.ts';
import {buildXlsx} from '../lib/excel-export.ts';
const head = [
  ['ООО «Тест»'],['Карточка счета 51 за 01.01.2025 - 30.06.2025'],[],
  ['Выводимые данные: БУ'],[],
  ['Период','Документ','Аналитика Дт','Аналитика Кт','Дебет','','','Кредит','','','Текущее сальдо'],
  ['','','','','Счет','','','Счет'],
  ['Сальдо на начало','','','','','','','','','','Д',1000]
];
const incoming = ['15.01.2025','Поступление\nпо договору № 1','Банк','Покупатель','51',250,'','62.01','','','Д',1250];
const outgoing = ['16.01.2025','Оплата поставщику','Поставщик','Банк','60.01','','','51',150,'','Д',1100];
test('Structured 1C card 51 preserves embedded newlines, debit/credit direction and balances',()=>{
 const c=parseAccount51Card([...head,incoming,outgoing,['Сальдо на конец','','','','','','','','','','Д',1100]]);
 assert.equal(c.operations.length,2);
 assert.equal(c.operations[0].direction,'INFLOW');
 assert.equal(c.operations[0].document,'Поступление\nпо договору № 1');
 assert.equal(c.operations[0].correspondingAccount,'62.01');
 assert.equal(c.operations[1].direction,'OUTFLOW');
 assert.equal(c.operations[1].correspondingAccount,'60.01');
 assert.deepEqual([c.openingBalance,c.closingBalance,c.reconciled],[1000,1100,true]);
});
test('Balance discrepancy stays visible and amounts are not silently corrected',()=>{
 const bad=[...outgoing];bad[11]=1200;
 const c=parseAccount51Card([...head,incoming,bad]);
 assert.equal(c.operations.at(-1).balanceAfter,1200);
 assert.equal(c.reconciled,false);
 assert.ok(c.warnings.some(w=>w.startsWith('ACCOUNT51_RUNNING_BALANCE_MISMATCH')));
});
test('No ambiguous entry is accepted as account 51 cash flow',()=>{
 const x=[...outgoing];x[4]='60.01';x[7]='62.01';
 assert.throws(()=>parseAccount51Card([...head,x]),/ACCOUNT51_AMBIGUOUS_POSTING/);
});
test('Invalid or missing dates cannot become confirmed 51 movements',()=>{
 const x=[...incoming];x[0]='31.02.2025';
 assert.throws(()=>parseAccount51Card([...head,x]),/ACCOUNT51_BAD_DATE/);
});

test('XLSX keeps one multiline description inside one posting row',()=>{
 const bytes=buildXlsx([{name:'Card 51',rows:[...head,incoming,outgoing]}]);
 const rows=extractXlsxRows(bytes);
 const card=parseAccount51Card(rows);
 assert.equal(card.operations.length,2);
 assert.equal(card.operations[0].document,'Поступление\nпо договору № 1');
 assert.equal(card.operations[1].amount,150);
 assert.equal(card.reconciled,true);
});

test('Internal 51-to-51 transfer does not create external cash movement',()=>{
 const transfer=['17.01.2025','Between own bank accounts','Own A','Own B','51',500,'','51',500,'','Д',1100];
 const card=parseAccount51Card([...head,incoming,outgoing,transfer]);
 assert.equal(card.operations.at(-1).direction,'INTERNAL_TRANSFER');
 assert.equal(card.operations.at(-1).amount,500);
 assert.equal(card.reconciled,true);
});
test('Unbalanced internal transfer needs review rather than being netted',()=>{
 const transfer=['17.01.2025','Between own bank accounts','Own A','Own B','51',500,'','51',499,'','Д',1100];
 assert.throws(()=>parseAccount51Card([...head,incoming,outgoing,transfer]),/ACCOUNT51_INTERNAL_TRANSFER_UNBALANCED/);
});
test('Negative 1C debit balance remains visible and cannot pass clean reconciliation',()=>{
 const debit=['17.01.2025','Additional payment','Vendor','Bank','60.01','','','51',2500,'','Д',-1400];
 const card=parseAccount51Card([...head,incoming,outgoing,debit]);
 assert.equal(card.operations.at(-1).balanceAfter,-1400);
 assert.equal(card.reconciled,false);
 assert.ok(card.warnings.some(code=>code.startsWith('ACCOUNT51_NEGATIVE_DEBIT_BALANCE:')));
});

test('Account 51 audit row points to original worksheet after empty physical row',()=>{
 const source=[...head,incoming,outgoing,['Сальдо на конец','','','','','','','','','','Д',1100]];
 const physical=source.map((_,i)=>i<2?i+1:i+2); // physical Excel row 3 is empty
 const card=parseAccount51Card(source,physical);
 assert.deepEqual(card.operations.map(o=>o.row),[physical[head.length],physical[head.length+1]]);
 assert.equal(card.reconciled,true);
});
test('Account 51 refuses invalid physical row evidence map',()=>{
 const source=[...head,incoming,outgoing];
 const physical=source.map((_,i)=>i+1);physical[8]=physical[7];
 assert.throws(()=>parseAccount51Card(source,physical),/ACCOUNT51_SOURCE_ROWS_INVALID/);
});
