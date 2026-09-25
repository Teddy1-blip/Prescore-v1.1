import Link from "next/link";
import type { WorkspaceModelV1 } from "../../../lib/workspace/model.ts";
import type { ClientReportModelV1 } from "../../../lib/credit-engine/contracts/client-report.ts";
import "./workspace.css";

function Brand(){
  return <span className="w4-brand"><svg viewBox="0 0 28 28" aria-hidden="true"><path d="M2 6C11 6 10 14 18 14H26M2 14H26M2 22C11 22 10 14 18 14"/></svg>прескор<span>.</span></span>;
}
const money=(value:number|null|undefined)=>value==null?"—":new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(value)+" ₽";
const pct=(value:number|null|undefined)=>value==null?"—":new Intl.NumberFormat("ru-RU",{style:"percent",maximumFractionDigits:0}).format(value);

function SignalBar({label,value,note}:{label:string;value:string;note?:string}){
  return <div className="w4-signal-stat"><small>{label}</small><strong>{value}</strong>{note&&<span>{note}</span>}</div>;
}

function SourceFlow({full,basic}:{full?:ClientReportModelV1;basic:WorkspaceModelV1["basic"]}){
  const sourceNames=full?.sources?.length?full.sources.slice(0,4).map(s=>s.label):basic.sources.banks.map(b=>"Выписка · "+b).slice(0,4);
  const sources=sourceNames.length?sourceNames:["Банковская выписка"];
  return <section className="w4-sources" id="sources">
    <div className="w4-section-copy"><span className="w4-label">ИСТОЧНИКИ</span><h2>От данных — к выводу.</h2><p>Показываем, из чего собрана текущая финансовая картина. Отсутствующий источник остаётся отсутствующим.</p></div>
    <div className={"w4-flow w4-flow-"+Math.min(4,sources.length)} aria-label="Источники анализа">
      {sources.map((name,i)=><div className="w4-flow-node" key={name+i}><span>{"0"+(i+1)}</span><b>{name}</b><small>{i===0?"учтено в денежном потоке":"учтено в текущем анализе"}</small></div>)}
      <div className="w4-flow-result"><span>→</span><b>Прескор</b><small>факты → ограничения → действие</small></div>
    </div>
  </section>;
}

function BasicHome({model,fullPreviewHref}:{model:WorkspaceModelV1;fullPreviewHref:string}){
  const b=model.basic;
  const width=String(Math.max(8,Math.min(100,(b.cashFlow.operatingInflow/Math.max(1,b.cashFlow.grossInflow))*100)))+"%";
  return <>
    <section className="w4-hero">
      <div className="w4-hero-copy"><span className="w4-label">ФИНАНСОВАЯ КАРТИНА</span><h1>Денежный поток компании — уже в одном контексте.</h1><p>Банковские выписки рассчитаны и сохранены. Ниже — факты, доступные без кредитной интерпретации.</p><a href="#sources" className="w4-primary">Посмотреть источники <span>↗</span></a></div>
      <div className="w4-primary-number"><small>ОПЕРАЦИОННЫЕ ПОСТУПЛЕНИЯ</small><strong>{money(b.cashFlow.operatingInflow)}</strong><span>за загруженный период</span><div className="w4-meter"><i style={{width}}/></div></div>
    </section>
    <div className="w4-signal-grid">
      <SignalBar label="СРЕДНЕЕ / МЕС." value={money(b.cashFlow.averageMonthlyInflow)}/>
      <SignalBar label="ЧИСТЫЙ ДЕНЕЖНЫЙ ПОТОК" value={money(b.cashFlow.netCashFlow)}/>
      <SignalBar label="БАНКИ / СЧЕТА" value={String(b.sources.banks.length)+" / "+String(b.sources.accounts)}/>
    </div>
    <section className="w4-dark">
      <div><span className="w4-label">СЛЕДУЮЩИЙ УРОВЕНЬ АНАЛИЗА</span><h2>Понять не только обороты, но и способность обслуживать финансирование.</h2><p>Индекс, готовность, долговая ёмкость и рекомендации строятся отдельно от базовой картины и не подменяются старыми оценками.</p></div>
      <div className="w4-dark-action"><span>01</span><b>Добавить недостающие источники</b><small>БФО · обязательства · правовой контур</small><Link href={fullPreviewHref}>Посмотреть полный вид ↗</Link></div>
    </section>
    <section className="w4-editorial-pair">
      <article><span className="w4-label">ЧТО ВИДНО СЕЙЧАС</span><h3>{money(b.cashFlow.totalInflow)} поступлений</h3><p>Из них {money(b.cashFlow.operatingInflow)} классифицировано как операционный денежный поток.</p></article>
      <article><span className="w4-label">НА ЧТО ОБРАТИТЬ ВНИМАНИЕ</span><h3>Концентрация TOP-1 · {pct(b.concentration.topOne)}</h3><p>Это факт структуры поступлений, а не вывод о решении банка.</p></article>
    </section>
    <SourceFlow basic={b}/>
  </>;
}

function FullHome({model,caseId}:{model:WorkspaceModelV1;caseId:string}){
  const fullPreviewHref="/dashboard/workspace-v4?case="+encodeURIComponent(caseId)+"&mode=full";
  if(model.full.status!=="READY") return <BasicHome model={model} fullPreviewHref={fullPreviewHref}/>;
  const r=model.full.model;
  const b=model.basic;
  const constraint=r.readiness.constraints[0]??r.limitations[0];
  const next=r.recommendations.primary[0]??r.actionPlan.horizons.flatMap(h=>h.items)[0];
  const indexNumber=typeof r.index.value?.value==="number"?r.index.value.value:null;
  const indexWidth=indexNumber==null?"0%":String(Math.max(0,Math.min(100,indexNumber/10)))+"%";
  const reportHref="/dashboard/report-v2?lab="+encodeURIComponent(caseId);
  return <>
    <section className="w4-hero">
      <div className="w4-hero-copy"><span className="w4-label">ФИНАНСОВЫЙ ПРОФИЛЬ</span><h1>{r.hero.headline}</h1><p>{r.hero.summary}</p><Link href={reportHref} className="w4-primary">Открыть полный анализ <span>↗</span></Link></div>
      <div className="w4-index"><small>PRESCORE INDEX</small><strong>{r.index.value?.display??"—"}<span>{r.index.value?"/ 1000":""}</span></strong><div className="w4-meter"><i style={{width:indexWidth}}/></div><p>{r.readiness.level}</p><span>{r.hero.confidence}</span></div>
    </section>
    <div className="w4-signal-grid">
      <SignalBar label="ГОТОВНОСТЬ" value={r.readiness.level} note={r.readiness.confidence}/>
      <SignalBar label="ДОП. ПЛАТЁЖ / МЕС." value={r.capacity.headline?.display??"—"} note="расчётный запас"/>
      <SignalBar label="ДАННЫЕ" value={r.hero.confidence} note={String(b.sources.statements)+" выписок · "+String(b.sources.accounts)+" счетов"}/>
    </div>
    <section className="w4-dark w4-capacity">
      <div><span className="w4-label">DEBT CAPACITY</span><h2>{r.capacity.headline?.display??"Недостаточно данных"}</h2><p>{r.capacity.text}</p></div>
      <div className="w4-capacity-visual"><div className="w4-capacity-line"><i/><i/><i/></div><div className="w4-capacity-labels"><span>денежный поток</span><span>текущая нагрузка</span><span>дополнительный запас</span></div><small>{r.capacity.disclaimer}</small></div>
    </section>
    <section className="w4-editorial-pair">
      <article><span className="w4-label">01 / ГЛАВНОЕ ОГРАНИЧЕНИЕ</span><h3>{constraint?.title??"Отдельное ограничение не выделено"}</h3><p>{constraint?.text??"Текущая модель не выделяет отдельный ограничивающий фактор."}</p><Link href={reportHref+"#factors"}>Посмотреть основания ↗</Link></article>
      <article><span className="w4-label">02 / СЛЕДУЮЩИЙ ШАГ</span><h3>{next?.title??"Проверить доступные источники"}</h3><p>{next?.summary??"Следующее действие будет сформировано после уточнения данных."}</p><Link href={reportHref+"#plan"}>План действий ↗</Link></article>
    </section>
    <SourceFlow full={r} basic={b}/>
  </>;
}

export default function ClientHomeV4({model,caseId,mode}:{model:WorkspaceModelV1;caseId:string;mode:"basic"|"full"}){
  const toggle="/dashboard/workspace-v4?case="+encodeURIComponent(caseId)+"&mode="+(mode==="full"?"basic":"full");
  return <main className="w4-shell">
    <aside className="w4-sidebar">
      <Link href="/" className="w4-brand-link"><Brand/></Link>
      <span className="w4-sidebar-caption">РАБОЧИЙ КАБИНЕТ</span>
      <nav aria-label="Разделы кабинета">
        {["Главная","Анализ","Финансирование","Обязательства","Документы","Заявки"].map((item,i)=><a className={i===0?"active":""} href={i===0?"#top":"#preview"} key={item}><i/>{item}<span>{i===0?"↗":"·"}</span></a>)}
      </nav>
      <div className="w4-sidebar-bottom"><span className="w4-live-dot"/> Данные связаны<small>Источник → показатель → вывод</small></div>
    </aside>
    <section className="w4-main" id="top">
      <header className="w4-topbar">
        <div><small>КОМПАНИЯ</small><b>{model.basic.company.name}</b><span>ИНН {model.basic.company.inn} · {model.basic.analysis.periodFrom} — {model.basic.analysis.periodTo}</span></div>
        <div className="w4-top-actions"><span>Демонстрационный профиль · условные данные</span><Link href={toggle}>{mode==="full"?"Посмотреть базовый вид":"Посмотреть полный вид"}</Link></div>
      </header>
      <div className="w4-content" id="preview">
        {mode==="full"?<FullHome model={model} caseId={caseId}/>:<BasicHome model={model} fullPreviewHref={toggle.replace("mode=basic","mode=full")}/>}
      </div>
      <footer className="w4-footer"><span>Прескор · финансовая аналитика</span><span>Аналитическая оценка не является решением банка.</span></footer>
    </section>
  </main>;
}
