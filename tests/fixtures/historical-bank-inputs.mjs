import {beforeBankBfoEvidence} from './client-report/reconciliation-v1-baseline.mjs';
import assert from 'node:assert/strict';
import {digest,reviewed,restore} from './client-report/stage5-baseline.mjs';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildCanonicalCreditAnalysis} from '../../lib/credit-engine/production/orchestrator.ts';

// Only synthetic bank inputs, serialized by the published staging revision.
// Golden outputs and their original fingerprints stay in their original files.
let saved;
function historical(kind,caseId) {
  saved ??= JSON.parse(gunzipSync(readFileSync(new URL('./stage1-bank-inputs.json.gz',import.meta.url))));
  const key=saved[kind][caseId];
  if (!key) throw Error('Missing historical bank fixture '+caseId);
  return structuredClone(saved.bankInputs[key]);
}
export const bankProfileHashes=JSON.parse(readFileSync(new URL('./client-report/bank-profile-hashes.json',import.meta.url)));
let bankProfileReverse;
export function currentHistoricalBusinessResult(caseId,input) {
  const {bankStatements,metricsV2,integrity}=historical('business',caseId);
  const analysis={...input.analysis,metricsV2,integrity,sourceManifest:{...input.analysis.sourceManifest,bankStatements}};
  return buildCanonicalCreditAnalysis({...input,analysis});
}
// Reconstruct and verify the accepted byte-for-byte Stage 5 result from the new result.
export function historicalBusinessResult(caseId,input) {
  const result=beforeBankBfoEvidence(currentHistoricalBusinessResult(caseId,input));
  assert.equal(digest(result),bankProfileHashes[caseId].historical,caseId+' current profile');
  bankProfileReverse??=JSON.parse(gunzipSync(readFileSync(new URL('./client-report/bank-profile-reverse.json.gz',import.meta.url))));
  const prior=restore(result,bankProfileReverse[caseId]);
  assert.equal(digest(prior),reviewed[caseId].historical,caseId+' original Stage 5 decision');
  return prior;
}
export function historicalCapacityEntries(entries) {
  return entries.map(entry=>entry.input.bankMetrics ? {...entry,input:{...entry.input,bankMetrics:historical('capacity',entry.caseId)}} : entry);
}
