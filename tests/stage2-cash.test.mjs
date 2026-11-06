import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';
import {cashStatement,ownLegsStatement} from './fixtures/stage2-cash.mjs';
import {analysisForStorage,analyzeBankStatements} from '../lib/prescore.ts';
import {cashEvidence} from '../lib/workspace/cash-evidence.ts';
import {cashValue,cashLabels} from '../lib/workspace/cash-series.ts';
const workbook = () => ({text:cashStatement(),fileName:'control.txt'});
const analyze=(input)=>analysisForStorage(analyzeBankStatements([input]));
const july='2026-07';
const totals={externalInflows:1020.15,externalOutflows:106.23,operatingReceipts:1000.12,otherReceipts:20.03,debtService:91.17,taxPayments:15.06};

test('1C TXT rows, ruble totals, physical line and bank balances reconcile to cents',()=>{
  const a=analyze(workbook());
  assert.deepEqual(a.statementBalanceCheck,{state:'VERIFIED',from:'2026-07-01',to:'2026-07-31',opening:100,closing:1013.92,inflow:1020.15,outflow:106.23,accountCount:1});
  for(const [series,value] of Object.entries(totals)){
    const e=cashEvidence(a,july,series,0);
    assert.equal(e.status,200);assert.equal(e.body.total,value,series);
    assert.equal(e.body.rows.reduce((s,r)=>s+Math.round(r.amount*100),0),Math.round(value*100));
    assert.ok(e.body.rows.every(r=>cashStatement().split('\n')[r.row-1].startsWith('СекцияДокумент=')&&r.source==='control.txt'));
  }
});

test('own transfer debit and credit legs keep their bank posting sides and do not inflate external flows',()=>{
  const text=ownLegsStatement(), a=analyze({text,fileName:'two-accounts.txt'});
  assert.equal(a.transactions.length,2);assert.deepEqual(a.transactions.map(t=>t.direction).sort(),['in','out']);
  assert.ok(a.transactions.every(t=>text.split('\n')[t.sourceRow-1].startsWith('СекцияДокумент=')));
  assert.equal(a.normalization.exactDuplicateCount,0);
  assert.deepEqual(a.statementBalanceCheck,{state:'VERIFIED',from:'2026-07-01',to:'2026-07-31',opening:50,closing:50,inflow:48.37,outflow:48.37,accountCount:2});
  for(const s of Object.keys(cashLabels)){const r=cashEvidence(a,july,s,0);assert.equal(r.body.total,0);assert.equal(r.body.count,0);}
});

test('missing, inconsistent, or incomplete saved evidence is unavailable',()=>{
  const a=analyze(workbook());
  const gap={...a.metricsV2.monthly[0],month:'2026-08',coverage:'MISSING'};
  a.metricsV2.monthly.push(gap);
  for(const s of Object.keys(cashLabels)){assert.equal(cashValue(gap,s),null);assert.equal(cashEvidence(a,'2026-08',s,0).status,409);}
  for(const partial of [{transactionsTruncated:true},{originalTransactionCount:a.transactions.length+1},{transactions:a.transactions.slice(1)},{storedTransactionCount:0}]){
    assert.equal(cashEvidence({...a,...partial},july,'externalInflows',0).status,409);
  }
  a.metricsV2.monthly[0].externalInflows+=.01;
  assert.equal(cashEvidence(a,july,'externalInflows',0).status,409);
  a.metricsV2.monthly[0].externalInflows=null;
  assert.equal(cashEvidence(a,july,'otherReceipts',0).status,409);
});

test('explicit foreign amounts never enter the ruble graph',()=>{
  const text=statementFixture().replace('Сумма=','Валюта=USD\nСумма=');
  assert.throws(()=>analyze({fileName:'foreign.txt',text}),/рублях/);
});

test('operation pagination neither loses rows nor changes the full total',()=>{
  const one=statementFixture({amount:'0.01',openingBalance:'0.00',endingBalance:'0.51'});
  const d=one.substring(one.indexOf('СекцияДокумент='),one.indexOf('КонецФайла'));
  const text=one.slice(0,one.indexOf('СекцияДокумент=')).replace('ВсегоПоступило=0.01','ВсегоПоступило=0.51')+
    Array.from({length:51},(_,i)=>d.replace('Номер=1','Номер='+(i+1))).join('')+'КонецФайла';
  const a=analyze({fileName:'cents.txt',text});
  const first=cashEvidence(a,july,'externalInflows',0).body;
  const second=cashEvidence(a,july,'externalInflows',first.nextOffset).body;
  assert.deepEqual([first.total,second.total,first.rows.length,second.rows.length,second.nextOffset],[.51,.51,50,1,null]);
  assert.equal(new Set([...first.rows,...second.rows].map(x=>x.id)).size,51);
});

test('ordinary upload, mixed file receipts, BASIC and FULL scoped read from stored analysis',async()=>{
  const rt=await createWorkspaceRuntime();
  try {
    const txt={fileName:'stage2.txt',base64:Buffer.from(cashStatement()).toString('base64')};
    const upload=await rt.request('/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({statements:[
      {fileName:'unknown.xlsx',base64:'QUJD'},txt,txt,{fileName:'foreign.txt',text:statementFixture({inn:'9999999999'})},
    ]})});
    assert.equal(upload.status,200);const body=await upload.json();
    assert.deepEqual(body.screeningResults.map(r=>r.status),['UNSUPPORTED','ACCEPTED','DUPLICATE','COMPANY_MISMATCH']);
    const id=body.analysis.id, url='/api/workspace-model?analysisId='+id;
    const drill=url+'&projection=cash-operations&month='+july+'&series=externalInflows';
    assert.equal((await rt.request(drill)).status,403);
    assert.equal((await rt.request(drill,{},rt.stranger)).status,404);
    await rt.full(id);
    const model=await (await rt.request(url)).json();
    assert.equal(model.basic.bankingFacts.monthly[0].externalInflows,1020.15);
    const detail=await rt.request(drill);assert.equal(detail.status,200);assert.match(detail.headers.get('cache-control'),/private, no-store/);
    const page=await detail.json();assert.equal(page.count,2);
    assert.equal(page.rows[0].hashOf,'file');
    assert.equal(page.rows[0].hash,createHash('sha256').update(Buffer.from(txt.base64,'base64')).digest('hex'));
    assert.equal((await rt.request(drill+'&offset=-1')).status,400);
    assert.equal((await rt.request(drill.replace(july,'2026-18'))).status,400);
  } finally{await rt.close();}
});

test('one-kopeck discrepancy hides derived liquidity yet preserves the reported endpoint',()=>{
  const a=analyze({fileName:'mismatch.txt',text:cashStatement().replace('КонечныйОстаток=1013.92','КонечныйОстаток=1013.91')});
  assert.equal(a.statementBalanceCheck.state,'MISMATCH');
  assert.equal(a.metricsV2.liquidity.endingBalance.value,1013.91);
  for(const field of ['averageDailyBalance','minimumDailyBalance','lowLiquidityDays'])assert.equal(a.metricsV2.liquidity[field].status,'UNKNOWN');
});

test('service account, unproven inactive account, mixed owners and malformed INN cannot establish ownership',()=>{
  for(const text of [
    cashStatement().replaceAll('40702810111110000001','45202810111110000001'),
    cashStatement().replaceAll('9900000002','broken9900000002'),
    cashStatement().replace('КонецРасчСчет','КонецРасчСчет\nСекцияРасчСчет\nРасчСчет=40702810555550000002\nКонецРасчСчет'),
  ]) assert.throws(()=>analyze({fileName:'boundary.txt',text}),/владельц|ИНН/);
});

test('one journal can contain distinct postings with the same document number only when both bank turnover totals agree',()=>{
  const text=cashStatement().replace('Номер=102','Номер=101');
  const a=analyze({fileName:'ledger.txt',text});
  assert.equal(a.transactions.length,4);assert.equal(a.statementBalanceCheck.state,'VERIFIED');
  assert.equal(a.metricsV2.cashFlow.grossExternalCashInflow.value,1020.15);
  const incomplete=analyze({fileName:'unconfirmed.txt',text:text.replace('ВсегоПоступило=1020.15','ВсегоПоступило=1000.12')});
  assert.ok(incomplete.deduplication.conflicts.length>0);
  assert.equal(incomplete.metricsV2.liquidity.endingBalance.value,1013.92);
});

test('component and whole-period evidence have the same support as the monthly published metrics',()=>{
  const a=analyze(workbook()),m=a.metricsV2.monthly[0];
  const targets={principal:91.17,interest:0,unsplit:0,leasing:0,taxOnly:15.06,social:0,netExternal:913.92,nonOperatingReceipts:20.03,unknownInflows:0};
  for(const [key,value] of Object.entries(targets)){
    assert.equal(m[key],value);assert.equal(cashEvidence(a,july,key,0).body.total,value);
  }
  for(const [key,value] of Object.entries({principal:91.17,taxOnly:15.06,netExternal:913.92,externalInflows:1020.15})){
    const e=cashEvidence(a,'all',key,0);assert.equal(e.status,200);assert.equal(e.body.total,value);
  }
});

test('consecutive coverage on the same account uses only the last reported closing balance',()=>{
  const julyFile=statementFixture({amount:'100',openingBalance:'0',endingBalance:'100'});
  const augFile=statementFixture({amount:'50',openingBalance:'100',endingBalance:'150',periodFrom:'01.08.2026',periodTo:'31.08.2026',transactionDate:'15.08.2026',number:'2'});
  const a=analyzeBankStatements([{fileName:'july.txt',text:julyFile},{fileName:'aug.txt',text:augFile}]);
  assert.equal(a.metricsV2.liquidity.endingBalance.value,150);
  assert.equal(a.statementBalanceCheck.closing,150);
});
