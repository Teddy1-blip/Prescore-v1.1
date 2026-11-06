/** Native SB/NBKI text parser -> BKI adapter -> portfolio checks.
 * Synthetic text only: no PDF extraction, mocked engines, HTTP or DB writes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCreditHistoryText,compareCreditPortfolio} from '../lib/credit-history.ts';
import {adaptUploadedBki} from '../lib/credit-engine/credit-portfolio/bki-adapter.ts';
import {buildCreditPortfolio} from '../lib/credit-engine/credit-portfolio/resolver.ts';

const inn='123456789012';
function fixture({overdue='нет',next=null,nextDate=null,history='2026 0 0 0',heading='Следующий платёж',inline=false,second=''}={}) {
 const field=(name,value)=>name+(inline?': ':'\n')+value;
 return `Иванов Иван Иванович
Содержание
Рейтинг и портрет заёмщика
Ваш рейтинг — 811
Главное о кредитной истории
Банк: Тест Банк  Действующий
Потребительский кредит
Данные обновлены 01.08.2026
Взяли на таких условиях
200 000.00 ₽ с 01.01.2025 по 01.01.2028
Выплатили
80 000.00 ₽
Осталось выплатить
120 000.00 ₽
120 000.00 ₽
Полная стоимость кредита
19.5 % годовых или 30 000.00 ₽
Среднемесячный платёж
9 000.00 ₽
${overdue===null?'':field('Текущая просрочка',overdue)}
${next===null?'':field(heading,next)}
${nextDate===null?'':field('Дата следующего платежа',nextDate)}
${history===null?'':`Своевременность платежей по договору\n${history}`}
${second}
Закрытые кредиты, займы, карты
Отчёт от 2 августа 2026
ИНН ${inn}`;
}
const parse=(options={})=>parseCreditHistoryText(fixture(options),'synthetic-bki.pdf');
const obligation=options=>parse(options).obligations[0];
const source={sourceId:'bki-field-fixture',sourceType:'BKI',status:'READY',companyInn:inn,receivedAt:'2026-08-02',confidence:98,warnings:[]};
const snapshot=report=>adaptUploadedBki(report,{companyInn:inn,source});

for(const token of ['нет данных','Нет данных','данные отсутствуют','не указано','—','-','']) {
 test(`unknown current overdue stays unknown: ${JSON.stringify(token)}`,()=>{
  const o=obligation({overdue:token});
  assert.equal(o.overdueAmount,null);
  assert.equal(o.nextPaymentAmount,null);
  assert.equal(o.paymentQuality,'Недостаточно данных','zero historical days do not prove current arrears absent');
  const f=snapshot(parse({overdue:token})).obligations[0].fields.overdueAmount;
  assert.equal(f.value,null);assert.equal(f.knowledge,'UNKNOWN');
 });
}
for(const inline of [false,true])for(const next of [null,'нет данных','—','9 000.00 ₽']) {
 test(`current 5000 is not overwritten or copied to next payment: ${inline}/${next}`,()=>{
  const o=obligation({overdue:'5 000.00 ₽',next,inline});
  assert.equal(o.overdueAmount,5000);
  assert.equal(o.nextPaymentAmount,next==='9 000.00 ₽'?9000:null);
  assert.equal(o.paymentQuality,'Негативное обслуживание');
 });
}
for(const token of ['нет','Нет','отсутствует','0.00 ₽','0 ₽']) {
 test(`explicit absence/zero remains known in canonical BKI: ${token}`,()=>{
  const report=parse({overdue:token}),o=report.obligations[0];
  assert.equal(o.overdueAmount,0);assert.equal(o.paymentQuality,'Без просрочек');
  assert.equal(o.fieldProvenance?.overdueAmount?.origin,'REPORTED');
  const f=snapshot(report).obligations[0].fields.overdueAmount;
  assert.equal(f.value,0);assert.equal(f.knowledge,'KNOWN');
 });
}
for(const heading of ['Следующий платёж','Следующий платеж','Ближайший платёж'])for(const overdue of ['нет','нет данных','5 000.00 ₽']) {
 test(`labelled next amount/date separate from overdue: ${heading}/${overdue}`,()=>{
  const o=obligation({overdue,next:'9 000.00 ₽',nextDate:'01.09.2026',heading});
  assert.equal(o.overdueAmount,overdue==='нет'?0:overdue==='нет данных'?null:5000);
  assert.equal(o.nextPaymentAmount,9000);assert.equal(o.nextPaymentDate,'2026-09-01');
  assert.equal(o.monthlyPayment,9000);
 });
}
test('a dated overdue amount does not become a dated next payment',()=>{
 const o=obligation({overdue:'5 000.00 ₽\nпо состоянию на 01.08.2026'});
 assert.equal(o.overdueAmount,5000);assert.equal(o.nextPaymentAmount,null);assert.equal(o.nextPaymentDate,'');
});
test('missing overdue label cannot borrow the explicitly labelled next payment',()=>{
 const o=obligation({overdue:null,next:'9 000.00 ₽',nextDate:'01.09.2026'});
 assert.equal(o.overdueAmount,null);assert.equal(o.nextPaymentAmount,9000);assert.equal(o.nextPaymentDate,'2026-09-01');
});
test('missing payment history does not remove explicit current values',()=>{
 const o=obligation({overdue:'5 000.00 ₽',next:'9 000.00 ₽',nextDate:'01.09.2026',history:null});
 assert.equal(o.overdueAmount,5000);assert.equal(o.nextPaymentAmount,9000);assert.equal(o.maxDelinquencyDays,null);
});
test('zero current arrears without known historical timeliness is not an all-clean verdict',()=>{
 const o=obligation({history:null});
 assert.equal(o.overdueAmount,0);assert.equal(o.maxDelinquencyDays,null);assert.equal(o.paymentQuality,'Недостаточно данных');
});
test('known historical delinquency is retained with current arrears absent',()=>{
 const o=obligation({history:'2026 0 3 0'});
 assert.equal(o.overdueAmount,0);assert.equal(o.maxDelinquencyDays,59);assert.equal(o.paymentQuality,'Есть существенная просрочка');
});
test('explicit zero next payment has field-level provenance in canonical values',()=>{
 const report=parse({next:'0.00 ₽',nextDate:'01.09.2026'}),f=snapshot(report).obligations[0].fields.nextPaymentAmount;
 assert.equal(report.obligations[0].nextPaymentAmount,0);assert.equal(f.value,0);assert.equal(f.knowledge,'KNOWN');
});
test('a missing next payment stays unknown despite known zero overdue',()=>{
 const f=snapshot(parse()).obligations[0].fields;
 assert.equal(f.overdueAmount.value,0);assert.equal(f.nextPaymentAmount.value,null);assert.equal(f.nextPaymentAmount.knowledge,'UNKNOWN');
});
test('SB personal source is still excluded from the company portfolio',()=>{
 const report=parse({overdue:'5 000.00 ₽',next:'нет данных'}),s=snapshot(report);
 assert.equal(report.affectsCompanyDebt,false);
 const p=buildCreditPortfolio({companyInn:inn,asOfDate:report.reportDate,creditHistorySnapshots:[s],paymentObservations:[]});
 assert.equal(p.obligations.length,0);
 assert.ok(p.warnings.includes('BKI_NOT_COMPANY_PORTFOLIO_SCOPE'));
});
test('explicit IP source scope retains separately reported arrears through the real portfolio',()=>{
 const report=parse({overdue:'5 000.00 ₽',next:'нет данных'});
 report.relationshipToCompany='ИП-заёмщик';report.affectsCompanyDebt=true;
 const p=buildCreditPortfolio({companyInn:inn,asOfDate:report.reportDate,creditHistorySnapshots:[snapshot(report)],paymentObservations:[]});
 assert.equal(p.obligations.length,1);
 assert.equal(p.obligations[0].currentPosition.overdueAmount.value,5000);
 assert.equal(p.obligations[0].currentPosition.nextPaymentAmount.value,null);
});
test('normal parser facts and repeated serialized adapter result are preserved',()=>{
 const report=parse({next:'9 000.00 ₽',nextDate:'01.09.2026'}),before=JSON.stringify(report),o=report.obligations[0];
 assert.equal(o.creditor,'Тест Банк');assert.equal(o.originalAmount,200000);assert.equal(o.outstandingPrincipal,120000);
 assert.equal(o.monthlyPayment,9000);assert.equal(o.annualRate,19.5);assert.equal(o.openedAt,'2025-01-01');assert.equal(o.scheduledCloseAt,'2028-01-01');
 assert.deepEqual(snapshot(JSON.parse(before)),snapshot(report));assert.equal(JSON.stringify(report),before);
});

for(const [overdue,expected] of [['нет данных',null],['0',0],['5000',5000]])for(const [next,nextExpected] of [['нет данных',null],['9000',9000]]) {
 test(`NBKI labels retain distinct fields through the corporate portfolio: ${overdue}/${next}`,()=>{
  const report=parseCreditHistoryText(`Субъект: Кредитная история юридического лица
Наименование организации
ООО КОНТРОЛЬ
ИНН
Номер
7701234567
Счет
Вид: Срочный кредит
Отношение: Заёмщик
Кредитор: Тест Банк
Счет: NB-1
Размер/лимит: 200000
Полная стоимость: 19.5
Открыт: 01-01-2025
Финальн.платеж: 01-01-2028
Статус: Действующий
Задолж-сть: 120000
Просрочено: ${overdue}
След.платеж: ${next}
Дата след.платежа: 01-09-2026
Просрочки (0 просроч.платежей)
Предоставлен 02-08-2026`,'synthetic-nbki.pdf');
  const o=report.obligations[0];
  assert.equal(o.overdueAmount,expected);assert.equal(o.nextPaymentAmount,nextExpected);assert.equal(o.monthlyPayment,null);
  assert.equal(o.nextPaymentDate,'2026-09-01');assert.equal(o.scheduledCloseAt,'2028-01-01');
  assert.equal(o.paymentQuality,expected===null?'Недостаточно данных':expected===0?'Без просрочек':'Негативное обслуживание');
  const s=adaptUploadedBki(report,{companyInn:report.subjectInn,source:{...source,companyInn:report.subjectInn}});
  const p=buildCreditPortfolio({companyInn:report.subjectInn,asOfDate:report.reportDate,creditHistorySnapshots:[s],paymentObservations:[]});
  assert.equal(p.obligations.length,1);assert.equal(p.obligations[0].currentPosition.overdueAmount.value,expected);
  assert.equal(p.obligations[0].currentPosition.nextPaymentAmount.value,nextExpected);
  assert.equal(p.obligations[0].currentTerms.scheduledPaymentAmount.value,null);
 });
}
test('two SB accounts do not share servicing values or an all-clean report verdict',()=>{
 const second=`Банк: Другой Банк  Действующий
Потребительский кредит
Взяли на таких условиях
300 000.00 ₽ с 01.01.2024 по 01.01.2029
Текущая просрочка
нет данных
Следующий платёж
нет данных
Своевременность платежей по договору
2026 0 0 0`;
 const report=parse({overdue:'нет',next:'9 000.00 ₽',nextDate:'01.09.2026',second});
 assert.equal(report.obligations.length,2);
 assert.equal(report.obligations[0].overdueAmount,0);assert.equal(report.obligations[0].nextPaymentAmount,9000);
 assert.equal(report.obligations[1].overdueAmount,null);assert.equal(report.obligations[1].nextPaymentAmount,null);
 assert.equal(report.summary.debtServiceQuality,'Недостаточно данных');
});
for(const [value,expected] of [['5\u202f000,50 ₽',5000.5],['5\u00a0000,50 ₽',5000.5],['5000 RUB',5000]]) {
 test(`servicing values preserve grouping and supported unit: ${value}`,()=>{
  const o=obligation({overdue:value,next:'9 000,50 ₽'});
  assert.equal(o.overdueAmount,expected);assert.equal(o.nextPaymentAmount,9000.5);
 });
}
test('missing current amount does not borrow a following section heading or date',()=>{
 const o=obligation({overdue:'',next:'9 000.00 ₽',nextDate:'01.09.2026'});
 assert.equal(o.overdueAmount,null);assert.equal(o.nextPaymentAmount,9000);assert.equal(o.nextPaymentDate,'2026-09-01');
});

for(const token of ['нет данных','нет']) {
 test(`legacy explanation respects current-overdue completeness: ${token}`,()=>{
  const report=parse({overdue:token});
  const result=compareCreditPortfolio({report,avgMonthlyInflow:1000000,statementMonthlyDebtPayment:9000,baseMonthlyPaymentCapacity:50000,estimatedLimitMax:1000000,limitConfidence:80});
  const item=result.insights.find(i=>i.title.startsWith('Качество обслуживания долга:'));
  assert.ok(item);
  if(token==='нет данных') {assert.match(item.facts,/недостаточно данных/);assert.doesNotMatch(item.facts,/0 ₽/);assert.doesNotMatch(item.impact,/Отсутствие просрочки поддерживает/);}
  else {assert.match(item.facts,/0 ₽/);assert.match(item.impact,/Отсутствие просрочки поддерживает/);}
 });
}

test('a stated quarterly installment stays distinct from the next payment and monthly debt service',()=>{
 const report=parseCreditHistoryText([
  'Субъект: Кредитная история юридического лица','ИНН','Номер','7701234567','Счет',
  'Вид: Срочный кредит','Отношение: Заёмщик','Кредитор: Тест Банк','Счет: NB-1','Статус: Действующий',
  'Плановый платёж: 15 000','Периодичность платежей: Ежеквартально',
  'След.платеж: 9 000','Предоставлен 02-08-2026'
 ].join('\n'),'synthetic.pdf');
 const o=report.obligations[0];
 assert.equal(o.monthlyPayment,null);assert.equal(o.nextPaymentAmount,9000);
 const s=adaptUploadedBki(report,{companyInn:report.subjectInn,source:{...source,companyInn:report.subjectInn}});
 const p=buildCreditPortfolio({companyInn:report.subjectInn,asOfDate:report.reportDate,creditHistorySnapshots:[s],paymentObservations:[]});
 assert.equal(p.obligations[0].currentTerms.scheduledPaymentAmount.value,15000);
 assert.equal(p.obligations[0].currentTerms.scheduledPaymentFrequency.value,'Ежеквартально');
});
