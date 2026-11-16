import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewFields} from '../lib/document-poc/review-fields.ts';
import {reviewedFinancial} from '../lib/workspace/reviewed-financial.ts';

const inn='5042149315'; // fabricated identity, no customer data
const page=(n,text)=>({page:n,logicalPage:n,segment:'FULL',method:'OCR',text});
const table=(pageNum,code,raw,prev,headings)=>({
 line:{page:pageNum,pdf:true,confidence:'MEDIUM',text:'Строка '+code+' | '+raw+' | '+prev},
 code,headings,
 cells:[{raw,uncertain:false,assembled:false},{raw:prev,uncertain:false,assembled:false}],
});
function source(){
 const pages=[
  page(1,[
   'Бухгалтерский баланс','ИНН: '+inn,
   'на 31 декабря 2025 г.','Единица измерения: тыс. руб. по ОКЕИ 384'
  ].join('\n')),
  page(2,[
   'Отчёт','о финансовых','результатах','за 2025 год',
   'Чистая прибыль'
  ].join('\n')),
 ];
 const headingsBalance=['На 31 декабря 2025 г.','На 31 декабря 2024 г.'];
 const headingsIncome=['За 2025 год','За 2024 год'];
 const tables=[
  table(1,'1600','1 000','900',headingsBalance),
  table(1,'1700','1 000','900',headingsBalance),
  table(2,'2110','120','110',headingsIncome),
  // Net profit is a labelled OCR table row, not accepted from a narrative.
  table(2,'2400','20','10',headingsIncome),
 ];
 const review=reviewFields('synthetic-whole-bfo',pages,2,'BFO','SINGLE',[],tables);
 const verified=Object.fromEntries(review.fields.filter(f=>
   ['company_inn','statement_date','period_start','period_end','statement_unit','1600','1700','2110','2400'].includes(f.key)
   &&f.value!==null&&f.page&&f.fragment).map(f=>[f.key,{value:f.value,page:f.page,fragment:f.fragment}]));
 const envelope={
  sourceId:'synthetic-financial-file',sourceType:'OTHER',status:'PROCESSING',
  companyInn:inn,receivedAt:'2026-11-16T08:00:00Z',
  confidence:94,warnings:[],fileName:'fabricated-f1f2.pdf'
 };
 return {review,verified,envelope};
}
test('full scanned F1+wrapped F2 -> reviewed source -> annual snapshot uses documented scale and exact values',()=>{
 const s=source();
 assert.equal(s.review.status,'READY_FOR_REVIEW');
 assert.equal(s.review.fields.find(x=>x.key==='period_start')?.value,'2025-01-01');
 assert.equal(s.review.fields.find(x=>x.key==='statement_date')?.value,'2025-12-31');
 const normalized=reviewedFinancial({review:s.review,verified:s.verified,envelope:s.envelope},inn);
 assert.ok(normalized);
 assert.equal(normalized.confirmedScale,1000);
 assert.equal(normalized.period.kind,'ANNUAL');
 assert.equal(normalized.period.from,'2025-01-01');
 assert.equal(normalized.period.to,'2025-12-31');
 assert.equal(normalized.balance.ASSETS_TOTAL.rawValue,1000);
 assert.equal(normalized.balance.ASSETS_TOTAL.value,1000000);
 assert.equal(normalized.balance.BALANCE_TOTAL.value,1000000);
 assert.equal(normalized.income.REVENUE.rawValue,120);
 assert.equal(normalized.income.REVENUE.value,120000);
 assert.equal(normalized.income.NET_PROFIT.value,20000);
 assert.equal(normalized.balance.INVENTORIES.value,null,'missing row is not a zero');
 assert.equal(normalized.companyInn,inn);
 assert.equal(normalized.source.sourceId,'synthetic-financial-file');
});
test('readable OCR preview without deliberate field confirmations creates no canonical snapshot',()=>{
 const s=source();
 assert.equal(reviewedFinancial({...s,verified:{}},inn),undefined);
 assert.equal(reviewedFinancial({...s,verified:{...s.verified,statement_unit:undefined}},inn),undefined);
 assert.equal(reviewedFinancial({...s,review:{...s.review,status:'INCOMPLETE'}},inn),undefined);
});
test('wrong company, mismatched or absent source fragment cannot enter the normalized financial history',()=>{
 const s=source();
 assert.equal(reviewedFinancial(s,'1111111111'),undefined);
 assert.equal(reviewedFinancial({...s,envelope:{...s.envelope,companyInn:'1111111111'}},inn),undefined);
 assert.equal(reviewedFinancial({...s,verified:{...s.verified,
   statement_unit:{...s.verified.statement_unit,fragment:'fabricated unit from another page'}
 }},inn),undefined);
 assert.equal(reviewedFinancial({...s,verified:{...s.verified,
   period_end:{...s.verified.period_end,page:8}
 }},inn),undefined);
});
test('unprinted extra credit or revenue row cannot be injected as a verified financial fact',()=>{
 const s=source();
 const payload={...s,verified:{...s.verified,
  1510:{value:'9999999',page:1,fragment:'invented borrowing source'}
 }};
 const normalized=reviewedFinancial(payload,inn);
 assert.ok(normalized);
 assert.equal(normalized.balance.SHORT_TERM_BORROWINGS.value,null);
 assert.equal(normalized.income.REVENUE.value,120000);
});
