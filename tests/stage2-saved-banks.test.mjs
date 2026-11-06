import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {businessCatalog,loadBusiness} from '../lib/credit-engine/credit-lab/business-corpus.mjs';
import {buildCanonicalCreditAnalysis} from '../lib/credit-engine/production/orchestrator.ts';
import {buildDebtCapacity} from '../lib/credit-engine/debt-capacity/engine.ts';
import {entries} from './fixtures/debt-capacity/golden-debt-capacity-pack-v1.mjs';
import {expectations,compareCapacity} from './fixtures/debt-capacity/lab.mjs';
import {historicalBusinessResult} from './fixtures/historical-bank-inputs.mjs';

// Only these three synthetic inputs change the downstream evidence as well as
// the input identity. Preserve the original goldens alongside the exact upgrade.
const reviewed={
  'CL-RU-BUS-011':['9efc1cad64a66032c6235b2c8eac0921f90daa54cfc1ebd4658883af6edd3628',31680000],
  'CL-RU-BUS-020':['d56fc59de1c284d30d44a566b3a0e4d60300154a324db2d034fc5f2a61138aa2',10840000],
  'CL-RU-BUS-022':['5094a8a5d5c911c042946476dfb89da5208bdee7a069f064412dc32c56be2bb7',null],
};
for (const {caseId} of businessCatalog()) test(caseId+' historical snapshot and fresh Stage 2 bank calculation',()=>{
  const {input}=loadBusiness(caseId);
  const historical=historicalBusinessResult(caseId,input);
  const fresh=buildCanonicalCreditAnalysis(input);
  assert.notEqual(fresh.inputFingerprint,historical.inputFingerprint);
  if (!reviewed[caseId]) {
    assert.deepEqual({...fresh,inputFingerprint:historical.inputFingerprint},historical);
    return;
  }
  const [hash,ending]=reviewed[caseId];
  assert.equal(input.analysis.metricsV2.liquidity.endingBalance.value,ending);
  assert.equal(fresh.debtCapacity.liquidityDiagnostics.averageDailyBalance.value,null);
  assert.equal(fresh.debtCapacity.liquidityDiagnostics.minimumDailyBalance.value,null);
  assert.deepEqual(fresh.prescoreIndex,historical.prescoreIndex);
  assert.deepEqual(fresh.model,historical.model);
  assert.equal(createHash('sha256').update(JSON.stringify(fresh)).digest('hex'),hash);
});
test('fresh bank input satisfies all original capacity-pack business and pairwise assertions',()=>{
  const cases=entries();
  const results=new Map();
  for (const entry of cases) {
    let result=null,error=null;
    try { result=buildDebtCapacity(entry.input); }
    catch (e) { error=e.message; }
    results.set(entry.caseId,result);
    const failures=expectations(entry,result,error).filter(item=>item.level==='HARD');
    assert.deepEqual(failures,[],entry.caseId);
  }
  for (const entry of cases) for (const pair of entry.expected.relative??[]) {
    assert.equal(compareCapacity(results.get(entry.caseId),results.get(pair.other),pair.field,pair.operator),true,entry.caseId);
  }
});
