/** Separate development runner; never rewrites approved Golden packs. */
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {loadDevelopmentPack, REFERENCE_SHA} from '../tests/fixtures/credit-lab/development-v1/pack.mjs';
import {runCreditLabPack} from '../lib/credit-engine/credit-lab/runner.ts';
import {validateSyntheticFixture} from '../lib/credit-engine/credit-lab/validator.ts';
const args=process.argv.slice(2);
try {
 if(args.length!==0 && !(args.length===2 && args[0]==='--json'))throw new Error('Usage: node --experimental-strip-types scripts/credit-lab-development.mjs [--json NEW_OUTPUT_FILE]');
 const pack=loadDevelopmentPack();
 for(const e of pack.entries){const errors=validateSyntheticFixture(e);if(errors.length)throw new Error(`FIXTURE_PRIVACY:${e.caseDefinition.caseId}:${errors.join(',')}`);}
 const run=runCreditLabPack(pack);
 run.warnings.push(`TARGET_REFERENCE_SHA:${REFERENCE_SHA}`,'DRAFT_EXPECTATIONS_NOT_HUMAN_APPROVED','RISK_LAYER_ONLY_NOT_FULL_PIPELINE_ACCEPTANCE');
 // DRAFT is not automatically Golden. This command deliberately reports every
 // mismatch and fails on ANY HARD mismatch, not just on goldenFailCount.
 console.log(JSON.stringify({version:pack.version,summary:run.summary,
   mismatches:run.results.filter(r=>r.result!=='PASS').map(r=>({caseId:r.caseId,result:r.result,mismatches:r.mismatches})),
   scope:'Credit Lab Risk cases; full source-to-report acceptance is separate'},null,2));
 if(args.length){const p=resolve(args[1]);if(/(?:^|[/\\])(?:tests|lib|scripts)(?:[/\\]|$)/.test(p))throw new Error('REFUSE_SOURCE_OUTPUT_PATH');writeFileSync(p,JSON.stringify(run,null,2)+'\n',{flag:'wx'});}
 process.exitCode=run.summary.failCount>0?1:0;
} catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}
