import {performance} from 'node:perf_hooks';import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';
import {scenario} from './builders.mjs';import {buildRecommendations} from '../../../lib/credit-engine/recommendations/engine.ts';import {validateRecommendationInput} from '../../../lib/credit-engine/recommendations/validation.ts';import {RECOMMENDATION_REGISTRY as registry} from '../../../lib/credit-engine/recommendations/registry.ts';import {RECOMMENDATION_POLICY as policy} from '../../../lib/credit-engine/recommendations/policy.ts';import {matchRecommendationTriggers} from '../../../lib/credit-engine/recommendations/triggers.ts';import {assembleRecommendation} from '../../../lib/credit-engine/recommendations/assembly.ts';import {resolveRecommendations,rankRecommendations,validateDependencies} from '../../../lib/credit-engine/recommendations/resolution.ts';import {checkRecommendationExpectations} from '../../../lib/credit-engine/recommendations/lab.ts';import {canonical,id} from '../../../lib/credit-engine/recommendations/common.ts';
export function benchmark(){const x=scenario({values:{FIN_EQUITY:-100,BKI_OVERDUE:1000,BKI_HISTORY_DAYS:0}}),out=buildRecommendations(x),hits=registry.definitions.flatMap(d=>matchRecommendationTriggers(x,d).map(h=>({d,h}))),raw=hits.map(({d,h})=>assembleRecommendation(x,d,h,policy)),results=[];
const measure=(phase,iterations,fn)=>{const start=performance.now();for(let i=0;i<iterations;i++)fn();results.push({phase,iterations,totalMs:Math.round((performance.now()-start)*100)/100});};
measure('inputValidation',1000,()=>validateRecommendationInput(x));
measure('registryMatching',1000,()=>registry.definitions.flatMap(d=>matchRecommendationTriggers(x,d)));
measure('actionAssembly',1000,()=>hits.map(({d,h})=>assembleRecommendation(x,d,h,policy)));
measure('copyMaterialization',1000,()=>registry.definitions.map(d=>({title:d.titleRu,steps:[...d.stepsRu],evidence:[...d.completionEvidenceRu],verification:structuredClone(d.verificationCriteriaTemplate)})));
measure('dedupeAndSuppression',1000,()=>resolveRecommendations(x,structuredClone(raw),policy,registry));
measure('dependencyValidation',1000,()=>validateDependencies(out.recommendations));
measure('ranking',1000,()=>rankRecommendations([...out.recommendations],policy,registry));
measure('finalizationFingerprints',1000,()=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,id('recommendation-upstream',canonical(v))])));
measure('recommendationEngine',1000,()=>buildRecommendations(x));
measure('canonicalRiskToRecommendationsPipeline',200,()=>buildRecommendations(scenario({values:{FIN_EQUITY:-100,BKI_OVERDUE:1000,BKI_HISTORY_DAYS:0}})));
measure('expectationEvaluation',1000,()=>checkRecommendationExpectations(out,{required:[{code:'RECONCILE_EQUITY_COMPONENTS'},{code:'SETTLE_VALID_CURRENT_OVERDUE',fields:{actionability:'ACTIONABLE'}}],forbidden:['VERIFY_HISTORICAL_DELINQUENCY'],maximumPrimary:10},x));return results;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(benchmark(),null,2));
