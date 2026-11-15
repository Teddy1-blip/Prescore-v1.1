import test from 'node:test';
import assert from 'node:assert/strict';
import {extractContractReview} from '../lib/document-poc/contract-facts.ts';
const make=(logicalPage,text)=>({page:Math.ceil(logicalPage/2),logicalPage,segment:logicalPage%2?'LEFT':'RIGHT',method:'OCR',text});
const pages=[
 make(1,`Договор № ТЕСТ-100
г. Москва «12» марта 2025г.
2.1. Субподрядчик обязан выполнить работы в сроки:
— начало — не позднее 17.03.2025г.
— окончание — не позднее 28.06.2025 года.
3.1. Цена Договора составляет 100 000 000 (словами) рублей 00 копеек, включая НДС 20%.`),
 make(4,`5.1. Генподрядчик в течение 7 (семи) рабочих дней с момента заключения Договора вправе перечислить аванс в размере до 20% от цены Договора.
5.2. Генподрядчик производит оплату за фактически принятые работы не позднее 7 (семи) рабочих дней после подписания акта КС-2 и справки КС-3.
5.3. Окончательный расчет не позднее 7 (семи) рабочих дней с момента подписания акта о приёмке.`),
 make(16,`11. Срок действия Договора
1. Договор вступает в силу с момента его заключения и действует до полного исполнения Сторонами своих обязательств.`),
];
const get=x=>Object.fromEntries(extractContractReview(x).facts.map(f=>[f.key,f]));
test('synthetic terms include exact advance ceiling, not paid balance',()=>{
 const facts=get(pages);
 assert.equal(facts.CONTRACT_DATE.value,'2025-03-12');
 assert.equal(facts.CONTRACT_AMOUNT.value,'100000000');
 assert.equal(facts.ADVANCE_MAX_PERCENT.value,'20');
 assert.equal(facts.ADVANCE_MAX_ESTIMATE.value,'20000000');
 assert.equal(facts.WORK_START.value,'17.03.2025');
 assert.equal(facts.WORK_END.value,'28.06.2025');
 assert.match(facts.FINAL_PAYMENT.value,/7 рабочих дней/);
 assert.match(facts.CONTRACT_DURATION.value,/полного исполнения/);
 for(const k of ['CONTRACT_AMOUNT','ADVANCE_MAX_PERCENT','FINAL_PAYMENT'])assert.ok(facts[k].pdfPage&&facts[k].sourceText&&facts[k].status==='REVIEW');
});
test('no invented assignment permission, payment schedule or due date',()=>{
 const facts=get(pages);
 for(const k of ['ASSIGNMENT','PAYMENT_SCHEDULE','TITLE_TRANSFER'])assert.equal(facts[k].value,null);
 assert.equal(facts.ASSIGNMENT.status,'UNKNOWN');
 assert.match(facts.PAYMENT_SCHEDULE.note,/не подтверждён/);
});
test('missing agreement data remains unknown',()=>{
 const facts=get([make(1,'Договор. Нет читаемых денежных условий.')]);
 for(const key of ['CONTRACT_DATE','CONTRACT_AMOUNT','ADVANCE_MAX_PERCENT','ADVANCE_MAX_ESTIMATE','FINAL_PAYMENT','WORK_END'])assert.equal(facts[key].value,null);
});
test('OCR 2.1 punctuation normalization, no invented deadlines',()=>{
 const bad=pages.map(x=>({...x,text:x.text.replaceAll('28.06.2025','28,06.2025')}));
 assert.equal(get(bad).WORK_END.value,'28.06.2025');
});
