import test from 'node:test';
import assert from 'node:assert/strict';
import {financialOcrCodes,preferSparseFinancialOcr} from '../lib/document-poc/local-ocr.ts';
const word=(s,confidence=96)=>['5','1','1','1','1','1','100','100','15','10',String(confidence),s].join('\t');
const seq=(...a)=>a.join('\n');
test('second OCR pass restores high-confidence financial row codes absent from primary pass',()=>{
 assert.equal(preferSparseFinancialOcr(seq(word('1200')),seq(word('1100'),word('1200'),word('1600'))),true);
});
test('low confidence numeric guesses cannot force switching OCR passes',()=>{
 assert.equal(preferSparseFinancialOcr(seq(word('1200')),seq(word('1200'),word('1600',15),word('1700',18))),false);
});
test('year, duplicate and out-of-range four-digit numbers are not financial rows',()=>{
 assert.deepEqual([...financialOcrCodes(seq(word('2024'),word('1200'),word('1200'),word('9999'),word('1600',0)))],['1200']);
});
