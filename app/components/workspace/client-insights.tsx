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
import {DecisionHistory} from './client-decision-history';
import {FinancialSnapshot} from './client-financials';
import {Panel} from './panel';
export {Panel};
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
export function SourceSummary({model,choose,onlyConnected=false}:{model:WorkspaceModelV1;choose?:(v:string)=>void;onlyConnected?:boolean}){
 const groups=['BANK_STATEMENTS','FINANCIAL_STATEMENTS','QUARTERLY_REPORT','CREDIT_HISTORY','EXTERNAL_SOURCE'];
 const visible=groups.flatMap(key=>{const rows=model.basic.sources.availability.filter(s=>s.source===key);if(onlyConnected&&!rows.some(s=>['READY','PARTIAL','STALE'].includes(s.status)))return[];return[{key,rows}];});
 return <div className="pc-source-list">{visible.map(({key,rows})=><div key={key}><span>{sourceLabel(key)}</span><b>{rows.length?[...new Set(rows.map(s=>sourceState(s.status)))].join(', '):'Можно добавить'}</b></div>)}{choose&&<button className="pc-text-button" onClick={()=>choose('documents')}>Управлять источниками →</button>}</div>;
}
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
function dashboardValue(f:WorkspaceModelV1['basic']['bankingFacts']['grossInflow']){return money(dashboardFactValue(f));}
export function ExecutiveOverview({model,choose,retry,children}:{children?:ReactNode;model:WorkspaceModelV1;choose:(v:string)=>void;retry:()=>void}){
 const r=model.full?.report,b=model.basic.bankingFacts;
 const index=model.full?.canonical.prescoreIndex.value??null;
 const readiness=model.full?.canonical.financingReadiness.level;
 const ready=Boolean(readiness&&readiness!=='UNKNOWN');
 const capacity=model.full?.canonical.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential??null;
 const factors=r?[...r.primaryFactors,...r.contextHighlights,...r.readiness.constraints]:[];
 const strengths=factors.filter(f=>f.status.tone==='positive').slice(0,3);
 const risks=factors.filter(f=>['critical','attention'].includes(f.status.tone)).slice(0,3);
 const dataLimits=r ? [...r.readiness.constraints, ...r.dataQuality, ...r.limitations].filter(
   (f,i,items)=>f.status.tone==='data' && items.findIndex(other=>other.claimId===f.claimId)===i
 ).slice(0, Math.max(0,3-risks.length)) : [];
 const actions=r?.recommendations.primary.slice(0,3)??[];
 const candidates=model.full?.canonical.productSelection.candidates??[];
 const products=r?[...r.productFit.primary,...r.productFit.other].filter(p=>candidates.some(c=>c.productFamily===p.family&&['STRONG_MATCH','MODERATE_MATCH','CONDITIONAL_MATCH'].includes(c.fitLevel))).slice(0,3):[];
 const period=`${date(model.basic.analysis.period.from)} — ${date(model.basic.analysis.period.to)}`;
 const bankKpis=[
  {label:'Поступления',fact:b.grossInflow},
  {label:'Списания',fact:b.grossOutflow},
  {label:'Чистый денежный поток',fact:b.netCashFlow},
  {label:'Средний остаток',fact:b.averageDailyBalance},
 ].filter(({fact})=>dashboardFactValue(fact)!==null);
 const hasSummary=index!==null||ready||capacity!==null;
 function openAnalysis(section:'conclusion'|'plan'|'expertise'|'history') {
   const url = new URL(window.location.href);
   url.searchParams.set('section',section);
   url.hash='';
   window.history.replaceState(null,'',url);
   choose('analysis');
 }
 const expertise=r?.expertise;
 const preview=expertise?.memoIds.map(id=>expertise.items.find(i=>i.id===id)).find(i=>i!==undefined)??expertise?.items[0];
 const bankName=model.basic.sources.statements.bankNames?.join(' · ')||'Банковские выписки';
 return <div className="pc-dashboard" data-prescore-dashboard="v2">
  <header className="pc-dashboard-heading">
   <div><span>ВАША КОМПАНИЯ</span><h1>Финансовая картина</h1><p>{model.basic.analysis.company.name} · ИНН {model.basic.analysis.company.inn} · {period}{r?.meta.asOfDate && <> · на {date(r.meta.asOfDate)}</>}</p></div>
   {r&&<button className="pc-primary" onClick={()=>openAnalysis('conclusion')}>Кредитный профиль →</button>}
  </header>
  {r && <div className="pc-dashboard-route">
    {children ?? <ClientDecisionRoute model={model} choose={choose}/>}
  </div>}
  {hasSummary&&<section className="pc-dashboard-summary" aria-label="Главные показатели">
   {index!==null&&<article className="pc-score-card"><small>Prescore Index</small><strong data-credit-index>{index}<em>/ 1000</em></strong><p>{r?.index.status||'Расчёт сформирован'}</p></article>}
   {ready&&<article className="pc-summary-card"><small>Готовность к финансированию</small><strong data-credit-readiness>{r?.readiness.level||readiness}</strong><p>{r?.readiness.text||'Откройте профиль, чтобы увидеть основания.'}</p></article>}
   {capacity!==null&&<article className="pc-capacity-card"><small>Запас для нового долга</small><strong data-prudential-capacity>{money(capacity)}<em>/ месяц</em></strong><p>{r?.capacity.text||'Осторожная оценка дополнительного долгового платежа.'}</p></article>}
  </section>}
  {r?.meta.snapshot&&<DecisionHistory key={model.analysisId+r.meta.snapshot.snapshotId} analysisId={model.analysisId} currentSnapshotId={r.meta.snapshot.snapshotId} compact openHistory={()=>openAnalysis('history')}/>}
  {bankKpis.length>0&&<section className="pc-bank-kpis" aria-label="Банковская картина">
   {bankKpis.map(({label,fact})=><article key={label}><small>{label}</small><strong>{dashboardValue(fact)}</strong></article>)}
  </section>}
  <div className={'pc-dashboard-grid pc-dashboard-grid-main'+(!r?' is-single':'')}>
   <section className="pc-dashboard-section"><header><div><span>ДЕНЬГИ</span><h2>Движение денег</h2></div><button className="pc-text-button" onClick={()=>choose('banking')}>Открыть финансы →</button></header>
    <p className="pc-bank-source">{bankName} · {period}</p>
    <CashTrend model={model} compact/>
   </section>
   {r&&<section className="pc-dashboard-section"><header><div><span>СЕЙЧАС В ФОКУСЕ</span><h2>Что важно сейчас</h2></div></header>
    <div className="pc-dashboard-factors">
     {!strengths.length && !risks.length && !dataLimits.length && <p className="pc-muted">Существенных факторов для отдельного акцента сейчас нет.</p>}
     {strengths.map((f,i)=><article key={'s'+i} data-tone="positive"><small>Сильная сторона</small><h3>{clientText(f.title)}</h3><p>{clientText(f.text)}</p><Why model={model} ids={[f.claimId]}/></article>)}
     {risks.map((f,i)=><article key={'r'+i} data-tone={f.status.tone}><small>{f.status.tone==='critical'?'Критическое ограничение':'Требует внимания'}</small><h3>{clientText(f.title)}</h3><p>{clientText(f.text)}</p><Why model={model} ids={[f.claimId]}/></article>)}
     {dataLimits.map(f=><article key={f.id} data-tone="data"><small>Можно уточнить</small><h3>{clientText(f.title)}</h3><p>{clientText(f.text)}</p><Why model={model} ids={[f.claimId]}/></article>)}
    </div>
   </section>}
  </div>
  {preview&&<section className="pc-dashboard-section pc-expert-preview"><header><h2>Экспертная оценка</h2><button className="pc-text-button" onClick={()=>openAnalysis('expertise')}>В кредитный профиль →</button></header><h3>{clientText(preview.title)}</h3><p>{clientText(preview.interpretation)}</p>{preview.nextStep&&<p><b>Следующий шаг.</b> {clientText(preview.nextStep)}</p>}{preview.claimIds.length>0&&<Why model={model} ids={preview.claimIds}/>}</section>}
  {r&&<div className="pc-dashboard-grid">
   <section className="pc-dashboard-section"><header><div><span>ФИНАНСИРОВАНИЕ</span><h2>Что подходит бизнесу</h2></div><button className="pc-text-button" onClick={()=>choose('financing')}>Все варианты →</button></header>
    <div className="pc-dashboard-products">{products.map(p=><article key={p.id}><small>{p.fit}</small><h3>{p.title}</h3><p>{p.purpose}</p><Why model={model} ids={[p.claimId]}/></article>)}</div>{!products.length&&<p className="pc-muted">{r.hero.globalStop?'Сначала разберите ограничение в кредитном профиле.':'Уточните цель и параметры запроса в разделе финансирования.'}</p>}
   </section>
   <section className="pc-dashboard-section"><header><div><span>РЕКОМЕНДАЦИИ</span><h2>Что сделать сейчас</h2></div><button className="pc-text-button" onClick={()=>openAnalysis('plan')}>План 7 / 30 / 60 →</button></header>
    <div className="pc-dashboard-actions">{actions.map(a=><article key={a.id}><div><h3>{a.title}</h3><p>{a.summary}</p></div><Why model={model} ids={[a.claimId]}/></article>)}</div>
   </section>
  </div>}
  {r?.financialAnalysis?.history.length?<FinancialSnapshot model={model} choose={choose}/>:null}
  {r?.externalSummary?.length?<section className="pc-dashboard-section pc-dashboard-external"><header><div><span>ВНЕШНИЙ КОНТЕКСТ</span><h2>Юридические и внешние сведения</h2></div></header><dl>{r.externalSummary.map(f=><div key={f.code}><dt>{f.label}</dt><dd>{f.value}<small>{f.source} · {date(f.asOf)}</small></dd></div>)}</dl></section>:null}
  <section className="pc-dashboard-section"><header><div><span>ИСТОЧНИКИ</span><h2>Что уже подключено</h2></div>
    <button className="pc-text-button" onClick={()=>choose('documents')}>Документы →</button>
  </header><SourceSummary model={model} onlyConnected/></section>
  {!r&&<FullAccessNotice model={model} retry={retry}/>}
 </div>;
}
