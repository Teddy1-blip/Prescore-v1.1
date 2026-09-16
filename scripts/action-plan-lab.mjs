// Internal-only laboratory. No application, storage, or network integration.
import {buildActionPlanEntries} from '../tests/fixtures/action-plan/golden-action-plan-pack-v1.mjs';
import {runActionPlanPack} from '../tests/fixtures/action-plan/lab.mjs';
const result=runActionPlanPack(buildActionPlanEntries());
console.log(JSON.stringify({...result,results:result.results.map(({caseId,result,errors,fingerprint})=>({caseId,result,errors,fingerprint}))},null,2));
if(result.FAIL)process.exitCode=1;
