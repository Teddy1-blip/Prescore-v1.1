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
import {RiskSections, ExpertiseSection, RecommendationsSection} from './profile-sections';
import {DecisionHistory} from './client-decision-history';

export function FinancingProducts({model,embedded=false,showHeading=true}:{model:WorkspaceModelV1;embedded?:boolean;showHeading?:boolean}){
 const r=model.full?.report;
 if(!r)return <FullAccessNotice model={model}/>;
 const candidates=model.full!.canonical.productSelection.candidates;
 const products=[...r.productFit.primary,...r.productFit.other].filter(p=>candidates.some(c=>c.productFamily===p.family && (c.preliminary||!['UNKNOWN','NOT_APPLICABLE'].includes(c.fitLevel))));
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
  {!products.length&&<Panel title="Требуются дополнительные данные"><p>{r.hero.globalStop?'Откройте стоп-факторы в кредитном профиле.':'Заполните запрос на финансирование: укажите цель и желаемую сумму.'}</p></Panel>}
  <p className="pc-muted">Prescore оценивает соответствие механики финансирования. Решение и условия конкретного банка определяет кредитор.</p>
 </>;
}

function ProductReasons({model,family}:{model:WorkspaceModelV1;family:string}){
 const candidate=model.full?.canonical.productSelection.candidates.find(c=>c.productFamily===family);
 if(!candidate)return <p>Подробные причины соответствия в этой версии анализа не раскрыты.</p>;
 return <>{candidate.supportReasonCodes.length>0&&<><h3>Почему рассматривается</h3><ul>{candidate.supportReasonCodes.map(code=><li key={code}>{productReason(code)}</li>)}</ul></>}{candidate.constraintReasonCodes.length>0&&<><h3>Ограничения</h3><ul>{candidate.constraintReasonCodes.map(code=><li key={code}>{productReason(code)}</li>)}</ul></>}</>;
}

export function DebtPortfolio({model,embedded=false}:{model:WorkspaceModelV1;embedded?:boolean}){
 const p=model.full?.report.analysisV3,b=model.basic.bankingFacts;
 const payments=[['Основной долг',b.loanPrincipalPayments],['Проценты',b.interestPayments],['Лизинг',b.leasingPayments],['Неразделённые платежи',b.unsplitDebtPayments]] as const;
 const schedule=p?.scheduledPayments?.filter(s=>s.value!==null)??[];
 return <>
  <div className="pc-page-title"><div>{embedded?<h2>Кредитный портфель</h2>:<h1>Кредитный портфель</h1>}<p>Договоры, обслуживание и ближайшие платежи</p></div></div>
  <Panel title="Обслуживание долга по выпискам">
   <dl className="pc-definition">{payments.filter(([,f])=>f.value!==null&&(f.status==='KNOWN'||f.status==='PARTIAL')).map(([name,f])=><div key={name}><dt>{name}</dt><dd>{money(f.value)}</dd></div>)}</dl>
   <p className="pc-muted">{date(model.basic.analysis.period.from)} — {date(model.basic.analysis.period.to)} · Банковские выписки</p>
  </Panel>
  {!model.full?<FullAccessNotice model={model}/>:<Panel title="Обязательства по договорам">
   {p?.portfolio.length?<div className="pc-obligations">{p.portfolio.map(o=>{
    const amounts=[
     ['Основной долг',o.principal],['Остаток по отчёту',o.reportedPrincipal],['Общая задолженность по отчёту',o.reportedTotal],
     ['Первоначальная сумма',o.originalAmount],['Лимит по договору',o.limit],['Неиспользованный лимит',o.availableLimit],
     ['Условное обязательство',o.contingent],['Платёж по договору',o.payment],['Ближайший платёж',o.nextPayment],['Просрочка',o.overdue],
    ] as const;
    return <article key={o.id}><header><div><h3>{o.creditor.value??'Кредитное обязательство'}</h3><small>{label(o.type)} · {label(o.exposure)}</small></div>{o.status.value&&<span className="pc-badge">{label(String(o.status.value))}</span>}</header>
     <dl className="pc-definition">{amounts.filter(([,v])=>v?.value!=null).map(([name,value])=><div key={name}><dt>{name}</dt><dd><PublishedValue value={value!} currency/></dd></div>)}
      {o.annualRate?.value!=null&&<div><dt>Ставка</dt><dd>{o.annualRate.value}%</dd></div>}
      {o.paymentFrequency.value!=null&&<div><dt>Периодичность платежа</dt><dd><PublishedValue value={o.paymentFrequency}/></dd></div>}
      {([['Дата ближайшего платежа',o.nextDate],['Срок погашения',o.maturity]] as const).map(([name,value])=>{
       return value?.value!=null&&<div key={String(name)}><dt>{String(name)}</dt><dd><PublishedValue value={value} dateValue/></dd></div>;
      })}</dl>
     <details><summary>Источник и участие в графике</summary>{!!o.sources?.length&&<p>{o.sources.map(s=>({BKI:'БКИ',BANK_STATEMENT:'Банковская выписка',DEBT_DOCUMENT:'Договор',USER_CONFIRMATION:'Подтверждение',DERIVED:'Расчёт'}[s]??'Другой источник')).join(' · ')}</p>}
      <p>{obligationScheduleGuidance(o.id,o.exposure,model.full!.canonical.debtCapacity.portfolioScheduledDebtService30d)}</p></details>
    </article>;
   })}</div>:<p>Добавьте БКИ в документах, чтобы раскрыть кредитный портфель и сопоставить график с платежами по выписке.</p>}
  </Panel>}
  {!!schedule.length&&<Panel title="Платежи по графику"><dl className="pc-definition">{schedule.map(s=><div key={s.days}><dt>Ближайшие {s.days} дней</dt><dd>{money(s.value)}</dd></div>)}</dl></Panel>}
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
  return ['conclusion','factors','expertise','capacity','financials','obligations','financing','reconciliation','recommendations','plan','evidence','history'].includes(value)?value:'conclusion';
 });
 const r=model.full?.report;
 if(!r)return <FullAccessNotice model={model} retry={retry}/>;
 const snapshot=r.meta.snapshot;
 const tabs=[['conclusion','Заключение'],['factors','Стоп-факторы и риски'],['expertise','Экспертная оценка'],['capacity','Долговая ёмкость'],['financials','Финансовое состояние'],['obligations','Кредитный портфель'],['financing','Финансирование'],['reconciliation','Сверка'],['recommendations','Рекомендации'],['plan','План 7 / 30 / 60'],['evidence','Основания'],['history','История']];
 const economic=r.primaryFactors?.find(f=>model.full?.canonical.explainability.claims.some(c=>c.claimId===f.claimId&&['GLOBAL_STOP','CREDIT_RISK'].includes(c.status??'')));
 const topConstraint=economic??r.readiness.constraints[0]??r.limitations[0]??r.dataQuality[0];
 function select(next:string){setTab(next);const url=new URL(window.location.href);url.searchParams.set('section',next);window.history.replaceState(null,'',url);}
 return <>
  <div className="pc-page-title"><div><h1>Кредитный профиль</h1><p>Заключение Prescore на {date(r.meta.asOfDate)}</p>{snapshot && <details><summary>Версия расчёта</summary><code style={{overflowWrap:"anywhere"}}>{snapshot.snapshotId}</code></details>}</div><a className="pc-secondary" href={'/dashboard/report-v2?analysisId='+encodeURIComponent(model.analysisId)+(snapshot&&model.full?.revisionAvailable?'&snapshotId='+encodeURIComponent(snapshot.snapshotId):'')+'&print=1'} target="_blank" rel="noreferrer">Печать / PDF</a></div>
  <nav className="pc-tabs" aria-label="Разделы анализа">{tabs.map(([id,title])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>select(id)}>{title}</button>)}</nav>

  {tab==='conclusion'&&<>
   <section className="pc-analysis-hero">
    <div><span className="pc-kicker">ЭКСПЕРТНОЕ ЗАКЛЮЧЕНИЕ</span><h2>{r.hero.headline}</h2><p>{r.hero.summary}</p><div className="pc-statusline"><span className={'pc-badge'+(r.hero.globalStop?' critical':'')}>{r.hero.globalStop?'Есть критичное ограничение':'Общий стоп-фактор не выявлен в доступных сведениях'}</span><span className="pc-badge">{r.hero.confidence}</span></div></div>
    <aside><span>{economic?'Ключевой фактор':'Что требует проверки'}</span><strong>{publicText(topConstraint?whyTitle(model.full?.canonical.explainability,topConstraint.claimId,topConstraint.title):'Отдельное ограничение не выделено')}</strong><small>{publicText(topConstraint?.text??'Проверьте комплект источников и готовность к финансированию.')}</small>{topConstraint&&<Why model={model} ids={[topConstraint.claimId]}/>}</aside>
   </section>
   {model.full?.canonical.creditAssessment.bankObservations?.length?<Panel title="Факторы заключения">{model.full.canonical.explainability.claims.filter(c=>c.claimCode.startsWith('PROFILE:')).map(c=><article key={c.claimId}><p>{publicText(c.textRu)}</p><Why model={model} ids={[c.claimId]}/></article>)}</Panel>:null}
   <BankingSnapshot model={model}/><CreditSummary model={model}/><AssessmentLimits model={model}/><details><summary>Основания числовой оценки</summary><IndexEvidenceGaps model={model}/></details>
   {model.full!.canonical.financingReadiness.level!=='UNKNOWN'&&<Panel title="Готовность к финансированию"><h3>{r.readiness.level}</h3><p>{r.readiness.text}</p><FactorRows model={model} items={r.readiness.constraints}/></Panel>}
  </>}

  {tab==='factors'&&<><RiskSections model={model}/>{r.index.components.some(c=>c.score.value!==null)&&<Panel title="Компоненты Prescore Index"><dl className="pc-definition">{r.index.components.filter(c=>c.score.value!==null).map(c=><div key={c.id}><dt>{c.label}</dt><dd>{c.score.display}{c.maximum.value!==null?' / '+c.maximum.display:''}<Why model={model} ids={[c.score.claimId]}/></dd></div>)}</dl></Panel>}<IndexEvidenceGaps model={model}/></>}
  {tab==='expertise'&&<ExpertiseSection model={model}/>}
  {tab==='recommendations'&&<RecommendationsSection model={model}/>}
  {tab==='capacity'&&<><div className="pc-canonical av-report"><Financing model={r}/></div>
   {r.analysisV3?.financing.views.some(v=>v.headroom!==null||v.upperHeadroom!==null)&&<Panel title="Запас в двух режимах обслуживания"><div className="pc-capacity-views">{r.analysisV3.financing.views.map(v=><section key={v.kind}><h3>{v.kind==='RECURRING'?'Регулярная нагрузка':'Ближайшие 30 дней'}</h3><dl className="pc-definition">{([['Текущее обслуживание',v.current.value],['Осторожный запас',v.headroom],['Верхняя граница запаса',v.upperHeadroom]] as const).filter(([,amount])=>typeof amount==='number').map(([name,amount])=><div key={name}><dt>{name}</dt><dd>{money(Number(amount))} / мес.</dd></div>)}</dl></section>)}</div></Panel>}
   <p className="pc-analysis-section-note">Это способность обслуживать дополнительный долг, а не одобренная сумма кредита.</p><CapacityEvidenceGaps model={model}/></>}

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
  {tab==='history'&&<DecisionHistory key={model.analysisId+snapshot?.snapshotId} analysisId={model.analysisId} currentSnapshotId={snapshot?.snapshotId}/>}
  {tab!=='plan'&&<button className="pc-text-button" onClick={()=>select('plan')} id="plan">Перейти к плану действий →</button>}
 </>;
}

export function ActionPlan({model}:{model:WorkspaceModelV1}){
 const r=model.full!.report,scheduled=new Set(r.actionPlan.horizons.flatMap(h=>h.items.map(a=>a.canonicalId))),now=r.recommendations.primary.filter(a=>!scheduled.has(a.canonicalId)),shown=new Set<string>();
 return <>
  <Panel title="Сейчас">{now.length?now.map(a=><ActionItem key={a.id} item={a} model={model}/>):<p>Приоритетные действия включены в ближайший этап плана ниже.</p>}</Panel>
  {r.actionPlan.horizons.map(h=><Panel key={h.id} title={h.title+' · '+date(h.date)}><ol className="pc-timeline">{h.items.filter(a=>{const key=a.title.trim()+'|'+a.summary.trim();if(shown.has(key))return false;shown.add(key);return true;}).map(a=><li key={a.id} id={a.id}><b>{publicText(a.title)}</b><p>{publicText(a.steps[0]??a.summary)}</p><small>{publicText(a.recheck)}</small><Why model={model} ids={[a.claimId]}/></li>)}</ol>{!h.items.length&&<p>Отдельные действия на этот срок не назначены.</p>}</Panel>)}

  <p className="pc-muted">{r.actionPlan.disclaimer}</p>
 </>;
}
