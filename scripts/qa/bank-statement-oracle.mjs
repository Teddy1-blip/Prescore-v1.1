// Private file paths enter only this local process. Output consists of counts and differences.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {analyzeBankStatements,analysisForStorage,screenBankStatements} from '../../lib/prescore.ts';
import {cashEvidence} from '../../lib/workspace/cash-evidence.ts';
import {cashLabels,cashValue} from '../../lib/workspace/cash-series.ts';
const files=process.argv.slice(2);
assert.ok(files.length,'Provide one or more private ruble TXT journals.');
for(const [index,file] of files.entries()){
 const oracle=JSON.parse(execFileSync('python3',['scripts/qa/bank-statement-oracle.py',file],{encoding:'utf8'}));
 const bytes=fs.readFileSync(file);let text;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('windows-1251').decode(bytes);}
 const hash=createHash('sha256').update(bytes).digest('hex');
 const input={fileName:'sample.txt',text,contentHash:hash,sourceId:'statement:'+hash,fileHash:true};
 const screened=screenBankStatements([input]);assert.equal(screened.accepted.length,1);
 const a=analysisForStorage(analyzeBankStatements(screened.accepted)),m=a.metricsV2;
 const deltas={};const delta=(name,actual,expected)=>{assert.equal(typeof actual,'number',name);deltas[name]=Math.round(actual*100)-expected;};
 assert.deepEqual([m.period.from,m.period.to],oracle.period);
 assert.equal(a.transactions.length,oracle.rows);
 assert.equal(a.statementBalanceCheck.state,'VERIFIED');
 delta('opening',a.statementBalanceCheck.opening,oracle.opening);
 delta('reportedEnding',m.liquidity.endingBalance.value,oracle.closing);
 delta('postedIn',a.statementBalanceCheck.inflow,(oracle.total.external_in??0)+(oracle.total.internal_in??0));
 delta('postedOut',a.statementBalanceCheck.outflow,(oracle.total.external_out??0)+(oracle.total.internal_out??0));
 delta('externalIn',m.cashFlow.grossExternalCashInflow.value,oracle.total.external_in??0);
 delta('externalOut',m.cashFlow.grossExternalCashOutflow.value,oracle.total.external_out??0);
 delta('net',m.cashFlow.netExternalCashFlow.value,(oracle.total.external_in??0)-(oracle.total.external_out??0));
 delta('dailyAverage',m.liquidity.averageDailyBalance.value,oracle.average);
 delta('dailyMinimum',m.liquidity.minimumDailyBalance.value,oracle.minimum);
 assert.equal(m.liquidity.lowLiquidityDays.value,oracle.lowDays);
 let drills=0,monthMax=0;const populations={};
 for(const t of a.transactions){const key=(t.classification?.primaryCategory==='INTERNAL_TRANSFER'?'internal_':'external_')+t.direction;populations[key]=(populations[key]??0)+1;}
 assert.deepEqual(populations,oracle.populations);
 assert.deepEqual(m.monthly.map(r=>r.month).sort(),Object.keys(oracle.months).sort());
 for(const row of m.monthly){
   const raw=oracle.months[row.month];
   monthMax=Math.max(monthMax,Math.abs(Math.round(row.externalInflows*100)-(raw.external_in??0)),Math.abs(Math.round(row.externalOutflows*100)-(raw.external_out??0)));
   for(const s of Object.keys(cashLabels)){const value=cashValue(row,s),e=cashEvidence(a,row.month,s,0);assert.equal(e.status,value==null?409:200,s);if(e.status===200)drills++;}
 }
 assert.ok(Object.values(deltas).every(v=>v===0),JSON.stringify(deltas));assert.equal(monthMax,0);
 console.log(JSON.stringify({sample:index+1,populations,rows:oracle.rows,accounts:oracle.accounts,days:oracle.days,months:m.monthly.length,drills,periodMatches:true,lowDaysMatch:true,maxMonthlyDeltaKopecks:monthMax,differenceKopecks:deltas}));
}
