import test from 'node:test';
import assert from 'node:assert/strict';
import {financialStatement} from '../lib/document-poc/financial.ts';
import {reviewFields} from '../lib/document-poc/review-fields.ts';
import {reviewedFinancial} from '../lib/workspace/reviewed-financial.ts';

const inn='5042149315'; // synthetic, never a customer's ID
const lines=[
 'Бухгалтерский баланс',
 'ИНН: '+inn,
 'на 31 декабря 2025 г.',
 'Единица измерения: тыс. руб. по ОКЕИ 384',
 'Строка | 1105 | 15 | 12',
 'Строка | 1215 | 25 | 23',
 'БАЛАНС | 1600 | 1000 | 900',
 'БАЛАНС | 1700 | 1000 | 900',
 'Отчёт о финансовых результатах',
 'за 2025 год',
 'Выручка | 2110 | 200 | 150',
].join('\n');
const page={page:1,logicalPage:1,segment:'FULL',method:'TEXT',text:lines};

test('supplementary RAS line 1105 and 1215 remain visible but cannot invalidate core balance totals',()=>{
 const result=reviewFields('fixture:extended-ras',[page],1,'BFO','SINGLE');
 assert.equal(result.status,'READY_FOR_REVIEW');
 assert.ok(result.issues.includes('SUPPLEMENTARY_LINE_NOT_MAPPED'));
 const lookup=key=>result.fields.find(x=>x.key===key);
 assert.deepEqual(['1105','1215'].map(key=>lookup(key)?.status),['REVIEW','REVIEW']);
 assert.deepEqual(['1105','1215'].map(key=>lookup(key)?.value),[null,null]);
 assert.deepEqual(['1600','1700'].map(key=>lookup(key)?.value),['1000','1000']);
 assert.equal(lookup('1600')?.status,'READ');
});
test('user confirmation of an unmapped auxiliary row cannot change the known credit-financial model',()=>{
 const review=reviewFields('fixture:extended-ras',[page],1,'BFO','SINGLE');
 const keys=['company_inn','statement_date','period_start','period_end','statement_unit','1600','1700','2110','1105','1215'];
 const verified=Object.fromEntries(review.fields.filter(f=>keys.includes(f.key)&&f.value!=null&&f.page&&f.fragment)
   .map(f=>[f.key,{value:f.value,page:f.page,fragment:f.fragment}]));
 const env={sourceId:'fake-bfo',sourceType:'OTHER',companyInn:inn,confidence:92,
   receivedAt:'2026-11-16T09:00:00Z',status:'PROCESSING',warnings:[]};
 const base=reviewedFinancial({review,verified,envelope:env},inn);
 assert.ok(base);
 assert.equal(base.balance.ASSETS_TOTAL.value,1000000);
 assert.equal(base.income.REVENUE.value,200000);
 assert.equal(base.balance.INTANGIBLE_ASSETS.value,null);
 const extended={...verified,
  1105:{value:'100000000',page:1,fragment:'Строка | 1105 | 15 | 12'},
  1215:{value:'800000000',page:1,fragment:'Строка | 1215 | 25 | 23'}};
 const again=reviewedFinancial({review,verified:extended,envelope:env},inn);
 assert.deepEqual(again?.balance,base.balance);
 assert.deepEqual(again?.income,base.income);
});
test('a bogus four-digit code is still invalid; do not turn arbitrary numbers into accounting lines',()=>{
 const input={id:'fake',lines:[
  {text:'Бухгалтерский баланс',page:1,confidence:'HIGH'},
  {text:'на 31 декабря 2025 г.',page:1,confidence:'HIGH'},
  {text:'Единица измерения: тыс. руб. по ОКЕИ 384',page:1,confidence:'HIGH'},
  {text:'Сторонний код | 9999 | 100 | 90',page:1,confidence:'HIGH'},
  {text:'БАЛАНС | 1600 | 1000 | 900',page:1,confidence:'HIGH'},
  {text:'БАЛАНС | 1700 | 1000 | 900',page:1,confidence:'HIGH'}
 ],issues:[]};
 financialStatement(input);
 assert.ok(input.issues.some(i=>i.status==='INVALID'&&i.code==='UNKNOWN_LINE_CODE'));
});
test('a supplemental code repeated on a continuation page is review-only; duplicate canonical 1600 is invalid',()=>{
 const synthetic=(code,page)=>({line:{text:'Строка '+code,page,confidence:'MEDIUM',pdf:true},
   code,headings:[],cells:[{raw:'20',uncertain:false,assembled:false},{raw:'10',uncertain:false,assembled:false}]}),
 input=(code)=>({id:'fake',lines:[{text:'Бухгалтерский баланс',page:1,confidence:'HIGH'},
   {text:'на 31 декабря 2025 г.',page:1,confidence:'HIGH'},
   {text:'Единица измерения: тыс. руб. по ОКЕИ 384',page:1,confidence:'HIGH'}],
   financialTables:[synthetic(code,1),synthetic(code,2)],issues:[]});
 const extra=input('1105');financialStatement(extra);
 assert.equal(extra.issues.some(i=>i.status==='INVALID'&&i.code==='DUPLICATE_LINE'),false);
 assert.ok(extra.issues.some(i=>i.code==='SUPPLEMENTARY_LINE_REPEATED'));
 const core=input('1600');financialStatement(core);
 assert.ok(core.issues.some(i=>i.status==='INVALID'&&i.code==='DUPLICATE_LINE'));
});
