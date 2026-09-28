import {buildVisualModel} from './visual.ts';
import type {ClientReportInputV1,ClientReportModelV1,ClientReportPolicyV1,PresentationFactorV1,PresentationMetricV1} from '../contracts/client-report.ts';
import {CLIENT_REPORT_POLICY} from './policy.ts';
import {clientText,COPY} from './copy.ts';
const forbidden=/Банк одобрит|Вероятность одобрения|Гарантированный лимит|Банк отказал из-за|Кредит точно получите|Рекомендуемая банком сумма/i;
export const internalCode=/RISK-[A-Z-]+|PRESCORE-[A-Z0-9.-]+|recommendation:|claim:|DELINQUENCY_[A-Z0-9_]+|\b(?:SHADOW|CREDIT_RISK|DATA_REVIEW)\b/;
export function visibleTexts(m:ClientReportModelV1):string[]{const out:string[]=[];const walk=(v:unknown,key='')=>{if(['id','claimId','canonicalId','sourceIds','actionIds','prerequisites','bindingCode','family','unit','technical','meta','visual','focusIds','monitoringIds','target','sectionOrder'].includes(key))return;if(typeof v==='string')out.push(v);else if(Array.isArray(v))v.forEach(a=>walk(a,key));else if(v&&typeof v==='object')Object.entries(v).forEach(([k,a])=>walk(a,k));};walk(m);return out;}
export function allFactors(m:ClientReportModelV1):PresentationFactorV1[]{return [...m.primaryFactors,...m.contextHighlights,...m.readiness.constraints,...m.capacity.details,...m.dataQuality,...m.limitations,...m.actionPlan.rerun,...m.detailedSections.flatMap(s=>s.factors)];}
export function validateClientReportModel(x:ClientReportInputV1,m:ClientReportModelV1,p:ClientReportPolicyV1=CLIENT_REPORT_POLICY){
 const fail=(s:string):never=>{throw Error('CLIENT_REPORT_INVALID:'+s);};
 if(JSON.stringify(m.visual)!==JSON.stringify(buildVisualModel(x,m)))fail('VISUAL_BINDING');
 if(!p.sectionOrder.includes(m.hero.cta.target))fail('ORPHAN_CTA');
 if(m.meta.entitlement==='FREE'){
  if(m.index.value||m.index.components.length||m.capacity.headline||m.readiness.level||allFactors(m).length||m.productFit.primary.length||m.productFit.other.length||m.actionPlan.horizons.length||m.recommendations.primary.length||m.recommendations.backlog.length||m.sources.length||m.technical.claimIds.length||m.hero.summary!==COPY.free||m.hero.globalStop)fail('FREE_PAID_LEAK');return;
 }
 const claims=new Map(x.explainability.claims.map(c=>[c.claimId,c]));
 if(m.hero.headline!==clientText(x.explainability.executiveSummary.statusHeadlineRu)||m.hero.summary!==clientText(x.explainability.executiveSummary.profileSummaryRu))fail('EXECUTIVE_COPY');
 if(m.readiness.level!==COPY.readiness[x.financingReadiness.level]||m.readiness.confidence!==p.confidenceDisplayMap[x.financingReadiness.confidence])fail('READINESS_CHANGED');
 if(m.capacity.confidence!==p.confidenceDisplayMap[x.debtCapacity.confidence]||m.index.confidence!==p.confidenceDisplayMap[x.prescoreIndex.confidence])fail('CONFIDENCE_CHANGED');
 const metrics:PresentationMetricV1[]=[...(m.index.value?[m.index.value]:[]),...(m.capacity.headline?[m.capacity.headline]:[]),...m.index.components.flatMap(c=>[c.score,c.maximum]),...allFactors(m).flatMap(c=>c.metrics)];
 for(const mt of metrics){const b=claims.get(mt.claimId)?.valueBindings.find(b=>b.bindingCode===mt.bindingCode);if(!b||b.rawValue!==mt.value||mt.display!==(b.rawValue===null?'Недостаточно данных':b.formattedValueRu))fail('VALUE_BINDING');}
 for(const f of allFactors(m)){const c=claims.get(f.claimId);if(!c||f.title!==clientText(c.titleRu)||f.text!==clientText(c.textRu))fail('CLAIM_COPY');for(const sid of f.sourceIds)if(!m.sources.some(s=>s.id===sid))fail('ORPHAN_SOURCE');}
 const actions=m.actionPlan.horizons.flatMap(h=>h.items),recs=[...m.recommendations.primary,...m.recommendations.backlog];
 for(const [list,isPlan]of [[actions,true],[recs,false]] as const)for(const a of list){const r=isPlan?x.actionPlan.items.find(r=>r.planItemId===a.canonicalId):x.recommendationSet.recommendations.find(r=>r.recommendationId===a.canonicalId);if(!r||!claims.has(a.claimId))fail('INVENTED_ACTION');if(a.title!==r!.titleRu||a.summary!==r!.actionSummaryRu||a.recheck!==r!.whatPrescoreWillRecheckRu||JSON.stringify(a.steps)!==JSON.stringify(r!.stepsRu)||JSON.stringify(a.evidence)!==JSON.stringify(r!.completionEvidenceRu))fail('ACTION_COPY');for(const dep of a.prerequisites)if(!list.some(i=>i.id===dep))fail('ORPHAN_DEPENDENCY');}
 if(new Set(recs.map(r=>r.canonicalId)).size!==recs.length)fail('DUPLICATE_RECOMMENDATION');
 if(actions.length!==x.actionPlan.items.length||recs.length!==x.recommendationSet.recommendations.length)fail('OMITTED_ACTION');
 for(const h of m.actionPlan.horizons){const source=x.actionPlan[h.id as 'day7'|'day30'|'day60'];if(!source||h.date!==source.checkpointDate)fail('PLAN_HORIZON');if(h.items.some(i=>!x.actionPlan.items.some(a=>a.planItemId===i.canonicalId&&a.horizon===source.horizon)))fail('PLAN_RESEQUENCING');for(const id of h.focusIds)if(!h.items.some(i=>i.id===id))fail('ORPHAN_FOCUS');}
 for(const id of m.actionPlan.focusIds)if(!actions.some(i=>i.id===id))fail('ORPHAN_OVERVIEW_FOCUS');
 const products=[...m.productFit.primary,...m.productFit.other];
 const ids=[...allFactors(m).map(v=>v.id),...metrics.map(v=>v.id),...actions.map(v=>v.id),...recs.map(v=>v.id),...products.map(v=>v.id),...m.detailedSections.map(v=>v.id),...m.index.components.map(v=>v.id),...m.sources.map(v=>v.id)];if(new Set(ids).size!==ids.length)fail('DUPLICATE_ID');
 for(const pr of products){const source=x.productSelection.candidates.find(c=>c.productFamily===pr.family);if(!source||source.rank!==pr.rank||p.fitDisplayMap[source.fitLevel]!==pr.fit||!claims.has(pr.claimId))fail('PRODUCT_CHANGED');}
 if(JSON.stringify(m.productFit.primary.map(v=>v.family))!==JSON.stringify(x.productSelection.primaryCandidateProducts.slice(0,p.productCardLimit)))fail('PRODUCT_RERANK');
 if(m.primaryFactors.length>p.executiveFactorLimit||m.productFit.primary.length>p.productCardLimit||m.actionPlan.focusIds.length>p.overviewActionLimit)fail('OVERVIEW_LIMIT');
 if(m.capacity.disclaimer!==COPY.capacityDisclaimer||m.actionPlan.disclaimer!==COPY.checkpoint||m.printMeta.disclaimer!==COPY.reportDisclaimer)fail('DISCLAIMER');
 if(m.index.value?.value!==x.prescoreIndex.value||m.capacity.headline?.value!==x.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential)fail('ANALYTICS_CHANGED');
 for(const text of visibleTexts(m))if(forbidden.test(text)||internalCode.test(text))fail('CLIENT_TEXT:'+text);
}
