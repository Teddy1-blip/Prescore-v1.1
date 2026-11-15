import {BankBfoReconciliation} from '../../components/workspace/bank-bfo-reconciliation.tsx';
import type {ClientReportModelV1} from '../../../lib/credit-engine/contracts/client-report.ts';
import type {AnalysisV3Value} from '../../../lib/credit-engine/client-report/analysis-v3.ts';
const states:Record<string,string>={KNOWN:'Значение известно',PARTIAL:'Частичные данные',UNKNOWN:'Не определено',NOT_APPLICABLE:'Не применимо',CONFIRMED:'Подтверждено',UNCONFIRMED:'Без независимой проверки',CONFLICTED:'Есть расхождение',HIGH:'Высокая',MEDIUM:'Средняя',LOW:'Низкая'};
const display=(value:number|string|null,unit='RUB')=>value===null?'Не определено':typeof value==='string'?value:new Intl.NumberFormat('ru-RU',{maximumFractionDigits:unit==='RUB'?0:3}).format(value)+({RUB:' ₽',PERCENT:'%',RATIO:' ×'}[unit]??'');
function Value({value}:{value?:AnalysisV3Value}){return <>{display(value?.value??null)}<small>{states[value?.knowledge??'UNKNOWN']??'Не определено'} · {states[value?.verification??'UNCONFIRMED']} · на {value?.asOf??'неуказанную дату'}</small></>;}
// Render only allowlisted canonical source details, identical to the workspace.
export function SourceAppendix({model}:{model:ClientReportModelV1}){
 if(model.meta.entitlement!=='FULL')return null;
 const selected=new Set(['REVENUE','NET_PROFIT','ASSETS_TOTAL','EQUITY','TOTAL_BORROWINGS','currentRatio','debtToEquity','netMargin','roa','roe']);
 return <section className="cr-source-appendix"><h2>Отчётность и кредитная история</h2>
 {(model.financialAnalysis?.history??[]).map(p=><section key={p.id}><h3>{p.source==='BFO'?'Бухгалтерская отчётность':'Промежуточная отчётность'} · {p.period.from} — {p.period.to}</h3><p>Достоверность: {states[p.quality.confidence]??'Не определена'}. Баланс: {p.quality.balanceReconciled===null?'сверка не определена':p.quality.balanceReconciled?'сходится':'требует проверки'}.</p><table><thead><tr><th>Показатель</th><th>Значение</th><th>Полнота</th></tr></thead><tbody>{p.groups.flatMap(g=>g.metrics).filter(m=>selected.has(m.key)).map(m=><tr key={m.key}><th>{m.label}</th><td>{m.status==='NOT_APPLICABLE'?'Не применимо':display(m.value,m.unit)}</td><td>{states[m.status]??'Не определено'}</td></tr>)}</tbody></table></section>)}
 {!model.financialAnalysis?.history.length&&<p>Бухгалтерская отчётность не обработана. Неизвестные показатели не равны нулю.</p>}
 <BankBfoReconciliation rows={model.reconciliation?.bankBfo}/>
 {(model.analysisV3?.portfolio??[]).map(o=><section className="cr-credit-source" key={o.id}><h3>{String(o.creditor.value??'Кредитор не определён')}</h3><dl>{[['Остаток на дату анализа',o.principal],['Остаток по отчёту',o.reportedPrincipal],['Лимит',o.limit],['Платёж',o.payment],['Следующий платёж',o.nextPayment],['Дата следующего платежа',o.nextDate],['Срок погашения',o.maturity],['Просрочка на дату источника',o.overdue]].map(([title,value])=><div key={String(title)}><dt>{String(title)}</dt><dd><Value value={value as AnalysisV3Value|undefined}/></dd></div>)}</dl></section>)}
 {!model.analysisV3?.portfolio.length&&<p>Обязательства не раскрыты. Отсутствие сведений не подтверждает отсутствие долга.</p>}
 <p>Исторический остаток отражает дату кредитного отчёта. Его наличие не подтверждает текущий остаток долга.</p></section>;
}
