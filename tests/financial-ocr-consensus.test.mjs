import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileFinancialOcrRows,preferMoreCompleteFinancialOcr} from '../lib/document-poc/financial-ocr-consensus.ts';
import {financialTokensFromTsv} from '../lib/document-poc/local-ocr.ts';

const row=(code,values,headings=['На 31 декабря 2025 г.','На 31 декабря 2024 г.'],page=2)=>({
 code,headings,cells:values.map(raw=>({raw,uncertain:false,assembled:false})),
 line:{page,pdf:true,confidence:'MEDIUM',text:'Обязательства | '+code+' | '+values.join(' | ')},
});
test('two OCR passes that disagree on the same dated BFO cell quarantine the selected number',()=>{
 const primary=row('1600',['1 000','900']),alternative=row('1600',['1 005','900']);
 const x=reconcileFinancialOcrRows([primary],[alternative]);
 assert.deepEqual(x.disagreements,[{code:'1600',column:0,page:2}]);
 assert.equal(x.rows[0].cells[0].uncertain,true);
 assert.equal(x.rows[0].cells[1].uncertain,false);
 assert.equal(primary.cells[0].uncertain,false,'original OCR evidence must remain immutable');
 assert.equal(x.rows[0].cells[0].raw,'1 000','preserve printed value for manual review');
});
test('agreement on values and standard grouping keeps both columns readable',()=>{
 const x=reconcileFinancialOcrRows([row('1700',['1 000','950'])],[row('1700',['1000','950'])]);
 assert.equal(x.disagreements.length,0);
 assert.ok(x.rows[0].cells.every(c=>!c.uncertain));
});
test('different report years never compare positions even when line code is identical',()=>{
 const x=reconcileFinancialOcrRows([row('1600',['1 000','900'])],
  [row('1600',['2 000','800'],['На 31 декабря 2024 г.','На 31 декабря 2023 г.'])]);
 assert.deepEqual(x.disagreements,[]);
 assert.equal(x.rows[0].cells[0].uncertain,false);
});
test('different periods in same year do not produce false OCR conflict',()=>{
 const x=reconcileFinancialOcrRows([row('2110',['100','90'],['За январь–март 2025 г.','За январь–март 2024 г.'])],
  [row('2110',['300','250'],['За январь–июнь 2025 г.','За январь–июнь 2024 г.'])]);
 assert.equal(x.disagreements.length,0);
});
test('undated headings, duplicated row code and different physical page do not prove a comparison',()=>{
 for(const alt of [
  row('1600',['500','800'],['На','На']),
  row('1600',['500','800'],['На 31 декабря 2025 г.','На 31 декабря 2024 г.'],3),
 ]){
  assert.equal(reconcileFinancialOcrRows([row('1600',['100','90'])],[alt]).disagreements.length,0);
 }
 assert.equal(reconcileFinancialOcrRows([row('1600',['100','90'])],
 [row('1600',['200','100']),row('1600',['300','100'])]).disagreements.length,0);
});
test('uncertain or unreadable amounts in alternative OCR cannot vote against a clear cell',()=>{
 const alt=row('1600',['?','102']),prior=row('1600',['100','90']);
 alt.cells[1].uncertain=true;
 assert.equal(reconcileFinancialOcrRows([prior],[alt]).disagreements.length,0);
});
test('Tesseract numeric tokens below confidence threshold are never copied as evidence',()=>{
 const tok=(word,c=90)=>['5','1','1','1','1','1','120','50','30','12',String(c),word].join('\t');
 const x=financialTokensFromTsv([tok('1600',96),tok('12345',21),tok('900',55),tok('0',NaN)].join('\n'),220);
 assert.deepEqual(x.map(t=>t.str),['1600','?','900']);
 assert.equal(x[0].transform[4],120*72/220);
});

test('real-scan-shaped F2: same six codes but sparse pass restores a missing profit value',()=>{
 const codes=['2110','2120','2340','2350','2410','2400'];
 const primary=codes.map(code=>row(code,['100','90']));
 const sparse=codes.map(code=>row(code,['100','90']));
 const profit=primary.find(r=>r.code==='2400');
 profit.cells[0]={...profit.cells[0],raw:'?',uncertain:true};
 assert.equal(primary.length,sparse.length);
 assert.equal(preferMoreCompleteFinancialOcr(primary,sparse),true,
  'better numeric coverage after 5 other independently matching row codes');
 const result=reconcileFinancialOcrRows(sparse,primary);
 assert.equal(result.disagreements.length,0);
 assert.equal(result.rows.find(x=>x.code==='2400').cells[0].uncertain,false);
});
test('an alternate OCR pass cannot win if even one previously readable monetary cell disagrees',()=>{
 const codes=['2110','2120','2340','2350','2410','2400'];
 const primary=codes.map(code=>row(code,['100','90']));
 const sparse=codes.map(code=>row(code,['100','90']));
 primary.at(-1).cells[0]={raw:'?',uncertain:true,assembled:false};
 sparse[1].cells[0].raw='105';
 assert.equal(preferMoreCompleteFinancialOcr(primary,sparse),false);
 const result=reconcileFinancialOcrRows(primary,sparse);
 assert.deepEqual(result.disagreements,[{code:'2120',column:0,page:2}]);
 assert.equal(result.rows[1].cells[0].uncertain,true);
});
test('one matching code with three columns is insufficient evidence for pass selection',()=>{
 const three=['На 31 декабря 2025 г.','На 31 декабря 2024 г.','На 31 декабря 2023 г.'];
 const first=[row('1600',['100','90','80'],three)];
 const second=[row('1600',['100','90','80'],three),row('1700',['100','90','80'],three)];
 assert.equal(preferMoreCompleteFinancialOcr(first,second),false);
});
test('another reporting period, missing column or duplicated row code cannot bias OCR selection',()=>{
 const first=['2110','2120','2340'].map(x=>row(x,['100','90']));
 const other=['2110','2120','2340','2400'].map(x=>row(x,['100','90']));
 other[0].headings=['За январь–март 2025 г.','За январь–март 2024 г.'];
 assert.equal(preferMoreCompleteFinancialOcr(first,other),false);
 const duplicate=[...other,row('2110',['100','90'])];
 assert.equal(preferMoreCompleteFinancialOcr(first,duplicate),false);
});
test('incomplete sparse OCR cannot replace previously readable cells even if it adds a new row',()=>{
 const first=['2110','2120','2340','2350'].map(x=>row(x,['100','90']));
 const second=['2110','2120','2340','2350','2400'].map(x=>row(x,['100','90']));
 second[1].cells[1]={raw:'?',uncertain:true,assembled:false};
 assert.equal(preferMoreCompleteFinancialOcr(first,second),false);
});
