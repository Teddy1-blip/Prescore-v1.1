import test from 'node:test';
import assert from 'node:assert/strict';
import {routeDocument} from '../lib/document-poc/document-routing.ts';
import {reviewFields} from '../lib/document-poc/review-fields.ts';
import {verifiedCreditDocument} from '../lib/workspace/contract-portfolio.ts';

const inn='7707083893';
const page=(text)=>({page:1,logicalPage:1,segment:'FULL',method:'TEXT',text});
const text=[
 'Заявление – оферта на заключение договора о предоставлении кредита по программе',
 'кредитования «Кредит Онлайн»',
 '1.1. Сумма кредита: 5 000 000.00 (Пять миллионов рублей 00 копеек) российских рублей',
 '1.4. Процентная ставка (процентов годовых): 18.40 (Восемнадцать целых 40 сотых)',
 '1.3. Срок Кредита: 18 месяцев с даты предоставления кредита',
 'акцептом со стороны Кредитора будет являться зачисление суммы Кредита на счет',
].join('\n');
const input={expectedFamily:'CREDIT',pages:[page(text)],totalPhysicalPages:1};

test('credit offer is routed for review from printed heading, not considered a funded loan',()=>{
 const r=routeDocument(input);
 assert.equal(r.actualFamily,'CREDIT');
 assert.deepEqual(r.subtypes,['CREDIT_OFFER']);
 assert.equal(r.parser,'CREDIT_AGREEMENT');
 assert.equal(r.status,'READY_FOR_REVIEW');
 assert.equal(r.automaticApply,false);
 const other=routeDocument({expectedFamily:'CREDIT',pages:[page('Заявление – оферта на заключение договора поставки')],totalPhysicalPages:1});
 assert.equal(other.parser,null);
});

test('credit offer amount and fixed annual rate are individually sourced, no invented maturity',()=>{
 const review=reviewFields('synthetic-offer',[page(text)],1,'CREDIT','SINGLE');
 const amount=review.fields.find(f=>f.key==='credit_amount');
 const rate=review.fields.find(f=>f.key==='interest_rate');
 const currency=review.fields.find(f=>f.key==='currency');
 assert.equal(review.status,'READY_FOR_REVIEW');
 assert.ok(review.issues.includes('CREDIT_OFFER_ACCEPTANCE_UNVERIFIED'));
 assert.equal(amount?.value,'5000000');
 assert.equal(rate?.value,'18.4');
 assert.equal(currency?.value,'RUB');
 assert.equal(amount?.page,1);
 assert.ok(amount?.fragment?.includes('5 000 000.00'));
 assert.equal(review.fields.find(f=>f.key==='maturity_date')?.value,null);
});

test('even manually checked offer terms cannot create contractual debt observations',()=>{
 const review=reviewFields('synthetic-offer',[page(text)],1,'CREDIT','SINGLE');
 const verified=Object.fromEntries([
  ['creditor','Учебный банк'],['borrower','ООО Тест'],['borrower_inn',inn],
  ['agreement_number','T-1'],['agreement_date','2025-01-01'],
  ['currency','RUB'],['credit_amount','5000000'],['interest_rate','18.4'],
 ].map(([key,value])=>[key,{value,page:1,fragment:key+' '+value}]));
 const row={id:'credit-offer:test',kind:'CREDIT_DOCUMENT',documentId:'source-document',payload:{
  envelope:{companyInn:inn,sourceId:'credit-offer:test',sourceType:'OTHER',status:'PROCESSING',receivedAt:'2026-11-16'},
  review,verified}};
 assert.equal(verifiedCreditDocument(row,inn),null);
});
