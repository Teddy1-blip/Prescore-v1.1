import type {RecommendationInputV1 as Input,RecommendationV1 as Rec,RecommendationPolicyV1 as Policy,RecommendationRegistryV1 as Registry,SuppressedRecommendationV1 as Suppressed} from '../contracts/recommendations.ts';
import {lineage,lineageKeys} from './assembly.ts';import {emptyLineage} from './triggers.ts';import {unique,weakest,id,stable,fail} from './common.ts';
export function resolveRecommendations(x:Input,raw:Rec[],p:Policy,registry:Registry):{recommendations:Rec[];suppressed:Suppressed[]}{
 const suppressed:Suppressed[]=[],groups=new Map<string,Rec>();
 const record=(r:Rec,reason:string,by:string[]=[])=>suppressed.push({recommendationId:r.recommendationId,definitionCode:r.definitionCode,subjectKey:r.subjectKey,reasonCodes:[reason],suppressedByRecommendationIds:by,lineage:lineage(r)});
 for(const r of raw){const key=stable([r.dedupeGroup,r.subjectKey,r.dedupeGroup==='COMPLETE_BANK_PERIOD'?null:r.sourceIds.slice().sort()]);const a=groups.get(key);if(!a){groups.set(key,r);continue;}for(const k of lineageKeys)(a[k] as string[])=unique([...a[k],...r[k]]);a.triggerCodes=unique([...a.triggerCodes,...r.triggerCodes]);a.reasonCodes=unique([...a.reasonCodes,...r.reasonCodes]);a.currentState=[...new Map([...a.currentState,...r.currentState].map(v=>[stable(v),v])).values()];a.verificationCriteria=[...new Map([...a.verificationCriteria,...r.verificationCriteria].map(v=>[stable(v),v])).values()];a.confidence=weakest(a.confidence,r.confidence);if(p.priorityOrder.indexOf(r.priority)<p.priorityOrder.indexOf(a.priority))a.priority=r.priority;if(r.actionability==='VERIFY_FIRST')a.actionability='VERIFY_FIRST';record(r,'EXPLICIT_DEDUPE_GROUP',[a.recommendationId]);}
 let candidates=[...groups.values()];
 // Complete-month requirements share one concrete upload action, but unrelated
 // subjects/source sets are never collapsed merely because the text is similar.
 const upload=registry.definitions.find(d=>d.code==='UPLOAD_COMPLETE_BANK_STATEMENT_PERIOD')!;
 for(const r of candidates)if(r.dedupeGroup==='COMPLETE_BANK_PERIOD'){r.titleRu=upload.titleRu;r.actionSummaryRu=upload.actionSummaryRu;r.stepsRu=[...upload.stepsRu];r.completionEvidenceRu=[...upload.completionEvidenceRu];r.definitionCode=upload.code;}
 const stops=x.riskAssessment.findings.filter(f=>f.scope==='GLOBAL_STOP');
 candidates=candidates.filter(r=>{if(stops.length&&!p.globalStopAllowedCategories.includes(r.category)){record(r,'GLOBAL_STOP_ACTION_SCOPE');return false;}const closed=r.portfolioObligationIds.length>0&&r.portfolioObligationIds.every(id=>x.creditPortfolio?.obligations.some(o=>o.obligationId===id&&o.status.value==='CLOSED'));if(closed&&!['REFRESH_SOURCE','RECONCILE','VERIFY','COLLECT_DATA'].includes(r.actionType)){record(r,'CLOSED_OBLIGATION_NO_CURRENT_REMEDIATION');return false;}
 const dominant=r.suppressionGroup==='HISTORICAL_DELINQUENCY'?candidates.filter(v=>v.triggerCodes.includes('RISK-BKI-CURRENT-OVERDUE')&&v.subjectKey===r.subjectKey):r.suppressionGroup==='CURRENT_LOSS'?candidates.filter(v=>v.triggerCodes.includes('RISK-FIN-NET-LOSS-REPEATED')):[];if(dominant.length){record(r,'MORE_SPECIFIC_CURRENT_OR_REPEATED_FINDING',dominant.map(v=>v.recommendationId));return false;}return true;});
 const conflicts=x.riskAssessment.findings.filter(f=>['RISK-DATA-COMPANY-IDENTITY-CONFLICT','RISK-DATA-FINANCIAL-SAME-FACT-CONFLICT','RISK-DATA-PORTFOLIO-CONFLICT'].includes(f.code));
 for(const r of candidates){const related=conflicts.filter(f=>f.code==='RISK-DATA-COMPANY-IDENTITY-CONFLICT'||f.subjectKey&&f.subjectKey===r.subjectKey||f.evidence.some(e=>e.sourceId&&r.sourceIds.includes(e.sourceId)));if(related.length&&p.operationalActionTypes.includes(r.actionType)){r.actionability='BLOCKED_BY_DATA';r.blockingReasonCodes=unique(related.map(f=>f.code));r.warnings=unique([...r.warnings,'DEPENDENT_OPERATION_BLOCKED_UNTIL_RECONCILIATION']);record(r,'OPERATIONAL_EXECUTION_SUPPRESSED_BY_CONFLICT');}}
 // Resolve dependencies after dedupe and suppression. A verified identity needs
 // no invented unresolved-identity prerequisite; conditional steps retain theirs.
 for(const r of candidates){const d=registry.definitions.find(d=>d.code===r.definitionCode)!;r.prerequisiteRecommendationIds=unique(d.prerequisiteDefinitionCodes.flatMap(code=>candidates.filter(v=>v.definitionCode===code&&v.subjectKey===r.subjectKey).map(v=>v.recommendationId)));if(r.blockingReasonCodes.length)r.prerequisiteRecommendationIds=unique([...r.prerequisiteRecommendationIds,...candidates.filter(v=>v.category==='DATA_QUALITY'&&v.triggerCodes.some(c=>r.blockingReasonCodes.includes(c))).map(v=>v.recommendationId)]);}
 for (const evaluation of x.riskAssessment.evaluations ?? []) {
   const primaryId = evaluation.suppressedBy;
   if (!primaryId) continue;
   const subject = evaluation.subjectKey ?? null;
   for (const definition of registry.definitions) {
     if (!definition.triggerSpecification.some(t => t.kind === 'RISK_FINDING_CODE' && t.code === evaluation.ruleCode)) continue;
     const hasSourceAction = raw.some(r => r.definitionCode === definition.code && r.subjectKey === subject
       && r.triggerCodes.includes(evaluation.ruleCode) && r.riskFindingIds.includes(primaryId));
     if (hasSourceAction || suppressed.some(s => s.definitionCode === definition.code && s.subjectKey === subject)) continue;
     const facts = x.riskAssessment.facts.filter(f => evaluation.requiredFactCodes.includes(f.semanticCode)
       && (!subject || f.subjectKey === subject));
     suppressed.push({
       recommendationId: id('upstream-suppressed-action', definition.code, evaluation.findingId),
       definitionCode: definition.code, subjectKey: subject, reasonCodes: ['UPSTREAM_RULE_SUPPRESSION'],
       suppressedByRecommendationIds: candidates.filter(r => r.riskFindingIds.includes(primaryId)).map(r => r.recommendationId),
       lineage: {...emptyLineage(), riskFactIds: facts.map(f => f.factId), sourceIds: unique(facts.flatMap(f => f.sourceIds))},
     });
   }
 }
 const ids=new Set(candidates.map(r=>r.recommendationId));for(const s of suppressed)s.suppressedByRecommendationIds=s.suppressedByRecommendationIds.filter(id=>ids.has(id));
 validateDependencies(candidates);return {recommendations:candidates,suppressed:suppressed.sort((a,b)=>stable(a).localeCompare(stable(b)))};
}
export function validateDependencies(rs:Rec[]):void{const m=new Map(rs.map(r=>[r.recommendationId,r]));if(m.size!==rs.length)fail('DUPLICATE_RECOMMENDATION_ID');const walk=(key:string,path:Set<string>)=>{if(path.has(key))fail('DEPENDENCY_CYCLE');const r=m.get(key);if(!r)fail('DANGLING_DEPENDENCY');for(const next of r!.prerequisiteRecommendationIds)walk(next,new Set([...path,key]));};for(const key of m.keys())walk(key,new Set());}
export function rankRecommendations(rs:Rec[],p:Policy,r:Registry):Rec[]{const order=new Map(r.definitions.map((d,i)=>[d.code,i]));return rs.sort((a,b)=>p.priorityOrder.indexOf(a.priority)-p.priorityOrder.indexOf(b.priority)||p.actionabilityOrder.indexOf(a.actionability)-p.actionabilityOrder.indexOf(b.actionability)||p.severityOrder.indexOf(a.sourceSeverity)-p.severityOrder.indexOf(b.sourceSeverity)||p.remediabilityOrder.indexOf(a.remediability)-p.remediabilityOrder.indexOf(b.remediability)||p.categoryOrder.indexOf(a.category)-p.categoryOrder.indexOf(b.category)||(order.get(a.definitionCode)!-order.get(b.definitionCode)!)||a.recommendationId.localeCompare(b.recommendationId));}
