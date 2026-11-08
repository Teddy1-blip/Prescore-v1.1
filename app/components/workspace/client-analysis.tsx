"use client";
import {whyTitle} from '../../../lib/workspace/why-evidence';
import {useState} from 'react';
import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import {Financing} from '../../dashboard/report-v2/analysis-v3';
import {Panel,FactorRows,ActionItem,Why,CreditSummary,SourceSummary,AssessmentLimits} from './client-insights';
import {ReconciliationDetails,FinancialStatements} from './client-financials';
import {FullAccessNotice,money,date} from './presentation';
import {productPurpose,productReason} from './product-copy';
import {PublishedValue,label} from './credit-depth';
import {BankingSnapshot} from './banking-ledger';
import {ExplanationLibrary} from './explanation-library';
import {publicText} from '../../../lib/credit-engine/client-report/copy';
import {indexGapGuidance,capacityGapGuidance,obligationScheduleGuidance} from '../../../lib/workspace/credit-coverage-guidance';
import {DecisionHistory} from './client-decision-history';

export function FinancingProducts({model,embedded=false,showHeading=true}:{model:WorkspaceModelV1;embedded?:boolean;showHeading?:boolean}){
 const r=model.full?.report;
 if(!r)return <FullAccessNotice model={model}/>;
 const products=[...r.productFit.primary,...r.productFit.other];
 return <>
  {showHeading&&<div className="pc-page-title"><div>{embedded?<h2>Финансирование</h2>:<h1>Финансирование</h1>}<p>Какие механизмы подходят профилю компании и что нужно уточнить до обращения к кредитору</p></div></div>}
  <p className="pc-analysis-section-note">{r.productFit.bankSeparation}</p>
  <div className="pc-products">{products.map(p=><Panel key={p.id} title={p.title}>
   <div className="pc-statusline"><span className="pc-badge">{p.fit}</span></div>
   <p><b>Для чего:</b> {productPurpose(p.family)}</p><p><b>Соответствие цели:</b> {p.purpose}</p>
   <ProductReasons model={model} family={p.family}/>
   <p><b>Связь с долговой ёмкостью:</b> {p.capacity}</p>
   <p><b>Запрос:</b> {p.requested}</p>
   {p.missing.length>0&&<><h3>До подачи нужно уточнить</h3><ul>{p.missing.map((s,i)=><li key={i}>{s}</li>)}</ul></>}
   <Why model={model} ids={[p.claimId]}/>
  </Panel>)}</div>
  {!products.length&&<Panel title="Требуются дополнительные данные"><p>Подходящие продукты ещё не определены. Дополните отчётность и кредитную историю в документах.</p></Panel>}
  <p className="pc-muted">Соответствие продукта вашей компании не является предложением банка или одобрением заявки.</p>
 </>;
}

function ProductReasons({model,family}:{model:WorkspaceModelV1;family:string}){
 const candidate=model.full?.canonical.productSelection.candidates.find(c=>c.productFamily===family);
 if(!candidate)return <p>Подробные причины соответствия в этой версии анализа не раскрыты.</p>;
 return <>{candidate.supportReasonCodes.length>0&&<><h3>Почему рассматривается</h3><ul>{candidate.supportReasonCodes.map(code=><li key={code}>{productReason(code)}</li>)}</ul></>}{candidate.constraintReasonCodes.length>0&&<><h3>Ограничения</h3><ul>{candidate.constraintReasonCodes.map(code=><li key={code}>{productReason(code)}</li>)}</ul></>}</>;
}

export function DebtPortfolio({model,embedded=false}:{model:WorkspaceModelV1;embedded?:boolean}){
 const p=model.full?.report.analysisV3,b=model.basic.bankingFacts;
 return <>
  <div className="pc-page-title"><div>{embedded?<h2>Обязательства</h2>:<h1>Обязательства</h1>}<p>Договоры, текущие платежи и долговая нагрузка</p></div></div>
  <Panel title="Обслуживание долга по выпискам">
   <dl className="pc-definition">{[['Основной долг',b.loanPrincipalPayments],['Проценты',b.interestPayments],['Лизинг',b.leasingPayments],['Неразделённые платежи',b.unsplitDebtPayments]].map(([name,f])=><div key={String(name)}><dt>{String(name)}</dt><dd>{money((f as typeof b.grossInflow).status==='UNKNOWN'?null:(f as typeof b.grossInflow).value)}</dd></div>)}</dl>
   <p className="pc-muted">За {date(model.basic.analysis.period.from)} — {date(model.basic.analysis.period.to)}. Платежи по выпискам не заменяют договорный график и не доказывают отсутствие других обязательств.</p>
  </Panel>
  {!model.full?<FullAccessNotice model={model}/>:<Panel title="Кредитный портфель"><p className="pc-table-hint">Таблицу можно прокручивать по горизонтали: справа показаны суммы, платежи и сроки.</p>
   {p?.portfolio.length?<div className="pc-table-scroll" tabIndex={0} aria-label="Таблица обязательств"><table><thead><tr><th>Кредитор / инструмент</th><th>Статус</th><th>Основной долг / лимит</th><th>Платёж</th><th>Следующий платёж</th><th>Срок погашения</th><th>Просрочка</th><th>Участие в графике ёмкости</th></tr></thead><tbody>{p.portfolio.map(o=><tr key={o.id}><th><PublishedValue value={o.creditor}/><small>{label(o.type)} · {label(o.exposure)}</small>{!!o.sources?.length&&<small>Источник: {o.sources.map(s=>({BKI:"БКИ",BANK_STATEMENT:"выписка",DEBT_DOCUMENT:"договор",USER_CONFIRMATION:"подтверждение",DERIVED:"расчёт"}[s]??"другой источник")).join(", ")}</small>}</th><td><PublishedValue value={o.status}/></td><td><PublishedValue value={o.principal} currency/>{o.reportedPrincipal?.value!==null&&o.reportedPrincipal&&(o.reportedPrincipal.asOf!==o.principal.asOf||o.reportedPrincipal.value!==o.principal.value)&&<><small>Остаток по отчёту на {date(o.reportedPrincipal.asOf)}</small><PublishedValue value={o.reportedPrincipal} currency/></>}{o.reportedTotal?.value!=null&&<><small>Общая задолженность по отчёту</small><PublishedValue value={o.reportedTotal} currency/></>}{o.originalAmount?.value!=null&&<><small>Первоначальная сумма</small><PublishedValue value={o.originalAmount} currency/></>}<small>Лимит по договору</small><PublishedValue value={o.limit} currency/>{o.availableLimit&&<><small>Неиспользованный лимит</small><PublishedValue value={o.availableLimit} currency/></>}{o.exposure==='CONTINGENT'&&<><small>Условное обязательство</small><PublishedValue value={o.contingent} currency/></>}</td><td><PublishedValue value={o.payment} currency/><PublishedValue value={o.paymentFrequency}/></td><td><PublishedValue value={o.nextPayment} currency/><PublishedValue value={o.nextDate} dateValue/></td><td>{o.maturity?<PublishedValue value={o.maturity} dateValue/>:'Недостаточно данных'}</td><td><PublishedValue value={o.overdue} currency/></td><td>{obligationScheduleGuidance(o.id,o.exposure,model.full!.canonical.debtCapacity.portfolioScheduledDebtService30d)}</td></tr>)}</tbody></table></div>:<p>Обязательства не раскрыты в полученных данных. Добавьте кредитную историю, чтобы Prescore сопоставил обязательства с платежами по выписке. Это не подтверждение отсутствия долга.</p>}
   <p className="pc-muted">Остаток долга, доступный лимит и условные обязательства учитываются отдельно. Просрочка показана на дату источника.</p>
  </Panel>}
 </>;
}


function IndexEvidenceGaps({model}:{model:WorkspaceModelV1}){
 const index=model.full?.canonical.prescoreIndex;
 if(!index||index.value!==null)return null;
 const gaps=indexGapGuidance(index.coverage.components);
 if(!gaps.length)return null;
 return <Panel title="Что мешает рассчитать Prescore Index">
  <p className="pc-muted">Указаны фактически отсутствующие подтверждения из расчётной модели. Диагностические баллы компонентов не являются общим индексом.</p>
  <ul>{gaps.map(g=><li key={g.component+g.factCode}><b>{g.component}: {g.label}.</b> {g.blocksNumericIndex?'Без этого подтверждения итоговый индекс не публикуется.':'Покрытие компонента ограничено, но это не самостоятельная блокировка общего индекса.'} {g.action}</li>)}</ul>
 </Panel>;
}
function CapacityEvidenceGaps({model}:{model:WorkspaceModelV1}){
 const full=model.full;
 if(!full)return null;
 const notes=capacityGapGuidance(full.canonical.debtCapacity,full.policyRequirements?.debtCapacityMinFullMonths);
 if(!notes.length)return null;
 return <Panel title="Основания и ограничения долговой ёмкости"><ul>{notes.map((note,i)=><li key={i}>{note}</li>)}</ul><p className="pc-muted">Долговые платежи по выписке и датированный платёж из БКИ — разные основания. Prescore не приравнивает неизвестный график к нулевому долгу.</p></Panel>;
}

export function FullCreditAnalysis({model,retry,initialSection='conclusion'}:{model:WorkspaceModelV1;retry:()=>void;initialSection?:string}){
 const [tab,setTab]=useState(()=>{
  const value=typeof window==='undefined'?initialSection:new URLSearchParams(window.location.search).get('section')||initialSection;
  return ['conclusion','factors','capacity','financials','obligations','financing','reconciliation','plan','evidence','history'].includes(value)?value:'conclusion';
 });
 const r=model.full?.report;
 if(!r)return <FullAccessNotice model={model} retry={retry}/>;
 const snapshot=r.meta.snapshot;
 const tabs=[['conclusion','Заключение'],['factors','Оценка и риски'],['capacity','Долговая ёмкость'],['financials','Финансовое состояние'],['obligations','Обязательства'],['financing','Финансирование'],['reconciliation','Сопоставление данных'],['plan','План действий'],['evidence','Источники'],['history','История']];
 const all=[...r.primaryFactors,...r.contextHighlights,...r.readiness.constraints,...r.detailedSections.flatMap(s=>s.factors)];
 const topConstraint=r.readiness.constraints[0]??r.limitations[0]??r.dataQuality[0];
 const expertise=r.expertise;
 const strengthIds=new Set(expertise?.strengthIds??[]);
 const attentionIds=new Set(expertise?.attentionIds??[]);
 const memoIds=new Set(expertise?.memoIds??[]);
 function select(next:string){setTab(next);const url=new URL(window.location.href);url.searchParams.set('section',next);window.history.replaceState(null,'',url);}
 return <>
  <div className="pc-page-title"><div><h1>Анализ Prescore</h1><p>Кредитное заключение на {date(r.meta.asOfDate)}</p>{snapshot && <details><summary>Версия расчёта</summary><code style={{overflowWrap:"anywhere"}}>{snapshot.snapshotId}</code></details>}</div><a className="pc-secondary" href={'/dashboard/report-v2?analysisId='+encodeURIComponent(model.analysisId)+'&print=1'} target="_blank" rel="noreferrer">Печать / PDF</a></div>
  <nav className="pc-tabs" aria-label="Разделы анализа">{tabs.map(([id,title])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>select(id)}>{title}</button>)}</nav>

  {tab==='conclusion'&&<>
   <section className="pc-analysis-hero">
    <div><span className="pc-kicker">КРЕДИТНОЕ ЗАКЛЮЧЕНИЕ</span><h2>{r.hero.headline}</h2><p>{r.hero.summary}</p><div className="pc-statusline"><span className={'pc-badge'+(r.hero.globalStop?' critical':'')}>{r.hero.globalStop?'Есть критичное ограничение':'Критичного общего стоп-фактора нет'}</span><span className="pc-badge">{r.hero.confidence}</span></div></div>
    <aside><span>Ключевое ограничение</span><strong>{publicText(topConstraint?whyTitle(model.full?.canonical.explainability,topConstraint.claimId,topConstraint.title):'Отдельное ограничение не выделено')}</strong><small>{publicText(topConstraint?.text??'Проверьте комплект источников и готовность к финансированию.')}</small>{topConstraint&&<Why model={model} ids={[topConstraint.claimId]}/>}</aside>
   </section>
   <BankingSnapshot model={model}/><CreditSummary model={model}/><AssessmentLimits model={model}/><IndexEvidenceGaps model={model}/>
   {model.full!.canonical.financingReadiness.level!=='UNKNOWN'&&<Panel title="Готовность к финансированию"><h3>{r.readiness.level}</h3><p>{r.readiness.text}</p><FactorRows model={model} items={r.readiness.constraints}/></Panel>}
   {expertise&&<Panel title="Экспертный разбор">
    <p className="pc-analysis-section-note">Факты и интерпретация разделены: сначала вывод, затем детали и подтверждения.</p>
    <div className="pc-expertise-grid">{expertise.items.filter(i=>memoIds.has(i.id)||strengthIds.has(i.id)||attentionIds.has(i.id)).map(i=>{const tone=strengthIds.has(i.id)?'positive':attentionIds.has(i.id)?'attention':'memo';return <article className="pc-expertise-card" data-tone={tone} key={i.id}><span>{tone==='positive'?'Сильная сторона':tone==='attention'?'Требует внимания':'Взгляд кредитора'}</span><h3>{i.title}</h3><p><b>Факт.</b> {i.fact}</p><p>{i.interpretation}</p><details><summary>Влияние и следующий шаг</summary><p><b>Влияние.</b> {i.impact}</p>{i.limitation&&<p><b>Ограничение.</b> {i.limitation}</p>}{i.nextStep&&<p><b>Следующий шаг.</b> {i.nextStep}</p>}{i.closure.length>0&&<ul>{i.closure.map((s,n)=><li key={n}>{s}</li>)}</ul>}<Why model={model} ids={i.claimIds}/></details></article>;})}</div>
   </Panel>}
  </>}

  {tab==='factors'&&<>
   <Panel title="Prescore Index"><p>{r.index.status} · {r.index.confidence}</p><dl className="pc-definition">{r.index.components.map(c=><div key={c.id}><dt>{c.label}</dt><dd>{c.score.value===null?'Недостаточно данных':c.score.display} / {c.maximum.value===null?'—':c.maximum.display}<Why model={model} ids={[c.score.claimId]}/></dd></div>)}</dl></Panel><IndexEvidenceGaps model={model}/>
   {([['Критичные ограничения',['critical']],['Требует внимания',['attention','data']],['Сильные стороны',['positive']],['Контекст оценки',['info','neutral']]] as Array<[string,string[]]>).map(([title,tones])=><Panel key={title} title={title}><FactorRows model={model} items={all.filter(f=>tones.includes(f.status.tone))}/></Panel>)}
  </>}

  {tab==='capacity'&&<><div className="pc-canonical av-report"><Financing model={r}/></div><CapacityEvidenceGaps model={model}/></>}
  {tab==='financials'&&<FinancialStatements model={model}/>}
  {tab==='obligations'&&<DebtPortfolio model={model} embedded/>}
  {tab==='financing'&&<FinancingProducts model={model} embedded/>}
  {tab==='reconciliation'&&<ReconciliationDetails model={model}/>}
  {tab==='plan'&&<ActionPlan model={model}/>}
  {tab==='evidence'&&<>
   <Panel title="Источники и периоды"><SourceSummary model={model}/><div className="pc-table-scroll"><table><thead><tr><th>Источник</th><th>Период</th><th>Дата сведений</th><th>Достоверность</th></tr></thead><tbody>{r.sources.map(s=><tr key={s.id}><th>{s.label}</th><td>{s.period||'Не указан'}</td><td>{date(s.asOf)}</td><td>{s.confidence}</td></tr>)}</tbody></table></div></Panel>
   <Panel title="Ограничения достоверности"><FactorRows model={model} items={[...r.dataQuality,...r.limitations]}/></Panel>
   <ExplanationLibrary model={model}/>
  </>}
  {tab==='history'&&<DecisionHistory analysisId={model.analysisId} currentSnapshotId={snapshot?.snapshotId}/>}
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
