"use client";
import {FinancialDynamics} from './financial-dynamics';
import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import type {PublicFinancialMetric} from '../../../lib/credit-engine/client-report/source-detail';
import {FullAccessNotice,date} from './presentation';
import {label,sourceLabel} from './credit-depth';
import {FactorRows,Panel} from './client-insights';

const messages:Record<string,string>={
 SCALE_UNCONFIRMED:'Единица измерения не подтверждена. Добавьте отчёт с указанием рублей, тысяч или миллионов рублей.',
 SOURCE_FIELD_MISSING:'В источнике отсутствует необходимое поле.',
 MISSING_NOT_ZERO:'Отсутствующие значения не приравнены к нулю.',
 ZERO_DENOMINATOR:'Расчёт неприменим при нулевой базе.',
 NON_POSITIVE_EQUITY_DENOMINATOR:'Расчёт ограничен неположительным капиталом.',
 ENDING_BALANCE_DENOMINATOR:'Использован остаток на конец периода вместо среднего.',
 ENDING_DENOMINATOR_FALLBACK:'Средняя величина недоступна; использована конечная.',
 AVERAGE_DENOMINATOR_USED:'Использована средняя величина на начало и конец периода.',
 PERIOD_NOT_COMPARABLE:'Периоды не сопоставимы.',
 INTERIM_PERIOD_NOT_ANNUALIZED:'Промежуточные результаты не пересчитаны в годовые.',
 PERIOD_BOUNDARIES_UNKNOWN:'Границы периода не подтверждены.',
 SOURCE_FIELD_UNKNOWN:'Значение источника неизвестно.',
 CASH_BASIS_VS_ACCRUAL_BASIS:'Поступления отражают движение денег, выручка — метод начисления.',
 VAT_AND_ACCOUNTING_PRESENTATION_MAY_DIFFER:'НДС и правила учёта могут влиять на сопоставимость.',
 CUSTOMER_ADVANCE_TIMING_MAY_DIFFER:'Авансы покупателей могут относиться к другому периоду.',
 RECEIVABLE_COLLECTION_TIMING_MAY_DIFFER:'Погашение дебиторской задолженности может относиться к другому периоду.',
 BANK_ACCOUNT_SET_NOT_PROVEN_COMPLETE:'Полнота набора банковских счетов не подтверждена.',
 CROSS_PERIOD_COMPARABILITY_REQUIRED:'Необходимо проверить сопоставимость периодов.',
 SOURCE_MISSING:'Источник не добавлен.',
 NO_REPORTED_INTEREST_EXPENSE:'Расходы по процентам в отчётности не указаны.'
};

export function Warnings({items}:{items:string[]}){
 if(!items.length)return null;
 const known=[...new Set(items.map(s=>messages[s]).filter(Boolean))],extra=items.filter(s=>!messages[s]).length;
 return <div className="pc-data-note"><ul>{known.map(s=><li key={s}>{s}</li>)}</ul>{extra>0&&<p>Есть дополнительные ограничения источника: {extra}. Проверьте исходный документ и достоверность показателя.</p>}</div>;
}

export function numeric(value:number|string|null,status:string,unit:string){
 if(status==='NOT_APPLICABLE')return 'Не применимо';
 if(status==='UNKNOWN'||value===null)return 'Не определено';
 if(typeof value==='string')return value;
 return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:unit==='RUB'?0:3}).format(value)+({RUB:' ₽',PERCENT:'%',DAYS:' дн.',COUNT:'',RATIO:' ×'}[unit]??'');
}

function MetricTable({metrics}:{metrics:PublicFinancialMetric[]}){
 return <div className="pc-table-scroll" tabIndex={0} aria-label="Финансовые показатели"><table><thead><tr><th>Показатель</th><th>Значение</th><th>Качество и период</th></tr></thead><tbody>{metrics.filter(m=>m.value!==null && (m.status==='KNOWN'||m.status==='PARTIAL')).map(m=><tr key={m.key}><th scope="row">{m.label}</th><td>{numeric(m.value,m.status,m.unit)}</td><td>{label(m.status)} · {label(m.confidence)} · {label(m.origin)}<small>{m.periodFrom||m.periodTo?date(m.periodFrom)+' — '+date(m.periodTo):date(m.asOf)}</small><Warnings items={m.warnings}/></td></tr>)}</tbody></table></div>;
}

// Reuses the retired conclusion's preview, keeping annual and interim periods separate.
export function FinancialSnapshot({model,choose}:{model:WorkspaceModelV1;choose:(view:string)=>void}){
 const history=model.full?.report.financialAnalysis?.history??[];
 const periods=['ANNUAL','INTERIM'].map(kind=>[...history].filter(p=>p.period.kind===kind).sort((a,b)=>(b.period.asOf??b.period.to??'').localeCompare(a.period.asOf??a.period.to??''))[0]).filter(Boolean);
 if(!periods.length)return null;
 const keys=['REVENUE','NET_PROFIT','ASSETS_TOTAL','EQUITY','TOTAL_BORROWINGS','currentRatio','equityRatio','debtToEquity','netMargin'];
 return <Panel title="Финансовое состояние" action={<button className="pc-text-button" onClick={()=>choose('banking')}>Отчётность и динамика →</button>}>{periods.map(p=><section key={p.id}><h3>{p.period.kind==='ANNUAL'?'Годовая отчётность':'Промежуточная отчётность'}</h3><p>{date(p.period.from)} — {date(p.period.to)} · Достоверность: {label(p.quality.confidence)}</p><dl className="pc-definition pc-bank-summary">{p.groups.flatMap(g=>g.metrics).filter(m=>keys.includes(m.key)).map(m=><div key={m.key}><dt>{m.label}</dt><dd>{numeric(m.value,m.status,m.unit)}<small>{label(m.status)}</small></dd></div>)}</dl><p className="pc-muted">{p.period.kind==='INTERIM'?'Промежуточные показатели не пересчитаны в годовые.':'Годовые показатели не заменяются более поздним кварталом.'} Баланс: {p.quality.balanceReconciled===true?'сходится':p.quality.balanceReconciled===false?'требует сверки':'сверка не подтверждена'}.</p></section>)}</Panel>;
}

export function FinancialStatements({model}:{model:WorkspaceModelV1}){
 const r=model.full?.report;
 if(!r)return <FullAccessNotice model={model}/>;
 const a=r.financialAnalysis;
 const hasChange=(t:NonNullable<typeof a>['trends'][number])=>[t.absolute,t.relative].some(m=>m.value!==null&&m.status!=='UNKNOWN'&&m.status!=='NOT_APPLICABLE');
 const availableTrends=a?.trends.filter(hasChange)??[],unavailableTrends=a?.trends.filter(t=>!hasChange(t))??[];
 const trendTable=(trends:NonNullable<typeof a>['trends'])=><div className="pc-table-scroll" tabIndex={0} aria-label="Финансовые тренды"><table><thead><tr><th>Показатель / периоды</th><th>Изменение суммы</th><th>Относительное изменение</th><th>Сопоставимость</th></tr></thead><tbody>{trends.map((t,i)=><tr key={i}><th>{t.label}<small>{date(a?.history.find(p=>p.id===t.previousId)?.period.asOf)} → {date(a?.history.find(p=>p.id===t.currentId)?.period.asOf)}</small></th><td>{numeric(t.absolute.value,t.absolute.status,t.absolute.unit)}<small>{label(t.absolute.status)}</small><Warnings items={t.absolute.warnings}/></td><td>{numeric(t.relative.value,t.relative.status,t.relative.unit)}<small>{label(t.relative.status)}</small><Warnings items={t.relative.warnings}/></td><td>{t.comparability==='COMPARABLE_ANNUAL_YOY'?'Год к году':t.comparability==='COMPARABLE_INTERIM_YOY'?'Промежуточный период':'Сопоставимость ограничена'}</td></tr>)}</tbody></table></div>;
 const conclusions=r.detailedSections.filter(s=>/financial|финанс|отчёт|отчет|капитал|ликвид|рентаб/i.test(s.id+' '+s.title));
 return <>
  <Panel title="Финансовая отчётность">
   <p>Показатели основаны на бухгалтерской и квартальной отчётности. Денежный поток по выпискам не заменяет бухгалтерскую выручку.</p>
   {!a?.history.length&&<div className="pc-empty-inline"><p>Добавьте БФО в документах, чтобы увидеть выручку, прибыль и капитал по периодам.</p></div>}
  </Panel>
  {a&&<FinancialDynamics history={a.history}/>}
  {a?.history.map((p,index)=><section className="pc-panel pc-financial-period" key={p.id}>
   <header><div><h2>{sourceLabel(p.source)}</h2><p>{date(p.period.from)} — {date(p.period.to)} · на {date(p.period.asOf)}</p></div><span className="pc-badge">{p.period.kind==='ANNUAL'?'Годовая':p.period.kind==='INTERIM'?'Промежуточная':'Период не уточнён'}</span></header>
   <div className="pc-quality-grid">
    <div><span>Достоверность</span><strong>{label(p.quality.confidence)}</strong></div>
    <div><span>Поля баланса</span><strong>{new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(p.quality.coreBalanceFieldCoverage*100)}%</strong></div>
    <div><span>Финансовый результат</span><strong>{new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(p.quality.coreIncomeFieldCoverage*100)}%</strong></div>
    <div><span>Период результата</span><strong>{({FULL_YEAR:'Полный год',CUMULATIVE_YTD:'С начала года',STANDALONE_PERIOD:'Отдельный период',UNKNOWN:'Не определён'})[p.period.flowPeriodType]??'Не определён'}</strong></div>
   </div>
   <p className="pc-muted">Баланс: {p.quality.balanceReconciled===null?'сверка не определена':p.quality.balanceReconciled?'сходится':'требует сверки'} · финансовый результат: {p.quality.incomeReconciled===null?'сверка не определена':p.quality.incomeReconciled?'сходится':'требует сверки'} · месяцев в периоде: {p.period.monthsCovered??'не определено'}.</p>
   <Warnings items={[...(index===0?a.warnings:[]),...p.quality.warnings]}/>
   <div className="pc-metric-groups">{p.groups.map(g=><details className="pc-metric-group" key={g.key}><summary>{g.title}<span>{g.metrics.length} показателей</span></summary><MetricTable metrics={g.metrics}/></details>)}</div>
  </section>)}
  {!!a?.trends.length&&<Panel title="Изменения по сопоставимым периодам">
   {!!availableTrends.length&&trendTable(availableTrends)}
   {!!unavailableTrends.length&&<><p className="pc-muted">Для {availableTrends.length?'остальных изменений':'оценки динамики'} нужны сопоставимые периоды и значения обоих периодов. Добавьте недостающую отчётность или уточните её показатели.</p><details className="pc-trend-limitations"><summary>Какие изменения пока нельзя оценить ({unavailableTrends.length})</summary>{trendTable(unavailableTrends)}</details></>}
  </Panel>}

  {!!conclusions.length&&<Panel title="Финансовые выводы текущего анализа">{conclusions.length?conclusions.map(s=><section className="pc-factor-section" key={s.id}><h3>{s.title}</h3><FactorRows model={model} items={s.factors}/></section>):<p className="pc-muted">Отдельные финансовые выводы не выделены в текущей версии анализа.</p>}</Panel>}
 </>;
}

const outcomes:Record<string,string>={
 AGREES:'Источники согласуются',
 WITHIN_TOLERANCE:'Согласуются в пределах допустимого отклонения',
 CONFLICT:'Есть расхождение',
 RELATIONSHIP_OBSERVED:'Связь показателей наблюдается',
 NOT_COMPARABLE:'Сведения не сопоставимы',
 INSUFFICIENT_DATA:'Недостаточно сведений',
 SOURCE_MISSING:'Источник не добавлен'
};

export function ReconciliationDetails({model}:{model:WorkspaceModelV1}){
 const r=model.full?.report;
 if(!r)return <FullAccessNotice model={model}/>;
 const a=r.reconciliation;
 const renderFinding=(f:NonNullable<typeof a>['findings'][number])=><article className={'pc-recon-card'+(f.requiresReview?' needs-review':'')} key={f.id}>
   <header><div><span>{outcomes[f.outcome]??'Состояние сверки не определено'}</span><h2>{f.title}</h2></div><span className={'pc-badge'+(f.requiresReview?' attention':'')}>{f.requiresReview?'Проверить':'Без отдельной проверки'}</span></header>
   <p>{f.requiresReview?'Есть расхождение или ограничение сопоставимости, которое стоит объяснить до подачи заявки.':'Сопоставление не выявило отдельного действия по этому факту.'}</p>
   <p className="pc-muted">Сопоставимость: {({EXACT_PERIOD:'одинаковый период',EXACT_ASOF:'одинаковая дата',NEAR_ASOF:'близкие даты',FULL_MONTH_ALIGNED:'совмещены полные месяцы',PARTIAL:'частичная',NONE:'не подтверждена'})[f.comparability]??'не определена'} · достоверность: {label(f.confidence)}.</p>
   <details><summary>Сравнить исходные показатели</summary><div className="pc-recon-sides">{[f.left,f.right].map((side,n)=><div key={n}>{side.map((v,i)=><div className="pc-recon-value" key={i}><h3>{sourceLabel(v.sourceType)} · {v.label}</h3><strong>{numeric(v.value,v.status,v.unit)}</strong><p>{date(v.period.from)} — {date(v.period.to)} · на {date(v.period.asOf)}</p><small>{label(v.status)} · {label(v.confidence)}</small><Warnings items={v.warnings}/></div>)}{!side.length&&<p>Сопоставляемый источник отсутствует.</p>}</div>)}</div><dl className="pc-definition"><div><dt>Абсолютная разница</dt><dd>{numeric(f.absoluteDifference,'KNOWN','')}</dd></div><div><dt>Относительное отклонение</dt><dd>{numeric(f.relativeDifference,'KNOWN','RATIO')}</dd></div><div><dt>Соотношение значений</dt><dd>{numeric(f.ratio,'KNOWN','RATIO')}</dd></div><div><dt>Разница дат</dt><dd>{numeric(f.temporalGapDays,'KNOWN','DAYS')}</dd></div></dl><Warnings items={[...f.reasons,...f.warnings]}/></details>
  </article>;
 return <>
  <Panel title="Сопоставление источников">
   <p>Prescore сравнивает банковские данные, отчётность и кредитную историю там, где показатели и периоды действительно сопоставимы. Расхождение само по себе не является кредитным решением.</p>
   {a&&<div className="pc-statusline"><span className="pc-badge">Достоверность: {label(a.confidence)}</span><span className={'pc-badge'+(a.findings.some(f=>f.requiresReview)?' attention':'')}>{a.findings.filter(f=>f.requiresReview).length} требуют проверки</span></div>}
   {a&&<Warnings items={a.warnings}/>}
  </Panel>
  {a?<div className="pc-reconciliation-list">{a.findings.filter(f=>f.requiresReview).map(renderFinding)}
    {a.findings.some(f=>!f.requiresReview)&&<details className="pc-recon-other"><summary>Остальные сопоставления ({a.findings.filter(f=>!f.requiresReview).length})</summary>{a.findings.filter(f=>!f.requiresReview).map(renderFinding)}</details>}
    {!a.findings.length&&<Panel title="Сверка завершена"><p>Отдельные результаты сопоставления источников пока отсутствуют.</p></Panel>}</div>:<Panel title="Сверка недоступна"><p>Детальная сверка не опубликована для этого анализа.</p></Panel>}
  <Panel title="Влияние на кредитную оценку">{r.detailedSections.filter(s=>/reconcil|сверк|источник/i.test(s.id+' '+s.title)).map(s=><section className="pc-factor-section" key={s.id}><h3>{s.title}</h3><FactorRows model={model} items={s.factors}/></section>)}<FactorRows model={model} items={r.limitations}/></Panel>
 </>;
}
