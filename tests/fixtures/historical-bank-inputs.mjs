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
export function historicalBusinessResult(caseId,input) {
  const {bankStatements,metricsV2,integrity}=historical('business',caseId);
  const analysis={...input.analysis,metricsV2,integrity,sourceManifest:{...input.analysis.sourceManifest,bankStatements}};
  return buildCanonicalCreditAnalysis({...input,analysis});
}
export function historicalCapacityEntries(entries) {
  return entries.map(entry=>entry.input.bankMetrics ? {...entry,input:{...entry.input,bankMetrics:historical('capacity',entry.caseId)}} : entry);
}
