import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadGoldenPack} from '../tests/fixtures/credit-lab/golden-pack-v0.mjs';
import {runCreditLabPack} from '../lib/credit-engine/credit-lab/runner.ts';
import {validateSyntheticFixture} from '../lib/credit-engine/credit-lab/validator.ts';
export function creditLabCli(args=[],pack=loadGoldenPack()){
 if(args.length&&!(args.length===2&&args[0]==='--json'))throw Error('Usage: credit-lab [--json output-path]');
 for(const entry of pack.entries){const errors=validateSyntheticFixture(entry);if(errors.length)throw Error(`EXPORT_REJECTED:${errors.join(',')}`);}
 const run=runCreditLabPack(pack,{sourceCommitSha:'6e953e14fb38e535dcf07d39bbef51adc7a09d92'});
 if(args.length){const target=path.resolve(args[1]),repo=fileURLToPath(new URL('../',import.meta.url));if(target.startsWith(repo)&&!target.startsWith(path.join(repo,'output','credit-lab')+path.sep))throw Error('OUTPUT_MUST_NOT_OVERWRITE_REPOSITORY_INPUTS');writeFileSync(target,JSON.stringify(run,null,2)+'\n',{flag:'wx'});}
 const s=run.summary;console.log(`Credit Lab RU Golden 0.1.0\nCases: ${s.caseCount}; Golden: ${s.goldenCaseCount}\nPASS: ${s.passCount}; REVIEW: ${s.reviewCount}; FAIL: ${s.failCount}\nRules: ${run.ruleCoverage.length}; covered with trigger: ${run.ruleCoverage.filter(r=>r.triggeredCaseIds.length).length}\nMismatches: ${s.hardMismatchCount} HARD, ${s.reviewMismatchCount} REVIEW`);
 return {run,exitCode:s.goldenFailCount?1:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=creditLabCli(process.argv.slice(2)).exitCode}catch(e){console.error(e.message);process.exitCode=1;}}
