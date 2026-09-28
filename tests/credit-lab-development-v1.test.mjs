import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDevelopmentPack,buildDevelopmentEntries} from './fixtures/credit-lab/development-v1/pack.mjs';
import {loadGoldenPack} from './fixtures/credit-lab/golden-pack-v0.mjs';
import {runCreditLabCase,runCreditLabPack} from '../lib/credit-engine/credit-lab/runner.ts';
import {validateCase,validatePack,validateSyntheticFixture} from '../lib/credit-engine/credit-lab/validator.ts';
const pack=loadDevelopmentPack();
test('development pack: 100 unique synthetic DRAFT candidates, no fake review',()=>{
 assert.equal(pack.entries.length,100);assert.equal(new Set(pack.entries.map(e=>e.caseDefinition.caseId)).size,100);
 for(const e of pack.entries){assert.equal(e.caseDefinition.origin,'SYNTHETIC');assert.equal(e.caseDefinition.status,'DRAFT');assert.equal(e.caseDefinition.review.reviewedByRole,'NONE');assert.equal(e.caseDefinition.review.approvedAt,null);assert.deepEqual(validateCase(e),[]);assert.deepEqual(validateSyntheticFixture(e),[]);}
});
test('development pack: frozen input/expectation fingerprints',()=>assert.deepEqual(validatePack(pack),[]));
test('development pack: deterministic build and JSON roundtrip',()=>assert.deepEqual(JSON.parse(JSON.stringify(buildDevelopmentEntries())),JSON.parse(JSON.stringify(buildDevelopmentEntries()))));
for(const entry of pack.entries)test(`${entry.caseDefinition.caseId}: ${entry.caseDefinition.title}`,()=>{
 const before=JSON.stringify(entry),result=runCreditLabCase(entry);
 assert.equal(result.result,'PASS',JSON.stringify(result.mismatches));assert.equal(JSON.stringify(entry),before);
 assert.deepEqual(runCreditLabCase(entry),result);
});
test('absent BKI creates neither a phantom obligation nor confirmed zero arrears',()=>{
 const entry=pack.entries.find(e=>e.caseDefinition.caseId==='CL-RU-DEV-SOURCE-006');
 const r=runCreditLabCase(entry);
 assert.ok(r.riskAssessment.facts.filter(f=>f.semanticCode==='BKI_OVERDUE').every(f=>f.value===null));
});
test('original Block 8 Golden pack remains independent and green',()=>{
 const golden=loadGoldenPack(),before=JSON.stringify(golden),r=runCreditLabPack(golden);
 assert.equal(r.summary.goldenCaseCount,31);assert.equal(r.summary.goldenPassCount,31);assert.equal(r.summary.failCount,0);assert.equal(JSON.stringify(golden),before);
 assert.ok(pack.entries.every(e=>!golden.entries.some(g=>g.caseDefinition.caseId===e.caseDefinition.caseId)));
});
