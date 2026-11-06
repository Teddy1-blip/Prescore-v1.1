"use client";
import Link from "next/link";
import {BankingLedger} from "./banking-ledger";
import {PortfolioDepth, sourceLabel, sourceState} from "./credit-depth";
import { DataPanel, concentrationPercent, factValue } from "./data-panel";
import { useState, type ReactNode } from "react";
import { LayoutDashboard, FileSearch, Gauge, WalletCards, Building2, Landmark, Sparkles, BriefcaseBusiness, Files, Menu, X, ShieldCheck, UserRound, Plus, CircleHelp } from "lucide-react";
import type { WorkspaceModelV1, WorkspaceFactV1 } from "../../../lib/workspace/model";
export const money = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "Недостаточно данных" : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value) + " ₽";
export const date = (value: string | null | undefined) => value ? value.slice(0,10).split("-").reverse().join(".") : "Период не указан";
export const reportUrl = (id: string) => `/dashboard/report-v2?analysisId=${encodeURIComponent(id)}`;
const factMoney = (f: WorkspaceFactV1) => f.status === "NOT_APPLICABLE" ? "Не применимо" : f.status === "UNKNOWN" ? "Недостаточно данных" : money(f.value);
const sourceNames: Record<string,string> = { BANK_STATEMENTS:"Банковские выписки", FINANCIAL_STATEMENTS:"Бухгалтерская отчётность", QUARTERLY_REPORT:"Квартальная отчётность", CREDIT_HISTORY:"Кредитная история", EXTERNAL_SOURCE:"Открытые сведения", BANK_STATEMENT:"Банковские выписки", BFO:"Бухгалтерская отчётность", QUARTERLY:"Квартальная отчётность", BKI:"Кредитная история" };
export function Heading({eyebrow,title,children}:{eyebrow:string;title:string;children?:ReactNode}){return <header className="ws-heading"><span className="ws-eyebrow">{eyebrow}</span><h1>{title}</h1>{children}</header>;}
export function EmptyHome({start}:{start?:()=>void}) {
 return <section className="ws-empty pc-onboarding"><div><span className="ws-eyebrow">PRESCORE · КРЕДИТНЫЙ ПРОФИЛЬ БИЗНЕСА</span><h1>От движения денег — к понятному решению</h1><p>Prescore помогает разобраться в финансовом состоянии компании, подготовиться к финансированию и определить следующие шаги.</p>{start?<button className="ws-primary" onClick={start}>Создать новый анализ <span aria-hidden="true">↗</span></button>:<p>Выберите доступный анализ или запросите его у владельца компании.</p>}<p>Загрузить банковскую выписку — первый шаг. Новый анализ начинается с выписки. Каждый следующий источник дополняет тот же сохранённый результат.</p><small>Банковские выписки: TXT 1CClientBankExchange (UTF-8 / Windows-1251) · до 30 файлов одного ИНН, до 15 МБ каждый.</small><p>Данные доступны владельцу и уполномоченным участникам. Загрузка не отправляет заявку в банк. <a href="/privacy">Конфиденциальность и обработка данных</a>. Перед добавлением документов вы подтверждаете право на их использование.</p></div><div className="pc-onboarding-sources"><article><span>01 · Банковская выписка</span><h2>Деньги и платёжная дисциплина</h2><p>Поступления, расходы, остатки, налоги, долговые платежи и концентрация покупателей — уже после первой поддерживаемой выписки.</p></article><article><span>02 · Бухгалтерская отчётность</span><h2>Финансовая устойчивость</h2><p>Выручка, прибыль, активы, капитал, коэффициенты и сверка с денежным потоком. Текстовый PDF, XLSX или CSV, один период в файле.</p></article><article><span>03 · Кредитная история</span><h2>Обязательства и долговая нагрузка</h2><p>Кредиторы, остатки, лимиты, платежи, сроки и просрочка, если они раскрыты в отчёте. Поддерживаемый текстовый PDF; сканы без текстового слоя не распознаются.</p></article><p>Квартальная отчётность уточнит финансовое состояние после последнего годового отчёта. Объём выводов зависит от содержания и периода источников.</p></div></section>;
}
export function Upgrade({id}:{id:string}){return <section className="ws-upgrade"><span className="ws-eyebrow">СЛЕДУЮЩИЙ УРОВЕНЬ АНАЛИЗА</span><h2>От банковских фактов<br/>к кредитной интерпретации</h2><p>Отчётность и кредитная история дополняют картину. Полный анализ объясняет ограничения, доступное обслуживание долга и подходящие продукты.</p><a className="ws-primary" href={`/checkout?analysisId=${encodeURIComponent(id)}`}>Открыть полный анализ ↗</a></section>;}
export function FullAccessNotice({model,retry}:{model:WorkspaceModelV1;retry?:()=>void}) {
 if(model.fullAvailability==='UNAVAILABLE'||model.entitlement==='FULL')return <section className="ws-unavailable" role="status"><h2>Полный расчёт сейчас недоступен</h2><p>{model.entitlement==='FULL'?'Доступ к полному анализу уже открыт. Повторная оплата не требуется.':'Не удалось проверить доступность полного расчёта.'} Доступные банковские факты сохранены.</p><button onClick={()=>retry?retry():window.location.reload()}>Повторить загрузку расчёта</button><a href={'/dashboard?analysisId='+encodeURIComponent(model.analysisId)+'&view=company'}>Проверить источники компании ↗</a></section>;
 return <Upgrade id={model.analysisId}/>;
}
export function Flow({model}:{model:WorkspaceModelV1}) {
 const rows=model.basic.bankingFacts.monthly??[],preview=rows.slice(-3);
 const max=Math.max(1,...rows.flatMap(r=>[r.externalInflows,r.externalOutflows]).filter((v):v is number=>v!==null));
 const renderRows=(items:typeof rows)=><div className="ws-flow-rows">{items.map(r=><div key={r.month} className="ws-flow-row"><strong>{r.month.split('-').reverse().join('.')}</strong><div><div className="ws-flow-bar" style={{width:r.externalInflows===null?'0%':Math.max(0,r.externalInflows)/max*100+'%'}}/><div className="ws-flow-bar ws-out" style={{width:r.externalOutflows===null?'0%':Math.max(0,r.externalOutflows)/max*100+'%'}}/></div><span>{money(r.externalInflows)}<small>Платежи: {money(r.externalOutflows)}</small>{r.coverage!=="FULL"&&<small>Неполный месяц</small>}</span></div>)}</div>;
 return <section className="ws-flow"><div className="ws-section-title"><div><span className="ws-eyebrow">ДВИЖЕНИЕ ДЕНЕГ</span><h2>Поступления и платежи</h2><p>Период выписок: {date(model.basic.analysis.period.from)} — {date(model.basic.analysis.period.to)}.</p></div><span className="ws-legend">Поступления — сплошная линия<br/>Платежи — пунктир</span></div>{rows.length?<><div className="ws-flow-preview"><p>{rows.length>3?'Последние три месяца периода':'Все месяцы периода'}: {preview[0].month} — {preview.at(-1)?.month}.</p>{renderRows(preview)}</div>{rows.length>3&&<details className="ws-flow-details" open><summary>Все месяцы ({rows.length})</summary><p>Полная помесячная раскладка. Общие показатели выше относятся ко всему периоду.</p>{renderRows(rows)}</details>}</>:<p>Для помесячного графика недостаточно данных.</p>}</section>;
}
export function missingSourceLabels(codes:string[]|null){const known=[...new Set((codes??[]).map(c=>sourceNames[c]).filter(Boolean))];return {known,unknown:(codes??[]).some(c=>!sourceNames[c])};}
export function Sources({model}:{model:WorkspaceModelV1}) {
 const s=model.basic.sources,missing=missingSourceLabels(s.missingSources);
 const processed=new Set(s.availability.filter(a=>a.status==='READY').map(a=>sourceNames[a.source]));
 const inconsistent=missing.known.filter(name=>processed.has(name));
 return <section className="ws-sources"><div><span className="ws-eyebrow">ОСНОВА АНАЛИЗА</span><h2>Источники и покрытие</h2><p>Банковские выписки: {sourceState(s.statements.status)}</p><p>{s.statements.bankNames?.join(' · ')||'Банки не определены'}</p><p>{date(s.statements.periodFrom)} — {date(s.statements.periodTo)}</p><div className="ws-inline-facts"><span><b>{s.statements.count??'—'}</b> выписок</span><span><b>{s.statements.accountCount??'—'}</b> счетов</span></div></div><div>{!!missing.known.length&&<p className="ws-missing">В сохранённом списке недостающих сведений: {missing.known.join(', ')}.</p>}{missing.unknown&&<p>Есть дополнительные требования к данным. Их описание доступно в подробном анализе.</p>}{!!inconsistent.length&&<p className="ws-source-conflict">Статусы требуют сверки: {inconsistent.join(', ')} одновременно отмечены как обработанные и недостающие. Полнота оценки не подтверждена.</p>}<details className="ws-source-details" open><summary>Состояние источников и банковских данных</summary><div className="ws-source-list">{s.availability.map((item,i)=><div key={i}><span>{sourceLabel(item.source)}</span><b>{sourceState(item.status)}</b><small>{date(item.periodFrom)} — {date(item.periodTo)}</small></div>)}{!s.availability.length&&<p>Сведения об источниках недоступны.</p>}</div><p>Обработка источника сама по себе не подтверждает его использование во всех выводах. Основания выводов приведены в подробном анализе.</p><p>Заполненность банковских данных: {s.completeness===null?'не определена':s.completeness+'%'}. Показатель учитывает заполненные поля операций и покрытие периода выписками. Это не полнота кредитной оценки.</p></details>{model.full&&<a href={reportUrl(model.analysisId)+'#data'}>Подробнее об основаниях и ограничениях ↗</a>}</div></section>;
}
export function BankingAnalysis({model,includeSources=true}:{model:WorkspaceModelV1;includeSources?:boolean}) {
 const b=model.basic.bankingFacts;
 return <>
 <section id="banking" className="ws-facts ws-banking-kpis"><div><span className="ws-eyebrow">ФИНАНСОВАЯ КАРТИНА ПО ВЫПИСКАМ</span><h1>Банковский анализ</h1><p>Движение денег за выбранный период. Операционные поступления не являются бухгалтерской выручкой.</p></div><dl>{[
  ["Операционные поступления",b.operatingInflow],
  ["Средние операционные поступления / месяц",b.observedMonthlyOperatingAverage],
  ["Внешние поступления",b.grossInflow],
  ["Внешние списания",b.grossOutflow],
  ["Чистый внешний денежный поток",b.netCashFlow],
  ["Остаток на конец периода",b.endingBalance],
  ["Среднедневной остаток",b.averageDailyBalance],
  ["Минимальный остаток",b.minimumDailyBalance],
 ].map(([label,fact])=><div key={String(label)}><dt>{String(label)}</dt><dd>{factMoney(fact as WorkspaceFactV1)}</dd></div>)}<div><dt>Дни низкой ликвидности</dt><dd>{factValue(b.lowLiquidityDays)??"Не определено"}</dd></div></dl><p className="ws-kpi-note">Среднее за наблюдаемый период. Среднее по полным месяцам: {factMoney(b.fullMonthOperatingAverage)}.</p></section>
 <DataPanel model={model}><Flow model={model}/></DataPanel>
 <BankingDetails model={model}/>
 <BankingLedger model={model}/>
 {includeSources&&<Sources model={model}/>}
 </>;
}
export function BankingDetails({model}:{model:WorkspaceModelV1}) {
 const b=model.basic.bankingFacts;
 const percent=(f:WorkspaceFactV1)=>{const v=concentrationPercent(f);return v===null?'Недостаточно данных':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(v)+'%';};
 return <section className="ws-banking-details" aria-label="Детали банковского анализа">
  <h2>Платежи и контрагенты</h2><p>Наблюдаемые операции по выпискам. Неизвестные суммы не означают отсутствие платежей.</p>
  <dl className="ws-payment-facts">{[["Основной долг",b.loanPrincipalPayments],["Проценты",b.interestPayments],["Неразделённые долговые платежи",b.unsplitDebtPayments],["Лизинг",b.leasingPayments],["Налоги",b.taxPayments],["Социальные взносы",b.socialContributions],["Переводы физическим лицам",b.transfersToIndividuals]].map(([label,f])=><div key={String(label)}><dt>{String(label)}</dt><dd>{factMoney(f as WorkspaceFactV1)}</dd></div>)}</dl>
  <div className="ws-counterparty-grid"><div><h3>Крупнейшие контрагенты</h3>{b.topCounterparties?.length?<dl className="ws-detail-list">{b.topCounterparties.map((c,i)=><div key={i}><dt>{c.name||'Название не указано'}</dt><dd>{money(c.amount)}<small>Доля: {new Intl.NumberFormat("ru-RU",{maximumFractionDigits:1}).format(c.share*100)}%</small></dd></div>)}</dl>:<p>Недостаточно данных о контрагентах.</p>}</div><div><h3>Концентрация прямых покупателей</h3><dl className="ws-detail-list"><div><dt>Крупнейший покупатель</dt><dd>{percent(b.directCustomerTop1)}</dd></div><div><dt>Три крупнейших покупателя</dt><dd>{percent(b.directCustomerTop3)}</dd></div></dl><p>Доли в прямых операционных поступлениях. Показатели пересекаются и не складываются.</p></div></div>
 </section>;
}
export function Home({model,retry}:{model:WorkspaceModelV1;retry?:()=>void}) {
 const full=model.state==='READY_FULL'?model.full:undefined, report=full?.report;
 const constraint=report?.readiness.constraints[0]??report?.primaryFactors[0];
 const next=report?.recommendations.primary[0]??report?.actionPlan.horizons.flatMap(h=>h.items)[0];
 const capacity=full?.canonical.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential;
 return <>
 <BankingAnalysis model={model} includeSources={false}/>
 {report&&<section className="ws-credit-overview"><div><span className="ws-eyebrow">КРЕДИТНАЯ ОЦЕНКА</span><h2>{report.hero.headline}</h2><p>{report.hero.summary}</p><a className="ws-primary" href={reportUrl(model.analysisId)}>Разобраться в кредитном анализе ↗</a></div><div className="ws-index"><span className="ws-eyebrow">PRESCORE INDEX</span><strong className={full?.canonical.prescoreIndex.value==null?'ws-value-unknown':undefined}>{full?.canonical.prescoreIndex.value??'Не определён'}</strong>{full?.canonical.prescoreIndex.value!=null&&<small>из 1000</small>}<div className="ws-assessment-status"><strong>{report.index.status}</strong><p>Статус относится к расчёту индекса. Число не является вероятностью одобрения или обещанием кредита.</p>{full?.canonical.prescoreIndex.status!=='CALCULATED'&&<p>Оценка ограничена доступными данными.</p>}</div><div className="ws-rule"/><span>Готовность к финансированию</span><h2>{report.readiness.level}</h2><p>{report.readiness.text}</p></div></section>}
 {full&&<section className="ws-capacity"><div><span className="ws-eyebrow">ОБСЛУЖИВАНИЕ ДОЛГА</span><h2>Расчётный запас<br/>для нового платежа</h2><p>{report?.capacity.text}</p></div><div><strong>{money(capacity)}</strong><span>в месяц · осторожная оценка</span><p className="ws-capacity-status">{report?.capacity.status}</p><p>Расчётная способность обслуживать долг. Не одобренный лимит и не обещание выдачи.</p></div></section>}
 {report&&<section className="ws-next"><div><span className="ws-eyebrow">ГЛАВНОЕ ОГРАНИЧЕНИЕ</span><h2>{constraint?.title??'Отдельное ограничение не выделено'}</h2><p>{constraint?.text??'Проверьте полноту источников и основания в подробном анализе.'}</p></div><div><span className="ws-eyebrow">СЛЕДУЮЩИЙ ШАГ</span><h2>{next?.title??'Уточнить исходные данные'}</h2><p>{next?.summary??'Добавьте актуальные документы компании.'}</p><a href={reportUrl(model.analysisId)+'#plan'}>Открыть план действий ↗</a></div></section>}
 {!full&&<FullAccessNotice model={model} retry={retry}/>}
 <Sources model={model}/>
 <section className="ws-operational-strip"><span>Документов: {model.basic.operations.documents.count??'не определено'}</span><span>Заявок: {model.basic.operations.applications.count??'не определено'}</span></section></>;
}
export function Financing({model}:{model:WorkspaceModelV1}){const r=model.full?.report;return <><Heading eyebrow="ФИНАНСИРОВАНИЕ" title="Выберите подходящий маршрут"><p>Соответствие продукта ситуации компании. Окончательные условия определяет кредитор.</p></Heading>{r?<>{[...r.productFit.primary,...r.productFit.other].map(p=><details className="ws-product" key={p.id}><summary><span><small>{p.fit}</small><strong>{p.title}</strong></span><span aria-hidden="true">+</span></summary><p>{p.purpose}</p><p>{p.capacity}</p>{p.missing.length>0&&<><h3>Что подтвердить</h3><ul>{p.missing.map((x,i)=><li key={i}>{x}</li>)}</ul></>}<a href={reportUrl(model.analysisId)+'#products'}>Основания и следующий шаг ↗</a></details>)}{!r.productFit.primary.length&&!r.productFit.other.length&&<p>Продукты пока не определены. Дополните источники анализа.</p>}<p>{r.productFit.bankSeparation}</p></>:<FullAccessNotice model={model}/>}</>;}
export function Obligations({model}:{model:WorkspaceModelV1}){const b=model.basic.bankingFacts;return <><Heading eyebrow="ОБЯЗАТЕЛЬСТВА" title="Долг и наблюдаемые платежи"><p>Данные портфеля и платежи по выписке — разные основания. Отсутствие отчёта не означает отсутствие долга.</p></Heading><section className="ws-facts"><h2>Платежи по банковским операциям</h2><dl>{[["Основной долг",b.loanPrincipalPayments],["Проценты",b.interestPayments],["Лизинг",b.leasingPayments],["Неразделённые долговые платежи",b.unsplitDebtPayments]].map(([l,f])=><div key={String(l)}><dt>{String(l)}</dt><dd>{factMoney(f as WorkspaceFactV1)}</dd></div>)}</dl></section><Sources model={model}/><PortfolioDepth model={model}/></>;}
export function Shell({broker=false,view,choose,children,secondary,context,companyName,availableViews}:{broker?:boolean;view:string;choose:(v:string)=>void;children:ReactNode;secondary?:ReactNode;context?:ReactNode;companyName?:string;availableViews?:string[]}){
 if(broker){const nav=[['home','Главная'],['clients','Клиенты'],['applications','Заявки'],['documents','Документы']];return <div className="ws"><a className="ws-skip" href="#ws-main">К содержимому</a><header className="ws-header"><Link className="ws-brand" href="/">Прескор<span>.</span></Link><span>РАБОТА С КЛИЕНТАМИ</span><a href="/logout">Выйти ↗</a></header><div className="ws-layout"><aside className="ws-rail"><span className="ws-eyebrow">БРОКЕР</span><nav aria-label="Основные разделы">{nav.map(([id,label],i)=><button key={id} aria-current={view===id?'page':undefined} onClick={()=>choose(id)}><small aria-hidden="true">0{i+1}</small>{label}<span aria-hidden="true">↗</span></button>)}</nav><div className="ws-secondary">{secondary}<a href="/dashboard">Кабинет компании ↗</a></div><p className="ws-rail-note">От фактов<br/>к решениям.</p></aside><main id="ws-main" className="ws-main" tabIndex={-1}>{context}{children}</main></div><footer className="ws-footer">Прескор · Финансовая ясность для бизнеса <span>Окончательное решение принимает кредитор.</span></footer></div>;}
 return <ClientRecoveryShell view={view} choose={choose} context={context} companyName={companyName} availableViews={availableViews}>{children}</ClientRecoveryShell>;
}

function ClientRecoveryShell({view,choose,children,context,companyName,availableViews}:{view:string;choose:(v:string)=>void;children:ReactNode;context?:ReactNode;companyName?:string;availableViews?:string[]}){
 const [menu,setMenu]=useState(false);
 const items=[
  {id:'home',label:'Кредитное заключение',icon:<LayoutDashboard/>},
  {id:'upload',label:'Новый анализ',icon:<FileSearch/>},
  {id:'banking',label:'Банковский анализ',icon:<FileSearch/>},
  {id:'obligations',label:'БКИ и портфель',icon:<WalletCards/>},
  {id:'company',label:'Финансовый анализ / отчётность',icon:<Building2/>},
  {id:'reconciliation',label:'Сверка источников',icon:<ShieldCheck/>},
  {id:'recommendations',label:'Рекомендации и план',icon:<Gauge/>},
  {id:'sources',label:'Источники и качество',icon:<Files/>},
  {id:'financing',label:'Финансирование',icon:<Landmark/>},
  {id:'analyst',label:'Кредитный аналитик',icon:<Sparkles/>},
  {id:'applications',label:'Заявки в банки',icon:<BriefcaseBusiness/>},
  {id:'documents',label:'Документы',icon:<Files/>},
 ];
 const groups=[
  {title:'АНАЛИЗ',ids:['home','upload','banking','analysis','company','obligations','reconciliation']},
  {title:'ФИНАНСИРОВАНИЕ',ids:['financing','recommendations','applications']},
  {title:'ДАННЫЕ',ids:['sources','documents']},
  {title:'ПОМОЩЬ',ids:['analyst']},
 ];
 const visibleItems=items.filter(item=>!availableViews||availableViews.includes(item.id));
 const go=(id:string)=>{choose(id);setMenu(false);};
 return <main className="ps-shell ps-client-recovery">
  <a className="ws-skip" href="#ws-main">К содержимому</a>
  <aside id="client-navigation" onKeyDown={e=>{if(e.key==='Escape'){setMenu(false);document.getElementById('client-menu-toggle')?.focus();}}} className={menu?'ps-sidebar open':'ps-sidebar'}>
   <div className="ps-sidebar-head"><Link href="/" className="brand brand-light"><strong>Прескор</strong></Link><button onClick={()=>setMenu(false)} aria-label="Закрыть меню"><X/></button></div>
   <div className="ps-workspace-label">РАБОЧИЙ КАБИНЕТ</div>
   <nav aria-label="Разделы кабинета">{groups.filter(group=>visibleItems.some(item=>group.ids.includes(item.id))).map(group=><div key={group.title}><small>{group.title}</small>{visibleItems.filter(item=>group.ids.includes(item.id)).sort((a,b)=>group.ids.indexOf(a.id)-group.ids.indexOf(b.id)).map(item=><button key={item.id} aria-current={view===item.id?'page':undefined} className={view===item.id?'active':''} onClick={()=>go(item.id)}>{item.icon}<span>{item.label}</span></button>)}</div>)}</nav>
   <div className="ps-source-card"><ShieldCheck/><span><small>ФИНАНСОВАЯ КАРТИНА</small><b>От фактов к решениям</b><p>Движение денег, кредитная оценка и следующие шаги для вашей компании.</p></span></div>
   <div className="ps-sidebar-user"><i><UserRound/></i><span><b>Клиентский кабинет</b><small>Prescore · рабочее пространство</small></span></div>
   <Link className="pv-logout" href="/logout">Выйти из кабинета</Link>
  </aside>
  <section className="ps-main">
   <header className="ps-topbar">
    <button id="client-menu-toggle" className="ps-menu-button" onClick={()=>setMenu(!menu)} aria-expanded={menu} aria-controls="client-navigation" aria-label="Открыть меню"><Menu/></button>
    <div className="ps-company"><i>RU</i><span><b>{companyName?.trim()||'Компания не указана'}</b><small>Банковский и кредитный анализ</small></span></div>
    <div className="ps-top-actions"><Link className="ps-cabinet-switch" href="/login">Сменить кабинет</Link>{visibleItems.some(item=>item.id==='analyst')&&<button title="Кредитный аналитик" aria-label="Открыть кредитный аналитик" onClick={()=>go('analyst')}><CircleHelp/></button>}{visibleItems.some(item=>item.id==='upload')&&<button className="ps-new-button" onClick={()=>go('upload')}><Plus/> Новый анализ</button>}</div>
   </header>
   <div id="ws-main" className="ps-content ws" tabIndex={-1}>{context}{children}</div>
  </section>
 </main>;
}
