import type {ClientReportInputV1,ClientReportModelV1,ClientReportVisualV1} from '../contracts/client-report.ts';
import {freeze,id,stable} from '../explainability/common.ts';

// Display-only policy: these labels describe existing component deductions.
// No new score, risk band, capacity calculation or action prioritization.
export const VISUAL_POLICY=freeze({version:'PRESCORE-CLIENT-VISUAL-1.0.0',component:{unchanged:'Без существенного снижения',affected:'Есть влияние',unknown:'Недостаточно данных'},capacity:{current:'Текущая нагрузка',cautious:'Осторожная граница модели',upper:'Верхняя граница модели'},motion:{signature:500,index:400,capacity:450,factor:300}});
export function buildVisualModel(x:ClientReportInputV1,m:ClientReportModelV1):ClientReportVisualV1{
 const out:ClientReportVisualV1={policyFingerprint:id('client-visual-policy',stable(VISUAL_POLICY)),componentStates:{},capacityScale:null,factorActions:{}};
 if(m.meta.entitlement==='FREE')return out;
 for(const component of m.index.components){
  const claim=x.explainability.claims.find(c=>c.claimId===component.score.claimId);
  const penalty=claim?.valueBindings.find(b=>b.bindingCode==='finalPenalty')?.rawValue;
  out.componentStates[component.id]=component.score.value===null||typeof penalty!=='number'?VISUAL_POLICY.component.unknown:penalty===0?VISUAL_POLICY.component.unchanged:VISUAL_POLICY.component.affected;
 }
 // Select an existing view that supports the headline; never combine incompatible bases.
 const headroom=m.capacity.headline;
 const key=x.debtCapacity.nearTerm30dView.incrementalHeadroom.prudential===headroom?.value?'nearTerm30dView':'recurringView';
 const claim=x.explainability.claims.find(c=>c.valueBindings.some(b=>b.bindingCode==='ANCHOR'&&b.canonicalPath.includes(key)));
 const detail=m.capacity.details.find(f=>f.claimId===claim?.claimId);
 const current=detail?.metrics.find(v=>v.bindingCode==='ANCHOR');
 const cautious=detail?.metrics.find(v=>v.bindingCode==='PRUDENTIAL_20_PERCENT_CEILING');
 const upper=detail?.metrics.find(v=>v.bindingCode==='MAXIMUM_25_PERCENT_CEILING');
 if(!m.hero.globalStop&&headroom&&current&&cautious&&upper&&[headroom,current,cautious,upper].every(v=>typeof v.value==='number'&&Number.isFinite(v.value)&&v.value>=0)&&Number(upper.value)>0){out.capacityScale={headroom,current,cautious,upper};}
 for(const factor of m.primaryFactors){
  const recIds=[...m.recommendations.primary,...m.recommendations.backlog].filter(r=>factor.actionIds.includes(r.id)).map(r=>r.canonicalId);
  out.factorActions[factor.id]=m.actionPlan.horizons.filter(h=>h.id==='day7').flatMap(h=>h.items).filter(a=>x.actionPlan.items.some(i=>i.planItemId===a.canonicalId&&recIds.includes(i.recommendationId))).map(a=>a.id);
 }
 return out;
}
