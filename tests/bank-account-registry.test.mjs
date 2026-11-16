import test from 'node:test';
import assert from 'node:assert/strict';
import {sourcePeriodAudit} from '../lib/workspace/source-period-audit.ts';
import {bankAccountRegister,lastCompletedMoscowDay} from '../lib/workspace/bank-account-registry.ts';
const inn='9900000001';
const mk=(id,account,from,to,bank='АО Учебный банк',extra={})=>({
 id,kind:'BANK_STATEMENT',documentId:null,
 payload:{envelope:{sourceId:id,sourceType:'BANK_STATEMENT',companyInn:inn,status:'READY',
 receivedAt:'2026-11-16T10:00:00Z',sourceName:bank,fileName:id+'.txt',
 periodBasis:'DECLARED',accountCoverage:[{account,periodFrom:from,periodTo:to}],...extra}},
});
const run=(sources,cutoff='2026-11-15')=>bankAccountRegister(sources,inn,sourcePeriodAudit(sources,inn),cutoff);
test('last complete Moscow calendar day is independent of browser/server local date',()=>{
 assert.equal(lastCompletedMoscowDay(new Date('2026-11-16T20:55:00Z')),'2026-11-16');
 assert.equal(lastCompletedMoscowDay(new Date('2026-11-16T19:59:00Z')),'2026-11-15');
});
test('one account union of adjacent intervals and exact internal gap; latest update request',()=>{
 const docs=[
 mk('first','40702810111110000001','2026-11-01','2026-11-06'),
 mk('middle','40702810111110000001','2026-11-08','2026-11-10'),
 mk('last','40702810111110000001','2026-11-10','2026-11-12'),
 ];
 const register=run(docs),account=register.accounts[0];
 assert.equal(register.referenceDate,'2026-11-15');
 assert.equal(account.bankName,'АО Учебный банк');
 assert.equal(account.accountMask,'Счёт ••••0001');
 assert.deepEqual(account.coverage,[{from:'2026-11-01',to:'2026-11-06'},
  {from:'2026-11-08',to:'2026-11-12'}]);
 assert.deepEqual(account.internalGaps.map(g=>[g.from,g.to,g.days]),[['2026-11-07','2026-11-07',1]]);
 assert.deepEqual(account.refreshGap&&[account.refreshGap.from,account.refreshGap.to,account.refreshGap.days],
  ['2026-11-13','2026-11-15',3]);
 assert.equal(account.overlapCount,1);
 assert.equal(account.state,'REVIEW');
 assert.equal(register.automaticApply,false);
 assert.equal(JSON.stringify(register).includes('40702810111110000001'),false);
});
test('per-account isolation: two banks and two accounts keep distinct freshness and history',()=>{
 const a=mk('a','40702810111110000001','2026-11-01','2026-11-15','Банк А');
 const b=mk('b','40702810111110000002','2026-11-01','2026-11-09','Банк Б');
 const result=run([a,b]);
 assert.equal(result.accounts.length,2);
 const first=result.accounts.find(x=>x.accountMask.endsWith('0001'));
 const second=result.accounts.find(x=>x.accountMask.endsWith('0002'));
 assert.equal(first.bankName,'Банк А');
 assert.equal(first.state,'UP_TO_REFERENCE');
 assert.equal(first.refreshGap,null);
 assert.equal(second.bankName,'Банк Б');
 assert.deepEqual([second.refreshGap.from,second.refreshGap.to],['2026-11-10','2026-11-15']);
 assert.equal(second.state,'UPDATE_NEEDED');
});
test('duplicate hashes do not create a false overlap or repeat a listed interval',()=>{
 const one=mk('one','40702810111110000001','2026-11-01','2026-11-10','Банк А',{contentHash:'a'.repeat(64)});
 const two=mk('two','40702810111110000001','2026-11-01','2026-11-10','Банк А',{contentHash:'a'.repeat(64)});
 const r=run([one,two]);
 assert.equal(r.accounts.length,1);
 assert.equal(r.accounts[0].periods.length,1);
 assert.equal(r.accounts[0].overlapCount,0);
 assert.equal(JSON.stringify(r).includes('a'.repeat(64)),false);
});
test('unknown bank name is not invented from filename, conflicting names trigger review',()=>{
 const a=mk('bank-a','40001','2026-11-01','2026-11-15',undefined);
 a.payload.envelope.sourceName=undefined;
 const s=run([a]).accounts[0];assert.equal(s.bankName,null);
 const b=mk('bank-b','40001','2026-11-10','2026-11-15','Неизвестный банк');
 const r=run([mk('bank-c','40001','2026-11-01','2026-11-05','АО Учебный банк'),b]);
 assert.equal(r.accounts[0].bankName,null);
 assert.equal(r.accounts[0].bankNameConflict,true);
 assert.equal(r.accounts[0].state,'REVIEW');
});
test('unverified source is not certified as covered account or as up-to-date',()=>{
 const observed=mk('observed','40001','2026-11-01','2026-11-15','Учебный банк',
  {periodBasis:'OBSERVED_ONLY'});
 const r=run([observed]);
 assert.equal(r.accounts.length,0);
 assert.equal(r.unverifiedFiles,1);
});
test('bank XLSX is a separate preliminary card, never accepted TXT bank evidence',()=>{
 const canonical=mk('txt','40001','2026-11-01','2026-11-15');
 const xlsx={id:'xlsx',kind:'BANK_XLSX',documentId:null,payload:{
  envelope:{sourceId:'xlsx',sourceType:'BANK_STATEMENT',status:'PROCESSING',companyInn:inn,
   receivedAt:'2026-11-16T10:00:00Z',fileName:'preview.xlsx',sourceName:'Банк из XLSX'},
  bankXlsxReview:{sheets:[{name:'sheet1',account:'40001',periodFrom:'2026-11-01',periodTo:'2026-11-15'}]},
 }};
 const r=run([canonical,xlsx]);
 assert.equal(r.accounts.length,2);
 assert.equal(r.accounts.find(a=>a.preview).state,'PREVIEW');
 assert.equal(r.accounts.find(a=>!a.preview).state,'UP_TO_REFERENCE');
});
test('future-dated source cannot make the registry declare verified freshness',()=>{
 const r=run([mk('future','40001','2026-11-01','2026-11-21')]);
 assert.equal(r.accounts[0].state,'REVIEW');
 assert.equal(r.accounts[0].refreshGap,null);
});
test('same account with non-overlapping periods is still not a claim of complete bank portfolio',()=>{
 const r=run([mk('s','40001','2026-11-01','2026-11-15')]);
 assert.equal(r.accounts.length,1);
 assert.equal(r.accounts[0].state,'UP_TO_REFERENCE');
 assert.equal(r.accounts[0].periods.length,1);
 assert.equal(r.automaticApply,false);
});
