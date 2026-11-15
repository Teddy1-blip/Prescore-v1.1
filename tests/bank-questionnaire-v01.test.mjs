import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectQuestionnaireRows} from '../lib/document-poc/bank-questionnaire.ts';
const sample=()=>[
 ['Анкета-Заявка Клиента'],
 ['','1.1. Полное наименование','','ООО ТЕСТ'],
 ['','1.2. ОГРН','','1185007010264','','1.3. Дата регистрации:','','13 сентября 2018 года'],
 ['','1.4. ИНН','','5042149315','','1.5. Вид деятельности','','Торговля'],
 ['','1.12. Сумма кредитного продукта','','1000000','','Валюта кредита','','Российский рубль'],
 ['2. Руководитель и учредители'],
 ['','ФИО полностью','','Иванов Иван Иванович'],
 ['','Серия паспорта','','0000','','Номер','','999999']
];
test('Multiple adjacent fields in one Excel row are preserved without crossing columns',()=>{
 const r=inspectQuestionnaireRows(sample());
 assert.equal(r.kind,'BANK_QUESTIONNAIRE');
 assert.equal(r.fields.find(f=>f.key==='COMPANY_INN')?.raw,'5042149315');
 assert.equal(r.fields.find(f=>f.key==='ACTIVITY')?.raw,'Торговля');
 assert.equal(r.fields.find(f=>f.key==='REQUESTED_AMOUNT')?.raw,'1000000');
 assert.ok(r.fields.every(f=>!f.raw.includes('Иванов')&&!f.raw.includes('999999')));
 assert.equal(r.personalFieldsExtracted,false);assert.equal(r.automaticApply,false);
});
test('Conflicting INN requires review, not a guessed company identity',()=>{
 const s=sample();s.push(['1.4. ИНН','','1234567890']);
 const r=inspectQuestionnaireRows(s);
 assert.ok(r.issues.includes('QUESTIONNAIRE_DUPLICATE_CONFLICT:COMPANY_INN'));
 assert.equal(r.fields.filter(f=>f.key==='COMPANY_INN').length,2);
});
test('Missing company value never borrows the next labelled field',()=>{
 const s=sample();s[3]=['','1.4. ИНН','','','1.5. Вид деятельности','','Торговля'];
 const r=inspectQuestionnaireRows(s);
 assert.ok(r.issues.includes('QUESTIONNAIRE_VALUE_MISSING:COMPANY_INN'));
});
test('Non-questionnaire document cannot enter questionnaire review',()=>{
 assert.equal(inspectQuestionnaireRows([['Договор поставки'],['1.4. ИНН','','5042149315']]).kind,'UNSUPPORTED');
});
