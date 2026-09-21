import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReason, diagnostic, inputSummary} from '../lib/credit-engine/production/diagnostics.ts';
import {loadCanonicalReport} from '../lib/credit-engine/production/report-service.ts';
import {analyzeBankStatements, analysisForStorage} from '../lib/prescore.ts';
import {statementFixture} from './fixtures/block1-statements.mjs';
test('diagnostic maps only exact allowlisted conditions, never raw exception text',()=>{
 assert.equal(safeReason(Error('DEBT_CAPACITY_INPUT_INVALID:FULL_MONTH_OUTSIDE_BANK_PERIOD')),'FULL_MONTH_OUTSIDE_BANK_PERIOD');
 for(const message of ['password=secret SELECT * FROM clients','DEBT_CAPACITY_INPUT_INVALID:FULL_MONTH_OUTSIDE_BANK_PERIOD secret','TypeError: financial payload']) assert.equal(safeReason(Error(message)),'UNEXPECTED_FAILURE');
 const d=diagnostic('secret','secret');assert.equal(d.stage,'SAVED_INPUT');assert.equal(d.reason,'UNEXPECTED_FAILURE');assert.equal(d.category,'PROGRAMMING_OR_RUNTIME_ERROR');assert.match(d.id,/^[0-9a-f-]{36}$/);
});
test('structural summary never echoes arbitrary fields, document contents or amounts',()=>{
 const secret='SENSITIVE_SENTINEL';const s=inputSummary({companyName:secret,metricsV2:{version:secret,period:{from:secret},monthly:[{month:secret,coverage:secret,operatingReceipts:999999}]},sourceManifest:{bankStatements:[{status:secret,fileName:secret,content:secret}]},transactions:[{description:secret}]},{raw:secret});
 assert.doesNotMatch(JSON.stringify(s),/SENSITIVE_SENTINEL|999999/);assert.equal(s.displayTransactions,1);
});
test('regression: swallowed validator condition survives service without weakening validation',async()=>{
 const a=analysisForStorage(analyzeBankStatements([{text:statementFixture(),fileName:'anonymous.txt'}]));
 const before=JSON.stringify(a);const d={readAccess:async()=>({row:{payload:before,companyInn:a.companyInn},access:'owner'}),readTier:async()=> 'FULL',readProfile:async()=>undefined,includeInputDiagnostics:true};
 const r=await loadCanonicalReport(a.id,d);assert.equal(r.status,'UNAVAILABLE');assert.equal(r.diagnostic.stage,'CAPACITY');assert.equal(r.diagnostic.reason,'FULL_MONTH_OUTSIDE_BANK_PERIOD');assert.equal(r.diagnostic.category,'INCOMPATIBLE_INPUT');assert.ok(r.inputSummary.metricsPresent);assert.equal(JSON.stringify(a),before);
 const normal=await loadCanonicalReport(a.id,{...d,includeInputDiagnostics:false});assert.equal(normal.inputSummary,undefined);
});
test('diagnostics cannot bypass ownership or FULL',async()=>{
 for(const access of [null,{row:{payload:'INVALID'},access:'owner'}]) {const r=await loadCanonicalReport('test',{includeInputDiagnostics:true,readAccess:async()=>access,readTier:async()=> 'FREE',readProfile:async()=>assert.fail('profile access forbidden')});assert.deepEqual(r,{status:access?'LOCKED':'NOT_FOUND'});}
});
