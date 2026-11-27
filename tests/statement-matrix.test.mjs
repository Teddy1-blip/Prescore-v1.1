import assert from 'node:assert/strict';
import test from 'node:test';
import {adaptCheckoBfo} from '../lib/credit-engine/financial-analysis/checko-bfo-adapter.ts';
import {normalizeSnapshot} from '../lib/credit-engine/financial-analysis/normalizer.ts';
import {annualPeriod,parseFinancialPeriod} from '../lib/credit-engine/financial-analysis/periods.ts';
import {sourceProjection} from '../lib/workspace/dossier-sources.ts';
import {statementColumns,validStatementPeriod} from '../lib/workspace/statement-matrix.ts';
import {statementPrintBands} from '../lib/workspace/statement-print.ts';
const inn='9900000017',receivedAt='2026-11-15T00:00:00.000Z';
const source=(id,type='BFO')=>({companyInn:inn,sourceId:id,status:'READY',sourceType:type,confidence:90,receivedAt,warnings:[]});
const uploaded=(snapshot)=>({id:snapshot.sourceId,kind:snapshot.sourceType,documentId:'doc-'+snapshot.sourceId,payload:{envelope:snapshot.source,snapshot}});
function quarter(label,id,rawLines={'2110':900,'2400':'(13)'},scale=1000){
  return normalizeSnapshot({source:{...source(id,'QUARTERLY'),fileName:id+'.csv'},period:parseFinancialPeriod(label),rawLines,scale});
}
const external={...source('external-years'),provider:'CHECKO',sourceName:'Checko /finances'};
const years=Object.fromEntries([2017,2018,2019,2021,2022,2023,2024,2025].map(y=>[y,{1600:1500,1700:1490,2110:y,2400:0}]));
function profile(){
  const snapshots=adaptCheckoBfo({company:{ИНН:inn},data:years},external);
  return {id:'profile',kind:'CHECKO',documentId:null,payload:{envelope:source('checko','CHECKO'),publicProfile:{inn,financialStatementsV2:snapshots,sourceManifest:{bfo:external}}}};
}
const project=(rows,full=true)=>({...sourceProjection(rows,inn,full,false).matrix,through:'2026-11-16'});
test('all provider years, gap, exact zero, fractional scaling and balance difference survive to PDF',()=>{
  const matrix=project([profile()]),cols=statementColumns(matrix);
  assert.equal(cols.filter(c=>c.annual).length,9);assert.equal(cols.find(c=>c.year===2020).period,undefined);
  assert.equal(cols[0].period.selected.values.NET_PROFIT.value,0);assert.equal(cols[0].period.difference,10);
  assert.equal(cols[0].period.selected.values.CASH,undefined);assert.equal(cols.at(-1).title,'2026 · 3 кв.');
  const bands=statementPrintBands(matrix);assert.ok(bands.every(b=>b.headers.length<=5));
  assert.ok(bands.flatMap(b=>b.rows).some(r=>r[0].startsWith('2400')&&r.includes('0')));
});
test('Q2 is empty between Q1 and Q3, YTD and standalone stay separate, BASIC sees annual only',()=>{
  const rows=[profile(),uploaded(quarter('3 месяца 2026','q1')),uploaded(quarter('9 месяцев 2026','q3')),uploaded(quarter('3 квартал 2026','alone'))];
  const cols=statementColumns(project(rows)).filter(c=>!c.annual);
  assert.equal(cols.length,4);assert.equal(cols[1].period,undefined);
  assert.deepEqual(new Set(cols.slice(2).map(c=>c.basis)),new Set(['9 мес. с начала года','Отдельный квартал']));
  assert.equal(cols[2].period.selected.values.NET_PROFIT.value,-13000);
  assert.ok(statementColumns(project(rows,false),true).every(c=>c.annual));
});
test('confirmed upload wins the identical year, alternatives retain separate sums, unresolved units cannot displace verified figures',()=>{
  const snap=normalizeSnapshot({source:{...source('upload'),fileName:'Отчёт.csv'},period:annualPeriod(2025),rawLines:{2110:11},scale:1000});
  const rows=[profile(),uploaded(snap)],period=project(rows).periods.at(-1);
  assert.equal(period.selected.values.REVENUE.value,11000);assert.equal(period.selected.documentId,'doc-upload');
  assert.equal(period.alternatives[0].values.REVENUE.value,2025);
  assert.equal(project([profile(),uploaded({...snap,confirmedScale:null})]).periods.at(-1).selected.id,external.sourceId);
});
test('unverified scale, other company, unknown flow, invalid dates and duplicate snapshots',()=>{
  const q=quarter('6 месяцев 2026','q',{'2110':321},null);
  assert.deepEqual(project([uploaded(q),uploaded(q)]).periods.map(p=>p.selected.values),[{}]);
  assert.equal(project([uploaded({...q,companyInn:'other'})]).periods.length,0);
  assert.equal(validStatementPeriod({...q.period,asOf:'2026-06-31'}),false);
  const balance=quarter('по состоянию на 30.06.2026','balance',{'1600':5,'2110':6});
  const values=project([uploaded(balance)]).periods[0].selected.values;
  assert.equal(values.REVENUE,undefined);assert.equal(values.ASSETS_TOTAL.value,5000);
});
test('an annual close keeps earlier interim data accessible in history, no unclosed quarter is invented',()=>{
  const prior=quarter('3 месяца 2025','q1-25'),matrix=project([profile(),uploaded(prior)]);
  assert.ok(!statementColumns(matrix).some(c=>c.id===prior.snapshotId));
  assert.ok(statementColumns(matrix,true).some(c=>c.id===prior.snapshotId));
  assert.deepEqual(statementColumns({...matrix,through:'2026-04-01'}).filter(c=>!c.annual).map(c=>c.title),['2026 · 1 кв.']);
});
test('extended Checko cells expose reported period only, reject conflicting identity',()=>{
  const raw={data:{2025:{2110:{СумОтч:123,СумПрдщ:234},2400:{СумПрдщ:5}}},company:{ИНН:inn}};
  const s=adaptCheckoBfo(raw,external)[0];assert.equal(s.income.REVENUE.value,123);assert.equal(s.income.NET_PROFIT.value,null);
  assert.throws(()=>adaptCheckoBfo({...raw,company:{ИНН:'other'}},external),/COMPANY_MISMATCH/);
});
