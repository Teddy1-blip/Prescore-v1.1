import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
export const reviewed=JSON.parse(readFileSync(new URL('./stage5-canonical-hashes.json',import.meta.url)));
export const digest=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
export function economicDigest(c){
  return digest({stop:c.riskAssessment.summary.globalStopStatus,index:[c.prescoreIndex.status,c.prescoreIndex.value],
    readiness:[c.financingReadiness.status,c.financingReadiness.level],assessment:c.creditAssessment.status,
    capacity:[c.debtCapacity.status,c.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity],
    products:c.productSelection.candidates.map(p=>[p.productFamily,p.fitLevel,p.rank]),
    priorities:c.recommendationSet.primaryRecommendationIds.map(id=>c.recommendationSet.recommendations.find(r=>r.recommendationId===id).definitionCode),
    plan:['day7','day30','day60'].map(k=>c.actionPlan[k].focusItems.map(i=>i.recommendationCode))});
}
export function restore(current,delta){
  if(!delta)return current;
  if(Object.hasOwn(delta,'replace'))return delta.replace;
  const children=new Map(delta.children);
  if(Object.hasOwn(delta,'length'))return Array.from({length:delta.length},(_,i)=>restore(current[i],children.get(i)));
  return Object.fromEntries(delta.keys.map(k=>[k,restore(current[k],children.get(k))]));
}
export function previousProvenanceCase(current,id){
  assert.equal(digest(current),reviewed[id].historical,'unreviewed Stage 5 complete output');
  const patches=JSON.parse(gunzipSync(readFileSync(new URL('./stage5-provenance-reverse.json.gz',import.meta.url))));
  return restore(current,patches[id]);
}
