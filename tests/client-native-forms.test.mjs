import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLedger} from '../lib/workspace/ledger-import.ts';
import {ledgerObservations} from '../lib/workspace/ledger-observations.ts';
import {oneCPeriod} from '../lib/workspace/one-c-period.ts';
import {nativePartyLedger} from '../lib/workspace/one-c-ledger.ts';
import {parseAccount51Card} from '../lib/workspace/account51-card.ts';
import {settlementPositions} from '../lib/workspace/settlement-positions.ts';

test('Recognized 1C months, quarter and leap-year end dates',()=>{
 assert.deepEqual(oneCPeriod('Карточка счета 51 за Октябрь 2023 г. - Сентябрь 2024 г.'),{from:'2023-10-01',to:'2024-09-30'});
 assert.deepEqual(oneCPeriod('ОСВ за 1 квартал 2024 г.'),{from:'2024-01-01',to:'2024-03-31'});
 assert.equal(oneCPeriod('Отчёт за Февраль 2024 г.').to,'2024-02-29');
 assert.equal(oneCPeriod('Отчёт за 30.02.2024 - 01.03.2024'),null);
});
test('Account 76 joins the existing debt portfolio only with identified principal and contract',()=>{
 const table='ИНН организации\tДата остатка\tСчёт\tКонтрагент\tДоговор\tДебет, руб.\tКредит, руб.\tВид задолженности\n';
 const row='9909000011\t2024-03-31\t76.01\tУчебный кредитор\tК-1\t\t400\t';
 const ledger=parseLedger(table+row+'Основной долг','9909000011','DEBT_LEDGER');
 const source={id:'s',kind:'DEBT_LEDGER',documentId:'d',payload:{envelope:{companyInn:'9909000011'},ledger}};
 assert.equal(ledgerObservations([source],'9909000011')[0].value,400);
 assert.equal(ledgerObservations([{...source,kind:'COUNTERPARTIES'}],'9909000011').length,1);
 assert.throws(()=>parseLedger(table+row+'Услуги','9909000011','DEBT_LEDGER'));
});
const rows=[['Учебная компания'],['Оборотно-сальдовая ведомость по счету 60 за 1 квартал 2024 г.'],[],['Счет','','Сальдо на начало периода','','Обороты за период','','Сальдо на конец периода',''],['Контрагенты','','Дебет','Кредит','Дебет','Кредит','Дебет','Кредит'],[],['60','','','100','100','80','','80'],['Учебный поставщик','','','100','100','80','','80'],['Закрытый пример','','','30','30','','',''],['Итого','','','130','130','80','','80']];
test('Native OSV requires explicit company, reconciles terminal balances and retains settled zero',()=>{
 assert.throws(()=>nativePartyLedger(rows,'9909000011',false));
 const parsed=nativePartyLedger(rows,'9909000011',true);
 assert.equal(parsed.length,2);assert.equal(parsed[0].credit,80);assert.equal(parsed[0].contract,null);assert.equal(parsed[1].credit,0);assert.equal(parsed[0].asOf,'2024-03-31');
 const changed=structuredClone(rows);changed.at(-1)[7]='200';assert.throws(()=>nativePartyLedger(changed,'9909000011',true));
});
test('Native card uses column labels and recognizes debit and credit turnovers with closing balance',()=>{
 const header=['Период','Документ','','Аналитика Дт','Аналитика Кт','Дебет','','','Кредит','','','Текущее сальдо',''];
 const card=parseAccount51Card([['Карточка счета 51 за Февраль 2024 г.'],header,['','','','','','Счет','','','Счет'],['Сальдо на начало','','','','','','','','','','','Д',100],['01.02.2024','Учебный платёж','','Расчётный счёт','Покупатель','51',50,'','62','','','Д',150],['Обороты за период и сальдо на конец','','','','',50,'','',0,'','','Д',150]]);
 assert.equal(card.closingBalance,150);assert.equal(card.operations[0].analytic,'Покупатель');assert.equal(card.reconciled,true);
});
test('A party-level aggregate and a contractual breakdown cannot become two independent debts',()=>{
 const source=(id,ledger)=>({id,kind:'COUNTERPARTIES',payload:{ledger,envelope:{}}});
 const [party]=nativePartyLedger(rows,'9909000011',true);
 const mixed=settlementPositions([source('a',[party]),source('b',[{...party,account:'60.01',contract:'К-1'}])]);assert.ok(mixed.every(p=>p.conflict));
});
