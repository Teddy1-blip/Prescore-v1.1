"use client";

import {
  AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, Download, FileSearch, Gauge, Landmark,
  LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, UploadCloud, WalletCards,
} from "lucide-react";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import {
  compareCreditPortfolio, parseCreditHistoryText,
  type CreditHistoryReport, type CreditObligation, type CreditPortfolioComparison, type CreditSubjectRelationship,
} from "../../lib/credit-history";
import { buildPaymentCalendar, creditWorkbook, downloadXlsx } from "../../lib/excel-export";

type CreditAnalysisContext = {
  id: string;
  companyName: string;
  companyInn: string;
  metrics: {
    avgMonthlyInflow: number;
    currentMonthlyDebtPayment: number;
    baseMonthlyPaymentCapacity: number;
    estimatedLimitMax: number;
    limitConfidence: number;
  };
  creditHistory?: CreditHistoryReport;
  creditPortfolioComparison?: CreditPortfolioComparison;
};

type TextItem = { str?: string; width?: number; transform?: number[] };

const rubles = (value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
const compact = (value: number) => new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value) + " ₽";
const formatDate = (value: string) => value ? new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00`)) : "—";

function money(value: number | null) { return value === null ? "Нет данных" : rubles(value); }
function rate(item: CreditObligation) { return item.annualRate === null ? "Нет данных" : `${item.annualRate.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}%`; }
function qualityTone(value: string) { return value === "Без просрочек" ? "good" : value === "Недостаточно данных" ? "neutral" : "bad"; }

function pageText(items: TextItem[]) {
  const rows: Array<{ y: number; items: Array<{ x: number; width: number; text: string }> }> = [];
  for (const item of items) {
    if (!item.str) continue;
    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 2);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ x, width: item.width ?? 0, text: item.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((row) => {
    row.items.sort((a, b) => a.x - b.x);
    let line = "";
    let right: number | null = null;
    for (const item of row.items) {
      if (right !== null) {
        const gap = item.x - right;
        if (gap > 1) line += " ".repeat(Math.max(1, Math.min(24, Math.round(gap / 3.6))));
      }
      line += item.text;
      right = item.x + item.width;
    }
    return line.trimEnd();
  }).join("\n");
}

async function extractPdfText(file: File, progress: (value: number) => void) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(pageText(content.items as TextItem[]));
    progress(Math.round(pageNumber / document.numPages * 100));
  }
  return pages.join("\n\f\n");
}

function buildComparison(report: CreditHistoryReport, analysis: CreditAnalysisContext) {
  return compareCreditPortfolio({
    report,
    avgMonthlyInflow: analysis.metrics.avgMonthlyInflow,
    statementMonthlyDebtPayment: analysis.metrics.currentMonthlyDebtPayment,
    baseMonthlyPaymentCapacity: analysis.metrics.baseMonthlyPaymentCapacity,
    estimatedLimitMax: analysis.metrics.estimatedLimitMax,
    limitConfidence: analysis.metrics.limitConfidence,
  });
}

export default function CreditHistory({
  analysis,
  onAttach,
  readOnly = false,
}: {
  analysis: CreditAnalysisContext | null;
  readOnly?: boolean;
  onAttach: (file: File, relationship: CreditSubjectRelationship) => Promise<CreditHistoryReport>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [report, setReport] = useState<CreditHistoryReport | null>(analysis?.creditHistory ?? null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [relationship, setRelationship] = useState<CreditSubjectRelationship>(analysis?.creditHistory?.relationshipToCompany ?? "Не указано");
  const [saved, setSaved] = useState(Boolean(analysis?.creditHistory));

  async function parse(file?: File) {
    if (!file || readOnly) return;
    if (!consent) { setError("Подтвердите законное основание и согласие субъекта до загрузки отчёта БКИ."); return; }
    if (!file.name.toLowerCase().endsWith(".pdf")) { setError("Поддерживается текстовый PDF отчёта СБ БКИ или НБКИ."); return; }
    if (file.size > 35 * 1024 * 1024) { setError("PDF больше 35 МБ. Загрузите отчёт меньшего размера."); return; }
    setProcessing(true); setProgress(0); setError(""); setSaved(false);
    try {
      const text = await extractPdfText(file, setProgress);
      const parsed = parseCreditHistoryText(text, file.name);
      setReport(parsed);
      setSourceFile(file);
      setRelationship(parsed.relationshipToCompany);
    } catch (caught) {
      setReport(null);
      setSourceFile(null);
      setError(caught instanceof Error ? caught.message : "Не удалось разобрать отчёт БКИ.");
    } finally {
      setProcessing(false);
      if (input.current) input.current.value = "";
    }
  }

  async function attach() {
    if (!report || !analysis || !sourceFile) return;
    if (report.subjectType === "Физическое лицо" && relationship === "Не указано") { setError("Укажите роль физического лица относительно компании. Личный и корпоративный долг нельзя смешивать."); return; }
    setProcessing(true); setError("");
    try {
      const verified = await onAttach(sourceFile, report.subjectType === "Юридическое лицо" ? "Компания-заёмщик" : relationship);
      setReport(verified);
      setSourceFile(null);
      setSaved(true);
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось добавить БКИ к анализу."); }
    finally { setProcessing(false); }
  }

  function drop(event: DragEvent) {
    event.preventDefault(); setDragging(false);
    void parse(event.dataTransfer.files[0]);
  }

  const mismatch = Boolean(report && analysis && report.subjectType === "Юридическое лицо" && report.subjectInn && analysis.companyInn && report.subjectInn !== analysis.companyInn);
  const relationshipMissing = Boolean(report?.subjectType === "Физическое лицо" && relationship === "Не указано");
  const reportForAnalysis = report ? { ...report, relationshipToCompany: report.subjectType === "Юридическое лицо" ? "Компания-заёмщик" as const : relationship, affectsCompanyDebt: report.subjectType === "Юридическое лицо" || (relationship === "ИП-заёмщик" && analysis?.companyInn.length === 12 && report.subjectInn === analysis.companyInn) } : null;
  const knownOutstanding = report?.obligations.some((item) => item.outstandingPrincipal !== null || item.totalOutstanding !== null) ?? false;
  const knownPayment = report?.obligations.some((item) => item.monthlyPayment !== null || item.nextPaymentAmount !== null) ?? false;
  const combined = reportForAnalysis && analysis ? buildComparison(reportForAnalysis, analysis) : null;
  const comparison = saved && analysis?.creditPortfolioComparison ? analysis.creditPortfolioComparison : combined?.comparison;
  const paymentCalendar = report ? buildPaymentCalendar(report) : [];

  return <>
    <div className="ps-credit-heading">
      <div><span>СЛОЙ C · КРЕДИТНАЯ ИСТОРИЯ</span><h1>БКИ и кредитный портфель</h1><p>Загрузите PDF СБ БКИ или НБКИ. Прескор сформирует реестр обязательств и сверит долг с выписками, БФО и правовым контуром.</p></div>
      {report && <div className="ps-heading-actions"><button className="ps-outline-button" onClick={() => downloadXlsx(`Кредитный_портфель_${report.subjectInn || "БКИ"}.xlsx`, creditWorkbook(report))}><Download /> Портфель и календарь · Excel</button><button className="ps-outline-button" onClick={() => { setReport(null); setSourceFile(null); setSaved(false); }}><RefreshCw /> Другой отчёт</button></div>}
    </div>

    {!report && <div className="ps-credit-upload-layout">
      <section className="ps-card ps-credit-upload-card">
        <label className="ps-credit-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span><b>Подтверждаю законное основание</b><small>Отчёт получен с согласия субъекта кредитной истории либо на ином законном основании. Я вправе передать его для информационно‑аналитической обработки.</small></span></label>
        <div className={`${dragging ? "ps-credit-dropzone dragging" : "ps-credit-dropzone"}${!consent ? " disabled" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
          <input ref={input} type="file" accept=".pdf,application/pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => void parse(event.target.files?.[0])} />
          {processing ? <><LoaderCircle className="spin" /><h2>Разбираем страницы отчёта…</h2><p>{progress}% · выполняется предварительная проверка</p></> : <><UploadCloud /><span>СБ БКИ / НБКИ · PDF</span><h2>Перетащите кредитный отчёт</h2><p>Текстовый PDF до 35 МБ. Исходный документ не сохраняется в серверном хранилище.</p><button disabled={!consent || readOnly} onClick={() => input.current?.click()}>Выбрать PDF</button></>}
        </div>
        {error && <div className="ps-upload-error"><AlertTriangle /><span><b>Отчёт не обработан</b><small>{error}</small></span></div>}
      </section>
      <aside className="ps-credit-side">
        <div className="ps-card"><LockKeyhole /><h3>Данные остаются под контролем</h3><p>Предпросмотр выполняется локально. При добавлении сервер повторно проверяет PDF и сохраняет только структурированные поля портфеля и агрегаты, без исходного файла.</p></div>
        <div className="ps-card"><FileSearch /><h3>Что сформируем</h3><p>Кредитор, продукт, сумма или лимит, остаток, платёж, ставка, просрочка, статус и качество обслуживания долга.</p></div>
      </aside>
    </div>}

    {report && <>
      <section className="ps-card ps-credit-report-head">
        <div className="ps-credit-source-icon"><Landmark /></div>
        <div><small>{report.source} · ДОСТОВЕРНОСТЬ ПАРСИНГА {report.parserConfidence}%</small><h2>{report.subjectName}</h2><p>{report.subjectType}{report.subjectInn ? ` · ИНН ${report.subjectInn}` : ""} · отчёт от {formatDate(report.reportDate)} · {report.fileName}</p></div>
        <aside>{report.bureauScore !== null ? <><strong>{report.bureauScore}</strong><small>рейтинг из {report.bureauScoreMax}</small></> : <><strong>{report.obligations.length}</strong><small>обязательств распознано</small></>}</aside>
      </section>

      {report.subjectType === "Физическое лицо" && <section className="ps-card ps-credit-role"><div><ShieldCheck /><span><b>Связь субъекта БКИ с компанией</b><small>Роль обязательна. Личный долг собственника или руководителя показывается отдельно и не увеличивает долг компании.</small></span></div><select value={relationship} onChange={(event) => setRelationship(event.target.value as CreditSubjectRelationship)}><option value="Не указано">Выберите роль</option><option value="ИП-заёмщик">ИП-заёмщик по этому ИНН</option><option value="Собственник">Собственник / бенефициар</option><option value="Поручитель">Поручитель по обязательствам компании</option><option value="Руководитель">Руководитель</option></select></section>}

      {(mismatch || report.warnings.length > 0 || error) && <div className="ps-credit-warnings">
        {mismatch && <div className="critical"><AlertTriangle /><span><b>ИНН отчёта не совпадает с выбранной компанией</b><small>В БКИ: {report.subjectInn}; в анализе: {analysis?.companyInn}. Такой корпоративный отчёт нельзя объединить с текущим досье.</small></span></div>}
        {report.warnings.map((warning) => <div key={warning}><AlertTriangle /><span><b>Нужна проверка</b><small>{warning}</small></span></div>)}
        {error && <div className="critical"><AlertTriangle /><span><b>Не удалось сохранить</b><small>{error}</small></span></div>}
      </div>}

      <div className="ps-credit-kpis">
        <CreditKpi label="Договоры в отчёте" value={`${report.obligations.length}`} note={`Открыто по сводке: ${report.summary.reportedOpenCount ?? "нет данных"}`} />
        <CreditKpi label="Сумма / лимиты" value={compact(report.summary.originalAmount)} note={report.summary.guaranteeExposure > 0 ? `включая гарантии ${compact(report.summary.guaranteeExposure)}` : "исходные суммы договоров"} />
        <CreditKpi label="Основной долг" value={knownOutstanding ? compact(report.summary.outstandingPrincipal) : "Нет данных"} note="остаток по данным БКИ" />
        <CreditKpi label="Платёж / месяц" value={knownPayment ? compact(report.summary.monthlyPayment) : "Нет данных"} note="по действующим обязательствам" />
        <CreditKpi label="Текущая просрочка" value={rubles(report.summary.overdueAmount)} note={report.summary.overdueAmount > 0 ? "требует устранения" : "не выявлена в отчёте"} tone={report.summary.overdueAmount > 0 ? "bad" : "good"} />
        <CreditKpi label="Средняя ставка" value={report.summary.weightedAnnualRate === null ? "Нет данных" : `${report.summary.weightedAnnualRate.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`} note={`ставок распознано: ${report.summary.knownRatesCount}`} />
        <CreditKpi label="Обслуживание долга" value={report.summary.debtServiceQuality} note="по просрочкам и истории платежей" tone={qualityTone(report.summary.debtServiceQuality)} />
        <CreditKpi label="Запросы кредиторов" value={`${report.summary.inquiries12Months ?? report.summary.inquiries24Months ?? "Нет данных"}`} note={report.summary.inquiries12Months !== null ? "за 12 месяцев" : report.summary.inquiries24Months !== null ? "за 24 месяца" : "период не распознан"} />
      </div>

      <section className="ps-card ps-credit-portfolio">
        <div className="ps-card-title"><span><b>Кредитный портфель</b><small>Неполные поля помечены «Нет данных» — они не считаются нулём</small></span></div>
        <div className="ps-credit-table-wrap"><table><thead><tr><th>Кредитор</th><th>Продукт / роль</th><th>Сумма / лимит</th><th>Остаток</th><th>Платёж</th><th>Ставка</th><th>Просрочка</th><th>Качество</th></tr></thead><tbody>{report.obligations.map((item) => <tr key={item.id}><td><b>{item.creditor}</b><small>{item.status}{item.openedAt ? ` · с ${formatDate(item.openedAt)}` : ""}</small></td><td><b>{item.product}</b><small>{item.role}</small></td><td>{money(item.creditLimit ?? item.originalAmount)}</td><td>{money(item.totalOutstanding ?? item.outstandingPrincipal)}</td><td>{money(item.monthlyPayment ?? item.nextPaymentAmount)}</td><td><b>{rate(item)}</b><small>{item.rateLabel}</small></td><td>{money(item.overdueAmount)}</td><td><span className={`ps-debt-quality ${qualityTone(item.paymentQuality)}`}>{item.paymentQuality}</span></td></tr>)}</tbody></table></div>
      </section>

      <section className="ps-card ps-payment-calendar">
        <div className="ps-card-title"><span><b>Платёжный календарь по кредитам</b><small>Ближайшие 12 месяцев; даты без точного графика отмечены как расчётные</small></span><button className="ps-outline-button" onClick={() => downloadXlsx(`БКИ_и_платежный_календарь_${report.subjectInn || "клиент"}.xlsx`, creditWorkbook(report))}><Download /> Выгрузить Excel</button></div>
        {paymentCalendar.length ? <div className="ps-credit-table-wrap"><table><thead><tr><th>Дата</th><th>Кредитор / продукт</th><th>Платёж</th><th>Остаток по БКИ</th><th>Основание</th><th>Качество</th></tr></thead><tbody>{paymentCalendar.map((item, index) => <tr key={`${item.date}-${item.creditor}-${index}`}><td><b>{formatDate(item.date)}</b></td><td><b>{item.creditor}</b><small>{item.product}</small></td><td>{rubles(item.amount)}</td><td>{item.principalBalance == null ? "Нет данных" : rubles(item.principalBalance)}</td><td><span className={item.basis === "Дата из БКИ" ? "ps-calendar-basis actual" : "ps-calendar-basis"}>{item.basis}</span></td><td><span className={`ps-debt-quality ${qualityTone(item.quality)}`}>{item.quality}</span></td></tr>)}</tbody></table></div> : <div className="ps-calendar-empty"><CalendarDays /><span><b>Календарь пока не рассчитан</b><small>В отчёте нет распознанной суммы регулярного или следующего платежа. Добавьте графики кредиторов для точных дат.</small></span></div>}
        <p className="ps-legal-disclaimer">Расчётный календарь предназначен для планирования ликвидности. Он не заменяет графики платежей по кредитным договорам; суммы и даты необходимо сверять с кредиторами.</p>
      </section>

      {analysis && comparison && <section className="ps-card ps-credit-combined">
        <div className="ps-card-title"><span><b>Совместный вывод: выписки + БКИ + БФО + Правовой контур</b><small>БКИ не меняет основной индекс автоматически, а уточняет долговую ёмкость отдельным слоем C</small></span></div>
        <div className="ps-credit-compare-grid">
          <span><small>Платёж по выпискам</small><b>{rubles(comparison.statementMonthlyDebtPayment)}</b></span>
          <span><small>Платёж по БКИ</small><b>{comparison.bureauMonthlyPaymentKnown ? rubles(comparison.bureauMonthlyDebtPayment) : "Нет данных"}</b></span>
          <span><small>Подтверждённый платёж</small><b>{rubles(comparison.confirmedMonthlyDebtPayment)}</b></span>
          <span><small>Не виден в выписках</small><b>{comparison.bureauMonthlyPaymentKnown ? rubles(comparison.paymentNotVisibleInStatements) : "Не рассчитано"}</b></span>
          <span><small>Новая платёжная ёмкость</small><b>{rubles(comparison.adjustedMonthlyPaymentCapacity)}</b></span>
          <span className="accent"><small>Диапазон после учёта БКИ</small><b>до {rubles(comparison.adjustedLimitMax)}</b></span>
        </div>
        <div className="ps-credit-insights">{combined?.insights.map((item) => <article className={item.tone} key={item.title}><header><i /><span><small>{item.tone === "positive" ? "ПОЛОЖИТЕЛЬНЫЙ ФАКТОР" : item.tone === "critical" ? "КРИТИЧЕСКИЙ СИГНАЛ" : item.tone === "warning" ? "НУЖНА СВЕРКА" : "ОГРАНИЧЕНИЕ ДАННЫХ"}</small><h3>{item.title}</h3></span></header><p><b>Факт:</b> {item.facts}</p><p><b>Влияние:</b> {item.impact}</p><p><b>Действие:</b> {item.action}</p></article>)}</div>
        <div className="ps-credit-layer-strip"><span><Check /> B · Выписки</span><span><Gauge /> F · БФО</span><span><ShieldCheck /> L · Правовой контур</span><span className="active"><WalletCards /> C · БКИ</span></div>
        <p className="ps-legal-disclaimer">Результат носит исключительно информационно‑аналитический характер. Это не банковское решение, не гарантия одобрения, не кредитный рейтинг банка и не оферта. Итоговые условия и лимит определяет кредитор после собственной проверки.</p>
        <button className="ps-credit-attach" disabled={readOnly || mismatch || relationshipMissing || processing || saved || !sourceFile} onClick={() => void attach()}>{saved ? <><CheckCircle2 /> БКИ добавлено в анализ</> : <><WalletCards /> Добавить портфель к текущему анализу <ArrowRight /></>}</button>
      </section>}

      {!analysis && <div className="ps-analytic-note"><AlertTriangle /><span><b>Портфель сформирован отдельно</b><small>Чтобы сверить платежи и уточнить расчётный лимит, сначала выполните анализ банковских выписок выбранной компании.</small></span></div>}
    </>}
  </>;
}

function CreditKpi({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) {
  return <article className={tone}><small>{label}</small><strong>{value}</strong><span>{note}</span></article>;
}
