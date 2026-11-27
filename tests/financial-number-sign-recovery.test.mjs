/** Native source parser -> normalized financial snapshot -> financial engine.
 * Text fixtures are synthetic. No mocked parser/engine or database writes.
 * This suite does not exercise PDF/XLSX byte extraction, HTTP or the browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQuarterlyReportText} from '../lib/quarterly-report.ts';
import {adaptFinancialReport} from '../lib/credit-engine/financial-analysis/quarterly-adapter.ts';
import {buildFinancialAnalysis} from '../lib/credit-engine/financial-analysis/engine.ts';

const inn='7701234567';
function fixture({profit='320',equity='500',netAssets='500',cost='(1500)',unit='тыс. руб.',period='2025 год',coded=true}={}){
 const row=(label,code,value)=>`${label}${coded?' '+code:''} ${value}`;
 return `Бухгалтерская отчетность за ${period}
Организация ООО КОНТРОЛЬНЫЙ ПРИМЕР
ИНН ${inn}
Единица измерения: ${unit}
${row(coded?'БАЛАНС Актив':'Активы всего','1600','1000')}
${row('Внеоборотные активы','1100','400')}
${row('Оборотные активы','1200','600')}
${row('Капитал и резервы','1300',equity)}
${row('Долгосрочные обязательства','1400','200')}
${row('Краткосрочные обязательства','1500','300')}
${row('Дебиторская задолженность','1230','300')}
${row('Денежные средства','1250','100')}
${row('Выручка (нетто)','2110','2000')}
${row('Себестоимость продаж','2120',cost)}
${row('Чистая прибыль (убыток)','2400',profit)}
Чистые активы ${netAssets}`;
}
function run(options={}){
 const report=parseQuarterlyReportText(fixture(options),'synthetic.csv');
 const period=report.financialMetadataV2.period;
 const source={sourceId:'financial-sign-fixture',sourceType:period.kind==='ANNUAL'?'BFO':'QUARTERLY',status:'READY',companyInn:inn,receivedAt:'2026-10-21',confidence:98,warnings:[]};
 const snapshot=adaptFinancialReport(JSON.parse(JSON.stringify(report)),source);
 const analysis=buildFinancialAnalysis([snapshot]);
 return {report,snapshot,analysis,period:analysis.history[0]};
}
const negatives=[
 ['parentheses with four digits','(1234)',-1234],
 ['parentheses with ungrouped decimal','(12345,67)',-12345.67],
 ['parentheses with inner padding','( 1234 )',-1234],
 ['standard grouped parentheses','(1 234 567,89)',-1234567.89],
 ['Unicode minus','−1234',-1234],
 ['Unicode minus with space','− 1234',-1234],
 ['narrow no-break separator','(1\u202f234,50)',-1234.5],
 ['thin-space separator','(1\u2009234,50)',-1234.5],
];
for(const [name,token,expected] of negatives) for(const coded of [true,false]){
 test(`${name}: ${coded?'coded':'label-only'} net loss stays negative through the financial engine`,()=>{
  const {report,snapshot,period}=run({profit:token,coded});
  const raw=coded?report.financialMetadataV2.rawLines['2400']:report.financialMetadataV2.labelValues['2400'].rawValue;
  assert.equal(raw,expected,'source sign must be preserved before scaling');
  assert.equal(snapshot.income.NET_PROFIT.value,expected*1000);
  assert.equal(period.amounts.NET_PROFIT.value,expected*1000);
  assert.ok(period.profitability.netMargin.value<0,'loss must not produce a positive margin');
  assert.equal(snapshot.income.NET_PROFIT.origin,'REPORTED');
  assert.equal(snapshot.income.NET_PROFIT.status,'KNOWN');
 });
}
for(const periodName of ['2025 год','Январь - Март 2026 года']) for(const [unit,scale]of [['руб.',1],['тыс. руб.',1000],['млн руб.',1000000]]){
 test(`${periodName}, ${unit}: scaling preserves loss and recorded period`,()=>{
  const {snapshot,period}=run({profit:'(1234)',period:periodName,unit});
  assert.equal(snapshot.income.NET_PROFIT.value,-1234*scale);
  assert.equal(snapshot.confirmedScale,scale);
  assert.equal(snapshot.period.kind,periodName.startsWith('2025')?'ANNUAL':'INTERIM');
  assert.equal(period.amounts.NET_PROFIT.value,-1234*scale);
 });
}
for(const coded of [true,false]){
 test(`negative equity and net assets remain separate reported values (${coded?'codes':'labels'})`,()=>{
  const {report,snapshot}=run({equity:'(1234)',netAssets:'(2345)',coded});
  assert.equal(report.values.equity,-1234000);
  assert.equal(snapshot.balance.EQUITY.value,-1234000);
  assert.equal(snapshot.reportedNetAssets.value,-2345000);
  assert.equal(snapshot.reportedNetAssets.origin,'REPORTED');
 });
}
test('four-digit expense parentheses preserve source sign',()=>{
 const {report,snapshot}=run({cost:'(1500)'});
 assert.equal(report.financialMetadataV2.rawLines['2120'],-1500);
 assert.equal(snapshot.income.COST_OF_SALES.rawValue,-1500);
 assert.equal(snapshot.income.COST_OF_SALES.value,1500000,'existing expense magnitude convention is unchanged');
 assert.ok(snapshot.income.COST_OF_SALES.warnings.includes('EXPENSE_SIGN_NORMALIZED'));
});
for(const [token,value]of [['320',320],['0',0],['(50)',-50],['-1234',-1234],['(1 234)',-1234],['1 234,50',1234.5]]){
 test(`existing unambiguous number ${token} retains its value`,()=>{
  const {report,snapshot}=run({profit:token});
  assert.equal(report.financialMetadataV2.rawLines['2400'],value);
  assert.equal(snapshot.income.NET_PROFIT.value,value*1000);
 });
}
test('missing scale never becomes a KNOWN financial amount',()=>{
 const {snapshot}=run({profit:'(1234)',unit:'не указана'});
 assert.equal(snapshot.income.NET_PROFIT.status,'UNKNOWN');
 assert.equal(snapshot.income.NET_PROFIT.value,null);
});
test('missing net profit is not filled from a following unrelated financial row',()=>{
 const text=fixture().replace('Чистая прибыль (убыток) 2400 320','Чистая прибыль (убыток) 2400');
 const report=parseQuarterlyReportText(text,'synthetic.csv');
 assert.equal(report.financialMetadataV2.rawLines['2400'],null);
});
test('negative amounts survive serialization without mutating the parsed source',()=>{
 const report=parseQuarterlyReportText(fixture({profit:'(1234)'}),'synthetic.csv');
 const before=JSON.stringify(report);
 const source={sourceId:'fixture',sourceType:'BFO',status:'READY',companyInn:inn,receivedAt:'2026-10-21',confidence:98,warnings:[]};
 const snapshot=adaptFinancialReport(report,source);
 buildFinancialAnalysis([snapshot]);
 assert.equal(JSON.stringify(report),before);
 assert.equal(JSON.parse(JSON.stringify(snapshot)).income.NET_PROFIT.value,-1234000);
 assert.equal(snapshot.income.NET_PROFIT.rawCode,'2400');
});
test('company mismatch remains rejected after financial number parsing',()=>{
 const report=parseQuarterlyReportText(fixture({profit:'(1234)'}),'synthetic.csv');
 assert.throws(()=>adaptFinancialReport(report,{sourceId:'other',sourceType:'BFO',status:'READY',companyInn:'7707654321',receivedAt:'2026-10-21',confidence:98,warnings:[]}),/FINANCIAL_COMPANY_MISMATCH/);
});

for(const token of ['(1234','1234)']) for(const coded of [true,false]){
 test(`incomplete accounting parentheses ${token} remain unknown (${coded?'codes':'labels'})`,()=>{
  const {snapshot}=run({profit:token,coded});
  assert.equal(snapshot.income.NET_PROFIT.value,null);
  assert.equal(snapshot.income.NET_PROFIT.status,'UNKNOWN');
 });
}
for(const coded of [true,false]){
 test(`wrapped negative value belongs to its own financial row (${coded?'codes':'labels'})`,()=>{
  const target=coded?'Чистая прибыль (убыток) 2400':'Чистая прибыль (убыток)';
  const text=fixture({coded}).replace(target+' 320',target+'\n(1234)');
  const report=parseQuarterlyReportText(text,'synthetic.csv');
  const source={sourceId:'wrapped',sourceType:'BFO',status:'READY',companyInn:inn,receivedAt:'2026-10-21',confidence:98,warnings:[]};
  assert.equal(adaptFinancialReport(report,source).income.NET_PROFIT.value,-1234000);
 });
 test(`a missing labelled profit cannot borrow net assets (${coded?'codes':'labels'})`,()=>{
  const target=coded?'Чистая прибыль (убыток) 2400':'Чистая прибыль (убыток)';
  const report=parseQuarterlyReportText(fixture({coded}).replace(target+' 320',target),'synthetic.csv');
  const source={sourceId:'missing',sourceType:'BFO',status:'READY',companyInn:inn,receivedAt:'2026-10-21',confidence:98,warnings:[]};
  assert.equal(adaptFinancialReport(report,source).income.NET_PROFIT.value,null);
 });
}
test('standalone dash keeps the pre-existing explicit empty-cell convention',()=>{
 const {report,snapshot}=run({profit:'—'});
 assert.equal(report.financialMetadataV2.rawLines['2400'],0);
 assert.equal(snapshot.income.NET_PROFIT.value,0);
 assert.equal(snapshot.income.NET_PROFIT.status,'KNOWN');
});
