import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchDocumentReview} from '../lib/document-poc/document-dispatch.ts';
const page=text=>({page:1,logicalPage:1,segment:'FULL',method:'TEXT',text});
const input=(text,family='COMMERCIAL')=>({expectedFamily:family,totalPhysicalPages:1,pages:[page(text)]});
for(const [text,family,selected] of [
 ['Бухгалтерский баланс','BFO','FINANCIAL_STATEMENT'],
 ['Кредитный договор № TEST','CREDIT','CREDIT_AGREEMENT'],
 ['Договор поставки № TEST','COMMERCIAL','COMMERCIAL_CONTRACT'],
])test(`dispatch invokes only ${selected}`,async()=>{
 const calls=[];const parsers=Object.fromEntries(['FINANCIAL_STATEMENT','CREDIT_AGREEMENT','COMMERCIAL_CONTRACT'].map(key=>[key,async pages=>{calls.push(key);return {key,pages:pages.length};}]));
 const r=await dispatchDocumentReview(input(text,family),parsers);
 assert.deepEqual(calls,[selected]);assert.equal(r.status,'EXTRACTION_REVIEW');assert.equal(r.automaticApply,false);
 assert.deepEqual(r.extraction,{key:selected,pages:1});
});
test('wrong upload cannot force a different specialized parser',async()=>{
 let calls=0;const r=await dispatchDocumentReview(input('Договор поставки','BFO'),{FINANCIAL_STATEMENT:()=>++calls,COMMERCIAL_CONTRACT:()=>++calls});
 assert.equal(calls,0);assert.equal(r.status,'ROUTING_REVIEW');assert.equal(r.extraction,null);
});
test('no fallback to commercial parser when BFO adapter is absent',async()=>{
 let calls=0;const r=await dispatchDocumentReview(input('Бухгалтерский баланс','BFO'),{COMMERCIAL_CONTRACT:()=>++calls});
 assert.equal(calls,0);assert.equal(r.status,'ADAPTER_NOT_CONNECTED');assert.equal(r.extraction,null);
});
test('parser error is safe and never becomes data',async()=>{
 const r=await dispatchDocumentReview(input('Договор поставки'),{COMMERCIAL_CONTRACT:()=>{throw Error('SECRET_CUSTOMER_TEXT');}});
 assert.equal(r.status,'PARSER_FAILED');assert.equal(r.extraction,null);assert.doesNotMatch(JSON.stringify(r),/SECRET_CUSTOMER_TEXT/);
});
test('null adapter result is not successful extraction',async()=>{
 const r=await dispatchDocumentReview(input('Договор поставки'),{COMMERCIAL_CONTRACT:()=>null});assert.equal(r.status,'PARSER_FAILED');
});
test('duplicate pages are supplied to parser only once',async()=>{
 const i=input('Договор поставки');i.pages.push({...i.pages[0]});let count=0;
 await dispatchDocumentReview(i,{COMMERCIAL_CONTRACT:pages=>{count=pages.length;return {};}});assert.equal(count,1);
});
test('parser cannot mutate source pages',async()=>{
 const i=input('Договор поставки'),before=JSON.stringify(i);
 const r=await dispatchDocumentReview(i,{COMMERCIAL_CONTRACT:pages=>{pages[0].text='changed';return {};}});
 assert.equal(r.status,'PARSER_FAILED');assert.equal(JSON.stringify(i),before);
});
test('incomplete input never enters any specialized parser',async()=>{
 let called=false;const i={...input('Договор поставки'),totalPhysicalPages:2};
 const r=await dispatchDocumentReview(i,{COMMERCIAL_CONTRACT:()=>{called=true;return {};}});assert.equal(called,false);assert.equal(r.status,'ROUTING_REVIEW');
});
test('inherited adapter property cannot be invoked',async()=>{
 let called=false;const parsers=Object.create({COMMERCIAL_CONTRACT:()=>{called=true;return {};}});
 const r=await dispatchDocumentReview(input('Договор поставки'),parsers);assert.equal(called,false);assert.equal(r.status,'ADAPTER_NOT_CONNECTED');
});
test('field validation is not implied by routing success',async()=>{
 const r=await dispatchDocumentReview(input('Договор поставки'),{COMMERCIAL_CONTRACT:()=>({advance:null,status:'REVIEW'})});
 assert.equal(r.status,'EXTRACTION_REVIEW');assert.equal(r.automaticApply,false);assert.ok(r.warnings.includes('FIELDS_REQUIRE_SEPARATE_VALIDATION'));
});
