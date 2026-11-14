"use client";
import type {WorkspaceModelV1} from "../../../lib/workspace/model";
import {scopedEvidence} from "../../../lib/workspace/scoped-evidence";

type Scope="home"|"bfo"|"counterparties"|"obligations";
type Route="analysis"|"actions"|"financing"|"documents"|"obligations"|"counterparties"|"bfo";

const labels:Record<Scope,string>={home:"Общий анализ компании",bfo:"По бухгалтерской отчётности",counterparties:"По данным покупателей и поставщиков",obligations:"По кредитным обязательствам"};

/** One analytical presentation, sourced from saved canonical evidence. No local credit calculations. */
export function ClientAnalyticPipeline({model,scope,choose}:{model:WorkspaceModelV1;scope:Scope;choose:(view:string)=>void}){
 const report=model.full?.report;
 const statements=model.basic.bankingFacts;
 const {stopFactor,recommendation,action}=scopedEvidence(model.full,scope);
 const financial=report?.financialAnalysis?.history??[];
 const annual=[...financial].sort((a,b)=>(b.period.asOf??b.period.to??"").localeCompare(a.period.asOf??a.period.to??""))[0];
 const portfolio=report?.analysisV3?.portfolio??[];
 const customerCount=statements.topCounterparties?.length??null;
 const expert=scope==="home"
  ? report?.hero.headline??"Доступные показатели по загруженным документам"
  :scope==="bfo"
   ? annual?("БФО: "+(annual.quality.balanceReconciled===true?"баланс сходится":annual.quality.balanceReconciled===false?"баланс требует сверки":"сверка баланса не подтверждена")):"Данные БФО ещё не представлены в полном анализе"
  :scope==="obligations"
   ?portfolio.length?("В анализе учтены обязательства: "+portfolio.length):"Договорные обязательства пока не подтверждены"
   :customerCount!==null?"По выпискам определены покупатели: "+customerCount+". Это не реестр дебиторки.":"Для оценки задолженности нужны ОСВ и договоры";
 const note=scope==="home"
  ?"Объединённые результаты выбранного анализа"
  :"Только опубликованные факты этого раздела; общий кредитный вывод — в «Кредитном профиле»";
 const steps:Array<{title:string;summary:string;route:Route}>=[
  {title:"Экспертность",summary:expert,route:scope==="bfo"?"bfo":scope==="obligations"?"obligations":scope==="counterparties"?"counterparties":"analysis"},
  {title:"Стоп-факторы",summary:stopFactor?.title??"Отдельный подтверждённый фактор не опубликован",route:"analysis"},
  {title:"Рекомендации",summary:recommendation?.title??"Нет отдельной рекомендации по подтверждённым фактам раздела",route:"analysis"},
  {title:"Предложения",summary:scope==="home"?report?.productFit.primary[0]?.title??"Подбор требует уточнения данных":"Финансирование подбирается по общему кредитному профилю",route:"financing"},
  {title:"План 7 / 30 / 60",summary:action?.title??"Откройте общий план действий и необходимые подтверждения",route:"actions"},
 ];
 return <section className="pc-analytic-rail" aria-label="Аналитика от фактов к действиям">
  <header><h2>От анализа к действию</h2><p>{labels[scope]} · {note}</p></header>
  <ol>{steps.map((step,i)=><li key={step.title}>
   <span className="pc-analytic-step">{i+1} / 5</span>
   <h3>{step.title}</h3><p>{step.summary}</p>
   <button type="button" onClick={()=>choose(step.route)}>Открыть раздел ↗</button>
  </li>)}</ol>
 </section>;
}
