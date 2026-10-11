"use client";
import {useState} from 'react';
import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import {Financing} from '../../dashboard/report-v2/analysis-v3';
import {Panel,FactorRows,ActionItem,Why,CreditSummary,SourceSummary} from './client-insights';
import {ReconciliationDetails,FinancialStatements} from './client-financials';
import {FullAccessNotice,money,date} from './presentation';
import {PublishedValue,label} from './credit-depth';

export function FinancingProducts({model}:{model:WorkspaceModelV1}){
 const r=model.full?.report;
 if(!r)return <FullAccessNotice model={model}/>;
 const products=[...r.productFit.primary,...r.productFit.other];
 return <>
  <div className="pc-page-title"><div><h1>Финансирование</h1><p>Какие механизмы подходят профилю компании и что нужно уточнить до обращения к кредитору</p></div></div>
  <p className="pc-analysis-section-note">{r.productFit.bankSeparation}</p>
  <div className="pc-products">{products.map(p=><Panel key={p.id} title={p.title}>
   <div className="pc-statusline"><span className="pc-badge">{p.fit}</span></div>
   <p><b>Для чего:</b> {p.purpose}</p>
   <p><b>Связь с долговой ёмкостью:</b> {p.capacity}</p>
   <p><b>Запрос:</b> {p.requested}</p>
   {p.missing.length>0&&<><h3>До подачи нужно уточнить</h3><ul>{p.missing.map((s,i)=><li key={i}>{s}</li>)}</ul></>}
   <Why model={model} ids={[p.claimId]}/>
  </Panel>)}</div>
  {!products.length&&<Panel title="Требуются дополнительные данные"><p>Подходящие продукты ещё не определены. Дополните отчётность и кредитную историю в документах.</p></Panel>}
  <p className="pc-muted">Соответствие продукта вашей компании не является предложением банка или одобрением заявки.</p>
 </>;
}

export function DebtPortfolio({model}:{model:WorkspaceModelV1}){
 const p=model.full?.report.analysisV3,b=model.basic.bankingFacts;
 return <>
  <div className="pc-page-title"><div><h1>Обязательства</h1><p>Договоры, текущие платежи и долговая нагрузка</p></div></div>
  <Panel title="Обслуживание долга по выпискам">
   <dl className="pc-definition">{[['Основной долг',b.loanPrincipalPayments],['Проценты',b.interestPayments],['Лизинг',b.leasingPayments],['Неразделённые платежи',b.unsplitDebtPayments]].map(([name,f])=><div key={String(name)}><dt>{String(name)}</dt><dd>{money((f as typeof b.grossInflow).status==='UNKNOWN'?null:(f as typeof b.grossInflow).value)}</dd></div>)}</dl>
   <p className="pc-muted">За {date(model.basic.analysis.period.from)} — {date(model.basic.analysis.period.to)}. Платежи по выпискам не заменяют договорный график и не доказывают отсутствие других обязательств.</p>
  </Panel>
  {!model.full?<FullAccessNotice model={model}/>:<Panel title="Кредитный портфель">
   {p?.portfolio.length?<div className="pc-table-scroll" tabIndex={0} aria-label="Таблица обязательств"><table><thead><tr><th>Кредитор / инструмент</th><th>Статус</th><th>Основной долг / лимит</th><th>Платёж</th><th>Следующий платёж</th><th>Просрочка</th></tr></thead><tbody>{p.portfolio.map(o=><tr key={o.id}><th><PublishedValue value={o.creditor}/><small>{label(o.type)} · {label(o.exposure)}</small></th><td><PublishedValue value={o.status}/></td><td><PublishedValue value={o.principal} currency/><small>Лимит</small><PublishedValue value={o.limit} currency/>{o.exposure==='CONTINGENT'&&<><small>Условное обязательство</small><PublishedValue value={o.contingent} currency/></>}</td><td><PublishedValue value={o.payment} currency/><PublishedValue value={o.paymentFrequency}/></td><td><PublishedValue value={o.nextPayment} currency/><PublishedValue value={o.nextDate}/></td><td><PublishedValue value={o.overdue} currency/></td></tr>)}</tbody></table></div>:<p>Обязательства не раскрыты в полученных данных. Добавьте БКИ и договоры. Это не подтверждение отсутствия долга.</p>}
   <p className="pc-muted">Остаток долга, доступный лимит и условные обязательства учитываются отдельно. Просрочка показана на дату источника.</p>
  </Panel>}
 </>;
}

export function FullCreditAnalysis({model,retry,initialSection='conclusion'}:{model:WorkspaceModelV1;retry:()=>void;initialSection?:string}){
 const [tab,setTab]=useState(()=>{
  const value=typeof window==='undefined'?initialSection:new URLSearchParams(window.location.search).get('section')||initialSection;
  return ['conclusion','factors','capacity','financials','reconciliation','plan','evidence'].includes(value)?value:'conclusion';
 });
 const r=model.full?.report;
 if(!r)return <FullAccessNotice model={model} retry={retry}/>;
 const tabs=[['conclusion','Заключение'],['factors','Оценка и риски'],['capacity','Долговая ёмкость'],['financials','Финансовое состояние'],['reconciliation','Сопоставление данных'],['plan','План действий'],['evidence','Источники']];
 const all=[...r.primaryFactors,...r.contextHighlights,...r.readiness.constraints,...r.detailedSections.flatMap(s=>s.factors)];
 const topConstraint=r.readiness.constraints[0]??r.limitations[0]??r.dataQuality[0];
 const expertise=r.expertise;
 const strengthIds=new Set(expertise?.strengthIds??[]);
 const attentionIds=new Set(expertise?.attentionIds??[]);
 const memoIds=new Set(expertise?.memoIds??[]);
 function select(next:string){setTab(next);const url=new URL(window.location.href);url.searchParams.set('section',next);window.history.replaceState(null,'',url);}
 return <>
  <div className="pc-page-title"><div><h1>Анализ Prescore</h1><p>Кредитное заключение на {date(r.meta.asOfDate)}</p></div><a className="pc-secondary" href={'/dashboard/report-v2?analysisId='+encodeURIComponent(model.analysisId)+'&print=1'} target="_blank" rel="noreferrer">Печать / PDF</a></div>
  <nav className="pc-tabs" aria-label="Разделы анализа">{tabs.map(([id,title])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>select(id)}>{title}</button>)}</nav>

  {tab==='conclusion'&&<>
   <section className="pc-analysis-hero">
    <div><span className="pc-kicker">КРЕДИТНОЕ ЗАКЛЮЧЕНИЕ</span><h2>{r.hero.headline}</h2><p>{r.hero.summary}</p><div className="pc-statusline"><span className={'pc-badge'+(r.hero.globalStop?' critical':'')}>{r.hero.globalStop?'Есть критичное ограничение':'Критичного общего стоп-фактора нет'}</span><span className="pc-badge">{r.hero.confidence}</span></div></div>
    <aside><span>Ключевое ограничение</span><strong>{topConstraint?.title??'Отдельное ограничение не выделено'}</strong><small>{topConstraint?.text??'Проверьте комплект источников и готовность к финансированию.'}</small>{topConstraint&&<Why model={model} ids={[topConstraint.claimId]}/>}</aside>
   </section>
   <CreditSummary model={model}/>
   <Panel title="Готовность к финансированию"><h3>{r.readiness.level}</h3><p>{r.readiness.text}</p><FactorRows model={model} items={r.readiness.constraints}/></Panel>
   {expertise&&<Panel title="Экспертный разбор">
    <p className="pc-analysis-section-note">Факты и интерпретация разделены: сначала вывод, затем детали и подтверждения.</p>
    <div className="pc-expertise-grid">{expertise.items.filter(i=>memoIds.has(i.id)||strengthIds.has(i.id)||attentionIds.has(i.id)).map(i=>{const tone=strengthIds.has(i.id)?'positive':attentionIds.has(i.id)?'attention':'memo';return <article className="pc-expertise-card" data-tone={tone} key={i.id}><span>{tone==='positive'?'Сильная сторона':tone==='attention'?'Требует внимания':'Взгляд кредитора'}</span><h3>{i.title}</h3><p><b>Факт.</b> {i.fact}</p><p>{i.interpretation}</p><details><summary>Влияние и следующий шаг</summary><p><b>Влияние.</b> {i.impact}</p>{i.limitation&&<p><b>Ограничение.</b> {i.limitation}</p>}{i.nextStep&&<p><b>Следующий шаг.</b> {i.nextStep}</p>}{i.closure.length>0&&<ul>{i.closure.map((s,n)=><li key={n}>{s}</li>)}</ul>}<Why model={model} ids={i.claimIds}/></details></article>;})}</div>
   </Panel>}
  </>}

  {tab==='factors'&&<>
   <Panel title="Prescore Index"><p>{r.index.status} · {r.index.confidence}</p><dl className="pc-definition">{r.index.components.map(c=><div key={c.id}><dt>{c.label}</dt><dd>{c.score.value===null?'Недостаточно данных':c.score.display} / {c.maximum.value===null?'—':c.maximum.display}<Why model={model} ids={[c.score.claimId]}/></dd></div>)}</dl></Panel>
   {([['Критичные ограничения',['critical']],['Требует внимания',['attention','data']],['Сильные стороны',['positive']],['Контекст оценки',['info','neutral']]] as Array<[string,string[]]>).map(([title,tones])=><Panel key={title} title={title}><FactorRows model={model} items={all.filter(f=>tones.includes(f.status.tone))}/></Panel>)}
  </>}

  {tab==='capacity'&&<div className="pc-canonical av-report"><Financing model={r}/></div>}
  {tab==='financials'&&<FinancialStatements model={model}/>}
  {tab==='reconciliation'&&<ReconciliationDetails model={model}/>}
  {tab==='plan'&&<ActionPlan model={model}/>}
  {tab==='evidence'&&<>
   <Panel title="Источники и периоды"><SourceSummary model={model}/><div className="pc-table-scroll"><table><thead><tr><th>Источник</th><th>Период</th><th>Дата сведений</th><th>Достоверность</th></tr></thead><tbody>{r.sources.map(s=><tr key={s.id}><th>{s.label}</th><td>{s.period||'Не указан'}</td><td>{date(s.asOf)}</td><td>{s.confidence}</td></tr>)}</tbody></table></div></Panel>
   <Panel title="Ограничения достоверности"><FactorRows model={model} items={[...r.dataQuality,...r.limitations]}/></Panel>
  </>}
  {tab!=='plan'&&<button className="pc-text-button" onClick={()=>select('plan')} id="plan">Перейти к плану действий →</button>}
 </>;
}

export function ActionPlan({model}:{model:WorkspaceModelV1}){
 const r=model.full!.report,scheduled=new Set(r.actionPlan.horizons.flatMap(h=>h.items.map(a=>a.canonicalId))),now=r.recommendations.primary.filter(a=>!scheduled.has(a.canonicalId)),shown=new Set<string>();
 return <>
  <Panel title="Сейчас">{now.length?now.map(a=><ActionItem key={a.id} item={a} model={model}/>):<p>Приоритетные действия включены в ближайший этап плана ниже.</p>}</Panel>
  {r.actionPlan.horizons.map(h=><Panel key={h.id} title={h.title+' · '+date(h.date)}>{h.items.filter(a=>{if(shown.has(a.canonicalId))return false;shown.add(a.canonicalId);return true;}).map(a=><ActionItem key={a.id} item={a} model={model}/>)}{!h.items.length&&<p>Отдельные действия на этот срок не назначены.</p>}</Panel>)}
  <Panel title="Дополнительные рекомендации">{r.recommendations.backlog.filter(a=>!scheduled.has(a.canonicalId)&&!now.some(n=>n.canonicalId===a.canonicalId)).map(a=><ActionItem key={a.id} item={a} model={model}/>)}</Panel>
  <p className="pc-muted">{r.actionPlan.disclaimer}</p>
 </>;
}
