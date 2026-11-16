import test from 'node:test';
import assert from 'node:assert/strict';
import {financialOcrCodes,financialUnboundRowCodes,financialOcrToken,preferSparseFinancialOcr,shouldRetryFinancialOcr} from '../lib/document-poc/local-ocr.ts';
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

test('real-scan-shaped OCR: stray comparative amount in another x column cannot become a row code',()=>{
 const at=(s,x,top=100,confidence=96)=>
  ['5','1','1','1','1','1',String(x),String(top),'25','12',String(confidence),s].join('\t');
 const codes=['1105','1110','1130','1140','1150','1160'].map((x,i)=>at(x,915+i,100+i*27));
 const other=[at('1108',1620,115,99),at('2546',1625,200,99)];
 assert.deepEqual([...financialOcrCodes([...codes,...other].join('\n'))],
  ['1105','1110','1130','1140','1150','1160']);
});
test('multiple competing aligned code columns must not pretend to be one table',()=>{
 const at=(s,x)=>['5','1','1','1','1','1',String(x),'100','25','12','96',s].join('\t');
 const left=['1100','1200','1600'].map(s=>at(s,915));
 const right=['1210','1300','1700'].map(s=>at(s,1500));
 assert.deepEqual([...financialOcrCodes([...left,...right].join('\n'))],[]);
});
test('continuation page with five aligned code tokens and no dated header needs review',()=>{
 const at=(s,i)=>['5','1','1','1','1','1',String(920+i),'100','25','12','96',s].join('\t');
 const raw=['1170','1180','1190','1210','1230'].map(at).join('\n');
 assert.equal(financialUnboundRowCodes(raw,[],2).length,5);
 const parsed=[{code:'1170',line:{page:2}},{code:'1180',line:{page:2}},
  {code:'1190',line:{page:2}}];
 assert.deepEqual(financialUnboundRowCodes(raw,parsed,2),[],
  'only two absent codes do not establish wholesale missing table');
});
test('low-confidence numeric OCR cannot supply BFO text metadata or monetary columns',()=>{
 assert.equal(financialOcrToken('2025',20),'?');
 assert.equal(financialOcrToken('384',Number.NaN),'?');
 assert.equal(financialOcrToken('2025',80),'2025');
 assert.equal(financialOcrToken('Бухгалтерский',21),'Бухгалтерский');
});

test('three aligned codes with balance total on a continuation page require manual column binding',()=>{
 const at=(code,x)=>['5','1','1','1','1','1',String(x),'120','25','12','95',code].join('\t');
 const rows=[at('1260',915),at('1200',916),at('1600',916)].join('\n');
 assert.deepEqual(financialUnboundRowCodes(rows,[],3),['1260','1200','1600']);
 assert.deepEqual(financialUnboundRowCodes(rows,[{code:'1600',line:{page:3}}],3),[],
  'a single missing pair does not establish a whole unbound table');
});
test('three unrelated amounts or undated three-code fragment cannot certify a continuation',()=>{
 const at=(code,x)=>['5','1','1','1','1','1',String(x),'120','25','12','95',code].join('\t');
 assert.deepEqual(financialUnboundRowCodes([at('1260',200),at('1200',600),at('1600',900)].join('\n'),[],3),[]);
 assert.deepEqual(financialUnboundRowCodes([at('1260',915),at('1200',916),at('1250',916)].join('\n'),[],3),[]);
});
