import {createHash} from 'node:crypto';
import {RISK_RULE_REGISTRY} from '../lib/credit-engine/risk/rules/registry.ts';
import {numeric,rule as defineRule} from '../lib/credit-engine/risk/rules/factory.ts';
import {threshold,get,missing,result,usable} from '../lib/credit-engine/risk/common.ts';
import {RECOMMENDATION_REGISTRY,validateRecommendationRegistry} from '../lib/credit-engine/recommendations/registry.ts';
import {compileExpression,STANDARD} from './expression.mjs';
export const BASE='cef0145f890a91fe8be58d5c740e7c7d250f4af8';
export const RISK='RISK-FIN-CURRENT-LIQUIDITY', ACTION='BUILD_RECEIVABLES_AGING';
export const triggers=RISK_RULE_REGISTRY.filter(r=>r.domain==='FINANCIAL' && r.scope==='CREDIT_RISK').map(r=>r.code);
const core=RISK_RULE_REGISTRY.find(r=>r.code===RISK);
const template=RECOMMENDATION_REGISTRY.definitions.find(d=>d.code===ACTION);
export const defaultRule=Object.freeze({enabled:true,op:'LT',high:core.thresholds[0].value,threshold:core.thresholds[1].value,severity:'MEDIUM',applicability:'ALL',input:'FIN_CURRENT_RATIO'});
export const baseline=()=>({expression:STANDARD,rule:{...defaultRule},actions:[]});
export const currentAction={code:ACTION,title:template.titleRu,text:template.actionSummaryRu,trigger:template.triggerSpecification[0].code,priority:template.defaultPriority,evidence:template.completionEvidenceRu[0],recheck:template.whatPrescoreWillRecheckRu};
export function requireThat(ok,message){if(!ok)throw new Error(message);}
export function shape(obj,keys){requireThat(obj && Object.getPrototypeOf(obj)===Object.prototype && Object.keys(obj).length===keys.length && keys.every(k=>Object.hasOwn(obj,k)),'Поля пакета не соответствуют схеме');}
export function label(s,max=360){requireThat(typeof s==='string' && s.trim() && s.length<=max && !/[\u0000-\u001f]/.test(s),'Проверьте текстовое поле');}
function canonical(x){return Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;}
export const digest=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
export function compileMethodology(m){
  shape(m,['expression','rule','actions']); const expr=compileExpression(m.expression), r=m.rule;
  shape(r,Object.keys(defaultRule));
  requireThat(typeof r.enabled==='boolean' && ['LT','LTE'].includes(r.op) && [r.high,r.threshold].every(n=>Number.isFinite(n)&&n>=0&&n<=100) && r.high<=r.threshold && ['MEDIUM','LOW','HIGH'].includes(r.severity) && ['ALL','BFO','QUARTERLY'].includes(r.applicability) && r.input==='FIN_CURRENT_RATIO','Недопустимые порты, границы или применимость правила');
  const experiment={};
  if(m.expression!==STANDARD) experiment.currentRatio=expr;
  if(digest(r)!==digest(defaultRule)){
    const test=(x,n)=>r.op==='LT'?x<n:x<=n;
    const spec={...core,requiredFactCodes:[r.input],thresholds:[threshold(r.op,r.high),threshold(r.op,r.threshold)]};
    const active=numeric(spec,n=>test(n,r.threshold)?{severity:test(n,r.high)?'HIGH':r.severity,reason:'CURRENT_LIQUIDITY_LOW',threshold:threshold(r.op,test(n,r.high)?r.high:r.threshold)}:null);
    const replacement=defineRule(spec,d=>{
      const fact=get(d,r.input);
      if(!r.enabled)return result('NOT_APPLICABLE',[fact],['STUDIO_RULE_DISABLED']);
      if(!usable(fact))return missing([fact]);
      if(r.applicability!=='ALL' && !fact.sourceTypes.includes(r.applicability))return result('NOT_APPLICABLE',[fact],['STUDIO_OUTSIDE_SOURCE_SCOPE']);
      return active.evaluate(d);
    });
    // rule.version is the canonical registry contract version. The independent
    // experimental parameter revision is bound to the run by methodologyHash.
    experiment.riskRules=RISK_RULE_REGISTRY.map(x=>x.code===RISK?replacement:x);
  }
  requireThat(Array.isArray(m.actions)&&m.actions.length<=16,'Допустимо до 16 изменений рекомендаций');
  if(m.actions.length){
    const registry=structuredClone(RECOMMENDATION_REGISTRY), seen=new Set();
    for(const a of m.actions){
      shape(a,Object.keys(currentAction));
      requireThat(typeof a.code==='string' && (a.code===ACTION||/^STUDIO_[A-Z0-9_]{1,54}$/.test(a.code)) && !seen.has(a.code),'Недопустимый или повторный ID рекомендации'); seen.add(a.code);
      requireThat(triggers.includes(a.trigger)&&['P1_HIGH','P2_MEDIUM','P3_LOW'].includes(a.priority),'Неизвестный trigger или приоритет');
      for(const k of ['title','text','evidence','recheck'])label(a[k],k==='title'?140:700);
      if(a.code===ACTION && digest(a)===digest(currentAction))continue;
      const d=structuredClone(template);
      Object.assign(d,{code:a.code,version:template.version+'-studio-'+digest(a).slice(0,12),titleRu:a.title,actionSummaryRu:a.text,stepsRu:[a.text,'Сохраните подтверждение: '+a.evidence],completionEvidenceRu:[a.evidence],whatPrescoreWillRecheckRu:a.recheck,defaultPriority:a.priority,triggerSpecification:[{kind:'RISK_FINDING_CODE',code:a.trigger}],calculationBasis:'RISK_FINDING_CODE:'+a.trigger,dedupeGroup:a.code,suppressionGroup:a.code});
      d.verificationCriteriaTemplate=d.verificationCriteriaTemplate.map(v=>v.kind==='RISK_FINDING_ABSENT'?{...v,sourceCode:a.trigger}:{...v,sourceCode:a.code,targetValue:a.evidence});
      if(a.code===ACTION)registry.definitions[registry.definitions.findIndex(x=>x.code===ACTION)]=d;
      else registry.definitions.push(d);
    }
    validateRecommendationRegistry(registry);experiment.recommendationRegistry=registry;
  }
  return Object.freeze(experiment);
}
