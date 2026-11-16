import test from 'node:test';
import assert from 'node:assert/strict';
import {sourcePeriodAudit} from '../lib/workspace/source-period-audit.ts';
const inn='9900000001';
const envelope=(id,kind,extra={})=>({sourceId:id,sourceType:kind,status:'READY',companyInn:inn,
 receivedAt:'2026-11-16T09:00:00.000Z',confidence:100,warnings:[],...extra});
const row=(id,kind,payload={})=>({id,kind,documentId:null,payload:{envelope:envelope(id,kind,payload.env),...payload}});
const statement=(id,account,from,to)=>row(id,'BANK_STATEMENT',{env:{accountCoverage:[{account,periodFrom:from,periodTo:to}]}});
const financial=(id,kind,period)=>row(id,kind,{env:{periodFrom:period.from,periodTo:period.to},
 snapshot:{period}});
test('bank overlap requires review and missing days request a precise upload',()=>{
 const result=sourcePeriodAudit([
  statement('a','40702000000000000001','2026-10-01','2026-10-05'),
  statement('b','40702000000000000001','2026-10-05','2026-10-10'),
  statement('c','40702000000000000001','2026-10-13','2026-10-15')],inn);
 const g=result.groups[0];
 assert.equal(g.kind,'BANK_STATEMENT');
 assert.equal(g.overlaps.length,1);assert.deepEqual(g.overlaps[0].sourceIds,['a','b']);
 assert.equal(g.overlaps[0].from,'2026-10-05');
 assert.deepEqual(g.gaps.map(x=>[x.from,x.to,x.days]),[['2026-10-11','2026-10-12',2]]);
 assert.match(g.gaps[0].action,/Дозагрузите банковскую выписку/);
 assert.equal(result.automaticApply,false);
});
test('different bank accounts never cross-deduplicate or create false overlaps',()=>{
 const result=sourcePeriodAudit([
  statement('a','40702000000000000001','2026-10-01','2026-10-10'),
  statement('b','40702000000000000002','2026-10-01','2026-10-10')],inn);
 assert.equal(result.groups.length,2);
 assert.ok(result.groups.every(g=>!g.gaps.length&&!g.overlaps.length));
});
test('continuous adjacent bank periods do not depend on individual transaction dates',()=>{
 const result=sourcePeriodAudit([statement('a','40001','2026-01-01','2026-01-10'),
 statement('b','40001','2026-01-11','2026-01-31')],inn);
 assert.equal(result.groups[0].gaps.length,0);
 assert.equal(result.groups[0].overlaps.length,0);
});
test('two bank files with same range are alternatives pending transaction reconciliation',()=>{
 const result=sourcePeriodAudit([statement('a','40001','2026-01-01','2026-01-31'),
 statement('b','40001','2026-01-01','2026-01-31')],inn);
 assert.equal(result.groups[0].overlaps[0].kind,'SAME_PERIOD');
 assert.equal(result.groups[0].gaps.length,0);
});
test('union of nested bank coverage finds only the true uncovered days',()=>{
 const r=sourcePeriodAudit([statement('a','40001','2026-01-01','2026-01-31'),
 statement('b','40001','2026-01-10','2026-01-15'),
 statement('c','40001','2026-02-03','2026-02-28')],inn);
 assert.deepEqual(r.groups[0].gaps.map(x=>[x.from,x.to]),[['2026-02-01','2026-02-02']]);
});
test('annual BFO revisions do not sum, and gap 2025 is discoverable',()=>{
 const period=y=>({kind:'ANNUAL',flowPeriodType:'FULL_YEAR',from:y+'-01-01',to:y+'-12-31',asOf:y+'-12-31'});
 const r=sourcePeriodAudit([financial('24','BFO',period('2024')),
  financial('26','BFO',period('2026')),financial('26-revision','BFO',period('2026'))],inn);
 const g=r.groups[0];
 assert.equal(g.mode,'ANNUAL');assert.equal(g.overlaps.length,1);
 assert.equal(g.overlaps[0].kind,'SAME_PERIOD');
 assert.deepEqual(g.gaps.map(x=>[x.from,x.to]),[['2025-01-01','2025-12-31']]);
});
test('cumulative YTD six and nine months are not incorrectly called duplicates',()=>{
 const q=(id,to)=>financial(id,'QUARTERLY',{kind:'INTERIM',flowPeriodType:'CUMULATIVE_YTD',
  from:'2026-01-01',to,asOf:to});
 const r=sourcePeriodAudit([q('6','2026-06-30'),q('9','2026-09-30')],inn);
 assert.equal(r.groups[0].mode,'CUMULATIVE_YTD');
 assert.equal(r.groups[0].overlaps.length,0);
 assert.equal(r.groups[0].gaps.length,0);
});
test('independent Q1 and Q3 report a Q2 gap, unlike cumulative YTD',()=>{
 const q=(id,from,to)=>financial(id,'QUARTERLY',{kind:'INTERIM',flowPeriodType:'STANDALONE_PERIOD',from,to,asOf:to});
 const r=sourcePeriodAudit([q('q1','2026-01-01','2026-03-31'),q('q3','2026-07-01','2026-09-30')],inn);
 assert.deepEqual(r.groups[0].gaps.map(x=>[x.from,x.to]),[['2026-04-01','2026-06-30']]);
});
test('BKI dated snapshots are not day coverage streams',()=>{
 const r=sourcePeriodAudit([row('one','BKI',{bki:{reportDate:'2026-01-31'}}),
  row('two','BKI',{bki:{reportDate:'2026-08-31'}})],inn);
 assert.equal(r.groups[0].mode,'SNAPSHOT');
 assert.equal(r.groups[0].gaps.length,0);
});
test('different OSS balances at same as-of date flag same-date review, not double debt',()=>{
 const a=row('osv1','DEBT_LEDGER',{ledger:[{asOf:'2026-01-31'}]});
 const b=row('osv2','DEBT_LEDGER',{ledger:[{asOf:'2026-01-31'}]});
 const r=sourcePeriodAudit([a,b],inn);
 assert.equal(r.groups[0].overlaps[0].kind,'SAME_DATE');
 assert.equal(r.groups[0].gaps.length,0);
});
test('preliminary bank XLSX stays in its own scope, not canonical TXT B-score',()=>{
 const x=row('xls','BANK_XLSX',{bankXlsxReview:{sheets:[{name:'Transactions',account:'40001',
 periodFrom:'2026-04-01',periodTo:'2026-04-30'}]}});
 const r=sourcePeriodAudit([statement('txt','40001','2026-04-01','2026-04-30'),x],inn);
 assert.equal(r.groups.length,2);
 assert.equal(r.groups.find(g=>g.kind==='BANK_XLSX_PREVIEW').spans[0].preliminary,true);
});
test('contract, calendar and questionnaire never invent continuous missing days',()=>{
 const r=sourcePeriodAudit([row('contract','CREDIT_DOCUMENT'),row('survey','BANK_QUESTIONNAIRE'),
 row('calendar','CALENDAR_SHEET')],inn);
 assert.equal(r.groups.length,0);
 assert.equal(r.unknown.length,3);
 assert.equal(r.requiresRecalculationReview,false);
});
test('missing bank account and impossible dates cannot produce false complete coverage',()=>{
 const missing=row('unknown','BANK_STATEMENT',{env:{periodFrom:'2026-01-01',periodTo:'2026-01-31'}});
 const invalid=statement('bad','40001','2026-02-30','2026-03-31');
 const r=sourcePeriodAudit([missing,invalid],inn);
 assert.equal(r.groups.length,0);assert.equal(r.unknown.length,2);
});
test('foreign company source never leaks into own coverage matrix',()=>{
 const foreign=row('other','BANK_STATEMENT',{env:{companyInn:'7701000001',accountCoverage:[
  {account:'40001',periodFrom:'2026-01-01',periodTo:'2026-02-28'}]}});
 const r=sourcePeriodAudit([foreign,statement('ours','40001','2026-01-01','2026-01-31')],inn);
 assert.equal(r.groups.length,1);assert.equal(r.groups[0].spans.length,1);
});

test('BKI reports for different subjects on same date never appear as duplicate snapshots',()=>{
 const a=row('corporate','BKI',{bki:{reportDate:'2026-10-01',subjectInn:'9900000001'}});
 const b=row('guarantor','BKI',{bki:{reportDate:'2026-10-01',subjectInn:'998800112233'}});
 const r=sourcePeriodAudit([a,b],inn);
 assert.equal(r.groups.length,2);
 assert.ok(r.groups.every(g=>g.overlaps.length===0));
});
test('two snapshots for same BKI subject and same date require source review not a sum',()=>{
 const a=row('one','BKI',{bki:{reportDate:'2026-10-01',subjectInn:'9900000001'}});
 const b=row('two','BKI',{bki:{reportDate:'2026-10-01',subjectInn:'9900000001'}});
 const r=sourcePeriodAudit([a,b],inn);
 assert.equal(r.groups.length,1);
 assert.equal(r.groups[0].overlaps[0].kind,'SAME_DATE');
 assert.equal(r.groups[0].gaps.length,0);
});
