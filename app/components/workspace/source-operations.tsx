"use client";

import { useRef, useState, type FormEvent } from "react";
import type { WorkspaceModelV1 } from "../../../lib/workspace/model";

export type AnalyticalSourceKind = "BKI" | "QUARTERLY" | "BFO";

type SourceDeltaChange = { label: string; before: string; after: string };
type SourceDeltaNext = {
  code: "BFO" | "BKI" | "QUARTERLY" | "ANALYSIS";
  label: string;
  view: "documents" | "obligations" | "analysis";
  anchor?: string;
};

export type SourceDeltaView = {
  kind: AnalyticalSourceKind;
  title: string;
  sourceChanged: boolean;
  sourcePeriod: string;
  fullComparisonAvailable: boolean;
  facts: string[];
  changes: SourceDeltaChange[];
  reasons: string[];
  confidence: string;
  next: SourceDeltaNext;
};

const sourceKeys: Record<AnalyticalSourceKind, string> = {
  BFO: "FINANCIAL_STATEMENTS",
  BKI: "CREDIT_HISTORY",
  QUARTERLY: "QUARTERLY_REPORT",
};

const sourceTitles: Record<AnalyticalSourceKind, string> = {
  BFO: "бухгалтерской отчётности",
  BKI: "кредитной истории",
  QUARTERLY: "квартальной отчётности",
};

const readyStatuses = new Set(["READY", "PARTIAL", "STALE"]);
const ruNumber = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const ruMoney = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function displayDate(value?: string | null) {
  if (!value) return "";
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function sourceRows(model: WorkspaceModelV1 | null, kind: AnalyticalSourceKind) {
  if (!model) return [];
  return model.basic.sources.availability.filter((source) => source.source === sourceKeys[kind]);
}

function sourcePeriod(model: WorkspaceModelV1, kind: AnalyticalSourceKind) {
  const rows = [...sourceRows(model, kind)].sort((left, right) =>
    (left.periodTo ?? left.periodFrom ?? "").localeCompare(right.periodTo ?? right.periodFrom ?? ""),
  );
  const latest = rows.at(-1);
  if (!latest) return "Период источника не определён";
  const from = displayDate(latest.periodFrom);
  const to = displayDate(latest.periodTo);
  if (from && to && from !== to) return `${from} — ${to}`;
  return to || from || "Период источника не указан";
}

function sourceReady(model: WorkspaceModelV1, kind: AnalyticalSourceKind) {
  return sourceRows(model, kind).some((source) => readyStatuses.has(source.status));
}

function formatMetric(value: number | string | boolean | null, unit: string) {
  if (value === null) return null;
  if (typeof value !== "number") return String(value);
  if (unit === "RUB") return `${ruMoney.format(value)} ₽`;
  if (unit === "PERCENT") return `${ruNumber.format(value)}%`;
  if (unit === "DAYS") return `${ruNumber.format(value)} дн.`;
  return unit === "RATIO" || !unit ? ruNumber.format(value) : `${ruNumber.format(value)} ${unit}`;
}

function confidenceLabel(value?: string | null) {
  const labels: Record<string, string> = {
    HIGH: "высокая",
    MEDIUM: "средняя",
    LOW: "низкая",
    UNKNOWN: "не определена",
  };
  return value ? labels[value] ?? value : "не определена";
}

function financialFacts(kind: "BFO" | "QUARTERLY", model: WorkspaceModelV1) {
  const history = model.full?.report.financialAnalysis?.history ?? [];
  const sourceType = kind === "BFO" ? "BFO" : "QUARTERLY";
  const matching = history
    .filter((period) => period.source === sourceType)
    .sort((left, right) =>
      (left.period.asOf ?? left.period.to ?? left.period.from ?? "").localeCompare(
        right.period.asOf ?? right.period.to ?? right.period.from ?? "",
      ),
    );
  const latest = matching.at(-1);
  if (!latest) return [`Источник принят за период: ${sourcePeriod(model, kind)}`];

  const facts = [
    `Период: ${displayDate(latest.period.from)} — ${displayDate(latest.period.to)}, состояние на ${displayDate(latest.period.asOf) || "дату отчётности"}.`,
    `Качество финансовых данных: ${confidenceLabel(latest.quality.confidence)}.`,
  ];
  const metrics = latest.groups.flatMap((group) => group.metrics);
  const priority = kind === "BFO"
    ? ["REVENUE", "NET_PROFIT", "EQUITY", "TOTAL_LIABILITIES", "currentRatio"]
    : ["REVENUE", "NET_PROFIT", "EQUITY", "RECEIVABLES", "currentRatio"];

  for (const key of priority) {
    const metric = metrics.find((candidate) => candidate.key === key && candidate.status !== "UNKNOWN");
    if (!metric) continue;
    const value = formatMetric(metric.value, metric.unit);
    if (value !== null) facts.push(`${metric.label}: ${value}.`);
  }
  return facts.slice(0, 7);
}

function sumKnown(values: Array<{ value: number | string | null } | undefined>) {
  const known = values
    .map((item) => item?.value)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return { count: known.length, value: known.reduce((sum, value) => sum + value, 0) };
}

function bkiFacts(model: WorkspaceModelV1) {
  const portfolio = model.full?.report.analysisV3?.portfolio ?? [];
  if (!portfolio.length) {
    return model.full
      ? ["Кредитная история принята, но действующие обязательства в доступных данных не подтверждены."]
      : ["Кредитная история добавлена к текущему анализу."];
  }

  const facts = [`Обязательств в портфеле: ${portfolio.length}.`];
  const principal = sumKnown(portfolio.map((obligation) => obligation.principal));
  const reported = sumKnown(portfolio.map((obligation) => obligation.reportedPrincipal));
  const payments = sumKnown(portfolio.map((obligation) => obligation.payment));
  const overdue = sumKnown(portfolio.map((obligation) => obligation.overdue));

  if (principal.count) {
    facts.push(`Известный текущий основной долг: ${ruMoney.format(principal.value)} ₽ по ${principal.count} из ${portfolio.length} обязательств.`);
  } else if (reported.count) {
    facts.push(`Есть датированные остатки по ${reported.count} обязательствам; они не подменяют неизвестный текущий долг.`);
  } else {
    facts.push("Текущий остаток долга в опубликованных данных не подтверждён.");
  }
  if (payments.count) {
    facts.push(`Известные регулярные платежи: ${ruMoney.format(payments.value)} ₽ по ${payments.count} обязательствам.`);
  } else {
    facts.push("Полный договорный платёжный график не подтверждён.");
  }
  if (overdue.count === portfolio.length) {
    facts.push(`Текущая просрочка по опубликованным данным: ${ruMoney.format(overdue.value)} ₽.`);
  } else if (overdue.count) {
    facts.push(`Просрочка известна по ${overdue.count} из ${portfolio.length} обязательств; неизвестные значения не считаются нулём.`);
  } else {
    facts.push("Сведения о текущей просрочке не подтверждены по всем обязательствам.");
  }
  return facts;
}

function summaryValues(model: WorkspaceModelV1 | null) {
  const report = model?.full?.report;
  return [
    { label: "Prescore Index", value: report?.index.value?.display ?? "Не рассчитан" },
    { label: "Готовность к финансированию", value: report?.readiness.level ?? "Не определена" },
    { label: "Кредитное заключение", value: report?.hero.headline ?? "Предварительный банковский профиль" },
    { label: "Дополнительный платёж", value: report?.capacity.headline?.display ?? "Не подтверждён" },
  ];
}

function changedReasons(before: WorkspaceModelV1 | null, after: WorkspaceModelV1) {
  const factors = (model: WorkspaceModelV1 | null) => {
    const report = model?.full?.report;
    return report
      ? [...report.primaryFactors, ...report.contextHighlights, ...report.readiness.constraints, ...report.limitations]
      : [];
  };
  const beforeIds = new Set(factors(before).map((factor) => factor.claimId || factor.id));
  const added = factors(after)
    .filter((factor) => !beforeIds.has(factor.claimId || factor.id))
    .map((factor) => factor.title)
    .filter((title, index, list) => list.indexOf(title) === index)
    .slice(0, 3);
  return added;
}

export function orderedNextSource(model: WorkspaceModelV1): SourceDeltaNext {
  if (!sourceReady(model, "BFO")) {
    return { code: "BFO", label: "Добавить бухгалтерскую отчётность", view: "documents", anchor: "source-bfo" };
  }
  if (!sourceReady(model, "BKI")) {
    return { code: "BKI", label: "Добавить корпоративную кредитную историю", view: "obligations", anchor: "source-bki" };
  }
  if (!sourceReady(model, "QUARTERLY")) {
    return { code: "QUARTERLY", label: "Добавить актуальную квартальную отчётность, если она есть", view: "documents", anchor: "source-quarterly" };
  }
  return { code: "ANALYSIS", label: "Посмотреть обновлённое кредитное заключение", view: "analysis" };
}

export function buildSourceDelta(
  kind: AnalyticalSourceKind,
  before: WorkspaceModelV1 | null,
  after: WorkspaceModelV1,
): SourceDeltaView {
  const beforeRows = sourceRows(before, kind);
  const afterRows = sourceRows(after, kind);
  const sourceChanged = JSON.stringify(beforeRows) !== JSON.stringify(afterRows);
  const beforeSummary = summaryValues(before);
  const afterSummary = summaryValues(after);
  const changes = before
    ? afterSummary.flatMap((item, index) =>
        item.value === beforeSummary[index]?.value
          ? []
          : [{ label: item.label, before: beforeSummary[index]?.value ?? "Не определено", after: item.value }],
      )
    : [];

  const beforeConfidence = before?.full?.report.hero.confidence;
  const afterConfidence = after.full?.report.hero.confidence;
  const confidence = beforeConfidence && afterConfidence && beforeConfidence !== afterConfidence
    ? `Достоверность заключения: ${confidenceLabel(beforeConfidence)} → ${confidenceLabel(afterConfidence)}.`
    : `Достоверность заключения: ${confidenceLabel(afterConfidence)}.`;

  const facts = kind === "BKI" ? bkiFacts(after) : financialFacts(kind, after);
  const reasons = changedReasons(before, after);
  if (!reasons.length && after.full) {
    reasons.push(
      kind === "BKI"
        ? "Портфель, долговая нагрузка и Capacity пересчитаны по данным кредитной истории."
        : "Финансовые коэффициенты, сверка источников и кредитное заключение пересчитаны по новому периоду.",
    );
  }

  return {
    kind,
    title: sourceTitles[kind],
    sourceChanged,
    sourcePeriod: sourcePeriod(after, kind),
    fullComparisonAvailable: !!after.full,
    facts,
    changes,
    reasons,
    confidence,
    next: orderedNextSource(after),
  };
}

async function readWorkspaceModel(analysisId: string): Promise<WorkspaceModelV1 | null> {
  try {
    const response = await fetch(`/api/workspace-model?analysisId=${encodeURIComponent(analysisId)}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok || body?.analysisId !== analysisId || !["READY_BASIC", "READY_FULL"].includes(body?.state)) return null;
    return body as WorkspaceModelV1;
  } catch {
    return null;
  }
}

function nextHref(analysisId: string, next: SourceDeltaNext) {
  const hash = next.anchor ? `#${next.anchor}` : "";
  return `/dashboard?analysisId=${encodeURIComponent(analysisId)}&view=${encodeURIComponent(next.view)}${hash}`;
}

function SourceDeltaCard({ delta, analysisId }: { delta: SourceDeltaView; analysisId: string }) {
  return <section className="pc-panel" data-source-delta={delta.kind}>
    <header>
      <h2>Что изменилось после добавления {delta.title}</h2>
      <small>{delta.sourcePeriod}</small>
    </header>
    <p>{delta.sourceChanged
      ? "Источник добавлен к текущему анализу; предыдущие данные и версия анализа сохранены."
      : "Источник обновил существующий период текущего анализа."}</p>

    <h3>Новые подтверждённые факты</h3>
    <ul>{delta.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>

    {delta.fullComparisonAvailable
      ? delta.changes.length
        ? <><h3>Изменение итогов</h3><dl className="pc-definition">{delta.changes.map((change) =>
            <div key={change.label}><dt>{change.label}</dt><dd>{change.before} → <b>{change.after}</b></dd></div>)}</dl></>
        : <p>Ключевые итоговые показатели не изменились: новый источник уточнил факты и доказательную базу.</p>
      : <p>Источник сохранён. Сравнение Index, Readiness и Capacity откроется в полном анализе.</p>}

    {delta.reasons.length > 0 && <><h3>Почему вывод уточнился</h3><ul>{delta.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></>}
    <p className="pc-muted">{delta.confidence}</p>
    <a className="pc-text-button" data-source-next={delta.next.code} href={nextHref(analysisId, delta.next)}>{delta.next.label} →</a>
  </section>;
}

export function SourceUpload({analysisId,kind,saved}:{analysisId:string;kind:AnalyticalSourceKind;saved:()=>void|Promise<void>}) {
 const pending=useRef(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false),[fileName,setFileName]=useState(''),[delta,setDelta]=useState<SourceDeltaView|null>(null);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending.current)return;pending.current=true;
  const form=e.currentTarget;setBusy(true);setMessage('');setFailed(false);setDelta(null);
  try{
   const before=await readWorkspaceModel(analysisId);
   const data=new FormData(form);data.set('analysisId',analysisId);data.set('sourceType',kind);
   const r=await fetch('/api/source-documents',{method:'POST',body:data});const body=await r.json();
   if(!r.ok)throw Error(body.error||'Документ не сохранён');
   if(!form.isConnected)return;form.reset();setFileName('');setMessage('Документ сохранён. Обновляем анализ…');await saved();
   const after=await readWorkspaceModel(analysisId);
   if(form.isConnected){
    setMessage('Документ добавлен. Финансовая картина обновлена. Изменения показаны ниже.');
    if(after)setDelta(buildSourceDelta(kind,before,after));
   }
  }catch(e){if(form.isConnected){setFailed(true);setMessage(e instanceof Error?e.message:'Ошибка загрузки');}}
  finally{pending.current=false;if(form.isConnected)setBusy(false);}
 }
 const accept=kind==='BKI'?'.pdf':'.pdf,.xlsx,.csv';
 return <form onSubmit={submit} className="ws-source-upload" id={'source-'+kind.toLowerCase()} aria-busy={busy} aria-label={kind==='BKI'?'Добавить кредитную историю':kind==='BFO'?'Добавить бухгалтерскую отчётность':'Добавить квартальную отчётность'}>
  <h2>{kind==='BKI'?'Добавить кредитную историю':kind==='BFO'?'Добавить бухгалтерскую отчётность':'Добавить квартальную отчётность'}</h2>
  <p>{kind==='BKI'?'PDF с кредитной историей. Обязательства появятся после проверки источника.':kind==='BFO'?'Текстовый PDF, XLSX или CSV: ИНН, годовой период, единица измерения и строки отчётности. Один период в файле; другие годы добавляйте отдельными файлами. Повторная загрузка за тот же период обновит его.':'PDF, XLSX или CSV за промежуточный период. Укажите в файле период и единицу измерения.'}</p>
  <p className="pc-muted">{kind==='BKI'?'До 35 МБ. ':'До 25 МБ. '}PDF должен содержать текст: сканы и фотографии не распознаются.</p>
  {kind==='BKI'&&<label>Кому принадлежит отчёт<select name="relationship"><option>Компания-заёмщик</option><option>ИП-заёмщик</option><option>Собственник</option><option>Руководитель</option><option>Поручитель</option><option>Не указано</option></select></label>}
  <label>Исходный документ
   <span className="pc-file-control">
    <input className="pc-file-native" type="file" name="file" required accept={accept} onChange={e=>setFileName(e.currentTarget.files?.[0]?.name??'')}/>
    <span className="pc-file-button">Выбрать файл</span>
    <span className="pc-file-name">{fileName||'Файл не выбран'}</span>
   </span>
  </label>
  <label className="ws-consent"><input type="checkbox" required/>Подтверждаю право передать документ и согласие на обработку данных.</label>
  <button disabled={busy} className="ws-primary">{busy?'Обрабатываем…':'Загрузить документ'}</button>
  {message&&<p role={failed?'alert':'status'}>{message}</p>}
  {delta&&<SourceDeltaCard delta={delta} analysisId={analysisId}/>} 
 </form>;
}

export function RecipientApplications({analysis,saved}:{analysis:{id:string;companyName:string;companyInn:string};saved:()=>void|Promise<void>}) {
 const pending=useRef(false),request=useRef<{key:string;id:string}|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(pending.current)return;pending.current=true;const form=e.currentTarget,fields=new FormData(form);setBusy(true);setMessage('');try{const applications=String(fields.get('banks')).split(',').map(bank=>({bank:bank.trim(),product:String(fields.get('product')),amount:Number(fields.get('amount'))})).filter(x=>x.bank);const key=JSON.stringify(applications);if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};const r=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'applications',requestId:request.current.id,analysisId:analysis.id,companyName:analysis.companyName,companyInn:analysis.companyInn,consentAt:new Date().toISOString(),applications})});const body=await r.json();if(!r.ok||!body.deals)throw Error(body.error||'Заявки не сохранены');request.current=null;await saved();form.reset();setMessage('Заявки созданы. Брокер проверит документы перед отправкой.');}catch(e){setMessage(e instanceof Error?e.message:'Ошибка сохранения');}finally{pending.current=false;setBusy(false);}}
 return <details className="ws-section"><summary>Подготовить заявки выбранным получателям</summary><form className="ws-source-upload" onSubmit={submit}><p>Укажите получателей самостоятельно или согласуйте их с брокером. Это обычные заявки, без автоматического подбора банка.</p><label>Банки или партнёры через запятую<input name="banks" required/></label><label>Продукт<select name="product"><option>Оборотный кредит</option><option>Контрактный кредит</option><option>Банковская гарантия</option><option>Факторинг</option><option>Лизинг</option><option>Рефинансирование</option></select></label><label>Запрошенная сумма, ₽<input type="number" name="amount" min="1" required/></label><label className="ws-consent"><input type="checkbox" required/>Подтверждаю создание заявок выбранным получателям, полномочия и согласие на подготовку передачи данных. Отправка — после проверки брокером.</label><button disabled={busy} className="ws-primary">{busy?'Сохраняем…':'Создать заявки'}</button>{message&&<p role="status">{message}</p>}</form></details>;
}
