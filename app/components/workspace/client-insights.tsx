"use client";
import {useRef,type ReactNode} from 'react';
import {linkedWhyClaims,whyBindings,whySources,whySourceDates,whyBindingText} from '../../../lib/workspace/why-evidence';
import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import type {PresentationFactorV1,PresentationActionV1} from '../../../lib/credit-engine/contracts/client-report';
import {money,date,FullAccessNotice} from './presentation';
import {publicText as clientText} from '../../../lib/credit-engine/client-report/copy';
import {sourceLabel,sourceState,label} from './credit-depth';
import {CashMovement} from './cash-movement';
import {ClientDecisionRoute} from './client-decision-route';
import {receiptLabel} from '../../../lib/credit-engine/explainability/receipts';
import {FinancialSnapshot} from './client-financials';
export function Panel({title,action,children,id}:{title:string;action?:ReactNode;children:ReactNode;id?:string}){return <section className="pc-panel" id={id}><header><h2>{title}</h2>{action}</header>{children}</section>;}
export function Why({model,ids}:{model:WorkspaceModelV1;ids:string[]}){
 const dialog=useRef<HTMLDialogElement>(null),e=model.full?.canonical.explainability;
 const claims=linkedWhyClaims(e,ids);
 return <><button className="pc-text-button" onClick={()=>dialog.current?.showModal()}>Почему?</button><dialog className="pc-evidence" ref={dialog} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}} aria-label="Основания вывода">
  <header><h2>Основания вывода</h2><button onClick={()=>dialog.current?.close()} autoFocus>Закрыть</button></header>
  {claims.length?claims.map(({claim:c,linked,missingLinked})=><section key={c.claimId} data-claim-id={c.claimId}>
   <h3>{clientText(c.titleRu)}</h3><p>{clientText(c.textRu)}</p><small>Достоверность: {label(c.confidence)}</small>
   <ul>{whyBindings(c).map((v,i)=><li key={i}>{whyBindingText(v)}</li>)}</ul>
   {c.warnings.length>0&&<p>Ограничения исходных данных: {c.warnings.map(clientText).join('; ')}</p>}
   {missingLinked&&<p>Связанное основание этого ограничения отсутствует в текущем отчёте; конкретный фактор и его значения не восстановлены.</p>}
   {!linked&&e&&whySources(e,c).map(s=><p key={s.sourceReferenceId} data-source-ref={s.sourceReferenceId}><b>{sourceLabel(s.sourceKind)}</b><br/>{whySourceDates(s)}{s.receipts?.map(r=><small key={r.sourceId}> · {receiptLabel(r)||sourceLabel(r.sourceType)} · получено {date(r.receivedAt?.slice(0,10))}{r.informationDate?' · сведения на '+date(r.informationDate):''}</small>)}<br/><small>Достоверность источника: {label(s.confidence)}</small></p>)}
  </section>):<p>Подробные основания этого вывода в текущей версии не раскрыты. Проверьте комплект документов.</p>}
 </dialog></>;
}
export function FactorRows({model,items,limit}:{model:WorkspaceModelV1;items:PresentationFactorV1[];limit?:number}){const groups=new Map<string,{factor:PresentationFactorV1;claims:string[]}>();for(const f of items){const key=clientText(f.title+'|'+f.text).trim().toLocaleLowerCase('ru')+'|'+f.status.tone;const old=groups.get(key);if(old){old.claims.push(f.claimId);old.factor={...old.factor,actionIds:[...new Set([...old.factor.actionIds,...f.actionIds])]};}else groups.set(key,{factor:f,claims:[f.claimId]});}const distinct=[...groups.values()].slice(0,limit);const r=model.full?.report,actions=r?[...r.recommendations.primary,...r.recommendations.backlog,...r.actionPlan.horizons.flatMap(h=>h.items)]:[];return <div className="pc-factor-list">{distinct.map(({factor:f,claims})=><article key={f.id} className={'pc-factor tone-'+f.status.tone}><div><small>{f.status.label}</small><h3>{clientText(f.title)}</h3><p>{clientText(f.text)}</p>{f.impact&&f.impact!==f.text&&<p className="pc-muted">{clientText(f.impact)}</p>}{actions.filter((a,i,list)=>list.findIndex(other=>other.canonicalId===a.canonicalId)===i&&[...f.actionIds,...(r?.visual.factorActions[f.id]??[])].includes(a.id)).map(a=><p key={a.id}><a className="pc-text-button" href={(model.access.role==='ASSIGNED_BROKER'?'/agent?view=dossier&dossierView=analysis&analysisId=':'/dashboard?view=analysis&analysisId=')+encodeURIComponent(model.analysisId)+'&section=plan#'+a.id}>Что сделать: {a.title} →</a></p>)}</div><Why model={model} ids={claims}/></article>)}{!distinct.length&&<p className="pc-muted">Отдельные факторы не выделены в текущем анализе.</p>}</div>;}
export function ActionItem({item,model}:{item:PresentationActionV1;model:WorkspaceModelV1}){const r=model.full!.report,all=[...r.recommendations.primary,...r.recommendations.backlog,...r.actionPlan.horizons.flatMap(h=>h.items)];return <article className="pc-action" id={item.id}><small>{item.group} · {item.status}</small><h3>{clientText(item.title)}</h3><p>{clientText(item.summary)}</p>{item.why!==item.summary&&<p>{clientText(item.why)}</p>}{item.steps.length>0&&<ol>{item.steps.map((s,i)=><li key={i}>{s}</li>)}</ol>}{item.prerequisites.length>0&&<p><b>Сначала: </b>{item.prerequisites.map(id=>all.find(a=>a.id===id||a.canonicalId===id)?.title??'Уточнить связанное условие').join('; ')}</p>}<p><b>Проверка результата: </b>{clientText(item.recheck)}</p>{item.evidence.length>0&&<p><b>Подтверждения: </b>{item.evidence.join('; ')}</p>}<Why model={model} ids={[item.claimId]}/></article>;}
export function CashTrend({model, compact=false}:{model:WorkspaceModelV1;compact?:boolean}) {
  return <CashMovement model={model} overview={compact}/>;
}
export function SourceSummary({model,choose}:{model:WorkspaceModelV1;choose?:(v:string)=>void}){return <div className="pc-source-list">{['BANK_STATEMENTS','FINANCIAL_STATEMENTS','QUARTERLY_REPORT','CREDIT_HISTORY','EXTERNAL_SOURCE'].map(key=>{const rows=model.basic.sources.availability.filter(s=>s.source===key);return <div key={key}><span>{sourceLabel(key)}</span><b>{rows.length?[...new Set(rows.map(s=>sourceState(s.status)))].join(', '):'Не добавлен'}</b></div>;})}{choose&&<button className="pc-text-button" onClick={()=>choose('documents')}>Дополнить документы →</button>}</div>;}
export function CreditSummary({model,section}:{model:WorkspaceModelV1;section?:"index"|"capacity"}){
 const f=model.full;if(!f)return null;const r=f.report,index=f.canonical.prescoreIndex.value,capacity=f.canonical.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential;
 const ready=f.canonical.financingReadiness.level!=='UNKNOWN';
 if(index===null&&!ready&&capacity===null)return null;
 return <><div className="pc-metrics">{section!=="capacity"&&index!==null&&<section><span>Prescore Index</span><strong data-credit-index>{index}<small> / 1000</small></strong><p>{r.index.status} · {r.index.confidence}</p></section>}{section!=="capacity"&&ready&&<section><span>Готовность к финансированию</span><strong data-credit-readiness>{r.readiness.level}</strong><p>{r.readiness.confidence}</p></section>}{section!=="index"&&capacity!==null&&<section><span>Дополнительный платёж / месяц</span><strong data-prudential-capacity>{money(capacity)}</strong><p>Осторожная оценка · {r.capacity.status}</p></section>}</div>{section!=="capacity"&&<p className="pc-dimensions">Индекс характеризует финансовый профиль. Готовность учитывает ограничения и документы. Дополнительный платёж — способность обслуживать долг, а не одобренная сумма кредита.</p>}</>;
}
export function AssessmentLimits({model,choose}:{model:WorkspaceModelV1;choose?:(v:string)=>void}){
 const f=model.full;if(!f)return null;
 const missing=[f.canonical.prescoreIndex.value===null?'Prescore Index':null,f.canonical.financingReadiness.level==='UNKNOWN'?'готовность к финансированию':null,f.canonical.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential===null?'дополнительный долговой платёж':null].filter(Boolean);
 if(!missing.length)return null;
 const sources=model.basic.sources.availability;
 const absent=(key:string)=>!sources.some(s=>s.source===key&&['READY','PARTIAL','STALE'].includes(s.status));
 const bfo=absent('FINANCIAL_STATEMENTS'),bki=absent('CREDIT_HISTORY');
 const reason=bfo?'Бухгалтерская отчётность не добавлена: прибыль, капитал и финансовые коэффициенты пока не подтверждены.':bki?'Кредитная история не добавлена: полного договорного графика и состава долга пока нет.':'Источники загружены, но часть показателей или сопоставимых периодов не подтверждена. Проверьте основания ограничений в анализе.';
 const action=bfo?'Добавить бухгалтерскую отчётность':bki?'Добавить кредитную историю':'Проверить основания оценки';
 return <aside className="pc-assessment-limit"><h2>Предварительная оценка</h2><p>Пока не определены: {missing.join(', ')}. Подтверждённые банковские данные показаны в обзоре.</p><p>{reason}</p><p>{bfo?'Отчётность дополнит денежный поток финансовым состоянием компании.':bki?'Кредитный отчёт позволит сопоставить обязательства с наблюдаемыми платежами.':'Уточнение источников позволит перепроверить ограниченные выводы; изменение оценки не гарантируется.'}</p>{choose&&<button className="pc-text-button" onClick={()=>choose(bfo||bki?'documents':'analysis')}>{action} →</button>}</aside>;
}
function dashboardFactValue(f:WorkspaceModelV1['basic']['bankingFacts']['grossInflow']){return f.status==='UNKNOWN'||f.status==='NOT_APPLICABLE'||f.value===null||!Number.isFinite(f.value)?null:f.value;}
function dashboardValue(f:WorkspaceModelV1['basic']['bankingFacts']['grossInflow']){const v=dashboardFactValue(f);return f.status==='NOT_APPLICABLE'?'Не применимо':v===null?'Нет данных':money(v);}
export function ExecutiveOverview({model,choose,retry,children}:{children?:ReactNode;model:WorkspaceModelV1;choose:(v:string)=>void;retry:()=>void}){
 const r=model.full?.report,b=model.basic.bankingFacts;
 const index=model.full?.canonical.prescoreIndex.value??null;
 const readiness=model.full?.canonical.financingReadiness.level;
 const capacity=model.full?.canonical.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential??null;
 const factors=r?[...r.primaryFactors,...r.contextHighlights,...r.readiness.constraints]:[];
 const strengths=factors.filter(f=>f.status.tone==='positive').slice(0,3);
 const risks=factors.filter(f=>['critical','attention'].includes(f.status.tone)).slice(0,3);
 const dataLimits=r ? [...r.readiness.constraints, ...r.dataQuality, ...r.limitations].filter(
   (f,i,items)=>f.status.tone==='data' && items.findIndex(other=>other.claimId===f.claimId)===i
 ).slice(0, Math.max(0,3-risks.length)) : [];
 const actions=r?.recommendations.primary.slice(0,3)??[];
 const products=r?[...r.productFit.primary,...r.productFit.other].slice(0,3):[];
 const period=`${date(model.basic.analysis.period.from)} — ${date(model.basic.analysis.period.to)}`;
 function openAnalysis(section:'conclusion'|'plan') {
   const url = new URL(window.location.href);
   url.searchParams.set('section',section);
   url.hash='';
   window.history.replaceState(null,'',url);
   choose('analysis');
 }
 const bankName=model.basic.sources.statements.bankNames?.join(' · ')||'Банковские выписки';
 return <div className="pc-dashboard" data-prescore-dashboard="v1">
  <header className="pc-dashboard-heading">
   <div><span>КРЕДИТНЫЙ ПРОФИЛЬ</span><h1>Финансово-кредитный профиль</h1><p>{model.basic.analysis.company.name} · ИНН {model.basic.analysis.company.inn} · {period}</p></div>
   <button className="pc-primary" onClick={()=>openAnalysis('conclusion')}>Открыть заключение →</button>
  </header>
  {r && <div className="pc-dashboard-route">
    {children ?? <ClientDecisionRoute model={model} choose={choose}/>}
  </div>}
  <section className="pc-dashboard-summary" aria-label="Кредитная сводка">
   <article className="pc-score-card"><small>Prescore Index</small>{index!==null?<strong data-credit-index>{index}<em>/ 1000</em></strong>:<strong className="is-text">Индекс не определён</strong>}<p>{index!==null?(r?.index.status||'Расчёт сформирован'):model.basic.sources.statements.status==='READY'?'Анализ по выпискам сформирован':sourceState(model.basic.sources.statements.status)}</p></article>
   <article className="pc-summary-card"><small>Готовность к финансированию</small><strong data-credit-readiness={readiness&&readiness!=='UNKNOWN'?true:undefined}>{readiness&&readiness!=='UNKNOWN'?(r?.readiness.level||readiness):'Недостаточно данных'}</strong><p>{readiness&&readiness!=='UNKNOWN'?(r?.readiness.text||'Открыть анализ для деталей'):'Ограничения и доступные документы указаны в досье.'}</p></article>
   <article className="pc-capacity-card"><small>Дополнительное обслуживание долга</small>{capacity!==null?<strong data-prudential-capacity>{money(capacity)}<em>/ месяц</em></strong>:<strong className="is-text">Пока не определён</strong>}<p>{capacity!==null?(r?.capacity.text||'Осторожная оценка способности обслуживать новый платёж'):'Добавление БКИ и отчётности позволит рассчитать запас нового ежемесячного платежа.'}</p></article>
  </section>
  <section className="pc-bank-kpis" aria-label="Банковская картина">
   <article><small>Внешние поступления</small><strong>{dashboardValue(b.grossInflow)}</strong></article>
   <article><small>Внешние списания</small><strong>{dashboardValue(b.grossOutflow)}</strong></article>
   <article><small>Чистый денежный поток</small><strong>{dashboardValue(b.netCashFlow)}</strong></article>
   <article><small>Средний остаток</small><strong>{dashboardValue(b.averageDailyBalance)}</strong></article>
  </section>
  <div className="pc-dashboard-grid pc-dashboard-grid-main">
   <section className="pc-dashboard-section"><header><div><span>БАНКОВСКОЕ ЗАКЛЮЧЕНИЕ</span><h2>Движение денег</h2></div><button className="pc-text-button" onClick={()=>choose('banking')}>Все финансы →</button></header>
    <p className="pc-bank-source">{bankName} · {period}</p>
    <CashTrend model={model} compact/>
   </section>
   <section className="pc-dashboard-section"><header><div><span>КРЕДИТНЫЕ ФАКТОРЫ</span><h2>Что важно сейчас</h2></div></header>
    <div className="pc-dashboard-factors">
     {!r && <p className="pc-muted">Кредитные факторы формируются только каноническим анализом Prescore. В BASIC доступны фактические банковские показатели без локальной кредитной интерпретации.</p>}
     {r && !strengths.length && !risks.length && !dataLimits.length && <p className="pc-muted">По имеющимся данным отдельные факторы не выделены.</p>}
     {strengths.map((f,i)=><article key={'s'+i} data-tone="positive"><small>Сильная сторона</small><h3>{clientText(f.title)}</h3><p>{clientText(f.text)}</p><Why model={model} ids={[f.claimId]}/></article>)}
     {risks.map((f,i)=><article key={'r'+i} data-tone={f.status.tone}><small>Требует внимания</small><h3>{clientText(f.title)}</h3><p>{clientText(f.text)}</p><Why model={model} ids={[f.claimId]}/></article>)}
     {dataLimits.map(f=><article key={f.id} data-tone="data"><small>Ограничение данных</small><h3>{clientText(f.title)}</h3><p>{clientText(f.text)}</p><Why model={model} ids={[f.claimId]}/></article>)}
    </div>
   </section>
  </div>
  {r&&<div className="pc-dashboard-grid">
   <section className="pc-dashboard-section"><header><div><span>ФИНАНСИРОВАНИЕ</span><h2>Подходящие механизмы</h2></div><button className="pc-text-button" onClick={()=>choose('financing')}>Все варианты →</button></header>
    <div className="pc-dashboard-products">{products.map((p,i)=><article key={p.id}><small>{String(i+1).padStart(2,'0')}</small><h3>{p.title}</h3><p>{p.purpose}</p><Why model={model} ids={[p.claimId]}/></article>)}</div>
   </section>
   <section className="pc-dashboard-section"><header><div><span>РЕКОМЕНДАЦИИ</span><h2>Что делать сейчас</h2></div><button className="pc-text-button" onClick={()=>openAnalysis('plan')}>План 7 / 30 / 60 →</button></header>
    <div className="pc-dashboard-actions">{actions.map((a,i)=><article key={a.id}><small>{String(i+1).padStart(2,'0')}</small><div><h3>{a.title}</h3><p>{a.summary}</p></div><Why model={model} ids={[a.claimId]}/></article>)}</div>
   </section>
  </div>}
  {r?.financialAnalysis?.history.length?<FinancialSnapshot model={model} choose={choose}/>:null}
  {r?.externalSummary?.length?<section className="pc-dashboard-section pc-dashboard-external"><header><div><span>ВНЕШНИЙ КОНТЕКСТ</span><h2>Юридические и внешние сведения</h2></div></header><dl>{r.externalSummary.map(f=><div key={f.code}><dt>{f.label}</dt><dd>{f.value}<small>{f.source} · {date(f.asOf)}</small></dd></div>)}</dl></section>:null}
  <section className="pc-dashboard-section"><header><h2>Источники досье</h2>
    <button className="pc-text-button" onClick={()=>choose('documents')}>Открыть документы →</button>
  </header><SourceSummary model={model}/></section>
  {!r&&<FullAccessNotice model={model} retry={retry}/>}
 </div>;
}
