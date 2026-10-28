import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalAnalystAnswer} from '../lib/ai-credit-analyst.ts';
import {reportAcceptanceModel} from './fixtures/report-local-acceptance.mjs';
const model=await reportAcceptanceModel();
export const questions=[
 'Сопоставь годовую и промежуточную выручку и прибыль. Укажи периоды и объясни, почему это разные показатели.',
 'Какой остаток долга подтверждён сейчас? Чем он отличается от 1,5 млн рублей в отчёте БКИ? Актуален ли указанный следующий платёж?',
 'Почему общий индекс и долговая ёмкость не рассчитаны, хотя загружены четыре документа и есть 12 месяцев выписок? Каких подтверждений не хватает?'
];
test('reproduction: annual versus cumulative interim explanation uses actual period semantics',()=>{
 const a=buildLocalAnalystAnswer(questions[0],model);assert.match(a,/12 месяцев/);assert.match(a,/6 месяцев/);assert.match(a,/нарастающим итогом/);assert.match(a,/удваивать/);assert.match(a,/ухудшени/);
});
test('reproduction: debt answer dates past payment, overdue and observed anchor explicitly',()=>{
 const a=buildLocalAnalystAnswer(questions[1],model);assert.match(a,/15\.07\.2026/);assert.match(a,/28\.10\.2026/);assert.match(a,/не доказывает.*оплат.*просроч/);assert.match(a,/просрочка[^\n]+30\.06\.2026/i);assert.match(a,/наблюдаем[^\n]+не[^\n]+будущ/i);
});
test('reproduction: composite index/capacity question explains actual coverage and capacity limitations',()=>{
 const a=buildLocalAnalystAnswer(questions[2],model);assert.match(a,/динамика банковского оборота/);assert.match(a,/юридический статус/);assert.match(a,/полнота.*счет/i);assert.match(a,/график/);assert.match(a,/12/);assert.match(a,/Следующее опубликованное действие/);
});
test('period semantics come from model, not question; partial/absent dates are honest',()=>{
 const m=structuredClone(model),p=m.full.report.financialAnalysis.history.find(p=>p.period.flowPeriodType==='CUMULATIVE_YTD');
 p.period.monthsCovered=9;p.period.to='2026-09-30';p.period.from=null;
 const a=buildLocalAnalystAnswer('Сравни годовую выручку с промежуточной за 6 месяцев',m);assert.match(a,/9 месяцев/);assert.match(a,/30\.09\.2026/);assert.doesNotMatch(a,/за 6 месяцев|не указан.*не указан/);
 p.period.flowPeriodType='STANDALONE_PERIOD';assert.match(buildLocalAnalystAnswer(questions[0],m),/самостоятельный период/);
 p.period.from=null;p.period.to=null;const b=buildLocalAnalystAnswer(questions[0],m);assert.match(b,/Период не указан/);assert.doesNotMatch(b,/не указан —.*не указан/);
});
test('debt dates use assessment, known zero is dated and unknown is never fabricated',()=>{
 const m=structuredClone(model),o=m.full.report.analysisV3.portfolio[0];
 o.overdue={...o.overdue,value:0,knowledge:'KNOWN'};
 const before=JSON.stringify(m);let a=buildLocalAnalystAnswer(questions[1],m).replace(/\u00a0|\u202f/g,' ');assert.match(a,/просрочка — 0 ₽; сведения на 30\.06\.2026/);assert.match(a,/текущий основной долг по доступным данным значение не подтверждено/);assert.equal(JSON.stringify(m),before);
 m.full.report.meta.asOfDate='2026-07-01';a=buildLocalAnalystAnswer(questions[1],m);assert.match(a,/позже даты оценки/);assert.doesNotMatch(a,/уже прошла/);
 m.full.report.meta.asOfDate='';a=buildLocalAnalystAnswer(questions[1],m);assert.match(a,/Недостаточно дат/);assert.doesNotMatch(a,/уже прошла|позже даты оценки/);
});
test('composite answer reflects changing canonical coverage, not fixture codes; model unchanged',()=>{
 const m=structuredClone(model),before=JSON.stringify(m);const a=buildLocalAnalystAnswer(questions[2],m);assert.equal(JSON.stringify(m),before);
 for(const row of m.full.canonical.prescoreIndex.coverage.components){row.state='ADEQUATE';row.missingFactCodes=[];}
 m.full.canonical.debtCapacity.warnings=[];
 const b=buildLocalAnalystAnswer(questions[2],m);assert.doesNotMatch(b,/Не подтверждён юридический статус|динамика банковского оборота|Полнота охвата банковских счетов/);assert.match(a,/долга/);assert.match(a,/ёмкость/);
});
