import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSberBusinessXlsxRows} from '../lib/workspace/bank-xlsx-intake.ts';
const sample=()=>{
 const r=()=>Array(22).fill('');
 const pre=r();pre[2]='ПАО СБЕРБАНК';pre[5]='СберБизнес';
 const owner=r();owner[12]='40702810205500005040';owner[3]='Российский рубль';
 const h=r();h[2]='Дата проводки';h[10]='Сумма по дебету';h[14]='Сумма по кредиту';h[15]='№ документа';h[21]='Назначение платежа';
 const sub=r(),one=r(),two=r();
 one[2]='2025-05-01 09:00:00';one[14]='1234.50';one[15]='001';one[21]='Оплата по договору';
 two[2]='2025-05-02 12:00:00';two[10]='200.75';two[15]='002';two[21]='Оплата услуг';
 return [pre,owner,h,sub,one,two];
};
test('SberBusiness debit and credit direction with source row evidence',()=>{
 const r=inspectSberBusinessXlsxRows(sample());
 assert.equal(r.format,'SBER_BUSINESS_OPERATIONS_XLSX');assert.equal(r.operations.length,2);
 assert.deepEqual(r.operations.map(x=>x.direction),['IN','OUT']);
 assert.deepEqual(r.operations.map(x=>x.amountMinor),[123450,20075]);
 assert.equal(r.account,'40702810205500005040');
 assert.equal(r.ownerInn,null);assert.equal(r.automaticApply,false);assert.equal(r.scoreUpdated,false);
});
test('Document must not have both directions on the same row',()=>{
 const a=sample();a[4][10]='100';assert.throws(()=>inspectSberBusinessXlsxRows(a),/BANK_XLSX_BOTH_DIRECTIONS/);
});
test('Reject an invalid banking amount instead of silently dropping it',()=>{
 const a=sample();a[5][10]='200.751';assert.throws(()=>inspectSberBusinessXlsxRows(a),/BANK_XLSX_BAD_AMOUNT/);
});
test('Reject unknown bank workbook instead of fabricating compatible rows',()=>{
 const a=sample();a[0][2]='Другой банк';a[0][5]='Не Сбер';
 assert.equal(inspectSberBusinessXlsxRows(a).format,'UNSUPPORTED');
});
test('Preserve actual source row numbers for evidence references',()=>{
 const r=inspectSberBusinessXlsxRows(sample(),[1,2,5,6,9,10]);
 assert.deepEqual(r.operations.map(o=>o.row),[9,10]);
});

test('40817 personal account is never declared a corporate settlement account',()=>{
 const a=sample();a[1][12]='40817'+'0'.repeat(15);
 const r=inspectSberBusinessXlsxRows(a);
 assert.equal(r.format,'SBER_BUSINESS_OPERATIONS_XLSX');
 assert.equal(r.status,'REVIEW_REQUIRED');
 assert.equal(r.account,null);
 assert.ok(r.warnings.includes('BANK_XLSX_PERSONAL_40817_ACCOUNT_REVIEW_REQUIRED'));
 assert.equal(r.automaticApply,false);assert.equal(r.scoreUpdated,false);
});
