import test from 'node:test';
import assert from 'node:assert/strict';
import {financialTableRows} from '../lib/document-poc/financial-layout.ts';

// Synthetic coordinates reproduce the alignment properties measured on two
// private scanned BFOs. There are no customer values or originals in fixtures.
const item=(s,x,y,w=String(s).length*4,h=6)=>({
  str:String(s),width:w,transform:[1,0,0,h,x,y]
});
const headings=()=>[350,460,570].flatMap((x,i)=>[
  item('На',x,-75,13),item('31',x+17,-75,10),
  item('декабря',x+31,-75,33),item(String(2025-i),x+67,-75,20)
]);
const rows=()=>[
 ['1100','Внеоборотные активы','100','100','100'],
 ['1200','Оборотные активы','900','800','700'],
 ['1600','БАЛАНС','1000','900','800'],
 ['1300','Капитал и резервы','400','350','300'],
 ['1500','Краткосрочные обязательства','600','550','500'],
 ['1700','БАЛАНС','1000','900','800'],
].flatMap(([code,label,...amounts],i)=>{
  const y=-110-i*25;
  return [item(label,20,y,180),item(code,315,y,24),
    ...amounts.map((a,j)=>item(a,375+j*110,y,30))];
});
const source=()=>[...headings(),...rows()];

test('scanned table restores missing code header only from 6 aligned rows and 3 dated columns',()=>{
 const result=financialTableRows(source(),1,true);
 assert.deepEqual(result.map(r=>r.code),['1100','1200','1600','1300','1500','1700']);
 assert.equal(result.find(r=>r.code==='1600')?.cells[0].raw,'1000');
 assert.equal(result.find(r=>r.code==='1700')?.cells[1].raw,'900');
 assert.equal(result[0].headings.length,3);
 assert.ok(result[0].headings[0].toLowerCase().includes('2025'));
 assert.ok(result.every(r=>r.line.page===1&&r.line.pdf));
});
test('native text PDF still requires a printed code heading, no synthetic header allowed',()=>{
 assert.deepEqual(financialTableRows(source(),1,false),[]);
});
test('short or misaligned numeric fragments do not manufacture a financial table',()=>{
 const base=source();
 const short=[...headings(),...rows().filter(t=>!['1600','1700'].includes(t.str)).slice(0,12)];
 assert.deepEqual(financialTableRows(short,1,true),[]);
 const noHeading=base.filter(t=>t.str!=='На');
 assert.deepEqual(financialTableRows(noHeading,1,true),[]);
 const noLabels=base.filter(t=>!/[А-Яа-я]/u.test(t.str)||t.str==='На');
 assert.deepEqual(financialTableRows(noLabels,1,true),[]);
});
test('two isolated row codes plus an apparent date header never imply a balance',()=>{
 const arbitrary=[...headings(),item('БАЛАНС',20,-110,80),
  item('1600',315,-110,24),item('1000',375,-110,30),
  item('БАЛАНС',20,-135,80),item('1700',315,-135,24),item('1000',375,-135,30)];
 assert.deepEqual(financialTableRows(arbitrary,2,true),[]);
});
