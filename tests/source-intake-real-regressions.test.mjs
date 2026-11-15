import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePartyLedger} from '../lib/workspace/one-c-ledger.ts';
import {parseAuthoritativeBfoText} from '../lib/credit-engine/source-foundation.ts';

const osvn='Оборотно-сальдовая ведомость по счету 67 за 01.05.2024 - 19.05.2025.xlsx';
const line=(name,debit='',credit='')=>[name,'','','','',debit,credit];
const rows=()=>[
 ['Тестовая организация','','','','','',''],
 ['Оборотно-сальдовая ведомость по счету 67','','','','','',''],
 ['','','','','','',''],['Счет','','','','','Сальдо на конец периода',''],
 ['Контрагенты','Дебет','Кредит','','','Дебет','Кредит'],
 line('67','','150'),line('67.01','','100'),line('Банк А','','100'),
 line('67.02','','50'),line('Банк А','','50'),line('Итого','','150')
];
const sample=[
 'Организация Общество с ограниченной ответственностью ТЕСТ по ОКПО 12345678',
 'Идентификационный номер налогоплательщика ИНН 7701234567',
 'Единица измерения: в тыс. рублей по ОКЕИ 384',
 'Бухгалтерский баланс','за 2024 год',
 'Внеоборотные активы 1100 880 800', 'Оборотные активы 1200 470 420',
 'Дебиторская задолженность 1230 120 110', 'БАЛАНС 1600 1350 1220',
 'Капитал и резервы 1300 800 700',
 'Долгосрочные обязательства 1400 200 200','Краткосрочные обязательства 1500 350 320',
 'Отчет о финансовых результатах','За 2024 год','За 2023 год',
 'Выручка 2110 1700 1500','Чистая прибыль (убыток) 2400 100 80'
].join('\n');
const bfo=text=>parseAuthoritativeBfoText({text,fileName:'annual.xlsx',analysisInn:'7701234567'});

test('1C OSV: subaccounts and closing balances parse without inventing loan contracts',()=>{
 const out=nativePartyLedger(rows(),'7700000000',true,'DEBT_LEDGER',osvn);
 assert.deepEqual(out.map(x=>x.account),['67.01','67.02']);
 assert.deepEqual(out.map(x=>x.credit),[100,50]);
 assert.ok(out.every(x=>x.contract===null&&x.asOf==='2025-05-19'));
});
test('1C OSV: no source INN requires explicit owner confirmation',()=>{
 assert.throws(()=>nativePartyLedger(rows(),'7700000000',false,'DEBT_LEDGER',osvn),/Подтвердите принадлежность/);
});
test('1C OSV: mismatched subsection sums never pass',()=>{
 const bad=rows();bad[7]=line('Банк А','','99');
 assert.throws(()=>nativePartyLedger(bad,'7700000000',true,'DEBT_LEDGER',osvn),/не сходится/);
});
test('1C OSV: source filename without a dated period is not accepted',()=>{
 assert.throws(()=>nativePartyLedger(rows(),'7700000000',true,'DEBT_LEDGER','osv.xlsx'),/период/);
});
test('1C OSV: unrelated account grouping cannot be treated as a counterparty',()=>{
 const bad=rows();bad.splice(9,0,line('76.05'));
 assert.throws(()=>nativePartyLedger(bad,'7700000000',true,'DEBT_LEDGER',osvn),/отдельная проверка/);
});
test('1C OSV: blank final balances do not manufacture a principal balance',()=>{
 const empty=rows().map(x=>[...x]);for(let i=5;i<empty.length;i++){empty[i][5]='';empty[i][6]='';}
 assert.deepEqual(nativePartyLedger(empty,'7700000000',true,'DEBT_LEDGER',osvn),[]);
});
test('BFO: allows comparative columns of the same annual report',()=>{
 const r=bfo(sample);
 assert.equal(r.financialMetadataV2.period.year,2024);
 assert.equal(r.values.assets,1_350_000);
});
test('BFO: allows third comparative year without accepting additional report',()=>{
 assert.equal(bfo(sample+'\nна 31.12.2022: сравнительная дата').financialMetadataV2.period.year,2024);
});
test('BFO: refuses concatenated separate annual forms',()=>{
 assert.throws(()=>bfo(sample+'\n'+sample),/неоднозначные годовые периоды|несколько форм/);
});
test('BFO: refuses years outside reporting period',()=>{
 assert.throws(()=>bfo(sample+'\nЗа 2020 год'),/неоднозначные годовые периоды/);
});
test('BFO: refuses different company INN',()=>{
 assert.throws(()=>parseAuthoritativeBfoText({text:sample,fileName:'annual.xlsx',analysisInn:'7812345678'}),/ИНН.*не совпадает/);
});
