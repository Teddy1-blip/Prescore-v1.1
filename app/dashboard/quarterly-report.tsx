"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { strFromU8, unzipSync } from "fflate";
import { parseQuarterlyReportText, type QuarterlyFinancialReport } from "../../lib/quarterly-report";

type Context = { id: string; companyName: string; companyInn: string; quarterlyReport?: QuarterlyFinancialReport };
type TextItem = { str?: string; width?: number; transform?: number[] };
const money = (value: number | null) => value == null ? "Нет данных" : new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);

function pageText(items: TextItem[]) {
  const rows: Array<{ y: number; items: Array<{ x: number; width: number; text: string }> }> = [];
  for (const item of items) {
    if (!item.str) continue;
    const x = item.transform?.[4] ?? 0; const y = item.transform?.[5] ?? 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 2);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ x, width: item.width ?? 0, text: item.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ")).join("\n");
}

async function pdfText(file: File, progress: (value: number) => void) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber); const content = await page.getTextContent();
    pages.push(pageText(content.items as TextItem[])); progress(Math.round(pageNumber / document.numPages * 100));
  }
  return pages.join("\n");
}

function decodeXml(value: string) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
}

async function xlsxText(file: File) {
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const sharedXml = archive["xl/sharedStrings.xml"] ? strFromU8(archive["xl/sharedStrings.xml"]) : "";
  const shared = [...sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) => decodeXml([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => item[1]).join("")));
  const sheets = Object.keys(archive).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();
  if (!sheets.length) throw new Error("В Excel не найдены листы с данными.");
  const lines: string[] = [];
  for (const sheet of sheets) {
    const xml = strFromU8(archive[sheet]);
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const cell of row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cell[1]; const body = cell[2]; const raw = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
        const value = /\bt=["']s["']/.test(attrs) ? shared[Number(raw)] ?? "" : decodeXml(raw);
        if (value.trim()) cells.push(value.trim());
      }
      if (cells.length) lines.push(cells.join(" "));
    }
  }
  return lines.join("\n");
}

async function csvText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const utf = new TextDecoder("utf-8").decode(bytes);
  if (!utf.includes("�")) return utf.replace(/[;\t]/g, " ");
  return new TextDecoder("windows-1251").decode(bytes).replace(/[;\t]/g, " ");
}

export default function QuarterlyReport({ analysis, onAttach }: { analysis: Context; onAttach: (file: File) => Promise<QuarterlyFinancialReport> }) {
  const input = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<QuarterlyFinancialReport | null>(analysis.quarterlyReport ?? null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false); const [dragging, setDragging] = useState(false); const [progress, setProgress] = useState(0); const [error, setError] = useState(""); const [saved, setSaved] = useState(Boolean(analysis.quarterlyReport)); const [confirmed, setConfirmed] = useState(false);
  const reportInnMismatch = Boolean(report?.companyInn && analysis.companyInn && report.companyInn !== analysis.companyInn.replace(/\D/g, ""));

  async function parse(file?: File) {
    if (!file) return;
    if (!confirmed) { setError("Подтвердите право на обработку корпоративной отчётности."); return; }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".xlsx") && !name.endsWith(".csv")) { setError("Поддерживаются читаемые PDF, Excel .xlsx и CSV. Старый .xls сохраните как .xlsx. Фото и сканы без текстового слоя не обрабатываются."); return; }
    if (file.size > 25 * 1024 * 1024) { setError("Файл больше 25 МБ. Загрузите более компактную выгрузку."); return; }
    setProcessing(true); setProgress(5); setError(""); setSaved(false);
    try {
      const text = name.endsWith(".pdf") ? await pdfText(file, setProgress) : name.endsWith(".xlsx") ? await xlsxText(file) : await csvText(file);
      setProgress(90); setReport(parseQuarterlyReportText(text, file.name)); setSourceFile(file); setProgress(100);
    } catch (caught) { setReport(null); setSourceFile(null); setError(caught instanceof Error ? caught.message : "Не удалось разобрать отчётность."); }
    finally { setProcessing(false); if (input.current) input.current.value = ""; }
  }

  async function attach() {
    if (!report || !sourceFile) return; setProcessing(true); setError("");
    if (reportInnMismatch) { setProcessing(false); setError(`ИНН в отчётности (${report.companyInn}) не совпадает с ИНН выбранной компании (${analysis.companyInn}). Файл нельзя включить в это досье.`); return; }
    try { const verified = await onAttach(sourceFile); setReport(verified); setSourceFile(null); setSaved(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось сохранить квартальный анализ."); }
    finally { setProcessing(false); }
  }
  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); void parse(event.dataTransfer.files[0]); }

  return <section className="ps-quarterly ps-card">
    <div className="ps-quarterly-head"><div><span><FileSpreadsheet /> ОПЕРАТИВНЫЙ СЛОЙ · КВАРТАЛЬНАЯ ОТЧЁТНОСТЬ</span><h2>Проверка промежуточного баланса до банка</h2><p>Отдельная Q‑оценка актуального периода. Она дополняет официальную БФО, но не заменяет её и не меняет F‑Score без подтверждения.</p></div>{report && <button className="ps-outline-button" onClick={() => { setReport(null); setSourceFile(null); setSaved(false); }}><RefreshCw /> Другой файл</button>}</div>
    {!report && <div className="ps-quarterly-upload-layout"><div><label className="ps-quarterly-consent"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><b>Подтверждаю право на обработку файла</b><small>Отчётность относится к выбранной компании и передана для информационно-аналитической проверки на законном основании.</small></span></label><div className={`${dragging ? "ps-quarterly-drop dragging" : "ps-quarterly-drop"}${!confirmed ? " disabled" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}><input ref={input} type="file" accept=".pdf,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event: ChangeEvent<HTMLInputElement>) => void parse(event.target.files?.[0])} />{processing ? <><LoaderCircle className="spin" /><h3>Разбираем строки отчётности…</h3><p>{progress}% · выполняется предварительная проверка</p></> : <><UploadCloud /><b>PDF с текстовым слоем · XLSX · CSV</b><h3>Перетащите квартальную отчётность</h3><p>Фото и сканированные PDF без текста не принимаются — OCR намеренно не используется.</p><button disabled={!confirmed} onClick={() => input.current?.click()}>Выбрать файл</button></>}</div></div><aside><LockKeyhole /><h3>Что проверим</h3><p>Капитал и чистые активы, прибыль, ликвидность, оборотный капитал, долю дебиторки и нагрузку кредиторской задолженности.</p><ShieldCheck /><h3>Без подгонки отчётности</h3><p>Прескор прогнозирует реакцию банка на текущие данные и просит расшифровки, но не советует менять достоверные показатели ради кредита.</p></aside></div>}
    {error && <div className="ps-upload-error"><AlertTriangle /><span><b>Файл не обработан</b><small>{error}</small></span></div>}
    {report && <div className="ps-quarterly-result"><header className={report.verdictCode.toLowerCase()}><div><small>Q‑ОЦЕНКА · {report.verdictCode} · ДОСТОВЕРНОСТЬ ПАРСИНГА {report.parserConfidence}%</small><h3>{report.verdict}</h3><p>{report.companyName ? `${report.companyName} · ` : ""}{report.companyInn ? `ИНН ${report.companyInn} · ` : ""}{report.period} · {report.fileName} · единица: {report.unitLabel}</p></div><strong>{report.verdictCode === "READY" ? "Можно сверять" : report.verdictCode === "REVIEW" ? "Нужна проверка" : "Высокий риск"}</strong></header>{reportInnMismatch && <div className="ps-upload-error"><AlertTriangle /><span><b>Отчётность другой компании</b><small>ИНН файла {report.companyInn} не совпадает с ИНН досье {analysis.companyInn}. Результат можно посмотреть, но нельзя добавить в общий анализ.</small></span></div>}<div className="ps-quarterly-kpis"><span><small>Выручка</small><b>{money(report.values.revenue)}</b></span><span><small>Чистая прибыль</small><b className={(report.values.netProfit ?? 0) < 0 ? "bad" : ""}>{money(report.values.netProfit)}</b></span><span><small>Чистые активы / капитал</small><b className={(report.values.netAssets ?? 0) <= 0 ? "bad" : ""}>{money(report.values.netAssets)}</b></span><span><small>Текущая ликвидность</small><b className={(report.ratios.currentLiquidity ?? 2) < .8 ? "bad" : ""}>{report.ratios.currentLiquidity ?? "—"}</b></span><span><small>Дебиторка / активы</small><b>{report.ratios.receivablesToAssets == null ? "—" : `${Math.round(report.ratios.receivablesToAssets * 100)}%`}</b></span><span><small>Кредиторка</small><b>{money(report.values.payables)}</b></span></div><div className="ps-quarterly-conclusion"><AlertTriangle /><span><b>{report.conclusion}</b><p>{report.submissionAdvice}</p></span></div><div className="ps-quarterly-factors">{report.factors.map((factor) => <article key={factor.title} className={factor.severity}>{factor.severity === "info" ? <CheckCircle2 /> : <AlertTriangle />}<div><small>{factor.severity === "critical" ? "ОТКАЗНОЙ РИСК" : factor.severity === "warning" ? "ТРЕБУЕТ РАСШИФРОВКИ" : "ПРОВЕРЕНО"}</small><h4>{factor.title}</h4><p><b>Факт:</b> {factor.evidence}</p><p><b>Как посмотрит банк:</b> {factor.bankImpact}</p><p><b>До подачи:</b> {factor.nextStep}</p></div></article>)}</div>{report.warnings.map((warning) => <p className="ps-quarterly-warning" key={warning}><AlertTriangle />{warning}</p>)}<div className="ps-quarterly-actions"><span>{saved ? <><CheckCircle2 /> Q‑оценка добавлена в кредитное досье</> : reportInnMismatch ? "Сначала выберите досье с тем же ИНН" : "Сохранится только структурированный результат без исходного файла"}</span><button disabled={processing || saved || reportInnMismatch || !sourceFile} onClick={attach}>{saved ? "Добавлено" : "Добавить в общий анализ"}</button></div></div>}
  </section>;
}
