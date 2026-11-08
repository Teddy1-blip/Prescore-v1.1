"use client";
import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import {publicText} from '../../../lib/credit-engine/client-report/copy';
import {Panel, Why, ActionItem} from './client-insights';
import {label} from './credit-depth';

export function RiskSections({model}:{model:WorkspaceModelV1}){
 const full=model.full;
 if(!full)return null;
 const claims=full.canonical.explainability.claims.filter(c=>c.riskFindingIds.length>0 && (c.claimKind==='FINDING'||c.claimKind==='DATA_LIMITATION'));
 const actions=[...full.report.recommendations.primary,...full.report.recommendations.backlog];
 const groups=[
  ['GLOBAL_STOP','Стоп-факторы'],['CREDIT_RISK','Существенные риски'],
  ['DATA_REVIEW','Требует проверки'],['INFORMATION','Контекст и информация'],
 ] as const;
 return <>{groups.map(([scope,title])=>{
  const items=claims.filter(c=>c.status===scope&&!c.claimCode.includes('SOURCE-MISSING'));
  if(!items.length)return null;
  const content=<Panel key={scope} title={title}><div className="pc-factor-list">
   {items.map(c=><article className={'pc-factor '+(scope==='GLOBAL_STOP'?'tone-critical':scope==='CREDIT_RISK'?'tone-attention':'tone-info')} key={c.claimId}>
    <div><h3>{publicText(c.titleRu)}</h3><p>{publicText(c.textRu)}</p>
     {actions.filter(a=>c.recommendationIds.includes(a.canonicalId)||full.canonical.recommendations.recommendations.some(rec=>rec.recommendationId===a.canonicalId&&rec.riskFindingIds.some(id=>c.riskFindingIds.includes(id)))).slice(0,1).map(a=><p key={a.id}>Следующий шаг · {publicText(a.title)}</p>)}
    </div><Why model={model} ids={[c.claimId]}/>
   </article>)}
  </div></Panel>;
  return scope==='INFORMATION'?<details key={scope}><summary>Контекст и информация</summary>{content}</details>:content;
 })}{claims.some(c=>c.claimCode==='RISK-DATA-SOURCE-MISSING')&&<Panel title="Дополнить профиль"><p>БФО уточняет капитал и прибыль, кредитная история раскрывает графики и остатки долга.</p><Why model={model} ids={claims.filter(c=>c.claimCode==='RISK-DATA-SOURCE-MISSING').map(c=>c.claimId)}/></Panel>}{!!model.basic.coverageGaps?.length&&<Panel title="Покрытие по счетам">{model.basic.coverageGaps.map((g,i)=><p key={i}>{g.bank}{g.account?' · счёт …'+g.account:''} · {g.month} · {{PARTIAL:'Часть месяца',MISSING:'Пропуск месяца',OVERLAP:'Пересечение периодов',FULL:'Полный месяц'}[g.status]}</p>)}</Panel>}{!!full.report.bankRuleCoverage?.length&&<details><summary>Основания ограничений банковских правил</summary>{full.report.bankRuleCoverage.map(e=><p key={e.code}><b>{e.code}</b> · {e.reasons.join(', ')}</p>)}</details>}{!claims.length&&<Panel title="Результат проверки"><p>В этом выпуске отдельные факторы риска не выделены. Основания доступны в заключении.</p></Panel>}</>;
}

export function ExpertiseSection({model}:{model:WorkspaceModelV1}){
 const expertise=model.full?.report.expertise;
 if(!expertise?.items.length)return <Panel title="Экспертная оценка"><p>Откройте заключение и основания по подтверждённым источникам этого выпуска.</p></Panel>;
 const groups=[
  ['SUMMARY','Общая оценка'],['STRENGTH','Сильные стороны'],['ATTENTION','Что влияет на решение'],
  ['STRUCTURE','Условия финансирования'],['CHECK','Что уточнить'],
 ] as const;
 return <>{groups.map(([key,title])=>{
  const items=expertise.items.filter(i=>i.category===key);
  if(!items.length)return null;
  return <Panel title={title} key={key}><div className="pc-expertise-grid">{items.map(i=><article className="pc-expertise-card" key={i.id}>
   <h3>{publicText(i.title)}</h3><p>{publicText(i.interpretation)}</p>{i.nextStep&&<p><b>Дальше.</b> {publicText(i.nextStep)}</p>}
   <details><summary>Факт и влияние</summary><p>{publicText(i.fact)}</p><p>{publicText(i.impact)}</p>{i.limitation&&<p>{publicText(i.limitation)}</p>}
   {i.closure.length>0&&<ul>{i.closure.map((s,n)=><li key={n}>{publicText(s)}</li>)}</ul>}
   <small>{i.asOfDate} · {label(i.confidence)}</small>{i.claimIds.length>0&&<Why model={model} ids={i.claimIds}/>}</details>
  </article>)}</div></Panel>;
 })}</>;
}

export function RecommendationsSection({model}:{model:WorkspaceModelV1}){
 const recommendations=model.full?.report.recommendations;
 if(!recommendations)return null;
 const {primary,backlog}=recommendations;
 return <><Panel title="Приоритетные рекомендации">{primary.length?primary.map(item=><ActionItem key={item.id} item={item} model={model}/>):<p>Для этого выпуска приоритетные действия не назначены.</p>}</Panel>
  {backlog.length>0&&<Panel title="Другие действия">{backlog.map(item=><ActionItem key={item.id} item={item} model={model}/>)}</Panel>}</>;
}
