import {baseline as readinessBaseline,fromIndex as readinessFromIndex,withRisk as readinessWithRisk,withRelation as readinessWithRelation,withCase as readinessWithCase,reorder as reorderReadiness,compose as readinessCompose,rawProfile,material,field} from '../readiness/builders.mjs';
import {baseline as indexBaseline,finding} from '../index/builders.mjs';
import {entries as contextEntries} from '../context/golden-context-pack-v1.mjs';
import {buildContextAssessment} from '../../../lib/credit-engine/context/engine.ts';
import {buildFinancingReadiness} from '../../../lib/credit-engine/readiness/engine.ts';
export {rawProfile,material,field};
export const compose=x=>({...x,financingReadiness:buildFinancingReadiness(x)});
export const baseline=()=>compose(readinessBaseline());
export const fromIndex=n=>compose(readinessFromIndex(n));
export const withRisk=o=>compose(readinessWithRisk(o));
export const withRelation=(effect,o)=>compose(readinessWithRelation(effect,o));
export const withCase=o=>compose(readinessWithCase(o));
export function fromContext(n){const x=structuredClone(contextEntries().find(e=>e.caseId===`CTX-RU-${String(n).padStart(3,'0')}`).input);return compose(readinessCompose({riskAssessment:x.riskAssessment,contextAssessment:buildContextAssessment(x),asOfDate:x.asOfDate}));}
export function multi(options){const x=indexBaseline();for(const o of options)finding(x,o);return compose(readinessCompose(x));}
export function reorder(x){const y=reorderReadiness(x);y.financingReadiness.constraints.reverse();y.financingReadiness.contextExplanations.reverse();y.financingReadiness.caseDefinition.facts.reverse();for(const c of y.financingReadiness.constraints){c.riskFindingIds.reverse();c.contextRelationIds.reverse();c.evidence.reverse();c.reasonCodes.reverse();}return y;}
