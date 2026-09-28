import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';
import {scenario} from './builders.mjs';
import {buildActionPlan} from '../../../lib/credit-engine/action-plan/engine.ts';
import {validateActionPlanInput} from '../../../lib/credit-engine/action-plan/validation.ts';
import {resolveActionPlanDependencies} from '../../../lib/credit-engine/action-plan/dependencies.ts';
import {assignActionPlanHorizons} from '../../../lib/credit-engine/action-plan/horizons.ts';
import {selectActionPlanFocus} from '../../../lib/credit-engine/action-plan/focus.ts';
import {deferActionPlanRecommendations} from '../../../lib/credit-engine/action-plan/deferrals.ts';
import {actionPlanRerunTriggers,mergeActionPlanTriggers} from '../../../lib/credit-engine/action-plan/rerun.ts';
import {buildActionPlanRecheckPack} from '../../../lib/credit-engine/action-plan/recheck.ts';
import {ACTION_PLAN_POLICY as p} from '../../../lib/credit-engine/action-plan/policy.ts';
import {canonical,id} from '../../../lib/credit-engine/action-plan/common.ts';
import {checkActionPlanExpectations} from './lab.mjs';
export function benchmark(){const opts={values:{FIN_EQUITY:-100,BKI_OVERDUE:1000,BKI_HISTORY_DAYS:0}},x=scenario(opts),o=buildActionPlan(x),rs=x.recommendationSet.recommendations,g=resolveActionPlanDependencies(rs),focusIds=new Set([o.day7,o.day30,o.day60].flatMap(h=>h.focusItems.map(i=>i.recommendationId))),results=[];
const measure=(phase,n,fn)=>{const t=performance.now();for(let i=0;i<n;i++)fn();const totalMs=Math.round((performance.now()-t)*100)/100;results.push({phase,iterations:n,totalMs,meanMs:totalMs/n});};
measure('validation',1000,()=>validateActionPlanInput(x));measure('dependencyAnalysis',1000,()=>resolveActionPlanDependencies(rs));measure('horizonAssignment',1000,()=>assignActionPlanHorizons(rs,x.recommendationSet.recommendationGroups,g,p));measure('focusSelection',1000,()=>selectActionPlanFocus(o.items,p));measure('deferral',1000,()=>deferActionPlanRecommendations(rs,o.items,focusIds));measure('rerunTriggerAssembly',1000,()=>mergeActionPlanTriggers(rs.flatMap(r=>actionPlanRerunTriggers(r,'DAY_30',p)),p));measure('recheckPackAssembly',1000,()=>p.horizons.map(h=>buildActionPlanRecheckPack(h,o.items,p)));measure('finalization',1000,()=>({recommendationSetReference:id('action-plan-recommendations',canonical(x.recommendationSet)),upstreamFingerprint:id('action-plan-upstream',canonical(x.recommendationSet.upstreamReferences)),backlog:structuredClone(rs)}));measure('actionPlanEngine',1000,()=>buildActionPlan(x));measure('canonicalPipeline',200,()=>buildActionPlan(scenario(opts)));measure('goldenExpectationChecks',1000,()=>checkActionPlanExpectations(o,{required:[{code:'VERIFY_CURRENT_OVERDUE_BALANCE',fields:{horizon:'DAY_7'}}],defect:true},x));return {synthetic:true,recommendationCount:rs.length,planItemCount:o.items.length,results};}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(benchmark(),null,2));
