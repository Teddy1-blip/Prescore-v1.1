"use client";
import { useId, useState, type ReactNode } from "react";
import type { WorkspaceFactV1, WorkspaceModelV1 } from "../../../lib/workspace/model";
import type { AgentData } from "./broker-operations";

type Monthly = NonNullable<WorkspaceModelV1["basic"]["bankingFacts"]["monthly"]>;
const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const rub = (v: number | null) => v === null ? "Недостаточно данных" : number.format(v) + " ₽";
const finite = (v: number | null) => v !== null && Number.isFinite(v) ? v : null;
export const factValue = (f: WorkspaceFactV1) => f.status === "UNKNOWN" ? null : finite(f.value);
// Display arithmetic only. Never fills a missing operand with zero or writes to the model.
export const monthlyNet = (row: Monthly[number]) => finite(row.externalInflows) === null || finite(row.externalOutflows) === null ? null : row.externalInflows! - row.externalOutflows!;
export const concentrationPercent = (f: WorkspaceFactV1) => {
 const value = factValue(f);
 return value === null || !["RATIO", "PERCENT"].includes(f.unit) ? null : value * (f.unit === "RATIO" ? 100 : 1);
};

export function FactBars({ rows, percent = false }: { rows: { label: string; value: number | null }[]; percent?: boolean }) {
 const max = percent ? 100 : Math.max(1, ...rows.filter(r => r.value !== null).map(r => Math.abs(r.value!)));
 const known = rows.filter(r => r.value !== null);
 return <div className="ws-chart" data-chart="bars">
  {!known.length ? <p className="ws-chart-empty">Недостаточно данных для графика. Значения не определены.</p> : known.every(r => r.value === 0) && <p className="ws-chart-empty">Известные значения равны нулю.{known.length < rows.length ? " Остальные значения не определены." : ""}</p>}
  <p className="ws-chart-legend">Длина полосы — {percent ? "доля, шкала 0–100%" : "сумма в рублях; общая шкала"}. Точные значения указаны справа.</p>
  <dl className="ws-chart-bars">{rows.map(r => <div key={r.label}><dt>{r.label}</dt><dd>{r.value === null ? "Недостаточно данных" : percent ? number.format(r.value) + "%" : rub(r.value)}</dd><span className="ws-chart-track" aria-hidden="true">{r.value !== null && r.value !== 0 && <i style={{ width: Math.min(100, Math.abs(r.value) / max * 100) + "%" }}/>}</span></div>)}</dl>
 </div>;
}

export function MonthlyChart({ rows, net = false }: { rows: Monthly; net?: boolean }) {
 const plotted = rows.slice(-12);
 const values = plotted.flatMap(r => net ? [monthlyNet(r)] : [finite(r.externalInflows), finite(r.externalOutflows)]);
 const max = Math.max(1, ...values.filter((v): v is number => v !== null).map(v => Math.abs(v)));
 const hasValue = values.some(v => v !== null), nonzero = values.some(v => v !== null && v !== 0);
 const step = 720 / Math.max(1, plotted.length), baseline = net ? 100 : 192;
 return <div className="ws-chart" data-chart={net ? "cash-flow" : "turnover"}>
  {rows.length > 12 && <p>График: последние 12 месяцев. Полная раскладка — ниже.</p>}
  <p className="ws-chart-legend">{net ? "Чистый внешний поток: поступления минус списания. Выше нуля — плюс, ниже — минус." : "Поступления — сплошные столбцы. Списания — контурные столбцы."} Рубли, единая шкала.</p>
  {!hasValue ? <p className="ws-chart-empty">Недостаточно данных для графика. Значения не определены.</p> : !nonzero ? <p className="ws-chart-empty">Известные значения равны нулю.</p> : <>
   <div className="ws-chart-scale"><span>{rub(max)}</span><span>{net ? "± от нулевой линии" : "от нулевой линии"}</span></div>
   <svg className="ws-financial-svg" viewBox="0 0 720 200" preserveAspectRatio="none" role="img" aria-label={net ? "Помесячный чистый внешний денежный поток; точные суммы в раскладке под графиком" : "Помесячные поступления и списания; точные суммы в раскладке под графиком"}>
    {[net ? 10 : 12, net ? 55 : 72, net ? 145 : 132].map(y => <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="#365361" strokeDasharray="3 5"/>)}
    <line x1="0" x2="720" y1={baseline} y2={baseline} stroke="#adc8d2"/>
    {plotted.map((r, i) => <g key={r.month}>{(net ? [monthlyNet(r)] : [finite(r.externalInflows), finite(r.externalOutflows)]).map((v, j) => {
     if (v === null || v === 0) return null;
     const h = Math.abs(v) / max * (net ? 88 : 175), x = i * step + step * (net ? .24 : .12 + j * .4);
     return <rect key={j} x={x} y={v >= 0 ? baseline - h : baseline} width={step * (net ? .52 : .3)} height={h} rx="1" fill={j ? "none" : v < 0 ? "#9698d4" : "#72c9d5"} stroke={j ? "#9698d4" : "none"} strokeWidth="2" vectorEffect="non-scaling-stroke"><title>{`${r.month}: ${net ? "чистый поток" : j ? "списания" : "поступления"} ${rub(v)}`}</title></rect>;
    })}</g>)}
   </svg>
   <div className="ws-chart-months">{plotted.map(r => <span key={r.month}>{r.month.slice(5)}<small>{r.month.slice(0,4)}</small></span>)}</div>
  </>}
  {values.some(v => v === null) && <p>Есть месяцы с недостаточными данными; пропуски не означают ноль.</p>}
  {net && rows.length > 0 && <details className="ws-chart-details"><summary>Помесячные значения потока</summary><dl>{rows.map(r => <div key={r.month}><dt>{r.month}{r.coverage !== "FULL" ? " · неполный месяц" : ""}</dt><dd>{rub(monthlyNet(r))}</dd></div>)}</dl></details>}
 </div>;
}

const tabs = ["Обороты", "Денежный поток", "Платежи", "Концентрация"];
export function DataPanel({ model, children }: { model: WorkspaceModelV1; children: ReactNode }) {
 const [tab, setTab] = useState(0), id = useId(), b = model.basic.bankingFacts;
 const payments = [["Налоги", b.taxPayments], ["Социальные взносы", b.socialContributions], ["Основной долг", b.loanPrincipalPayments], ["Проценты", b.interestPayments], ["Неразделённые долговые платежи", b.unsplitDebtPayments], ["Лизинг", b.leasingPayments], ["Переводы физическим лицам", b.transfersToIndividuals]] as const;
 return <section className="ws-data-panel" aria-label="Банковская динамика">
  <header><div><span className="ws-eyebrow">ДАННЫЕ ВЫПИСОК</span><h2>Банковская динамика</h2></div><span>{model.basic.analysis.period.from} — {model.basic.analysis.period.to}</span></header>
  <div className="ws-data-tabs" role="tablist" aria-label="Банковские визуализации">{tabs.map((label, i) => <button type="button" key={label} id={`${id}-tab-${i}`} role="tab" aria-selected={tab === i} aria-controls={`${id}-panel`} tabIndex={tab === i ? 0 : -1} onClick={() => setTab(i)} onKeyDown={e => {
   const next = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
   if (next !== null) { e.preventDefault(); setTab(next); document.getElementById(`${id}-tab-${next}`)?.focus(); }
  }}>{label}</button>)}</div>
  <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}>
   {tab === 0 && <><MonthlyChart rows={b.monthly ?? []}/>{children}</>}
   {tab === 1 && <><MonthlyChart rows={b.monthly ?? []} net/><p className="ws-chart-note">Разность внешних поступлений и списаний за один месяц. Визуализация движения денег, не кредитный вывод.</p></>}
   {tab === 2 && <><h3>Структура классифицированных платежей</h3><FactBars rows={payments.map(([label, f]) => ({ label, value: factValue(f) }))}/><p className="ws-chart-note">Выбранные категории по выпискам. Не все расходы компании; неизвестные суммы не заменены нулём.</p></>}
   {tab === 3 && <><h3>Концентрация прямых покупателей</h3><FactBars percent rows={[{ label: "Крупнейший покупатель", value: concentrationPercent(b.directCustomerTop1) }, { label: "Три крупнейших покупателя", value: concentrationPercent(b.directCustomerTop3) }]}/><p className="ws-chart-note">Доли в прямых операционных поступлениях. Показатели пересекаются и не складываются. Без оценки риска.</p></>}
  </div>
 </section>;
}

export function applicationDistribution(applications: AgentData["applications"]) {
 const counts = new Map<string, number>();
 for (const a of applications) counts.set(a.status || "Статус не указан", (counts.get(a.status || "Статус не указан") ?? 0) + 1);
 return [...counts].map(([label, value]) => ({ label, value }));
}
export function BrokerOverview({ data, attentionCount }: { data: AgentData; attentionCount: number }) {
 const withAnalysis = data.leads.filter(l => !!l.analysisId).length, statuses = applicationDistribution(data.applications);
 return <section className="ws-broker-overview" aria-label="Обзор портфеля и заявок">
  <div><span className="ws-eyebrow">КЛИЕНТСКАЯ БАЗА</span><h2>Портфель клиентов <small>{data.leads.length}</small></h2>
   {data.leads.length > 0 ? <div className="ws-portfolio-bar" role="img" aria-label={`С анализом: ${withAnalysis}; без анализа: ${data.leads.length - withAnalysis}`}><i style={{width: (data.leads.length ? withAnalysis / data.leads.length * 100 : 0) + "%"}}/></div> : <p>Клиентов пока нет. Распределение появится после добавления клиента.</p>}
   <dl className="ws-portfolio-legend"><div><dt>С анализом</dt><dd>{withAnalysis}</dd></div><div><dt>Без анализа</dt><dd>{data.leads.length - withAnalysis}</dd></div></dl>
   <p>В очереди внимания: <b>{attentionCount}</b> задач. Это отдельный счётчик задач, а не доля клиентов.</p>
  </div>
  <div className="ws-broker-status" data-chart="application-status"><span className="ws-eyebrow">ОБРАЩЕНИЯ</span><h2>Заявки <small>{data.applications.length}</small></h2><p className="ws-chart-legend">Статус → число заявок. Длина полосы — доля от общего числа.</p>
   {statuses.length ? <dl className="ws-status-distribution">{statuses.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd><span aria-hidden="true"><i style={{width:s.value / data.applications.length * 100 + "%"}}/></span></div>)}</dl> : <p>Заявок пока нет. Распределение появится после создания обращения.</p>}
   <p>Текущий срез статусов, не конверсия между этапами.</p>
  </div>
 </section>;
}
