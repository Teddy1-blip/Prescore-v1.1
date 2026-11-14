"use client";
import type {WorkspaceModelV1} from "../../../lib/workspace/model";
import {Panel} from "./client-insights";
import {money,date} from "./presentation";

const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;

/** Displays only dated evidence from the existing credit portfolio, not a fabricated forecast. */
export function ClientPaymentCalendar({model}:{model:WorkspaceModelV1}){
 const obligations=model.full?.report.analysisV3?.portfolio??[];
 const items=obligations.flatMap(o=>{
  const due=o.nextDate?.value,amount=o.nextPayment?.value;
  if(typeof due!=="string"||!validDate(due)||typeof amount!=="number"||!Number.isFinite(amount)||amount<0||o.exposure==="CONTINGENT")return [];
  return [{id:o.id,creditor:typeof o.creditor.value==="string"?o.creditor.value:"Кредитное обязательство",due,amount,source:(o.sources??[]).join(", ")||"Данные обязательства"}];
 }).sort((a,b)=>a.due.localeCompare(b.due)||a.id.localeCompare(b.id));
 const today=new Date().toISOString().slice(0,10);
 const upcoming=items.filter(item=>item.due>=today);
 const summary=model.full?.report.analysisV3?.scheduledPayments?.filter(s=>s.value!==null)??[];
 return <div className="pc-calendar">
  <div className="pc-page-title"><div><h1>Платёжный календарь</h1><p>Известные графики обязательств. Прогноз поступлений и платежей поставщикам ещё не подключён.</p></div></div>
  <Panel title="Датированные предстоящие платежи">{upcoming.length?<div className="pc-table-scroll"><table><thead><tr><th>Дата</th><th>Кредитор</th><th>Сумма</th><th>Источник</th></tr></thead><tbody>{upcoming.map(item=><tr key={item.id}><td>{date(item.due)}</td><th scope="row">{item.creditor}</th><td>{money(item.amount)}</td><td>{item.source}</td></tr>)}</tbody></table></div>:<p>Подтверждённых дат и сумм будущих платежей пока нет. Для календаря добавьте БКИ и графики договоров в «Кредитном портфеле».</p>}</Panel>
  {summary.length>0&&<Panel title="Ближайшая нагрузка по графикам"><dl className="pc-definition">{summary.map(s=><div key={s.days}><dt>Ближайшие {s.days} дней</dt><dd>{money(s.value)}</dd></div>)}</dl><p className="pc-muted">Суммы по обязательствам — не полный прогноз остатка денег.</p></Panel>}
  <Panel title="Прогноз ликвидности"><p>Для расчёта кассовых разрывов нужны подтверждённые остатки и датированные поступления/выплаты. История движения денег не считается гарантированным прогнозом.</p></Panel>
 </div>;
}
