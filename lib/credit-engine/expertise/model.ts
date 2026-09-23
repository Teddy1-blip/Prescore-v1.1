import type {CanonicalCreditAnalysisV1} from '../production/orchestrator.ts';
import type {ClientReportModelV1} from '../contracts/client-report.ts';
import type {ExplanationClaimV1} from '../contracts/explainability.ts';

export const EXPERTISE_VERSION = 'PRESCORE-EXPERTISE-1.0.0';
export type ExpertiseItemV1 = {
 id:string; category:'SUMMARY'|'STRENGTH'|'ATTENTION'|'STRUCTURE'|'CHECK';
 title:string; fact:string; interpretation:string; impact:string; limitation:string;
 nextStep:string|null; closure:string[];
 claimIds:string[]; sourceReferenceIds:string[]; affectedObjects:string[];
 confidence:string; knowledge:'KNOWN'|'PARTIAL'|'UNKNOWN'; asOfDate:string;
 recommendationIds:string[]; actionIds:string[]; factorIds:string[]; sourceIds:string[];
 applicationStatus:'CONFIRMED'|'CLARIFY'|'BLOCKS_ASSESSMENT'|'OPTIONAL';
};
export type PrescoreExpertiseV1 = {
 version:typeof EXPERTISE_VERSION; asOfDate:string; items:ExpertiseItemV1[];
 memoIds:string[]; strengthIds:string[]; attentionIds:string[]; structureIds:string[]; checklistIds:string[];
 creditor:{convincing:string[];review:string[];structureLimits:string[];unknowns:string[]};
};
const unique=(v:string[])=>[...new Set(v)].sort();
const promised=/(?:банк\s+(?:точно\s+)?(?:одобрит|откажет|выдаст)|высокий шанс одобрения|гарантировано|идеальный за[её]мщик|скорее всего дадут|идеальн\S* кредитн\S* истор)/i;
const confidenceRu:Record<string,string>={HIGH:'Высокая',MEDIUM:'Средняя',LOW:'Низкая',UNKNOWN:'Не определена'};
export const expertiseConfidence=(v:string)=>confidenceRu[v]??'Не определена';
function assertInput(r:CanonicalCreditAnalysisV1,m:ClientReportModelV1):void {
 if(m.company.inn!==r.company.inn || m.meta.asOfDate!==r.asOfDate)throw Error('EXPERTISE_IDENTITY_MISMATCH');
 for(const x of [r.riskAssessment,r.contextAssessment,r.explainability,r.prescoreIndex,r.financingReadiness,r.creditAssessment,r.debtCapacity,r.productSelection,r.recommendationSet,r.actionPlan]){
  if(x.asOfDate!==r.asOfDate)throw Error('EXPERTISE_ASOF_MISMATCH');
 }
}
// Reads approved outputs only. No engines, source documents, policies or clocks.
function derive(r:CanonicalCreditAnalysisV1,m:ClientReportModelV1):PrescoreExpertiseV1 {
 assertInput(r,m);
 const e=r.explainability;
 const factors=[...m.primaryFactors,...m.contextHighlights,...m.dataQuality,...m.readiness.constraints,...m.capacity.details,...m.limitations,...m.detailedSections.flatMap(s=>s.factors)];
 const actions=[...m.actionPlan.horizons.flatMap(h=>h.items),...m.recommendations.primary,...m.recommendations.backlog];
 const items:ExpertiseItemV1[]=[];
 const byCode=(code:string)=>e.claims.find(c=>c.claimCode===code);
 const byId=(id:string)=>e.claims.find(c=>c.claimId===id);
 function add(c:ExplanationClaimV1,category:ExpertiseItemV1['category'],fields:Partial<Pick<ExpertiseItemV1,'title'|'fact'|'interpretation'|'impact'|'limitation'|'knowledge'|'applicationStatus'|'nextStep'|'closure'>>={}):string {
  const id='expertise-'+category.toLowerCase()+'-'+c.claimId.replace('explanation-claim:','');
  if(items.some(i=>i.id===id))return id;
  const fs=factors.filter(f=>f.claimId===c.claimId);
  const related=e.claims.filter(a=>a.claimRole==='ACTION' && (a.claimId===c.claimId || a.riskFindingIds.some(id=>c.riskFindingIds.includes(id)) || a.readinessConstraintIds.some(id=>c.readinessConstraintIds.includes(id)) || a.recommendationIds.some(id=>c.recommendationIds.includes(id))));
  const acts=actions.filter(a=>related.some(c=>c.claimId===a.claimId));
  const claimIds=unique([c.claimId,...related.map(a=>a.claimId)]);
  const refs=unique(claimIds.flatMap(id=>byId(id)?.sourceReferenceIds??[]));
  const sourceIds=unique([...fs.flatMap(f=>f.sourceIds),...factors.filter(f=>claimIds.includes(f.claimId)).flatMap(f=>f.sourceIds)]).filter(id=>m.sources.some(s=>s.id===id));
  const partial=c.status==='PARTIAL',unknown=c.confidence==='UNKNOWN'||c.status==='INSUFFICIENT_DATA';
  items.push({id,category,title:fs[0]?.title??c.titleRu,fact:(fs[0]?.text??c.textRu)+(fs[0]?.metrics.length?' '+fs[0].metrics.map(v=>v.label+': '+v.display+(v.unit==='DAYS'?' дней':'')).join('. '):''),
   interpretation:category==='CHECK'?'Этот вопрос следует закрыть документально перед использованием результата в заявке.':c.claimRole==='DATA_LIMITATION'?'Ограничение относится к доказательности оценки, а не само по себе к финансовой слабости компании.':fs[0]?.why??c.textRu,
   impact:fs[0]?.impact??(c.claimKind==='CAPACITY'?'Ограничивает применимость сценария финансирования.':c.claimKind==='PRODUCT_FIT'?'Определяет соответствие механизма задаче; решение кредитора не прогнозируется.':'Учитывается в каноническом отчёте; отдельный пересчёт не выполняется.'),
   limitation:unknown?'Уверенность не определена. Вывод нельзя расширять за пределы доступного подтверждения.':partial?'Оценка частичная; ограничения исходного расчёта сохраняются.':'Вывод относится только к указанным источникам и дате оценки.',
   nextStep:acts[0]?.summary??null,closure:unique(acts.flatMap(a=>[...a.evidence,a.recheck]).filter(Boolean)),
   claimIds,sourceReferenceIds:refs,affectedObjects:unique([c.section,...c.riskFindingIds,...c.readinessConstraintIds,...c.capacityReferenceIds,...c.productFamilies]),
   confidence:c.confidence,knowledge:partial?'PARTIAL':unknown?'UNKNOWN':'KNOWN',asOfDate:r.asOfDate,
   recommendationIds:unique([c,...related].flatMap(c=>c.recommendationIds)),actionIds:unique(acts.map(a=>a.id)),factorIds:unique(fs.map(f=>f.id)),sourceIds,
   applicationStatus:c.status==='BLOCKS_READINESS'?'BLOCKS_ASSESSMENT':c.status==='INFORMATION_ONLY'?'OPTIONAL':'CLARIFY',...fields});
  return id;
 }
 const memoIds:string[]=[],strengthIds:string[]=[],attentionIds:string[]=[],structureIds:string[]=[],checklistIds:string[]=[];
 for(const code of ['INDEX_VALUE','READINESS','CAPACITY']){
  const c=byCode(code);if(!c)continue;
  const interpretation=code==='INDEX_VALUE'
   ?'Индекс описывает текущий финансовый профиль в пределах доступного покрытия. Высокое значение не снимает ограничений доказательности.'
   :code==='READINESS'
   ?'Готовность отражает ограничения текущей оценки и задачи финансирования; это не решение конкретного кредитора.'
   :m.hero.globalStop
   ?'Из-за глобального ограничения числовая структура финансирования не предлагается.'
   :r.debtCapacity.bankConflict
   ?'Расхождение версий не позволяет использовать бесспорную часть поступлений в качестве полной базы обслуживания.'
   :r.debtCapacity.status==='INSUFFICIENT_DATA'
   ?'Согласованных оснований недостаточно, чтобы определить дополнительный месячный платёж.'
   :'Дополнительный месячный платёж — ориентир нагрузки. Для заявки его нужно рассматривать вместе с графиком обязательств и ограничениями источников.';
  memoIds.push(add(c,'SUMMARY',{interpretation,applicationStatus:r.debtCapacity.status==='NOT_RATABLE_GLOBAL_STOP'?'BLOCKS_ASSESSMENT':'CLARIFY'}));
 }
 const recurring=r.debtCapacity.recurringView;
 // POSITIVE is already the upstream headroom state, not a new threshold/score.
 const rc=byCode('CAPACITY:recurringView');
 if(rc&&!m.hero.globalStop&&recurring.incrementalHeadroom.state==='POSITIVE'&&recurring.confidence==='HIGH'&&recurring.existingDebtServiceAnchor.knowledge==='KNOWN'){
  const anchor=rc.valueBindings.find(b=>b.bindingCode==='ANCHOR');
  const operating=rc.valueBindings.find(b=>b.bindingCode==='OPERATING_BASIS');
  strengthIds.push(add(rc,'STRENGTH',{title:'Регулярная база поддерживает обслуживание долга',fact:'Операционная база: '+operating?.formattedValueRu+' в месяц. Действующее обслуживание: '+anchor?.formattedValueRu+' в месяц.',interpretation:'В регулярном виде Debt Capacity подтверждён положительный расчётный запас дополнительного обслуживания.',impact:'Это доказательство расчётной возможности в регулярной базе, а не готовности всей заявки.',limitation:'Общий результат может оставаться частичным. Ближайший график и полнота долговых обязательств требуют отдельной проверки.',knowledge:'KNOWN',applicationStatus:'CONFIRMED'}));
 }
 for(const c of e.claims.filter(c=>c.claimRole==='POSITIVE_CONTEXT'&&c.confidence==='HIGH'))if(!m.hero.globalStop)strengthIds.push(add(c,'STRENGTH',{applicationStatus:'CONFIRMED'}));
 // Actual negative and data findings, not absence of a positive signal.
 for(const c of e.claims.filter(c=>c.claimRole==='NEGATIVE_FACTOR'||(c.claimRole==='DATA_LIMITATION'&&c.claimCode.startsWith('RISK-'))))attentionIds.push(add(c,'ATTENTION'));
 const cap=byCode('CAPACITY');
 if(cap&&(r.debtCapacity.bankConflict||r.debtCapacity.status==='NOT_RATABLE_GLOBAL_STOP'))attentionIds.unshift(memoIds.find(id=>items.find(i=>i.id===id)?.claimIds.includes(cap.claimId))!);
 for(const code of ['CAPACITY:recurringView','CAPACITY:nearTerm30dView']){const c=byCode(code);if(c)structureIds.push(add(c,'STRUCTURE',{fact:(factors.find(f=>f.claimId===c.claimId)?.metrics??[]).map(v=>v.label+': '+v.display).join('. '),limitation:m.hero.globalStop?'Глобальное ограничение: практическая структура финансирования не предлагается.':'Регулярная и ближайшая базы независимы. Аннуитетный эквивалент не является лимитом факторинга, гарантии или лизинга.'}));}
 if(!m.hero.globalStop){
  for(const p of [...m.productFit.primary,...m.productFit.other]){const c=byId(p.claimId);if(c)structureIds.push(add(c,'STRUCTURE',{fact:p.title+'. '+p.fit+'. '+p.purpose,limitation:[p.capacity,...p.missing].join('. ')}));}
  for(const c of e.claims.filter(c=>c.claimCode==='CAPACITY_SCENARIO')){
   const numeric=c.valueBindings.filter(b=>typeof b.rawValue==='number');
   if(numeric.some(b=>b.canonicalPath.includes('prudentialPrincipalEquivalent')&&b.rawValue!==null))structureIds.push(add(c,'STRUCTURE',{fact:(factors.find(f=>f.claimId===c.claimId)?.metrics??[]).map(v=>v.label+': '+v.display).join('. '),limitation:'Только заданный аннуитетный сценарий. Не банковский лимит и не универсальная сумма для факторинга, гарантии или лизинга.'}));
  }
 }
 // One question per canonical recommendation. Evidence/recheck is copied, not invented.
 for(const a of [...m.recommendations.primary,...m.recommendations.backlog]){
  const c=byId(a.claimId);if(!c)continue;
  const blocking=c.readinessConstraintIds.some(id=>r.financingReadiness.constraints.some(x=>x.constraintId===id&&x.impact==='BLOCKS_READINESS'));
  checklistIds.push(add(c,'CHECK',{title:a.title,fact:a.summary,interpretation:a.why,nextStep:a.steps.join(' '),closure:unique([...a.evidence,a.recheck]),applicationStatus:blocking?'BLOCKS_ASSESSMENT':r.financingReadiness.constraints.some(x=>c.readinessConstraintIds.includes(x.constraintId)&&x.impact==='INFORMATION_ONLY')?'OPTIONAL':'CLARIFY'}));
 }
 for(const c of e.claims.filter(c=>c.claimRole==='DATA_LIMITATION'&&c.readinessConstraintIds.length)){
  if(!checklistIds.some(id=>items.find(i=>i.id===id)?.claimIds.some(cid=>byId(cid)?.readinessConstraintIds.some(rid=>c.readinessConstraintIds.includes(rid)))))checklistIds.push(add(c,'CHECK'));
 }
 for(const o of m.analysisV3?.portfolio??[]){
  const fields=[['Остаток основного долга',o.principal],['Платёж',o.payment],['Следующий платёж',o.nextPayment],['Просроченная сумма',o.overdue]] as const;
  const gaps=fields.filter(([,v])=>v.knowledge==='UNKNOWN'||v.knowledge==='PARTIAL'||v.verification==='CONFLICTED');
  const c=e.claims.find(c=>c.claimCode.startsWith('PORTFOLIO_EXPOSURE:')&&c.portfolioObligationIds.includes(o.id));
  if(c&&gaps.length)checklistIds.push(add(c,'CHECK',{title:'Уточнить неполные сведения об обязательстве',fact:gaps.map(([label,v])=>label+': '+(v.verification==='CONFLICTED'?'конфликт источников':v.knowledge==='PARTIAL'?'частичные сведения':'недостаточно данных')).join('. '),interpretation:'Неполный портфель не подтверждает отсутствие долга или просрочки.',impact:'Ограничивает полноту оценки долгового обслуживания.',knowledge:'UNKNOWN'}));
 }
 const focus=actions.find(a=>m.actionPlan.focusIds.includes(a.id));if(focus){const c=byId(focus.claimId);if(c)memoIds.push(add(c,'SUMMARY',{title:'Ближайший шаг',fact:focus.summary,nextStep:focus.steps.join(' '),closure:unique([...focus.evidence,focus.recheck])}));}
 return {version:EXPERTISE_VERSION,asOfDate:r.asOfDate,items,memoIds,strengthIds,attentionIds:unique(attentionIds.filter(Boolean)),structureIds,checklistIds,
  creditor:{convincing:[...strengthIds],review:attentionIds.filter(Boolean),structureLimits:structureIds.filter(id=>items.find(i=>i.id===id)?.knowledge!=='KNOWN'),unknowns:unique([...memoIds,...attentionIds].filter(id=>items.find(i=>i.id===id)?.knowledge==='UNKNOWN'))}};
}
export function validateExpertise(r:CanonicalCreditAnalysisV1,m:ClientReportModelV1,x:PrescoreExpertiseV1):void {
 if(m.meta.entitlement!=='FULL')throw Error('EXPERTISE_FULL_REQUIRED');
 assertInput(r,m);
 const claims=new Map(r.explainability.claims.map(c=>[c.claimId,c]));
 const refs=new Set(r.explainability.sourceReferences.map(s=>s.sourceReferenceId));
 if(x.asOfDate!==r.asOfDate)throw Error('EXPERTISE_ASOF_MISMATCH');
 if(new Set(x.items.map(i=>i.id)).size!==x.items.length)throw Error('EXPERTISE_DUPLICATE_ID');
 for(const i of x.items){
  if(i.asOfDate!==x.asOfDate)throw Error('EXPERTISE_ASOF_MISMATCH');
  if(!i.claimIds.length||!i.sourceReferenceIds.length||!i.affectedObjects.length||i.claimIds.some(id=>!claims.has(id))||i.sourceReferenceIds.some(id=>!refs.has(id)||!i.claimIds.some(cid=>claims.get(cid)!.sourceReferenceIds.includes(id))))throw Error('EXPERTISE_ORPHAN');
  if(i.category==='STRENGTH'&&(i.knowledge!=='KNOWN'||i.confidence!=='HIGH'))throw Error('EXPERTISE_UNKNOWN_STRENGTH');
  if(promised.test([i.title,i.fact,i.interpretation,i.impact,i.limitation,i.nextStep,...i.closure].join(' ')))throw Error('EXPERTISE_BANK_PROMISE');
 }
 // Exact re-derivation validates every word, linkage, state and field against the
 // allowlisted templates/upstream. Adding an untracked sentence fails closed.
 if(JSON.stringify(x)!==JSON.stringify(derive(r,m)))throw Error('EXPERTISE_UNSUPPORTED_STATEMENT');
}
export function buildExpertise(r:CanonicalCreditAnalysisV1,m:ClientReportModelV1):PrescoreExpertiseV1|undefined {
 if(m.meta.entitlement!=='FULL')return undefined;
 const model=derive(r,m);validateExpertise(r,m,model);return model;
}
// Future read-only seam: deliberately no provider, raw claims/bindings or policies.
// Rebuild from validated outputs, never trust an injected model.expertise object.
export function canonicalExpertiseContext(r:CanonicalCreditAnalysisV1,m:ClientReportModelV1){
 const expertise=buildExpertise(r,m);if(!expertise)return undefined;
 return structuredClone({version:EXPERTISE_VERSION,asOfDate:r.asOfDate,expertise,reportReference:{version:m.meta.version,claimIds:unique(expertise.items.flatMap(i=>i.claimIds))},explainabilityReference:{version:r.explainability.version,sourceReferenceIds:unique(expertise.items.flatMap(i=>i.sourceReferenceIds))}});
}
