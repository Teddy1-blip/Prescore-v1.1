import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewFields} from '../lib/document-poc/review-fields.ts';

const page=(page,text,segment='FULL',method='TEXT')=>({page,logicalPage:page,segment,method,text});
const core=() => [
 page(1,[
  'Бухгалтерский баланс',
  'на 31 декабря 2022 г.',
  'ИНН: 5032333146',
  'Единица измерения: тыс. руб. по ОКЕИ 384',
  'БАЛАНС | 1600 | 100 | 90',
  'БАЛАНС | 1700 | 100 | 90',
 ].join('\n')),
 page(2,[
  'Отчёт о финансовых результатах',
  'за 2022 год',
  'ИНН: 5032333146',
  'Выручка | 2110 | 120 | 100',
 ].join('\n'))
];
const field=(r,key)=>r.fields.find(f=>f.key===key)?.value;
test('FNS acceptance receipts and third-party INN are not financial source facts',()=>{
 const pages=[
  ...core(),
  page(3,'Код по КНД 1167005\nИнформационное сообщение о представительстве\nИНН: 7707654321\nБАЛАНС | 1600 | 9999 | 8888'),
  page(4,'КНД 1166002\nКвитанция о приеме налоговой декларации\nИНН: 7707654321'),
 ];
 const foreignTable={line:{page:3,pdf:true,confidence:'HIGH',text:'БАЛАНС | 1600 | 9999 | 8888'},code:'1600',cells:[{raw:'9999',uncertain:false,assembled:false},{raw:'8888',uncertain:false,assembled:false}],headings:[]};
 const r=reviewFields('synthetic-fns-package',pages,4,'BFO','SINGLE',[],[foreignTable]);
 assert.equal(r.status,'READY_FOR_REVIEW');
 assert.equal(field(r,'company_inn'),'5032333146');
 assert.equal(field(r,'1600'),'100');
 assert.equal(field(r,'1700'),'100');
 assert.equal(field(r,'2110'),'120');
 assert.ok(r.issues.includes('BFO_FNS_SUPPORTING_DOCUMENTS_SEPARATE_REVIEW'));
 assert.equal(r.issues.includes('DUPLICATE_LINE'),false);
});
test('Standard FNS 0710099 cover is not misclassified as external service appendix',()=>{
 const pages=[
  page(1,'Форма по КНД 0710099\nБухгалтерская (финансовая) отчетность'),
  ...core().map(p=>({...p,page:p.page+1,logicalPage:p.logicalPage+1})),
 ];
 const r=reviewFields('synthetic-fns-cover',pages,3,'BFO','SINGLE');
 assert.equal(r.status,'READY_FOR_REVIEW');
 assert.equal(field(r,'company_inn'),'5032333146');
 assert.equal(field(r,'1600'),'100');
 assert.equal(r.issues.includes('BFO_FNS_SUPPORTING_DOCUMENTS_SEPARATE_REVIEW'),false);
});
test('A financial headline inside a later service appendix is not silently merged',()=>{
 const pages=[
  ...core(),
  page(3,'КНД 1167002\nПодтверждение даты отправки'),
  page(4,'Бухгалтерский баланс\nИНН: 7707654321\nБАЛАНС | 1600 | 9999 | 8888')
 ];
 const r=reviewFields('synthetic-fns-late-bfo',pages,4,'BFO','SINGLE');
 assert.equal(r.status,'INCOMPLETE');
 assert.ok(r.issues.includes('BFO_MIXED_FINANCIAL_AND_SUPPORTING_PAGE_REVIEW'));
 assert.equal(r.fields.length,0);
});
test('BFO and service document on opposite halves of the same sheet require explicit review',()=>{
 const pages=[
   {...page(1,'Бухгалтерский баланс\nБАЛАНС | 1600 | 100 | 90','LEFT'),logicalPage:1},
   {...page(1,'Код по КНД 1167005\nПодтверждение даты отправки','RIGHT'),logicalPage:2},
 ];
 const r=reviewFields('synthetic-two-up',pages,1,'BFO','TWO_UP_ROTATED');
 assert.equal(r.status,'INCOMPLETE');
 assert.ok(r.issues.includes('BFO_MIXED_FINANCIAL_AND_SUPPORTING_PAGE_REVIEW'));
});
