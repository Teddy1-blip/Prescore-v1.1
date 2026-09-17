// Internal synthetic lab only. No production endpoints or persistence.
import {buildExplainabilityEntries} from '../tests/fixtures/explainability/golden-explainability-pack-v1.mjs';
import {runExplainabilityPack} from '../tests/fixtures/explainability/lab.mjs';
import {auditExplainabilityCoverage} from '../lib/credit-engine/explainability/coverage.ts';
const run=runExplainabilityPack(buildExplainabilityEntries());const counts={PASS:0,REVIEW:0,FAIL:0};for(const r of run.results)counts[r.result]++;
console.log(JSON.stringify({...run,...counts,coverage:auditExplainabilityCoverage()},null,2));if(counts.FAIL||counts.REVIEW)process.exitCode=1;
