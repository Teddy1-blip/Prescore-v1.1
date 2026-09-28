import {buildActionPlan} from '../../../lib/credit-engine/action-plan/engine.ts';
import {id,canonical} from '../../../lib/credit-engine/action-plan/common.ts';
export function checkActionPlanExpectations(plan,e,input){const errors=[];const check=(yes,code)=>{if(!yes)errors.push(code);};
 for(const q of e.required??[]){const matches=plan.items.filter(i=>i.recommendationCode===q.code);check(matches.length>0,'MISSING:'+q.code);for(const i of matches)for(const[k,v]of Object.entries(q.fields??{}))check(JSON.stringify(i[k])===JSON.stringify(v),k+':'+q.code);}
 for(const c of e.forbidden??[])check(!plan.items.some(i=>i.recommendationCode===c),'FORBIDDEN:'+c);
 for(const[k,v]of Object.entries(e.summary??{}))check(plan.summary[k]===v,'SUMMARY:'+k);
 for(const t of e.triggers??[])check(plan.rerunTriggers.some(v=>v.type===t),'TRIGGER:'+t);
 if(e.status)check(plan.status===e.status,'STATUS');
 if(e.defect){check(!JSON.stringify(plan).match(/DELINQUENCY_1_29|DELINQUENCY_30_59|DELINQUENCY_60_PLUS/),'DEFECT_REASONS');check(!plan.items.some(i=>i.triggerCodes.includes('RISK-BKI-HISTORICAL-DELINQUENCY')),'DEFECT_HISTORY');}
 const rs=input.recommendationSet.recommendations,byId=new Map(plan.items.map(i=>[i.planItemId,i]));
 check(new Set(plan.items.map(i=>i.recommendationId)).size===plan.items.length,'DUPLICATE');
 check(plan.recommendationBacklog.length===rs.length,'BACKLOG');
 for(const i of plan.items){const r=rs.find(r=>r.recommendationId===i.recommendationId);check(!!r,'SOURCE');for(const k of ['titleRu','actionSummaryRu','stepsRu','completionEvidenceRu','whatPrescoreWillRecheckRu'])check(JSON.stringify(i[k])===JSON.stringify(r?.[k]),'COPY:'+k);check(i.confidence===r?.confidence,'CONFIDENCE');check(!['VERIFIED','EVIDENCE_READY'].includes(i.completionState),'NO_COMPLETION');for(const p of i.prerequisitePlanItemIds){const prior=byId.get(p);check(!!prior&&prior.sequence<i.sequence&&prior.checkpointDate<=i.checkpointDate,'DEPENDENCY');check(i.status!=='READY_TO_START','WAITING');}}
 for(const[h,n]of [['day7',7],['day30',10],['day60',10]])check(plan[h].focusItems.length<=n,'FOCUS:'+h);
 return errors;
}
export function runActionPlanCase(entry){try{const p=buildActionPlan(entry.input);const errors=entry.expectations.invalid?['EXPECTED_INVALID']:checkActionPlanExpectations(p,entry.expectations,entry.input);return {caseId:entry.caseId,result:errors.length?'FAIL':'PASS',errors,fingerprint:id('action-plan-golden',canonical(p)),plan:p};}catch(e){return {caseId:entry.caseId,result:entry.expectations.invalid&&String(e).includes(entry.expectations.invalid)?'PASS':'FAIL',errors:entry.expectations.invalid&&String(e).includes(entry.expectations.invalid)?[]:[String(e)]};}}
export function runActionPlanPack(entries){const results=entries.map(runActionPlanCase);return {total:results.length,PASS:results.filter(r=>r.result==='PASS').length,REVIEW:0,FAIL:results.filter(r=>r.result==='FAIL').length,results};}
export function compareActionPlanRuns(a,b){return [...new Set([...a.results,...b.results].map(r=>r.caseId))].sort().map(caseId=>{const x=a.results.find(r=>r.caseId===caseId),y=b.results.find(r=>r.caseId===caseId);return {caseId,changed:x?.fingerprint!==y?.fingerprint||x?.result!==y?.result};});}
