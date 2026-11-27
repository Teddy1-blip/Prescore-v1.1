import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCreditHistoryText} from '../lib/credit-history.ts';
import {bureauReview,readBureau,modernNbkiSummaryReview} from '../lib/workspace/bureau-review.ts';
import {reviewFields} from '../lib/document-poc/review-fields.ts';
import {BUREAU_MAX_PDF_PAGES} from '../lib/document-poc/local-ocr.ts';
import {bureauOcrToken} from '../lib/document-poc/local-ocr.ts';

const inn='7707083893';
const cover='Кредитный отчет\nот 16 июня 2026 года\nСубъект: юридическое лицо\nИНН организации: '+inn;
const active='Сформирован 16 июня 2026    Действующие кредитные договоры\n'+
  '№   Источник данных/вид обязательств    Общая задолженность\n'+
  '1   Учебный банк   200 000 руб.   120 000 руб.   0 руб.\nДоговор займа (кредита)\n'+
  '1. Учебный банк - Договор займа (кредита)\nВид участия в сделке   Идентификатор сделки   Номер сделки\nЗаёмщик   12345678-1234-1234-1234-123456789abc   К-1';
const pages=[cover,active,'Отчет предоставлен АО «ОКБ»'].map((text,i)=>({page:i+1,logicalPage:i+1,segment:'FULL',method:'OCR',text}));
const payload={envelope:{companyInn:inn,fileName:'report.pdf'},relationship:'Компания-заёмщик'};
test('OKB column amounts use the detail-section role and exact page; no synthetic balance',()=>{
 const r=readBureau(pages.map(p=>p.text).join('\f'),'file.pdf',inn,'Компания-заёмщик');
 assert.equal(r.source,'ОКБ');assert.equal(r.reportDate,'2026-06-16');
 const [loan]=r.obligations;assert.equal(loan.totalOutstanding,120000);assert.equal(loan.outstandingPrincipal,null);
 assert.equal(loan.originalAmount,200000);assert.equal(loan.overdueAmount,0);assert.match(loan.sourcePageHint,/Страница 2/);
 assert.equal(parseCreditHistoryText([cover,active.replace('Заёмщик   ','Поручитель   '),'АО «ОКБ»'].join('\f')).obligations[0].totalOutstanding,null);
});
test('unreadable, truncated, wrong tenant and personal report cannot become confirmed company debt',()=>{
 assert.equal(bureauReview(pages,payload,[]).status,'BUREAU_CONFIRM');
 assert.throws(()=>readBureau(pages.map(p=>p.text).join('\f'),'report.pdf',inn,'Руководитель'));
 assert.equal(bureauReview(pages,payload,['OCR_PAGE_TRUNCATED:2']).status,'INCOMPLETE');
 assert.equal(bureauReview(pages.map(p=>({...p,method:'UNREADABLE'})),payload,[]).status,'INCOMPLETE');
 assert.equal(bureauReview(pages,{...payload,envelope:{companyInn:'7710140679'}},[]).status,'BUREAU_IDENTITY_REVIEW');
 const personal=pages.map(p=>p.text.replace('Субъект: юридическое лицо','Дата рождения')).join('\f');
 assert.equal(readBureau(personal,'report.pdf',inn,'Собственник').affectsCompanyDebt,false);
 assert.throws(()=>readBureau(personal,'report.pdf',inn,'Компания-заёмщик'));
});
test('contracts and supply agreements share field extraction, price has no effect on receivables',()=>{
 for(const title of ['Договор поставки № Т-10','Государственный контракт на поставку № Т-10']){
  const text=[title,'Поставщик: Поставщик Тест','Заказчик: Заказчик Тест','Цена контракта составляет 421 000,50 рублей.'].join('\n');
  const v=reviewFields('test',[{...pages[0],text}],1,'COMMERCIAL','SINGLE');
  assert.equal(v.status,'READY_FOR_REVIEW');
  for(const [key,value] of [['contract_number','Т-10'],['CONTRACT_AMOUNT','421000.5'],['customer','Заказчик Тест']]){
   const f=v.fields.find(f=>f.key===key);assert.equal(f.value,value);assert.ok(f.fragment);assert.equal(f.page,1);
  }
 }
});

test('contract price retains explicitly stated kopecks and flags conflicting fractional amounts',()=>{
 for(const [price,expected] of [['1 000 рублей 35 копеек','1000.35'],['1 000,35 рублей 35 копеек','1000.35'],['1 000,10 рублей 35 копеек',null]]){
  const text='Договор поставки № Т-10\nЦена договора составляет '+price;
  const v=reviewFields('test',[{...pages[0],text}],1,'COMMERCIAL','SINGLE');
  assert.equal(v.fields.find(f=>f.key==='CONTRACT_AMOUNT')?.value??null,expected);
 }
});

test('credit agreement prose binds the contract heading, maturity and interest to the page; conflicts stay unknown',()=>{
 const text=['Кредитный договор № КР-17 от 01.03.2025','Кредитор: Учебный банк','Заёмщик: Компания Тест',
   '2.1. Сумма кредита составляет 150 000 рублей.','2.2. Процентная ставка по кредиту составляет 16,5 % годовых.',
   'Дата окончательного возврата кредита — 01.03.2027.'].join('\n');
 const review=(t)=>reviewFields('test',[{...pages[0],text:t}],1,'CREDIT','SINGLE').fields;
 const keys=Object.fromEntries(review(text).map(f=>[f.key,f]));
 for(const [name,value] of Object.entries({agreement_number:'КР-17',agreement_date:'2025-03-01',credit_amount:'150000',interest_rate:'16.5',maturity_date:'2027-03-01'})){
   assert.equal(keys[name]?.value,value,name);assert.equal(keys[name].page,1);assert.ok(keys[name].fragment);
 }
 const conflict=review(text+'\nПроцентная ставка: 19%').find(f=>f.key==='interest_rate');
 assert.equal(conflict?.value,null);
});

test('low-confidence BKI numbers are withheld, not silently presented as debt or overdue',()=>{
 for(const word of ['120 000','120000','01.10.2026','7707083893','К-1']){
   assert.deepEqual(bureauOcrToken(word,40),{value:'?',requiresReview:true},word);
   assert.deepEqual(bureauOcrToken(word,55),{value:word,requiresReview:false},word);
 }
 assert.deepEqual(bureauOcrToken('Кредитор',3),{value:'Кредитор',requiresReview:false});
 assert.deepEqual(bureauOcrToken('123456',NaN),{value:'?',requiresReview:true});
 assert.equal(bureauReview(pages,payload,['OCR_BKI_NUMERIC_REVIEW:2']).status,'INCOMPLETE');
});

test('company bureau intake covers a 199-page report with an explicit page bound',()=>{
 assert.equal(BUREAU_MAX_PDF_PAGES,256);
 assert.ok(BUREAU_MAX_PDF_PAGES>=199);
});

test('creditor directory lines must not manufacture NBKI obligations from an isolated Вид label',()=>{
 const text=[
  'Субъект: Кредитная история юридического лица',
  'ИНН','Номер','7707083893',
  'Сведения об источниках формирования кредитной истории',
  'Вид: Заимодавец (кредитор) – кредитная организация',
  'Регистрационный номер: 12345',
  'Полное наименование: Учебная организация',
  'Счет','Вид: Срочный кредит','Отношение: Заёмщик',
  'Кредитор: Учебный банк','Счет: QA-1',
  'Размер/лимит: RUB 200000',
  'Открыт: 01-01-2025','Статус: Действующий',
  'Задолж-сть: RUB 120000','Просрочено: RUB 0',
  'При наличии вопросов обратитесь в НБКИ',
  'Предоставлен 16-06-2026',
 ].join('\n');
 const report=parseCreditHistoryText(text,'synthetic-long-nbki.pdf');
 assert.equal(report.source,'НБКИ');
 assert.equal(report.obligations.length,1);
 assert.equal(report.obligations[0].accountNumber,'QA-1');
 assert.equal(report.obligations[0].creditor,'Учебный банк');
});

test('modern NBKI summary does not become confirmed debt or silently create 64 obligations',()=>{
 const intro=[
  'Кредитный отчет для субъекта','ID запроса Пользователь Предоставлен',
  'synthetic-request QATEST 24-08-2023 11:16','Субъект кредитной истории',
  'Полное наименование: ООО ТЕСТ','Номер налогоплательщика: '+inn,
  'При наличии вопросов обращайтесь в НБКИ',
 ].join('\n');
 const summary=[
  'Кредитный отчет для субъекта','Сводка','Счета',
  'Счета                         Договоры                                           Задолженность',
  'Всего: 64                     Сумма обязательств за всю историю: RUB 25000000    Текущая: RUB 4000000',
  'С просрочкой 30+ дней: 1      Следующий платеж: RUB 240000                     Просроченная: RUB 0',
  'Открытых: 1','Запросы','Всего 200',
 ].join('\n');
 const parts=[{...pages[0],text:intro},{...pages[0],page:4,logicalPage:4,text:summary}];
 const proof=modernNbkiSummaryReview(parts,payload);
 assert.ok(proof);
 assert.equal(proof.status,'BUREAU_STRUCTURE_REVIEW');
 assert.ok(proof.issues.includes('BUREAU_2023_RECONCILIATION_REQUIRED'));
 assert.equal(proof.fields.find(f=>f.key==='nbki_reported_accounts')?.value,'64');
 assert.equal(proof.fields.find(f=>f.key==='nbki_reported_current')?.value,'4000000');
 assert.equal(proof.fields.find(f=>f.key==='nbki_reported_overdue')?.value,'0');
 assert.ok(proof.fields.every(f=>f.page===4&&f.status==='SOURCE_ONLY'));
 assert.equal(bureauReview(parts,payload,[]).status,'BUREAU_STRUCTURE_REVIEW');
 assert.notEqual(bureauReview(parts,payload,[]).status,'BUREAU_CONFIRM');
 const wrongInn={...payload,envelope:{...payload.envelope,companyInn:'7710140679'}};
 assert.equal(bureauReview(parts,wrongInn,[]).status,'BUREAU_IDENTITY_REVIEW');
 assert.equal(bureauReview(parts,{...payload,relationship:'Руководитель'},[]).status,'BUREAU_IDENTITY_REVIEW');
 assert.equal(bureauReview(parts,payload,['OCR_BKI_NUMERIC_REVIEW:4']).status,'INCOMPLETE');
});
test('modern NBKI summary rejects duplicated or missing summary without filling zeros',()=>{
 const intro='Кредитный отчет для субъекта\nID запроса Пользователь Предоставлен\nsynthetic QATEST 24-08-2023 11:16\nСубъект кредитной истории\nНомер налогоплательщика: '+inn+'\nПри наличии вопросов обращайтесь в НБКИ';
 const summary='Сводка\nСчета\nСчета                  Договоры                   Задолженность\nВсего: 5                Сумма обязательств за всю историю: RUB 200000  Текущая: RUB 10000\nОткрытых: 2\nЗапросы';
 const pagesA=[{...pages[0],text:intro},{...pages[0],text:summary,page:4}];
 const review=modernNbkiSummaryReview(pagesA,payload);
 assert.ok(review);assert.equal(review.status,'BUREAU_STRUCTURE_REVIEW');
 assert.ok(review.issues.includes('BUREAU_SUMMARY_PARTIAL'));
 assert.equal(review.fields.find(f=>f.key==='nbki_reported_overdue'),undefined);
 const repeated=[...pagesA,{...pages[0],text:summary,page:5}];
 assert.equal(bureauReview(repeated,payload,[]).status,'INCOMPLETE');
});
