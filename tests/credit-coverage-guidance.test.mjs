import test from 'node:test';
import assert from 'node:assert/strict';
import {indexGapGuidance,capacityGapGuidance} from '../lib/workspace/credit-coverage-guidance.ts';

test('index: missing legal component blocks, limited operating trend does not independently block',()=>{
 const rows=[{component:'FINANCIAL_STRENGTH',state:'ADEQUATE',missingFactCodes:[]},{component:'OPERATING_BEHAVIOR',state:'LIMITED',missingFactCodes:['BANK_OPERATING_TREND']},{component:'LEGAL_CORPORATE',state:'INSUFFICIENT',missingFactCodes:['LEGAL_LIFECYCLE']}];
 const old=JSON.stringify(rows),result=indexGapGuidance(rows);
 assert.equal(result.length,2);
 assert.equal(result[0].blocksNumericIndex,false);
 assert.equal(result[1].blocksNumericIndex,true);
 assert.match(result[1].label,/юридический статус/);
 assert.doesNotMatch(result[1].action,/Checko|контур|СПАРК/i);
 assert.equal(JSON.stringify(rows),old);
});
test('index: only actual missing codes appear; no invented facts',()=>{
 assert.deepEqual(indexGapGuidance([{component:'LEGAL_CORPORATE',state:'ADEQUATE',missingFactCodes:['LEGAL_LIFECYCLE']}]),[]);
 const r=indexGapGuidance([{component:'OTHER',state:'INSUFFICIENT',missingFactCodes:['CUSTOM'] }]);
 assert.equal(r[0].factCode,'CUSTOM');assert.match(r[0].label,/CUSTOM/);
});
test('capacity: one month, incomplete assessment, excluded scheduled obligation, no zero substitution',()=>{
 const input={status:'INSUFFICIENT_DATA',operatingBasis:{fullMonthCount:1},creditAssessmentReference:{status:'INSUFFICIENT_DATA'},portfolioScheduledDebtService30d:{value:null,complete:false,excludedObligationIds:['loan-a'],unknownObligationIds:[]}};
 const old=JSON.stringify(input),notes=capacityGapGuidance(input,6).join(' ');
 assert.match(notes,/1/);assert.match(notes,/6 полных месяцев/);assert.match(notes,/не полностью/);
 assert.match(notes,/вне расчётной классификации/);assert.doesNotMatch(notes,/просрочка 0|долг отсутствует|9.?000/);
 assert.equal(JSON.stringify(input),old);
});
test('capacity: complete report does not show missing-evidence warnings',()=>{
 const input={status:'CALCULATED',operatingBasis:{fullMonthCount:12},creditAssessmentReference:{status:'CALCULATED'},portfolioScheduledDebtService30d:{value:0,complete:true,excludedObligationIds:[],unknownObligationIds:[]}};
 assert.deepEqual(capacityGapGuidance(input,6),[]);
});
test('capacity: unknown portfolio payment never becomes a factual zero',()=>{
 const input={status:'PARTIAL',operatingBasis:{fullMonthCount:8},creditAssessmentReference:{status:'PARTIAL'},portfolioScheduledDebtService30d:{value:null,complete:false,excludedObligationIds:[],unknownObligationIds:['u']}};
 const text=capacityGapGuidance(input,6).join(' ');
 assert.match(text,/не полностью/);assert.match(text,/1 обязательствам/);assert.doesNotMatch(text,/6 полных/);
});
