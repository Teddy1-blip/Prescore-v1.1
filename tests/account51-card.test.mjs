import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAccount51Card} from '../lib/workspace/account51-card.ts';
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
