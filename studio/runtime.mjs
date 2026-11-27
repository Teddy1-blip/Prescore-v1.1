import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {buildCanonicalCreditAnalysis as analyze,CANONICAL_WIRING_VERSION} from '../lib/credit-engine/production/orchestrator.ts';
import {compileMethodology,currentAction,baseline,triggers,defaultRule,digest,requireThat,shape,label,BASE,RISK} from './methodology.mjs';
import {companies,scenario,makeInput,verifyScenario} from './scenarios.mjs';
import {validateWires} from './graph.mjs';
import {FIELDS} from './expression.mjs';
export const engine={baseCommit:BASE,wiring:CANONICAL_WIRING_VERSION,implementation:digest(['../lib/credit-engine/production/orchestrator.ts','../lib/credit-engine/financial-analysis/metrics.ts','../lib/credit-engine/financial-analysis/engine.ts','../lib/credit-engine/action-plan/validation.ts','../lib/credit-engine/action-plan/engine.ts','../lib/credit-engine/explainability/validation.ts','../lib/credit-engine/explainability/engine.ts','methodology.mjs','expression.mjs','scenarios.mjs','runtime.mjs'].map(p=>readFileSync(new URL(p,import.meta.url),'utf8').replaceAll('\r\n','\n')))};
export const promotion=Object.freeze(['DRAFT','VALIDATED','REVIEWED','APPROVED_FOR_INTEGRATION']);
export const defaults={baseline:baseline(),currentAction,defaultRule,triggers,promotion,fields:FIELDS,companies,scenarios:companies.map(c=>scenario(c.id)),engine};
export function initial(company){return {name:'Новый эксперимент',revision:1,mode:'method',method:baseline(),scenario:scenario(company),baseScenario:scenario(company)};}
export function validateDraft(d){
 shape(d,['name','revision','mode','method','scenario','baseScenario']); label(d.name,80);
 requireThat(Number.isSafeInteger(d.revision)&&d.revision>0&&d.revision<1e9&&['method','data','combined'].includes(d.mode),'Некорректная ревизия или режим сравнения');
 verifyScenario(d.scenario);verifyScenario(d.baseScenario);requireThat(d.scenario.company===d.baseScenario.company,'Сравнение требует одну компанию');
 const cfg=compileMethodology(d.method);validateWires(d.method);return cfg;
}
function project(v){
 const risk=v.riskAssessment,idx=v.prescoreIndex, fact=risk.facts.find(f=>f.semanticCode==='FIN_CURRENT_RATIO');
 const period=v.financialAnalysis?.history.at(-1), metric=period?.liquidity.currentRatio;
 return {index:idx.value,raw:idx.rawValueBeforeRiskCeiling,ceiling:idx.riskCeiling,capped:idx.riskCeilingApplied,status:idx.status,coverage:idx.coverage.components.map(c=>[c.component,c.state,c.missingFactCodes]),components:idx.components.map(c=>({name:c.component,score:c.scorePoints,max:c.maxPoints,penalty:c.finalPenalty,context:c.contextAdjustment})),
  metric:metric?{value:metric.value,unit:metric.unit,status:metric.status,period:metric.asOf,expression:metric.calculationBasis,warnings:metric.warnings,inputs:metric.dependencies.map(field=>({field,value:period.amounts[field]?.value??null,source:period.amounts[field]?.sourceIds??[],asOf:period.amounts[field]?.asOf??null}))}:{value:null,status:'UNKNOWN',warnings:['FINANCIAL_SOURCE_MISSING'],inputs:[]},
  fact:fact?{id:fact.factId,value:fact.value,status:fact.status,period:fact.period}:null,
  rule:risk.evaluations.find(e=>e.ruleCode===RISK),risks:risk.findings.map(f=>({code:f.code,severity:f.severity,scope:f.scope,facts:f.factIds,actual:f.actualValue,reason:f.reasonCodes})),
  suppressed:risk.evaluations.filter(e=>e.suppressedBy).map(e=>({code:e.ruleCode,by:e.suppressedBy})),contributions:idx.contributions,
  readiness:{level:v.financingReadiness.level,status:v.financingReadiness.status,reasons:v.financingReadiness.uncertaintyCapReasons},
  assessment:{status:v.creditAssessment.status,headline:v.model.hero.headline,text:v.model.hero.summary,risks:v.creditAssessment.summary.materialRiskCount,drivers:v.creditAssessment.drivers.map(d=>({code:d.code??d.sourceCode,reason:d.reasonCodes})),limitations:v.creditAssessment.limitations.map(l=>l.code??l.limitationCode)},
  capacity:{status:v.debtCapacity.status,...v.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity},products:v.productSelection.primaryCandidateProducts,
  recommendations:v.recommendationSet.recommendations.map(a=>({code:a.definitionCode,title:a.titleRu,text:a.actionSummaryRu,trigger:a.triggerCodes,priority:a.priority,evidence:a.completionEvidenceRu,recheck:a.whatPrescoreWillRecheckRu,dependencies:a.prerequisiteRecommendationIds,findings:a.riskFindingIds,facts:a.riskFactIds,sources:a.sourceIds,horizon:v.actionPlan.items.find(p=>p.recommendationId===a.recommendationId)?.horizon||'BACKLOG'})),
  plan:Object.fromEntries(['day7','day30','day60'].map(k=>[k,{date:v.actionPlan[k].checkpointDate,actions:v.actionPlan[k].focusItems.map(x=>x.titleRu)}])),
  facts:risk.facts.map(f=>({id:f.factId,code:f.semanticCode,value:f.value,status:f.status,unit:f.unit,period:f.period,sources:f.sourceIds??f.evidence.map(e=>e.sourceId)})),evaluations:risk.evaluations.map(e=>[e.ruleCode,e.status]),asOfDate:v.asOfDate,inputFingerprint:v.inputFingerprint};
}
function side(s,m,compiled) {
 const input=makeInput(s),v=analyze(input,compiled);
 return {snapshotHash:digest(s),inputHash:v.inputFingerprint,methodologyHash:digest(m),resultHash:digest(v),result:project(v)};
}
export function runComparison(d,scope='preview-owner'){
 const cfg=validateDraft(d),base=baseline();
 const leftData=d.mode==='method'?d.scenario:d.baseScenario, leftMethod=d.mode==='data'?d.method:base;
 const record={runId:randomUUID(),startedAt:new Date().toISOString(),scope,company:d.scenario.company,scenarioId:'S-'+digest(d.scenario).slice(0,14),engine,revision:d.revision,draftHash:digest(d),draft:structuredClone(d),errors:[]};
 try{
  const before=side(leftData,leftMethod,d.mode==='data'?cfg:undefined),after=side(d.scenario,d.method,cfg);
  const changed=Object.keys(after.result).filter(k=>digest(after.result[k])!==digest(before.result[k]));
  const both=before.snapshotHash!==after.snapshotHash&&before.methodologyHash!==after.methodologyHash;
  return {...record,status:'COMPLETE',before,after,changed,both,asOfDate:after.result.asOfDate,finishedAt:new Date().toISOString()};
 }catch(error){return {...record,status:'FAILED',errors:[error.stage?error.stage+' / '+error.reason:error.message],finishedAt:new Date().toISOString()};}
}
export function makePackage(d,run){
 validateDraft(d);requireThat(run?.status==='COMPLETE'&&run.draftHash===digest(d)&&run.engine.implementation===engine.implementation,'Сначала пересчитайте эту ревизию');
 const payload={schema:'prescore-studio/1',state:'VALIDATED',base:BASE,engine,version:digest(d.method),draft:d,checks:{runId:run.runId,before:run.before.resultHash,after:run.after.resultHash,changed:run.changed},dependencies:['Financial Analysis v2','Risk','Recommendations','Canonical orchestration'],approval:{by:null,at:null},rollback:'Вернуть базовую методологию из сохранённого снимка',createdAt:run.finishedAt};
 return {...payload,checksum:digest(payload)};
}
export function importPackage(p){
 const keys=['schema','state','base','engine','version','draft','checks','dependencies','approval','rollback','createdAt','checksum'];
 shape(p,keys);const {checksum,...body}=p;
 requireThat(p.schema==='prescore-studio/1'&&p.base===BASE&&p.state==='VALIDATED'&&digest(p.engine)===digest(engine)&&digest(body)===checksum&&digest(p.draft.method)===p.version,'Несовместимый пакет или нарушена контрольная сумма');
 shape(p.checks,['runId','before','after','changed']);requireThat(typeof p.checks.runId==='string' && /^[0-9a-f-]{36}$/.test(p.checks.runId) && [p.checks.before,p.checks.after].every(s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s))&&Array.isArray(p.checks.changed)&&p.checks.changed.every(s=>typeof s==='string'&&s.length<60),'Некорректный протокол запуска');
 shape(p.approval,['by','at']);requireThat(p.approval.by===null&&p.approval.at===null && typeof p.createdAt==='string'&&new Date(p.createdAt).toISOString()===p.createdAt,'Некорректная дата или утверждение');
 requireThat(Array.isArray(p.dependencies)&&p.dependencies.length<=20,'Некорректные зависимости');p.dependencies.forEach(v=>label(v,100));label(p.rollback,360);
 validateDraft(p.draft);return structuredClone(p.draft);
}
