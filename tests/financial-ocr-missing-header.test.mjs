import test from 'node:test';
import assert from 'node:assert/strict';
import {financialTableRows} from '../lib/document-poc/financial-layout.ts';
import {financialTokensFromTsv,financialOcrColumnHeadingToken,
 preferDatedSparseFinancialContinuation,financialUnboundRowCodes,preferSparseFinancialOcr} from '../lib/document-poc/local-ocr.ts';
import {financialMetadata} from '../lib/document-poc/financial-metadata.ts';

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

test('realistic sparse OCR thousands groups require coherent spacing even without a code header',()=>{
 const totals=new Set([-160,-235]);
 const split=(gap)=>rows().flatMap(t=>{
   const y=t.transform[5];
   if(!totals.has(y)||!['1000','900','800'].includes(t.str))return [t];
   // Synthetic digit spacing follows private real-case geometry; amounts are fabricated.
   const pair={'1000':['193','005'],'900':['94','447'],'800':['35','583']}[t.str];
   const x=t.transform[4];
   return [item(pair[0],x,y,12,8),item(pair[1],x+12+gap,y,12,8)];
 });
 const aligned=financialTableRows([...headings(),...split(4)],1,true);
 for(const code of ['1600','1700']){
   const found=aligned.find(r=>r.code===code);
   assert.ok(found,'expected line '+code);
   assert.deepEqual(found.cells.slice(0,3).map(c=>c.raw),['193 005','94 447','35 583']);
   assert.ok(found.cells.slice(0,3).every(c=>!c.uncertain));
 }
 const disconnected=financialTableRows([...headings(),...split(24)],1,true);
 for(const code of ['1600','1700']){
   const found=disconnected.find(r=>r.code===code);
   assert.ok(found,'expected line '+code+' in disconnected scan');
   assert.ok(found.cells.slice(0,3).every(c=>c.uncertain),'never trust detached digit groups');
 }
});

test('split sparse-OCR reporting unit and separately printed OKEI require same-page evidence',()=>{
 const inspect=(fragments)=>financialMetadata({id:'synthetic-unit',issues:[],lines:[
   'Бухгалтерский баланс','на 31 декабря 2025 г.',...fragments
 ].map(text=>({text,page:1,confidence:'MEDIUM'}))});
 const valid=inspect(['Единица измерения:','в тыс. рублей','по ОКЕИ','384']);
 assert.equal(valid.unit.value,'тыс. ₽');
 assert.equal(valid.raw_unit.value,'в тыс. рублей по ОКЕИ 384');
 assert.equal(valid.unit.source_page,1);
 const conflicting=inspect(['Единица измерения:','в тыс. рублей','по ОКЕИ','385']);
 assert.equal(conflicting.unit.value,null,'word/code mismatch must remain unverified');
 const unrelated=inspect(['Единица измерения:','Остаток 1000 руб.']);
 assert.equal(unrelated.unit.value,null,'unrelated monetary sentence must not establish a unit');
 const acrossPages=financialMetadata({id:'synthetic-cross-page',issues:[],lines:[
   {text:'Бухгалтерский баланс',page:1,confidence:'MEDIUM'},
   {text:'на 31 декабря 2025 г.',page:1,confidence:'MEDIUM'},
   {text:'Единица измерения:',page:1,confidence:'MEDIUM'},
   {text:'в тыс. рублей',page:2,confidence:'MEDIUM'},
 ]});
 assert.equal(acrossPages.unit.value,null,'cross-page continuation must not establish a scale');
});

// Synthetic table coordinates mirror observed multi-column OCR geometry;
 // no real company, dates with source-specific values, or monetary amounts.
const tsvWord=(s,x,top,w=24,h=21,conf=94)=>
 ['5','1','1','1','1','1',String(x),String(top),String(w),String(h),String(conf),String(s)].join('\t');
test('Tesseract may join vertical borders to printed На/За without changing heading meaning',()=>{
 for(const [raw,want] of [['|На','На'],['¦На','На'],['│За','За'],['На|','На'],['За¦','За'],
  ['|Наименование','|Наименование'],['|ПАО','|ПАО'],['|999','|999'],['Наименование','Наименование']]){
  assert.equal(financialOcrColumnHeadingToken(raw),want);
 }
});
test('real-scan-shaped three-column F1 restores the middle |На date before financial amounts',()=>{
 const header=[
  tsvWord('Код',957,947,46,25),
  tsvWord('На',1041,931,33),tsvWord('31',1084,931,22),tsvWord('декабря',1123,930,83),
  tsvWord('|На',1263,931,33),tsvWord('31',1306,931,22),tsvWord('декабря',1344,931,83),
  tsvWord('На',1485,932,33),tsvWord('31',1529,932,22),tsvWord('декабря',1567,931,83),
  tsvWord('2025',1095,963,50,20),tsvWord('2024',1317,964,50,20),
  tsvWord('2023',1540,964,50,20),
 ];
 const codes=['1150','1210','1250','1230','1600','1700'];
 const rows=codes.flatMap((code,i)=>{
  const y=1064+i*37;
  return [
   tsvWord('Строка',240,y,95,20),tsvWord(code,954,y,53,20),
   tsvWord(String(110+i),1160,y,52,20),tsvWord(String(100+i),1383,y,52,20),
   tsvWord(String(90+i),1605,y,52,20),
  ];
 });
 const rowsParsed=financialTableRows(financialTokensFromTsv([...header,...rows].join('\n'),220),1,true);
 assert.deepEqual(rowsParsed.map(r=>r.code),codes);
 assert.deepEqual(rowsParsed[0].headings.map(x=>(x.match(/20\d{2}/)||[])[0]),['2025','2024','2023']);
 assert.equal(rowsParsed[0].cells.length,3);
 assert.deepEqual(rowsParsed[0].cells.map(c=>c.raw),['110','100','90']);
 assert.ok(rowsParsed[0].cells.every(c=>!c.uncertain));
});
test('real-scan-shaped F2 with second |За column binds profit values to two different years',()=>{
 const header=[
  tsvWord('Код',1090,721,45,27),
  tsvWord('За',1169,707,27,19),tsvWord('Январь',1204,707,95,19),
  tsvWord('-',1297,717,10,14),tsvWord('Декабрь',1312,707,105,19),
  tsvWord('|За',1434,707,28,20),tsvWord('Январь',1470,708,95,19),
  tsvWord('-',1564,718,10,14),tsvWord('Декабрь',1579,707,105,19),
  tsvWord('2025',1253,738,52,19),tsvWord('2024',1521,738,52,19),
 ];
 const codes=['2110','2120','2330','2340','2350','2410','2400'];
 const rows=codes.flatMap((code,i)=>{
  const y=789+i*37;
  return [
   tsvWord('Строка',280,y,95,20),tsvWord(code,1085,y,52,20),
   tsvWord(String(200+i),1355,y,55,20),tsvWord(String(150+i),1610,y,55,20),
  ];
 });
 const parsed=financialTableRows(financialTokensFromTsv([...header,...rows].join('\n'),220),2,true);
 assert.deepEqual(parsed.map(r=>r.code),codes);
 assert.deepEqual(parsed[0].headings.map(x=>(x.match(/20\d{2}/)||[])[0]),['2025','2024']);
 assert.deepEqual(parsed[0].cells.map(c=>c.raw),['200','150']);
 assert.ok(parsed[0].cells.every(c=>!c.uncertain));
});


// Synthetic fourth-page F2 continuation. The primary OCR loses the table
// header; sparse OCR preserves four row codes and two printed dates.
// The years and amounts are invented; no customer documents are committed.
const f2Page4Tsv=(withHeader,includeFirst)=>[
 ...(withHeader?[
  tsvWord('Код',1046,260,45,25),
  tsvWord('За',1187,244,27,19),tsvWord('Январь',1224,244,95,19),
  tsvWord('-',1320,245,10,19),tsvWord('Сентябрь',1335,244,100,19),
  tsvWord('За',1453,240,28,19),tsvWord('Январь',1488,240,95,19),
  tsvWord('-',1580,240,10,19),tsvWord('Сентябрь',1594,240,105,19),
  tsvWord('2025',1280,272,55,19),tsvWord('2024',1548,267,54,20)
 ]:[]),
 ...['2510','2520','2530','2500'].filter(c=>includeFirst||c!=='2510').flatMap((code,i)=>{
  const y=343+i*61;
  return [tsvWord('Показатель',200,y,95,21),tsvWord(code,1040,y,60,21),
   tsvWord(code==='2500'?'260':'-',1328,y,55,21),
   tsvWord(code==='2500'?'220':'-',1600,y,55,21)];
 })
].join('\n');

test('short F2 continuation selects only a whole date-bound sparse OCR pass',()=>{
 const primary=f2Page4Tsv(false,false),sparse=f2Page4Tsv(true,true);
 assert.equal(preferSparseFinancialOcr(primary,sparse),false,
  'one extra recognized code must not trigger the old selection heuristic');
 const first=financialTableRows(financialTokensFromTsv(primary,220),4,true);
 const second=financialTableRows(financialTokensFromTsv(sparse,220),4,true);
 assert.equal(first.length,0,'without a header three codes cannot bind columns');
 assert.ok(second.length>=4,'a printed header and four codes establish the table');
 const total=second.find(r=>r.code==='2500');
 assert.ok(total);
 assert.deepEqual(total.cells.slice(0,2).map(c=>c.raw),['260','220']);
 assert.deepEqual(total.headings.slice(0,2).map(h=>(h.match(/20\d{2}/)||[])[0]),['2025','2024']);
 assert.equal(preferDatedSparseFinancialContinuation(first,second),true);
});
test('short F2 continuation rejects guessed dates, ambiguous numbers and partial OCR passes',()=>{
 const labels=['За Январь - Сентябрь 2025 г.','За Январь - Сентябрь 2024 г.'];
 const row=(code,headings=labels,current='-',prior='-')=>({
  code,headings,line:{page:4,pdf:true,confidence:'MEDIUM',text:'Строка '+code},
  cells:[{raw:current,uncertain:false,assembled:false},{raw:prior,uncertain:false,assembled:false}]
 });
 const complete=[row('2510'),row('2520'),row('2530'),row('2500',labels,'260','220')];
 assert.equal(preferDatedSparseFinancialContinuation([],complete),true);
 assert.equal(preferDatedSparseFinancialContinuation([complete[0]],complete),false);
 assert.equal(preferDatedSparseFinancialContinuation([],complete.slice(0,3)),false);
 assert.equal(preferDatedSparseFinancialContinuation([],complete.map(r=>({...r,headings:['За','За']}))),false);
 assert.equal(preferDatedSparseFinancialContinuation([],complete.map(r=>({...r,headings:['За 2025','За 2025']}))),false);
 assert.equal(preferDatedSparseFinancialContinuation([],complete.map(r=>({...r,cells:r.cells.map(c=>({...c,uncertain:true}))}))),false);
 assert.equal(preferDatedSparseFinancialContinuation([],complete.map(r=>({...r,cells:r.cells.map(c=>({...c,raw:'?'}))}))),false);
 assert.equal(preferDatedSparseFinancialContinuation([],[
  ...complete.slice(0,3),{...complete[3],headings:[labels[1],labels[0]]}]),false);
 assert.equal(preferDatedSparseFinancialContinuation([],[
  complete[0],complete[1],complete[2],complete[3],complete[3]]),false);
});
test('three aligned F2 continuation codes including 2500 cannot disappear silently',()=>{
 const primary=f2Page4Tsv(false,false);
 assert.deepEqual(financialUnboundRowCodes(primary,[],4).sort(),['2500','2520','2530']);
 const isolatedAmounts=['2699','6615','9500'].map((s,i)=>
   tsvWord(s,1300,i*65+350,50,21,94)).join('\n');
 assert.deepEqual(financialUnboundRowCodes(isolatedAmounts,[],4),[],
  'amounts without a source code column are not financial evidence');
});
