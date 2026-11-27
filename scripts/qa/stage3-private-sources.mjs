// Independent comparisons. Input paths, identifiers, amounts and PDF text stay local.
// Usage: node --experimental-strip-types scripts/qa/stage3-private-sources.mjs kind=file ...
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {extractDocumentText} from '../../lib/credit-engine/server/document-extraction.ts';
import {parseQuarterlyReportText} from '../../lib/quarterly-report.ts';
import {parseCreditHistoryText} from '../../lib/credit-history.ts';
import {adaptFinancialReport} from '../../lib/credit-engine/financial-analysis/quarterly-adapter.ts';
import {buildFinancialAnalysis} from '../../lib/credit-engine/financial-analysis/engine.ts';
import {adaptUploadedBki} from '../../lib/credit-engine/credit-portfolio/bki-adapter.ts';

const result = {financialFiles:0, rawLines:0, ratios:0, knownRatios:0, balanced:0, bureauFiles:0, unsupported:0};
const oracle = fileURLToPath(new URL('./stage3-source-oracle.py',import.meta.url));
for (const arg of process.argv.slice(2)) {
  const sep=arg.indexOf('='), kind=arg.slice(0,sep), filename=arg.slice(sep+1);
  assert.ok(['financial','bureau','unsupported'].includes(kind));
  const text=await extractDocumentText('sample.pdf',new Uint8Array(fs.readFileSync(filename)),kind==='financial'?'financial':'bureau');
  if(kind==='unsupported'){
    assert.throws(()=>parseCreditHistoryText(text,'sample.pdf'),/Формат БКИ пока не распознан/);
    result.unsupported++;
    continue;
  }
  const expected=JSON.parse(execFileSync('python',['-B',oracle,kind,filename],{stdio:['ignore','pipe','ignore']}));
  const source={sourceId:'offline',sourceType:'QUARTERLY',status:'READY',companyInn:expected.inn,
    receivedAt:'2026-11-06',confidence:90,warnings:[]};
  if(kind==='financial'){
    const report=parseQuarterlyReportText(text,'sample.pdf'), meta=report.financialMetadataV2;
    assert.ok(report.companyInn===expected.inn && meta.scaleConfirmed && meta.rawScale===expected.scale,'identity/scale');
    assert.ok(meta.period.from===expected.fromDate && meta.period.to===expected.toDate && meta.period.flowPeriodType==='CUMULATIVE_YTD','period');
    const snapshot=adaptFinancialReport(report,source), analysis=buildFinancialAnalysis([snapshot]).history[0];
    assert.ok(analysis.quality.balanceReconciled===true,'balance equation');
    for(const [code,value] of Object.entries(expected.raw)){
      assert.ok(meta.rawLines[code]===value,'current column at line '+code);
      const field=[...Object.values(snapshot.balance),...Object.values(snapshot.income)].find(f=>f.rawCode===code);
      if(field && value!==null) assert.ok(Math.abs(field.value)===Math.abs(value*expected.scale),'RUB normalization '+code);
      result.rawLines++;
    }
    for(const [key,value] of Object.entries(expected.ratios)){
      const metric=({...analysis.liquidity,...analysis.capitalStructure,...analysis.profitability})[key];
      assert.ok(value===null ? metric.value===null : metric.value!==null && Math.abs(metric.value-value)<0.000001,key+' sample '+result.financialFiles+' oracle-known '+(value!==null)+' actual-known '+(metric.value!==null));
      result.ratios++; if(value!==null) result.knownRatios++;
    }
    result.financialFiles++;result.balanced++;
  }else{
    const r=parseCreditHistoryText(text,'sample.pdf');
    assert.ok(expected.subjectInn && r.subjectInn===expected.subjectInn && r.reportDate===expected.date,'subject/date');
    assert.ok(r.obligations.length===expected.count && r.obligations.filter(o=>o.status==='Действующий').length===expected.active,'obligation counts');
    for(const [k,v] of Object.entries(expected.first)) assert.ok(r.obligations[0][k]===v,'dated field '+k);
    assert.equal(r.affectsCompanyDebt,false);
    const snapshot=adaptUploadedBki(r,{companyInn:'9999999999',source:{...source,companyInn:'9999999999',sourceType:'BKI'}});
    assert.ok(snapshot && !r.affectsCompanyDebt);
    Object.assign(result,{bureauFiles:1,obligations:expected.count,active:expected.active,datedFields:Object.keys(expected.first).length});
  }
}
console.log(JSON.stringify(result));
