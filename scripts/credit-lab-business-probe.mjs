/** Synthetic raw-source -> saved projection -> current canonical orchestrator probe.
 * This is not a browser or HTTP upload acceptance test. It never touches a DB.
 * It must be run against the CURRENT staging checkout, after reviewing fixtures.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {buildCanonicalCreditAnalysis} from '../lib/credit-engine/production/orchestrator.ts';
import {publicCanonicalModel} from '../lib/credit-engine/production/public-model.ts';
export {buildBusinessInput} from '../lib/credit-engine/credit-lab/business-input.mjs';
import {buildBusinessInput} from '../lib/credit-engine/credit-lab/business-input.mjs';
function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
export function probeBusiness(root,relative){
 const {caseSpec:c,input}=buildBusinessInput(root,relative),before=JSON.stringify(input);
 try{
  const r=buildCanonicalCreditAnalysis(input);
  assert.equal(JSON.stringify(input),before,'MUTATED_SOURCE');
  assert.deepEqual(buildCanonicalCreditAnalysis(input),r,'NONDETERMINISTIC_CORE');
  assert.equal(r.model.company.inn,c.companyInn,'WRONG_COMPANY');
  assert.equal(r.model.index.value?.value??null,r.prescoreIndex.value,'INDEX_NOT_CANONICAL');
  assert.equal(r.model.capacity.headline?.value??null,r.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,'CAPACITY_NOT_CANONICAL');
  if(r.prescoreIndex.value!==null)assert.ok(r.prescoreIndex.value>=0&&r.prescoreIndex.value<=1000);
  const sentinel=structuredClone(input);sentinel.analysis.score=-999;sentinel.analysis.readiness='LEGACY_SENTINEL';
  sentinel.analysis.metrics.estimatedLimitMax=999999999;
  assert.deepEqual(buildCanonicalCreditAnalysis(sentinel),r,'LEGACY_VALUE_LEAKED');
  return {caseId:c.caseId,status:'PIPELINE_RETURNED_MODEL',asOfDate:r.asOfDate,
   coreAssertions:'PASS',index:r.prescoreIndex.value,readiness:r.financingReadiness.level,
   capacity:r.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity,
   model:publicCanonicalModel(r.model),
   businessAssertionsPending:c.expected.mustCheck,
   note:'Core probe only. Business oracles, source-adapter fidelity, HTTP, storage and browser acceptance remain to be checked.'};
 }catch(e){
  return {caseId:c.caseId,status:'PROBE_FAILED',stage:e?.stage??'CORE_ASSERTION',reason:e?.reason??e?.code??'SEE_SYNTHETIC_TEST',message:e instanceof Error?e.message:String(e),
   businessAssertionsPending:c.expected.mustCheck,
   note:'Do not copy the observed failure into the expectation merely to pass.'};
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [rootArg,outArg]=process.argv.slice(2);if(!rootArg||!outArg)throw Error('Usage: node --experimental-strip-types scripts/credit-lab-business-probe.mjs CORPUS_DIR NEW_OUTPUT_DIR');
  const root=path.resolve(rootArg),out=path.resolve(outArg);if(out===root||out.startsWith(root+path.sep))throw Error('OUTPUT_MUST_BE_OUTSIDE_CORPUS');
  const catalog=readJson(path.join(root,'catalog.json'));fs.mkdirSync(out,{recursive:false});
  const results=[];
  for(const c of catalog.cases){
   let r;try{r=probeBusiness(root,c.path);}catch(e){r={caseId:c.caseId,status:'FIXTURE_PREPARATION_FAILED',reason:'CHECK_SYNTHETIC_SOURCE_ADAPTER',message:e instanceof Error?e.message:String(e),businessAssertionsPending:c.checks};}
   fs.writeFileSync(path.join(out,c.caseId+'.json'),JSON.stringify(r,null,2)+'\n',{flag:'wx'});
   const summary={...r};delete summary.model;results.push(summary);
  }
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({scope:'SYNTHETIC_IN_MEMORY_PROBE_NOT_FULL_ACCEPTANCE',results},null,2)+'\n',{flag:'wx'});
  const failed=results.filter(r=>r.status!=='PIPELINE_RETURNED_MODEL').length;
  console.log(JSON.stringify({cases:results.length,pipelineReturned:results.length-failed,failed,businessAcceptance:'PENDING',browserAcceptance:'NOT_RUN'},null,2));
  process.exitCode=failed?1:0;
 }catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}
}
