import test from 'node:test';
import assert from 'node:assert/strict';
import {financialOcrCodes,preferSparseFinancialOcr,shouldRetryFinancialOcr} from '../lib/document-poc/local-ocr.ts';
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

test('a partially scanned 11-code balance triggers second pass instead of stopping early',()=>{
 const first=['1100','1150','1170','1200','1210','1230','1250','1260','1300','1400','1500'].map(x=>word(x)).join('\n');
 const second=[...['1100','1150','1170','1200','1210','1230','1250','1260','1300','1400','1500'],
    ...['1510','1520','1530','1600','1700','2100','2110']].map(x=>word(x)).join('\n');
 assert.equal(financialOcrCodes(first).size,11);
 assert.equal(shouldRetryFinancialOcr(first),true);
 assert.equal(preferSparseFinancialOcr(first,second),true);
});
test('already rich financial OCR pass with balance evidence does not double render',()=>{
 const complete=['1100','1150','1170','1200','1210','1230','1250','1260',
 '1300','1400','1500','1510','1520','1600','1700','2110','2120','2400'].map(x=>word(x)).join('\n');
 assert.equal(shouldRetryFinancialOcr(complete),false);
});
test('line codes without balance totals require a second OCR pass even when numerous',()=>{
 const noTotal=['1100','1110','1120','1130','1140','1150','1160','1170',
 '1200','1210','1220','1230','1240','1250','1260','1300','1400'].map(x=>word(x)).join('\n');
 assert.equal(shouldRetryFinancialOcr(noTotal),true);
});
