import test from 'node:test';
import assert from 'node:assert/strict';
import {wordReviewPages} from '../lib/document-poc/word-review.ts';
import {routeDocument} from '../lib/document-poc/document-routing.ts';
const statement='Договор о предоставлении невозобновляемой кредитной линии № 123/24';
const paras=(array)=>array.map((text,i)=>({page:i+1,logicalPage:i+1,method:'TEXT',text}));
const route=(pages,family='CREDIT')=>routeDocument({expectedFamily:family,pages,totalPhysicalPages:pages.length,layout:'SINGLE'});
test('Large Word credit-line templates are chunked before routing, preserving all paragraphs',()=>{
 const p=paras([statement,...Array.from({length:260},(_,i)=>'Условие '+i+': '+'Условие о порядке выдачи траншей и исполнения обязательств. '.repeat(5))]);
 const raw=p.map(v=>v.text).join('\n');
 assert.ok(raw.length>26_000);
 assert.equal(route([{page:1,logicalPage:1,method:'TEXT',text:raw}]).status,'INPUT_INVALID');
 const pages=wordReviewPages(p);
 assert.ok(pages.length>1&&pages.length<=64);
 assert.ok(pages.every(p=>p.text.length<=20_000));
 assert.equal(pages.map(p=>p.text).join('\n'),raw);
 const r=route(pages);
 assert.equal(r.status,'READY_FOR_REVIEW');
 assert.equal(r.parser,'CREDIT_AGREEMENT');
 assert.equal(r.actualFamily,'CREDIT');
});
test('Both renewable and non-renewable credit-line headings route for review',()=>{
 for(const term of ['невозобновляемой','возобновляемой']){
  const pages=wordReviewPages(paras(['Договор о предоставлении '+term+' кредитной линии № 120', 'Банк обязуется предоставить кредит на указанных условиях.']));
  const result=route(pages);
  assert.equal(result.actualFamily,'CREDIT');
  assert.equal(result.parser,'CREDIT_AGREEMENT');
 }
});
test('Ordinary generic agency agreement is never invented as a supply/services contract',()=>{
 const pages=wordReviewPages(paras(['Договор № 247', 'Агент содействует в получении финансирования по поручению заказчика.']));
 const r=route(pages,'COMMERCIAL');
 assert.equal(r.status,'TYPE_REVIEW');
 assert.equal(r.parser,null);
});
test('A single enormous paragraph fails closed without truncation',()=>{
 assert.throws(()=>wordReviewPages(paras(['A'.repeat(20001)])),/DOCX_PARAGRAPH_TOO_LONG/);
});
test('More than 64 bounded chunks are rejected without losing audit evidence',()=>{
 assert.throws(()=>wordReviewPages(paras(Array.from({length:65},(_,i)=>String(i)+'x'.repeat(19_990)))),/DOCX_REVIEW_PAGE_LIMIT/);
});
test('Word reference text never changes while chunking',()=>{
 const p=paras(['Кредитный договор',...'abcde'.repeat(4500).match(/.{1,500}/g)]);
 const chunks=wordReviewPages(p);
 assert.equal(chunks.map(c=>c.text).join('\n'),p.map(x=>x.text).join('\n'));
});
