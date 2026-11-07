"use client";
import {useRef,type ReactNode} from 'react';
import {linkedWhyClaims,whyBindings,whySources,whySourceDates,whyBindingText} from '../../../lib/workspace/why-evidence';
import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import type {PresentationFactorV1,PresentationActionV1} from '../../../lib/credit-engine/contracts/client-report';
import {money,date,FullAccessNotice} from './presentation';
import {publicText as clientText} from '../../../lib/credit-engine/client-report/copy';
import {sourceLabel,sourceState,label} from './credit-depth';
import {CashMovement, cashMoney} from './cash-movement';
import {receiptLabel} from '../../../lib/credit-engine/explainability/receipts';
import {concentrationPercent,factValue} from './data-panel';
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
function bankDashboardSignals(model:WorkspaceModelV1){
 const b=model.basic.bankingFacts;
 const net=factValue(b.netCashFlow),low=factValue(b.lowLiquidityDays),top1=concentrationPercent(b.directCustomerTop1),individuals=factValue(b.transfersToIndividuals),principal=factValue(b.loanPrincipalPayments);
 const strengths:Array<{title:string;text:string}>=[];
 const attention:Array<{title:string;text:string}>=[];
 if(net!==null) (net>=0?strengths:attention).push({title:net>=0?'Положительный чистый денежный поток':'Списания превышают поступления',text:net>=0?`Внешние поступления превышают списания на ${money(net)} за анализируемый период.`:`Внешние списания превышают поступления на ${money(Math.abs(net))} за анализируемый период.`});
 if(top1!==null&&top1>=50) attention.push({title:'Высокая концентрация поступлений',text:`На крупнейшего прямого покупателя приходится ${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(top1)}% идентифицированных операционных поступлений.`});
 if(low!==null&&low>0) attention.push({title:'Периоды низкой ликвидности',text:`Зафиксировано ${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(low)} дней с низким денежным запасом.`});
 if(individuals!==null&&individuals>0) attention.push({title:'Существенные переводы физическим лицам',text:`По выпискам классифицировано ${money(individuals)} переводов физическим лицам. Их назначение стоит проверить перед финансированием.`});
 if(principal!==null&&principal>0) strengths.push({title:'Наблюдается обслуживание долга',text:`По выпискам подтверждены платежи основного долга на ${money(principal)} за период.`});
 if(!strengths.length) strengths.push({title:'Банковский профиль сформирован',text:'Prescore обработал движение денег, обязательные платежи, ликвидность и структуру поступлений по представленным счетам.'});
 if(!attention.length) attention.push({title:'Критичных банковских сигналов в сводке не выделено',text:'Детальная проверка факторов и источников доступна в разделе «Анализ Prescore».'});
 return {strengths:strengths.slice(0,3),attention:attention.slice(0,3)};
}
function dashboardValue(f:WorkspaceModelV1['basic']['bankingFacts']['grossInflow']){const v=factValue(f);return v===null?'—':money(v);}
export function ExecutiveOverview({model,choose,retry,children}:{children?:ReactNode;model:WorkspaceModelV1;choose:(v:string)=>void;retry:()=>void}){
 const r=model.full?.report,b=model.basic.bankingFacts,bank=bankDashboardSignals(model);
 const index=model.full?.canonical.prescoreIndex.value??null;
 const readiness=model.full?.canonical.financingReadiness.level;
 const capacity=model.full?.canonical.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential??null;
 const factors=r?[...r.primaryFactors,...r.contextHighlights,...r.readiness.constraints]:[];
 const strengths=factors.filter(f=>f.status.tone==='positive').slice(0,3);
 const risks=factors.filter(f=>['critical','attention'].includes(f.status.tone)).slice(0,3);
 const actions=r?.recommendations.primary.slice(0,3)??[];
 const products=r?[...r.productFit.primary,...r.productFit.other].slice(0,3):[];
 const period=`${date(model.basic.analysis.period.from)} — ${date(model.basic.analysis.period.to)}`;
 const bankName=model.basic.sources.statements.bankNames?.join(' · ')||'Банковские выписки';
 return <div className="pc-dashboard" data-prescore-dashboard="v1">
  <header className="pc-dashboard-heading">
   <div><span>КРЕДИТНЫЙ ПРОФИЛЬ</span><h1>Финансово-кредитный профиль</h1><p>{model.basic.analysis.company.name} · ИНН {model.basic.analysis.company.inn} · {period}</p></div>
   <button className="pc-secondary" onClick={()=>choose('analysis')}>Открыть полный анализ →</button>
  </header>
  <section className="pc-dashboard-summary" aria-label="Кредитная сводка">
   <article className="pc-score-card"><small>Prescore Index</small>{index!==null?<strong data-credit-index>{index}<em>/ 1000</em></strong>:<strong className="is-text">Банковский профиль</strong>}<p>{index!==null?(r?.index.status||'Расчёт сформирован'):'Анализ по выпискам сформирован'}</p></article>
   <article className="pc-summary-card"><small>Готовность к финансированию</small><strong data-credit-readiness={readiness&&readiness!=='UNKNOWN'?true:undefined}>{readiness&&readiness!=='UNKNOWN'?(r?.readiness.level||readiness):'Следующий уровень оценки'}</strong><p>{readiness&&readiness!=='UNKNOWN'?(r?.readiness.text||'Открыть анализ для деталей'):'БФО и БКИ уточнят кредитную готовность, не отменяя банковский анализ.'}</p></article>
   <article className="pc-capacity-card"><small>Дополнительное обслуживание долга</small>{capacity!==null?<strong data-prudential-capacity>{money(capacity)}<em>/ месяц</em></strong>:<strong className="is-text">Расчёт после долгового контура</strong>}<p>{capacity!==null?(r?.capacity.text||'Осторожная оценка способности обслуживать новый платёж'):'Добавление БКИ и отчётности позволит рассчитать запас нового ежемесячного платежа.'}</p></article>
  </section>
  <section className="pc-bank-kpis" aria-label="Банковская картина">
   <article><small>Внешние поступления</small><strong>{dashboardValue(b.grossInflow)}</strong></article>
   <article><small>Внешние списания</small><strong>{dashboardValue(b.grossOutflow)}</strong></article>
   <article><small>Чистый денежный поток</small><strong>{dashboardValue(b.netCashFlow)}</strong></article>
   <article><small>Средний остаток</small><strong>{dashboardValue(b.averageDailyBalance)}</strong></article>
  </section>
  <div className="pc-dashboard-grid pc-dashboard-grid-main">
   <section className="pc-dashboard-section"><header><div><span>БАНКОВСКОЕ ЗАКЛЮЧЕНИЕ</span><h2>Что показывает движение денег</h2></div><button className="pc-text-button" onClick={()=>choose('banking')}>Все финансы →</button></header>
    <div className="pc-bank-conclusion"><p><b>{bankName}</b> · {period}</p><p>{bank.strengths[0].text}</p>{bank.attention[0]&&<p>{bank.attention[0].text}</p>}</div>
    <CashTrend model={model} compact/>
   </section>
   <section className="pc-dashboard-section"><header><div><span>КРЕДИТНЫЕ ФАКТОРЫ</span><h2>Что важно сейчас</h2></div></header>
    <div className="pc-dashboard-factors">
     {(strengths.length?strengths.map(f=>({title:clientText(f.title),text:clientText(f.text),tone:'positive',ids:[f.claimId]})):bank.strengths.map(f=>({...f,tone:'positive',ids:[]}))).map((f,i)=><article key={'s'+i} data-tone={f.tone}><small>Сильная сторона</small><h3>{f.title}</h3><p>{f.text}</p>{f.ids.length>0&&<Why model={model} ids={f.ids}/>}</article>)}
     {(risks.length?risks.map(f=>({title:clientText(f.title),text:clientText(f.text),tone:'attention',ids:[f.claimId]})):bank.attention.map(f=>({...f,tone:'attention',ids:[]}))).map((f,i)=><article key={'r'+i} data-tone={f.tone}><small>Требует внимания</small><h3>{f.title}</h3><p>{f.text}</p>{f.ids.length>0&&<Why model={model} ids={f.ids}/>}</article>)}
    </div>
   </section>
  </div>
  {r&&<div className="pc-dashboard-grid">
   <section className="pc-dashboard-section"><header><div><span>ФИНАНСИРОВАНИЕ</span><h2>Подходящие механизмы</h2></div><button className="pc-text-button" onClick={()=>choose('financing')}>Все варианты →</button></header>
    <div className="pc-dashboard-products">{products.map((p,i)=><article key={p.id}><small>{String(i+1).padStart(2,'0')}</small><h3>{p.title}</h3><p>{p.purpose}</p><Why model={model} ids={[p.claimId]}/></article>)}</div>
   </section>
   <section className="pc-dashboard-section"><header><div><span>РЕКОМЕНДАЦИИ</span><h2>Что делать сейчас</h2></div><button className="pc-text-button" onClick={()=>choose('analysis')}>План 7 / 30 / 60 →</button></header>
    <div className="pc-dashboard-actions">{actions.map((a,i)=><article key={a.id}><small>{String(i+1).padStart(2,'0')}</small><div><h3>{a.title}</h3><p>{a.summary}</p></div><Why model={model} ids={[a.claimId]}/></article>)}</div>
   </section>
  </div>}
  {r?.externalSummary?.length?<section className="pc-dashboard-section pc-dashboard-external"><header><div><span>ВНЕШНИЙ КОНТЕКСТ</span><h2>Юридические и внешние сведения</h2></div></header><dl>{r.externalSummary.map(f=><div key={f.code}><dt>{f.label}</dt><dd>{f.value}<small>{f.source} · {date(f.asOf)}</small></dd></div>)}</dl></section>:null}
  <section className="pc-dashboard-sources"><span>Выписки <b>✓</b></span><button onClick={()=>choose('documents')}>БФО +</button><button onClick={()=>choose('obligations')}>БКИ +</button><button onClick={()=>choose('analysis')}>Основания и заключение →</button></section>
  {children&&r?.hero.route!=='INSUFFICIENT_DATA'?<div className="pc-dashboard-route">{children}</div>:null}
  {!r&&<FullAccessNotice model={model} retry={retry}/>}
 </div>;
}
