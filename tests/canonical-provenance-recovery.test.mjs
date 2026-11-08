import {reviewed,previousProvenanceCase} from './fixtures/client-report/stage5-baseline.mjs';
import {bankProfileHashes,historicalBusinessResult} from './fixtures/historical-bank-inputs.mjs';
/** Exact review of two metadata-only changes, not a blanket golden refresh.
 * Actual bank parser and canonical engines; no provider calls or engine mocks.
 * Optional extracted corpus uses the same hash-verified synthetic source files.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildBusinessInput} from '../lib/credit-engine/credit-lab/business-input.mjs';
import {businessAssertions} from '../lib/credit-engine/credit-lab/business-assertions.mjs';
import {buildCanonicalCreditAnalysis} from '../lib/credit-engine/production/orchestrator.ts';

const audit=JSON.parse(fs.readFileSync('tests/fixtures/client-report/canonical-provenance-review-20261026.json','utf8'));
const goldens=JSON.parse(fs.readFileSync('tests/fixtures/client-report/analysis-v3-canonical-hashes.json','utf8'));
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const root=process.env.PRESCORE_TEST_EXTRACTED_CORPUS;
const load=root ? caseId=>buildBusinessInput(root,caseId)
 : (await import('../lib/credit-engine/credit-lab/business-corpus.mjs')).loadBusiness;

function assertReviewedDelta(result,entry){
 const current=previousProvenanceCase(result,entry.caseId);
 const before=digest(current),restored=structuredClone(current),seen=new Set();
 assert.equal(before,entry.reviewedOutputHash,'unexpected complete current output');
 for(const change of entry.changes){
  const path=change.path,key=JSON.stringify(path),last=path.at(-1);
  assert.ok(path.length>0&&!path.includes('__proto__')&&!path.includes('constructor'));
  assert.ok(!seen.has(key),'duplicate reviewed path');seen.add(key);
  const metadata=['inputFingerprint','upstreamFingerprint','fingerprint','calculationBasis','includedCategories','excludedCategories'];
  assert.ok(metadata.includes(last)||path.includes('upstreamFingerprints')||(path.at(-2)==='warnings'&&Number.isInteger(last)),'economic fields are not permitted in this review');
  assert.ok(typeof change.before==='string'||(Array.isArray(change.before)&&change.before.every(x=>typeof x==='string')));
  assert.ok(typeof change.after==='string'||(Array.isArray(change.after)&&change.after.every(x=>typeof x==='string')));
  let target=restored;
  for(const part of path.slice(0,-1)){assert.ok(Object.hasOwn(target,part),'missing reviewed path');target=target[part];}
  assert.ok(Object.hasOwn(target,last));
  assert.deepEqual(target[last],change.after,'unexpected provenance value at '+key);
  target[last]=structuredClone(change.before);
 }
 assert.equal(digest(restored),entry.previousOutputHash,'an unreviewed output field changed');
 assert.equal(digest(current),before,'review must not mutate the current result');
 return restored;
}

assert.deepEqual(audit.entries.map(e=>e.caseId),['CL-RU-BUS-010','CL-RU-BUS-022']);
for(const entry of audit.entries){
 const fixture=load(entry.caseId),result=buildCanonicalCreditAnalysis(fixture.input),historical=historicalBusinessResult(entry.caseId,fixture.input);
 test(entry.caseId+' exact reviewed delta reconstructs the complete original golden',()=>{
  assert.equal(goldens[entry.caseId],entry.reviewedOutputHash);
  assertReviewedDelta(historical,entry);
 });
 test(entry.caseId+' published bank profile and original report match both reviewed versions',()=>{
  assert.equal(digest(result.model),bankProfileHashes[entry.caseId].model);
  assert.equal(digest(historical.model),reviewed[entry.caseId].model);
  assert.equal(digest(previousProvenanceCase(historical,entry.caseId).model),entry.unchangedClientReportHash);
 });
 test(entry.caseId+' existing business assertions still pass',()=>{
  const checks=businessAssertions(fixture,result);
  assert.ok(checks.length>0);assert.deepEqual(checks.filter(c=>c.status!=='PASS'),[]);
 });
 test(entry.caseId+' review rejects an unlisted credit-value change',()=>{
  const changed=structuredClone(historical);changed.prescoreIndex.value=123.456;
  assert.throws(()=>assertReviewedDelta(changed,entry));
 });
 test(entry.caseId+' review rejects a changed client conclusion',()=>{
  const changed=structuredClone(historical);changed.model.hero.headline='Unexpected conclusion';
  assert.throws(()=>assertReviewedDelta(changed,entry));
 });
 test(entry.caseId+' review rejects changed provenance rather than ignoring it',()=>{
  const changed=structuredClone(historical);changed.inputFingerprint='unreviewed-input';
  assert.throws(()=>assertReviewedDelta(changed,entry));
 });
 if(entry.caseId==='CL-RU-BUS-010')test('010 internal-transfer provenance does not inflate revenue or change balance figures',()=>{
  const m=fixture.input.analysis.metricsV2;
  assert.equal(m.operating.operatingCashReceipts.value,12_000_000);
  assert.equal(m.liquidity.endingBalance.value,21_680_000);
  assert.equal(m.liquidity.averageDailyBalance.value,21_419_616.44);
  assert.equal(m.liquidity.minimumDailyBalance.value,20_000_000);
  assert.ok(m.liquidity.averageDailyBalance.includedCategories.includes('INTERNAL_TRANSFER'));
  assert.deepEqual(m.liquidity.averageDailyBalance.excludedCategories,[]);
  assert.match(m.liquidity.averageDailyBalance.calculationBasis,/including internal transfers/);
 });
 if(entry.caseId==='CL-RU-BUS-022')test('022 keeps conflict unresolved, retains document dates and does not invent a full turnover or capacity',()=>{
  const m=fixture.input.analysis.metricsV2,g=m.conflicts.groups[0];
  assert.equal(g.status,'UNRESOLVED');assert.equal(g.variants.length,2);
  for(const variant of g.variants)for(const observation of variant.observations){
   assert.equal(observation.rawValues.documentDate,'05.07.2025');
   assert.equal(observation.date,'2025-07-05');
  }
  assert.equal(m.operating.operatingCashReceipts.value,null);
  assert.equal(m.liquidity.averageDailyBalance.value,null);
  assert.equal(result.prescoreIndex.value,null);
  assert.equal(result.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,null);
 });
}
