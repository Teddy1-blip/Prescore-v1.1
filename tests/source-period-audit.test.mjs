import test from 'node:test';
import assert from 'node:assert/strict';
import {sourcePeriodAudit} from '../lib/workspace/source-period-audit.ts';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';
import {corporation,checkoDouble} from './fixtures/stage4-external.mjs';
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

test('a source with observed-only transaction extrema is not certified as a full statement interval',()=>{
 const input=statement('s','40001','2026-02-01','2026-02-28');
 input.payload.envelope.periodBasis='OBSERVED_ONLY';
 const r=sourcePeriodAudit([input],inn);
 assert.equal(r.groups.length,0);
 assert.equal(r.unknown[0].reason,'BANK_DECLARED_COVERAGE_NOT_CONFIRMED');
});
test('gap disappears after a missing interval is uploaded, without changing other evidence',()=>{
 const old=[statement('a','40001','2026-01-01','2026-01-10'),
  statement('b','40001','2026-01-13','2026-01-31')];
 assert.deepEqual(sourcePeriodAudit(old,inn).groups[0].gaps.map(x=>[x.from,x.to]),
  [['2026-01-11','2026-01-12']]);
 const next=sourcePeriodAudit([...old,statement('c','40001','2026-01-11','2026-01-12')],inn);
 assert.equal(next.groups[0].gaps.length,0);
 assert.equal(next.groups[0].overlaps.length,0);
 assert.equal(next.automaticApply,false);
});

test('owner dossier API closes a bank date gap after a later incremental upload',async()=>{
 const provider=checkoDouble(),rt=await createWorkspaceRuntime({checkoFetch:provider.fetcher});
 try{
  const user=rt.owner;
  const send=(url,payload)=>rt.request(url,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(payload)},user);
  const saved=await send('/api/dossier',{action:'save',inn:corporation});
  assert.equal(saved.status,200,await saved.clone().text());
  const dossierId=(await saved.json()).company.id;
  const add=async(name,from,to,date,number)=>{
   const statement=statementFixture({inn:corporation,company:'ООО Учебный поставщик',bank:'АО Учебный банк',
    account:'40702810111110000001',periodFrom:from,periodTo:to,transactionDate:date,number});
   const response=await send('/api/analysis',{dossierId,statements:[{fileName:name,text:statement}]});
   assert.equal(response.status,200,await response.clone().text());
  };
  await add('jan-first.txt','01.01.2026','10.01.2026','05.01.2026','1');
  await add('jan-last.txt','13.01.2026','31.01.2026','19.01.2026','2');
  const read=async()=>{
   const result=await rt.request('/api/dossier?id='+encodeURIComponent(dossierId),{},user);
   assert.equal(result.status,200,await result.clone().text());
   return result.json();
  };
  const before=await read();
  const source=before.periodAudit.groups.find(g=>g.kind==='BANK_STATEMENT');
  assert.ok(source);
  assert.deepEqual(source.gaps.map(x=>[x.from,x.to]),[['2026-01-11','2026-01-12']]);
  assert.equal(before.versions.length,2);
  await add('jan-missing.txt','11.01.2026','12.01.2026','11.01.2026','3');
  const after=await read();
  assert.equal(after.versions.length,3,'old analysis versions are preserved');
  const filled=after.periodAudit.groups.find(g=>g.kind==='BANK_STATEMENT');
  assert.equal(filled.gaps.length,0);
  assert.equal(filled.spans.length,3);
  assert.equal(after.periodAudit.automaticApply,false);
  assert.equal((await rt.request('/api/dossier?id='+dossierId,{},rt.stranger)).status,404);
 }finally{await rt.close();}
});

test('period-audit API payload never exposes a full bank account or personal BKI subject INN',()=>{
 const account='40702810111110000001';
 const person='998800112233';
 const audit=sourcePeriodAudit([
  statement('bank-a',account,'2026-01-01','2026-01-31'),
  row('personal-bki','BKI',{bki:{subjectInn:person,reportDate:'2026-02-01'}}),
 ],inn);
 const body=JSON.stringify(audit);
 assert.equal(body.includes(account),false);
 assert.equal(body.includes(person),false);
 assert.ok(audit.groups.some(g=>g.kind==='BANK_STATEMENT'&&g.scope.includes('0001')));
});

test('identical bank bytes across separate uploads do not create a false period overlap',()=>{
 const hash='a'.repeat(64);
 const first=statement('old','40001','2026-01-01','2026-01-31');
 const second=statement('new','40001','2026-01-01','2026-01-31');
 first.payload.envelope.contentHash=hash;second.payload.envelope.contentHash=hash;
 const audit=sourcePeriodAudit([first,second],inn);
 assert.deepEqual(audit.duplicates,[{sourceIds:['old','new'],kinds:['BANK_STATEMENT'],reason:'IDENTICAL_FILE_CONTENT'}]);
 assert.equal(audit.groups.length,1);
 assert.equal(audit.groups[0].spans.length,1);
 assert.equal(audit.groups[0].overlaps.length,0);
 assert.equal(audit.automaticApply,false);
 assert.equal(JSON.stringify(audit).includes(hash),false);
});
test('same period with different bytes is a real review overlap, not a proven duplicate',()=>{
 const a=statement('a','40001','2026-03-01','2026-03-31');
 const b=statement('b','40001','2026-03-01','2026-03-31');
 a.payload.envelope.contentHash='a'.repeat(64);
 b.payload.envelope.contentHash='b'.repeat(64);
 const audit=sourcePeriodAudit([a,b],inn);
 assert.equal(audit.duplicates.length,0);
 assert.equal(audit.groups[0].overlaps[0].kind,'SAME_PERIOD');
 assert.equal(audit.automaticApply,false);
});
test('same exact PDF hash across BFO and quarterly is flagged without merging financial periods',()=>{
 const hash='c'.repeat(64);
 const a=financial('annual','BFO',{kind:'ANNUAL',flowPeriodType:'FULL_YEAR',from:'2025-01-01',to:'2025-12-31',asOf:'2025-12-31'});
 const b=financial('quarterly','QUARTERLY',{kind:'INTERIM',flowPeriodType:'CUMULATIVE_YTD',from:'2025-01-01',to:'2025-12-31',asOf:'2025-12-31'});
 a.payload.envelope.contentHash=hash;b.payload.envelope.contentHash=hash;
 const audit=sourcePeriodAudit([a,b],inn);
 assert.equal(audit.duplicates.length,1);
 assert.deepEqual(audit.duplicates[0].kinds,['BFO','QUARTERLY']);
 assert.equal(audit.groups.length,2,'different document classification must remain visible for review');
 assert.ok(!JSON.stringify(audit).includes(hash));
});
test('duplicate contracts with no period get exact-byte notice, not an invented date gap',()=>{
 const hash='d'.repeat(64);
 const a=row('contract-1','CREDIT_DOCUMENT',{env:{contentHash:hash}});
 const b=row('contract-2','CREDIT_DOCUMENT',{env:{contentHash:hash}});
 const result=sourcePeriodAudit([a,b],inn);
 assert.equal(result.duplicates.length,1);
 assert.equal(result.groups.length,0);
 assert.equal(result.automaticApply,false);
});
test('duplicate detection cannot compare a second company or missing/invalid file hashes',()=>{
 const a=statement('a','40001','2026-01-01','2026-01-31');
 const foreign=statement('foreign','40001','2026-01-01','2026-01-31');
 a.payload.envelope.contentHash='a'.repeat(64);foreign.payload.envelope.contentHash='a'.repeat(64);
 foreign.payload.envelope.companyInn='7701000001';
 const without=statement('missing','40001','2026-02-01','2026-02-28');
 const invalid=statement('invalid','40001','2026-03-01','2026-03-31');
 invalid.payload.envelope.contentHash='not-a-hash';
 const result=sourcePeriodAudit([a,foreign,without,invalid],inn);
 assert.equal(result.duplicates.length,0);
 assert.equal(result.groups[0].spans.length,3);
});
