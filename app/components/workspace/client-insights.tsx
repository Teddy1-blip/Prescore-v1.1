"use client";
import {useRef,type ReactNode} from 'react';
import {linkedWhyClaims,whyBindings,whySources,whySourceDates,whyBindingText} from '../../../lib/workspace/why-evidence';
import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import type {PresentationFactorV1,PresentationActionV1} from '../../../lib/credit-engine/contracts/client-report';
import {money,date,FullAccessNotice} from './presentation';
import {publicText as clientText} from '../../../lib/credit-engine/client-report/copy';
import {sourceLabel,sourceState,label,PortfolioSnapshot} from './credit-depth';
import {FinancialSnapshot} from './client-financials';
import {CashMovement, cashMoney} from './cash-movement';
import {ClientDecisionRoute} from './client-decision-route';
import {ExplanationLibrary} from './explanation-library';
import {receiptLabel} from '../../../lib/credit-engine/explainability/receipts';
import {BankingSnapshot} from './banking-ledger';
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
const coverageLabels:Record<string,string>={FULL:'Полный месяц',PARTIAL:'Неполный месяц',MISSING:'Нет покрытия',OVERLAP:'Перекрытие выписок'};
export function CashTrend({model,compact=false}:{model:WorkspaceModelV1;compact?:boolean}){
 if (!compact) return <CashMovement model={model}/>;
 const rows=model.basic.bankingFacts.monthly??[],shown=compact?rows.slice(-6):rows;
 const max=Math.max(1,...shown.flatMap(r=>[r.externalInflows,r.externalOutflows]).filter((n):n is number=>n!==null).map(Math.abs));
 return <div className="pc-trend"><p className="pc-muted">Внешние поступления <i className="pc-key in"/> · списания <i className="pc-key out"/> {compact&&rows.length>6?'· Последние 6 месяцев':''}</p>
 {shown.length?<>
  {shown.map(r=><div className="pc-trend-row" key={r.month}><span>{r.month.split('-').reverse().join('.')}<small>{r.coverage==='FULL'?'':coverageLabels[r.coverage]??'Покрытие не определено'}</small></span><div className="pc-bars" aria-hidden="true">{[r.externalInflows,r.externalOutflows].map((v,i)=><i key={i} className={v!==null&&v<0?'negative':''} style={{width:v===null?'0%':Math.abs(v)/max*100+'%'}}/>)}</div><span>{cashMoney(r.externalInflows)}<small>{cashMoney(r.externalOutflows)}</small></span></div>)}

 </>:<p>Для помесячного графика недостаточно данных. Добавьте выписку с датами операций.</p>}</div>;
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
export function ExecutiveOverview({model,choose,retry,children}:{children?:ReactNode;model:WorkspaceModelV1;choose:(v:string)=>void;retry:()=>void}){
 const r=model.full?.report;
 const all=r?[...r.primaryFactors,...r.contextHighlights,...r.readiness.constraints]:[];
 const risks=all.filter(f=>['critical','attention'].includes(f.status.tone));
 const strengths=all.filter(f=>f.status.tone==='positive');
 const actions=r?.recommendations.primary.slice(0,3)??[];
 const broker=model.access.role==='ASSIGNED_BROKER';
 const detail=(section:string)=> (broker?'/agent?view=dossier&dossierView=analysis&analysisId=':'/dashboard?view=analysis&analysisId=')+encodeURIComponent(model.analysisId)+'&section='+section;
 const hasCredit=model.full&&(model.full.canonical.prescoreIndex.value!==null||model.full.canonical.financingReadiness.level!=='UNKNOWN');
 return <>
  <div className="pc-page-title"><h1>Обзор компании</h1><small>Расчёт на {date(r?.meta.asOfDate??model.basic.analysis.createdAt)}</small></div>
  {r&&(children??<ClientDecisionRoute model={model} choose={choose}/>)}
  {!hasCredit&&<p>Банковский профиль компании рассчитан</p>}
  {r&&<><CreditSummary model={model} section="index"/><p>Кредитное заключение · {r.hero.status}</p><Why model={model} ids={model.full!.canonical.explainability.claims.filter(c=>['INDEX_VALUE','READINESS'].includes(c.claimCode)).map(c=>c.claimId)}/></>}
  {(strengths.length>0||risks.length>0)&&<div className="pc-columns">{strengths.length>0&&<Panel title="Что помогает получить финансирование"><FactorRows model={model} items={strengths} limit={3}/></Panel>}{risks.length>0&&<Panel title="Риски и стоп-факторы"><FactorRows model={model} items={risks} limit={3}/></Panel>}</div>}
  <BankingSnapshot model={model}/>
  <FinancialSnapshot model={model} choose={choose}/><PortfolioSnapshot model={model} choose={choose}/>
  <Panel title="Денежный поток" action={<button className="pc-text-button" onClick={()=>choose('banking')}>Все финансы →</button>}><CashTrend model={model} compact/></Panel>
  {r&&<>
    {r.externalSummary?.length? <Panel title="Правовые сведения"><dl className="pc-definition">{r.externalSummary.map(f=><div key={f.code}><dt>{f.label}</dt><dd>{f.value}<br/><small>{f.source} {date(f.asOf)}</small></dd></div>)}</dl></Panel>:null}
    <Panel title="Долговая ёмкость"><CreditSummary model={model} section="capacity"/><p>{r.capacity.text}</p><a href={detail('capacity')}>Основания и сценарии расчёта →</a></Panel>
    <Panel title="Подходящее финансирование" action={<button className="pc-text-button" onClick={()=>choose('financing')}>Все варианты →</button>}>
      {[...r.productFit.primary,...r.productFit.other].slice(0,3).map(p=><article className="pc-product-brief" key={p.id}><h3>{p.title}</h3><span>{p.fit}</span><p>{p.purpose}</p>{p.missing.length>0&&<p>Требуется уточнить · {p.missing.join(', ')}</p>}<Why model={model} ids={[p.claimId]}/></article>)}
    </Panel>
    <Panel title="Что делать сейчас">{actions.map(a=><article key={a.id}><h3>{a.title}</h3><p>{a.summary}</p><p>{a.recheck}</p><Why model={model} ids={[a.claimId]}/></article>)}
      <a href={detail('plan')}>План на 7 / 30 / 60 дней →</a>
    </Panel>
    <Panel title="Ограничения оценки"><AssessmentLimits model={model} choose={broker?undefined:choose}/><FactorRows model={model} items={r.limitations} limit={3}/></Panel>
    <Panel title="Почему Prescore сделал этот вывод"><details><summary>Показать основания и источники</summary><ExplanationLibrary key={model.analysisId} model={model}/></details></Panel>
  </>}
  {!r&&<FullAccessNotice model={model} retry={retry}/>}
 </>;
}
