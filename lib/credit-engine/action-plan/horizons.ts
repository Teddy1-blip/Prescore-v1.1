import type {RecommendationV1 as Rec,RecommendationSetV1 as SetV1} from '../contracts/recommendations.ts';
import type {ActionPlanPolicyV1 as Policy,ActionPlanHorizon as Horizon,ActionPlanAssignmentReason as Reason,ActionPlanCheckpointReason as Check,ActionPlanItemStatus} from '../contracts/action-plan.ts';
import type {DependencyGraph} from './dependencies.ts';
export type Assignment={horizon:Horizon;assignmentReasonCodes:Reason[];checkpointReasonCodes:Check[];status:ActionPlanItemStatus};
export const isMonitoring=(r:Rec)=>r.actionType==='MONITOR'||r.remediability==='NOT_REMOVABLE';
export function allowedInPlan(r:Rec,status:SetV1['status'],p:Policy):boolean{
 if(status==='NOT_RATABLE_GLOBAL_STOP')return ['LEGAL_CORPORATE','DATA_QUALITY','VERIFICATION'].includes(r.category);
 if(status!=='INSUFFICIENT_DATA')return true;
 if(['DATA_QUALITY','VERIFICATION'].includes(r.category))return true;
 if(isMonitoring(r)||r.remediability==='INDIRECT'||p.definitionHorizons[r.definitionCode]?.checkpointReason==='STRUCTURAL_REMEDIATION')return false;
 return ['VERIFY','COLLECT_DATA','REFRESH_SOURCE','RECONCILE'].includes(r.actionType)||r.actionType==='DEFINE_FINANCING_CASE'&&r.verificationCriteria.some(c=>c.kind==='CASE_FIELD_KNOWN');
}
export function assignActionPlanHorizons(rs:Rec[],groups:SetV1['recommendationGroups'],graph:DependencyGraph,p:Policy):Map<string,Assignment>{
 const byId=new Map(rs.map(r=>[r.recommendationId,r])),out=new Map<string,Assignment>();const dataIds=new Set(groups.filter(g=>g.groupCode==='DATA_FIRST').flatMap(g=>g.recommendationIds));
 for(const rid of graph.orderedIds){const r=byId.get(rid)!;let horizon:Horizon='DAY_30',reason:Reason='VERIFICATION_CHECKPOINT',check:Check='DOCUMENT_PREPARATION';
 const pick=(h:Horizon,r:Reason,c:Check)=>({horizon:h,reason:r,check:c});
 const rules:Record<string,()=>ReturnType<typeof pick>|null>={
 P0_FIRST:()=>r.priority==='P0_CRITICAL'?pick('DAY_7','P0_IMMEDIATE','CRITICAL_BLOCKER'):null,
 DATA_FIRST:()=>r.actionability==='BLOCKED_BY_DATA'||dataIds.has(rid)?pick('DAY_7','DATA_BLOCKER','DATA_UNBLOCK'):null,
 MONITORING_LATER:()=>isMonitoring(r)?pick('DAY_60','MONITORING','MONITORING'):null,
 CASE_FIRST:()=>r.actionType==='DEFINE_FINANCING_CASE'?pick('DAY_7','CASE_COMPLETION','FINANCING_CASE_COMPLETION'):null,
 PREREQUISITE_FIRST:()=>graph.unblockers.has(rid)?pick('DAY_7','PREREQUISITE_UNBLOCK','PREREQUISITE'):null,
 EXPLICIT_DEFINITION:()=>{const a=p.definitionHorizons[r.definitionCode];return a?pick(a.horizon,a.reason,a.checkpointReason):null;},
 VERIFY_FIRST:()=>r.actionability==='VERIFY_FIRST'&&r.priority==='P1_HIGH'?pick('DAY_7','P1_VERIFY_FIRST','DATA_UNBLOCK'):null,
 LOW_EFFORT_HIGH_PRIORITY:()=>r.effort==='LOW'&&r.priority==='P1_HIGH'?pick('DAY_7','LOW_EFFORT_HIGH_PRIORITY','DIRECT_REMEDIATION'):null,
 STRUCTURAL:()=>r.effort==='HIGH'||r.remediability==='INDIRECT'?pick('DAY_60','STRUCTURAL_HIGH_EFFORT','STRUCTURAL_REMEDIATION'):null,
 PRODUCT_DOCUMENT:()=>['PRODUCT_PREPARATION','DOCUMENT_PREPARATION'].includes(r.category)?pick('DAY_30','PRODUCT_PREPARATION','PRODUCT_PREPARATION'):null,
 DIRECT:()=>r.remediability==='DIRECT'?pick('DAY_30','DIRECT_REMEDIATION','DIRECT_REMEDIATION'):null,
 DEFAULT_VERIFICATION:()=>pick('DAY_30','VERIFICATION_CHECKPOINT','DOCUMENT_PREPARATION')
 };
 for(const rule of p.rules){const result=rules[rule]?.();if(result){({horizon,reason,check}=result);break;}}
 const ps=graph.prerequisites.get(rid)!,reasons:Reason[]=[reason],checks:Check[]=[check];
 if(ps.length){const latest=Math.max(...ps.map(k=>p.horizons.indexOf(out.get(k)!.horizon)));const minimum=Math.min(latest+1,p.horizons.length-1);if(p.horizons.indexOf(horizon)<minimum){horizon=p.horizons[minimum];reasons.push('DEPENDENCY_SHIFT');checks.push('PREREQUISITE');}}
 const status:ActionPlanItemStatus=r.actionability==='BLOCKED_BY_DATA'?'BLOCKED_BY_DATA':r.actionability==='VERIFY_FIRST'?'VERIFY_FIRST':ps.length?'WAITING_FOR_PREREQUISITE':isMonitoring(r)?'MONITORING':r.actionability==='CONDITIONAL'?'VERIFY_FIRST':'READY_TO_START';
 out.set(rid,{horizon,assignmentReasonCodes:reasons,checkpointReasonCodes:checks,status});
 }
 return out;
}
