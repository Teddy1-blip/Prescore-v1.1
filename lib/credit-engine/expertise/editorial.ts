import type {ClientReportModelV1} from '../contracts/client-report.ts';
import type {ExpertiseItemV1} from './model.ts';

export const EXPERTISE_EDITORIAL_VERSION='PRESCORE-EXPERTISE-EDITORIAL-1.0.0';
// Presentation only: no new score, risk rank, source selection or verdict.
export type ExpertiseSentence={role:'POSITION'|'STRENGTH'|'LIMITATION'|'STEP';text:string;itemIds:string[];claimIds:string[];sourceReferenceIds:string[]};
const firstSentence=(s:string)=>s.trim().split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z])/u)[0].replace(/[.!?]+$/u,'');
const unique=(xs:string[])=>[...new Set(xs)];
export function expertiseStatementStatus(i:ExpertiseItemV1):string {
 // applicationStatus belongs to the pre-application checklist, not to a fact.
 if(i.category==='CHECK')return ({CONFIRMED:'Подтверждено в модели',CLARIFY:'Требуется документ или уточнение',BLOCKS_ASSESSMENT:'Блокирует уверенную оценку',OPTIONAL:'Желательно, не обязательное условие оценки'})[i.applicationStatus];
 if(i.applicationStatus==='BLOCKS_ASSESSMENT')return 'Блокирует уверенную оценку';
 if(i.knowledge!=='KNOWN'||i.confidence==='UNKNOWN')return 'Оценка ограничена данными';
 if(i.category==='STRENGTH')return 'Подтверждено в модели';
 return 'Рассчитано по доступным данным';
}
export function expertiseEditorial(m:ClientReportModelV1){
 const e=m.expertise;if(m.meta.entitlement!=='FULL'||!e)return undefined;
 const item=(id:string)=>e.items.find(i=>i.id===id)!;
 const memo=e.memoIds.map(item);
 const focus=new Set([...m.actionPlan.focusIds,...m.actionPlan.horizons.filter(h=>h.id==='day7').flatMap(h=>h.items.map(a=>a.id))]);
 const primaryClaims=new Set(m.recommendations.primary.map(a=>a.claimId));
 const constraints=new Set(m.readiness.constraints.map(f=>f.id));
 const tier=(i:ExpertiseItemV1)=>i.applicationStatus==='BLOCKS_ASSESSMENT'?0:i.actionIds.some(id=>focus.has(id))?1:i.applicationStatus==='CLARIFY'&&(i.claimIds.some(id=>primaryClaims.has(id))||i.factorIds.some(id=>constraints.has(id)))?2:3;
 // Stable within each existing relationship tier; no severity/weight inference.
 const checklist=[...e.checklistIds].sort((a,b)=>tier(item(a))-tier(item(b)));
 const primaryProducts=new Set(m.productFit.primary.map(p=>p.claimId));
 const otherProducts=new Set(m.productFit.other.map(p=>p.claimId));
 // The two already-selected monthly views are retained first. Remaining
 // non-product structure items are the upstream numeric scenarios only.
 const structurePrimary=e.structureIds.filter(id=>{const i=item(id);return i.claimIds.some(c=>primaryProducts.has(c))||!i.claimIds.some(c=>otherProducts.has(c));});
 const structureOther=e.structureIds.filter(id=>!structurePrimary.includes(id));
 const sentences:ExpertiseSentence[]=[];
 function sentence(role:ExpertiseSentence['role'],text:string,items:ExpertiseItemV1[]){sentences.push({role,text:text+'.',itemIds:items.map(i=>i.id),claimIds:unique(items.flatMap(i=>i.claimIds)),sourceReferenceIds:unique(items.flatMap(i=>i.sourceReferenceIds))});}
 // Subject and follow-up come from the memo. Locate capacity by its canonical claim.
 if(memo[0])sentence('POSITION',firstSentence(memo[0].fact)+(memo[1]?'; '+firstSentence(memo[1].fact).replace(/^Аналитическая готовность/u,'готовность'):''),memo.slice(0,2));
 const strength=e.strengthIds[0]&&item(e.strengthIds[0]);
 if(strength)sentence('STRENGTH',firstSentence(strength.interpretation).replace('В регулярном виде Debt Capacity','В расчёте по регулярной базе'),[strength]);
 // Preserve existing exceptional capacity attention (global stop/conflict),
 // otherwise follow the report's primary factor order, without a new risk rank.
 const capacity=m.capacity.headline && memo.find(i=>i.claimIds.includes(m.capacity.headline!.claimId));
 const attention=capacity&&e.attentionIds.includes(capacity.id)?capacity:m.primaryFactors.map(f=>e.attentionIds.map(item).find(i=>i.factorIds.includes(f.id))).find(Boolean)??(e.attentionIds[0]?item(e.attentionIds[0]):undefined);
 const limit=capacity?.knowledge==='UNKNOWN'?capacity:attention??(capacity?.knowledge!=='KNOWN'?capacity:memo.find(i=>i.knowledge!=='KNOWN'));
 if(limit)sentence('LIMITATION','Ограничение оценки: '+firstSentence(limit===capacity?limit.interpretation:limit.fact).replace(/^Данные показывают:\s*/u,''),[limit]);
 const step=memo.find(i=>i.actionIds.some(id=>focus.has(id)));
 if(step)sentence('STEP','Ближайший шаг: '+firstSentence(step.fact),[step]);
 return {version:EXPERTISE_EDITORIAL_VERSION,sentences,checklistFirst:checklist.slice(0,5),checklistOther:checklist.slice(5),structurePrimary,structureOther};
}
