import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewFields} from '../lib/document-poc/review-fields.ts';
import {financialTableRows} from '../lib/document-poc/financial-layout.ts';
import {financialOcrInnFromTsv} from '../lib/document-poc/local-ocr.ts';
const inn='5042149315'; // test-only non-customer identifier
const page=(text)=>({page:1,logicalPage:1,segment:'FULL',method:'OCR',text});
const sample=(extras={})=>{
 const info=[
  'Бухгалтерский баланс',
  'ИНН: '+(extras.inn??inn),
  'на 31 декабря 2025 г.',
  'Единица измерения: тыс. руб. по ОКЕИ 384',
 ];
 const statements=extras.text??info.join('\n');
 const cells=extras.current??['1000','1000'];
 return reviewFields('fake-scan-bfo',[page(statements)],1,'BFO','SINGLE',[],[
  {line:{page:1,pdf:true,confidence:'MEDIUM',text:'БАЛАНС | 1600 | '+cells[0]+' | 900'},
    code:'1600',headings:['На 31 декабря 2025 г.','На 31 декабря 2024 г.'],
    cells:[{raw:cells[0],uncertain:false,assembled:false},{raw:'900',uncertain:false,assembled:false}]},
  {line:{page:1,pdf:true,confidence:'MEDIUM',text:'БАЛАНС | 1700 | '+cells[1]+' | 900'},
    code:'1700',headings:['На 31 декабря 2025 г.','На 31 декабря 2024 г.'],
    cells:[{raw:cells[1],uncertain:false,assembled:false},{raw:'900',uncertain:false,assembled:false}]},
 ]);
};
const f=(x,key)=>x.fields.find(z=>z.key===key);

test('end-to-end F1 review binds scanned table values to valid subject, date, and thousands-of-rubles scale',()=>{
 const report=sample();
 assert.equal(report.status,'READY_FOR_REVIEW');
 assert.equal(f(report,'company_inn')?.value,inn);
 assert.equal(f(report,'statement_date')?.value,'2025-12-31');
 assert.equal(f(report,'statement_unit')?.value,'тыс. ₽');
 assert.equal(f(report,'1600')?.value,'1000');
 assert.equal(f(report,'1700')?.value,'1000');
 assert.equal(f(report,'1600')?.unit,'тыс. ₽');
 assert.equal(f(report,'1600')?.page,1);
 assert.equal(f(report,'1600')?.status,'READ');
 assert.equal(report.issues.includes('BFO_INTEGRITY_REVIEW_REQUIRED'),false);
});
test('readable amounts cannot make scanned BFO READY without documented monetary scale',()=>{
 const report=sample({text:['Бухгалтерский баланс','ИНН: '+inn,'на 31 декабря 2025 г.'].join('\n')});
 assert.equal(report.status,'INCOMPLETE');
 assert.ok(report.issues.includes('BFO_REPORTING_SCALE_UNVERIFIED'));
 assert.equal(f(report,'1600')?.value,'1000','retain evidence for checking');
 assert.equal(f(report,'1600')?.status,'REVIEW');
 assert.equal(f(report,'statement_unit')?.value,null);
});
test('readable amounts cannot make scanned BFO READY without independent reporting date',()=>{
 const report=sample({text:['Бухгалтерский баланс','ИНН: '+inn,
  'Единица измерения: тыс. руб. по ОКЕИ 384'].join('\n')});
 assert.equal(report.status,'INCOMPLETE');
 assert.ok(report.issues.includes('BFO_REPORT_DATE_UNVERIFIED'));
 assert.equal(f(report,'1600')?.status,'REVIEW');
 assert.equal(f(report,'1600')?.value,'1000');
});
test('missing or invalid printed taxpayer identity keeps numeric source facts in review',()=>{
 for(const text of [
  'Бухгалтерский баланс\nна 31 декабря 2025 г.\nЕдиница измерения: тыс. руб. по ОКЕИ 384',
  'Бухгалтерский баланс\nИНН: 1234567890\nна 31 декабря 2025 г.\nЕдиница измерения: тыс. руб. по ОКЕИ 384'
 ]){
  const report=sample({text});
  assert.equal(report.status,'INCOMPLETE');
  assert.ok(report.issues.includes('BFO_SUBJECT_INN_UNVERIFIED'));
  assert.equal(f(report,'1600')?.status,'REVIEW');
 }
});
test('geometric scanned table amounts still flow through the same metadata gate',()=>{
 const tok=(s,x,y,w=String(s).length*4,h=6)=>({str:String(s),width:w,transform:[1,0,0,h,x,y]});
 const tokens=[350,460,570].flatMap((x,i)=>[
  tok('На',x,-75,13),tok('31',x+17,-75,10),
  tok('декабря',x+31,-75,33),tok(String(2025-i),x+67,-75,20)
 ]).concat([
  tok('Внеоборотные активы',20,-110,180),tok('1100',315,-110,24),tok('100',375,-110,30),tok('90',485,-110,30),tok('80',595,-110,30),
  tok('Оборотные активы',20,-135,180),tok('1200',315,-135,24),tok('900',375,-135,30),tok('810',485,-135,30),tok('720',595,-135,30),
  tok('БАЛАНС',20,-160,180),tok('1600',315,-160,24),tok('1000',375,-160,30),tok('900',485,-160,30),tok('800',595,-160,30),
  tok('Капитал',20,-185,180),tok('1300',315,-185,24),tok('400',375,-185,30),tok('350',485,-185,30),tok('300',595,-185,30),
  tok('Обязательства',20,-210,180),tok('1500',315,-210,24),tok('600',375,-210,30),tok('550',485,-210,30),tok('500',595,-210,30),
  tok('БАЛАНС',20,-235,180),tok('1700',315,-235,24),tok('1000',375,-235,30),tok('900',485,-235,30),tok('800',595,-235,30),
 ]);
 const geom=financialTableRows(tokens,1,true);
 assert.deepEqual(geom.map(r=>r.code),['1100','1200','1600','1300','1500','1700']);
 const text='Бухгалтерский баланс\nИНН: '+inn+'\nна 31 декабря 2025 г.\nЕдиница измерения: тыс. руб. по ОКЕИ 384';
 const good=reviewFields('synthetic-geom',[page(text)],1,'BFO','SINGLE',[],geom);
 assert.equal(good.status,'READY_FOR_REVIEW');
 assert.equal(f(good,'1600')?.value,'1000');
 assert.equal(f(good,'1700')?.value,'1000');
 assert.equal(f(good,'1600')?.status,'READ');
 const missing=reviewFields('synthetic-geom-unknown-scale',[page(text.replace('Единица измерения: тыс. руб. по ОКЕИ 384',''))],1,'BFO','SINGLE',[],geom);
 assert.equal(missing.status,'INCOMPLETE');
 assert.equal(f(missing,'1600')?.value,'1000');
 assert.equal(f(missing,'1600')?.status,'REVIEW');
});

test('OCR coordinate-bound identity allows previously incomplete scanned financial review',()=>{
 const row=(s,x)=>['5','1','1','1','1','1',String(x),'300','48','18','94',s].join('\t');
 const recovered=financialOcrInnFromTsv([row('ИНН',850),row('5042149315',1080)].join('\n'));
 assert.equal(recovered,inn);
 const lines=['Бухгалтерский баланс','на 31 декабря 2025 г.','Единица измерения: тыс. руб. по ОКЕИ 384'];
 const text=lines.concat('ИНН: '+recovered+' (координатная сверка OCR)').join('\n');
 const result=sample({text});
 assert.equal(result.status,'READY_FOR_REVIEW');
 assert.equal(f(result,'company_inn')?.value,inn);
 assert.equal(f(result,'1600')?.value,'1000');
 const absent=sample({text:lines.join('\n')});
 assert.equal(absent.status,'INCOMPLETE');
 assert.ok(absent.issues.includes('BFO_SUBJECT_INN_UNVERIFIED'));
});

test('scanned F2 split over three printed lines is routed, dated and scaled as an income statement',()=>{
 const text=[
  'Отчёт','о финансовых','результатах',
  'за 2025 год','ИНН: '+inn,'Единица измерения: тыс. руб. по ОКЕИ 384',
  'Выручка | 2110 | 120 | 100','Чистая прибыль | 2400 | 20 | 15'
 ].join('\n');
 const report=reviewFields('synthetic:wrapped-f2',[page(text)],1,'BFO','SINGLE');
 assert.equal(report.status,'READY_FOR_REVIEW');
 assert.equal(f(report,'statement_date')?.value,'2025-12-31');
 assert.equal(f(report,'period_start')?.value,'2025-01-01');
 assert.equal(f(report,'statement_unit')?.value,'тыс. ₽');
 assert.equal(f(report,'2110')?.value,'120');
 assert.equal(f(report,'2110')?.status,'READ');
 assert.equal(report.issues.includes('BFO_FINANCIAL_PAGE_BOUNDARY_UNVERIFIED'),false);
});
test('two-line F2 heading is accepted without falsely inventing a balance sheet',()=>{
 const text=[
   'Отчёт о финансовых','результатах',
   'за 2025 год','ИНН: '+inn,'Единица измерения: тыс. руб. по ОКЕИ 384',
   'Выручка | 2110 | 120 | 100'
 ].join('\n');
 const report=reviewFields('synthetic:f2-two-line',[page(text)],1,'BFO','SINGLE');
 assert.equal(report.status,'READY_FOR_REVIEW');
 assert.equal(f(report,'2110')?.value,'120');
 assert.equal(report.issues.includes('BFO_BALANCE_TOTALS_UNVERIFIED'),false);
});
test('heading parts from different physical pages cannot manufacture an F2 document',()=>{
 const a={...page('Отчёт\no финансовых'),page:1,logicalPage:1};
 const b={...page('результатах\nза 2025 год\nИНН: '+inn),page:2,logicalPage:2};
 const report=reviewFields('synthetic:cross-page-title',[a,b],2,'BFO','SINGLE');
 assert.notEqual(report.status,'READY_FOR_REVIEW');
 assert.equal(report.fields.length,0);
});
