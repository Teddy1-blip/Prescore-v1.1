"use client";
import { ChangeEvent, DragEvent, ReactNode, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, BriefcaseBusiness, Check, Files, Gauge, Landmark, LoaderCircle, LockKeyhole, MessageSquareText, Plus, Search, ShieldCheck, Trash2, UploadCloud, X } from "lucide-react";
import { inspectBankStatement, type AnalysisResult, type StatementInput, type StatementInspection } from "../../../lib/prescore";
import ApplicationChat from "../../dashboard/application-chat";
export type StoredAnalysis = { id: string; companyName: string; companyInn: string; createdAt?: string; periodFrom?: string; periodTo?: string };
const rubles = (n: number) => new Intl.NumberFormat("ru-RU", {maximumFractionDigits:0}).format(n) + " ₽";
const formatDate = (s: string) => s ? s.split("-").reverse().join(".") : "Не указан";
export type Deal = {
  id: string; analysisId: string; companyName: string; product: string; amount: number;
  status: string; owner: string; nextAction: string; bank?: string; applicationGroupId?: string;
  consentAt?: string; createdAt?: string; updatedAt?: string;
  statusHistory?: Array<{ id: string; fromStatus: string; toStatus: string; actorRole: string; publicComment: string; createdAt: string }>;
};

function PageHeading({ kicker, title, body, action }: { kicker: string; title: string; body: string; action?: ReactNode }) {
  return <div className="ps-heading"><div><span>{kicker}</span><h1>{title}</h1><p>{body}</p></div>{action}</div>;
}

export function Analyze({ onResult }: { onResult: (result: AnalysisResult) => void | Promise<void> }) {
  const supportEmail = "support@prescore.ru";
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [statements, setStatements] = useState<Array<StatementInput & { inspection: StatementInspection }>>([]);
  const [rejectedFiles, setRejectedFiles] = useState<Array<{ fileName: string; reason: string }>>([]);

  async function calculate(inputs: StatementInput[]) {
    setProcessing(true); setError("");
    try {
      const response = await fetch("/api/analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statements: inputs }) });
      const payload = await response.json() as { analysis?: AnalysisResult; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "Серверный расчёт не выполнен");
      const result = payload.analysis;
      await onResult(result);
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось разобрать файл"); }
    finally { setProcessing(false); }
  }

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setError(""); setRejectedFiles([]);
    const availableSlots = Math.max(0, 30 - statements.length);
    const selectedFiles = files.slice(0, availableSlots);
    if (files.length > availableSlots) setError("За один анализ можно объединить до 30 выписок.");
    const checked = await Promise.all(selectedFiles.map(async (file) => {
      if (file.size > 15 * 1024 * 1024) return { rejected: true as const, fileName: file.name, reason: "Размер файла превышает 15 МБ." };
      try {
        const buffer = await file.arrayBuffer();
        let text = new TextDecoder("utf-8").decode(buffer);
        if (!text.toLowerCase().includes("1cclientbankexchange") || text.includes("�")) text = new TextDecoder("windows-1251").decode(buffer);
        const inspection = inspectBankStatement(text, file.name);
        if (!inspection.companyInn) return { rejected: true as const, fileName: file.name, reason: "Не удалось определить владельца счёта или в файле отсутствуют операции." };
        return { rejected: false as const, text, fileName: file.name, inspection };
      } catch (caught) {
        const detail = caught instanceof Error && /ни одного документа|операц/i.test(caught.message)
          ? "В файле не найдено банковских операций."
          : "Формат этой банковской выписки пока не поддерживается.";
        return { rejected: true as const, fileName: file.name, reason: detail };
      }
    }));
    const rejected = checked.filter((item): item is Extract<typeof item, { rejected: true }> => item.rejected);
    const recognized = checked.filter((item): item is Extract<typeof item, { rejected: false }> => !item.rejected);
    const anchorInn = statements[0]?.inspection.companyInn || recognized[0]?.inspection.companyInn || "";
    const accepted = anchorInn ? recognized.filter((item) => item.inspection.companyInn === anchorInn) : [];
    setRejectedFiles([...rejected.map((item) => ({ fileName: item.fileName, reason: item.reason })), ...recognized.filter((item) => item.inspection.companyInn !== anchorInn).map((item) => ({ fileName: item.fileName, reason: "Нельзя объединять выписки разных ИНН." }))]);
    if (accepted.length) {
      setStatements((current) => {
        const keys = new Set(current.map((item) => `${item.fileName}:${item.inspection.accounts.join(",")}`));
        return [...current, ...accepted.filter((item) => !keys.has(`${item.fileName}:${item.inspection.accounts.join(",")}`))];
      });
    }
    if (input.current) input.current.value = "";
  }

  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); void addFiles(Array.from(event.dataTransfer.files)); }
  return <>
    <PageHeading kicker="БАНКОВСКИЕ ВЫПИСКИ" title="Соберите банковский поток компании" body="Каждый расчёт сохраняется отдельной версией. После загрузки вы увидите поступления, платежи и доступные факты о ликвидности. Подробную интерпретацию можно открыть позже." />
    <div className="ps-upload-layout">
      <section className="ps-card ps-upload-card">
        <div className={dragging ? "ps-dropzone dragging" : "ps-dropzone"} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
          <input ref={input} multiple type="file" accept=".txt,text/plain" onChange={(event: ChangeEvent<HTMLInputElement>) => void addFiles(Array.from(event.target.files ?? []))} />
          {processing ? <><LoaderCircle className="spin" /><h2>Объединяем банковский поток…</h2><p>Проверяем ИНН, убираем дубли и внутренние переводы, рассчитываем кредитные метрики.</p></> : <><UploadCloud /><span>1CCLIENTBANKEXCHANGE TXT</span><h2>{statements.length ? "Добавьте выписки из других банков" : "Перетащите одну или несколько выписок"}</h2><p>Можно выбрать сразу несколько файлов одного клиента. До 30 выписок, 15 МБ каждая, Windows-1251 или UTF-8.</p><button onClick={() => input.current?.click()}>{statements.length ? "Добавить ещё файлы" : "Выбрать TXT-файлы"}</button></>}
        </div>
        {statements.length > 0 && <div className="ps-statement-list"><div className="ps-statement-list-head"><span><Files /><b>Собрано выписок: {statements.length}</b><small>Компания: {statements[0].inspection.companyName} · ИНН {statements[0].inspection.companyInn}</small></span><button onClick={() => { setStatements([]); setRejectedFiles([]); setError(""); }}>Очистить</button></div>{statements.map((item, index) => <article key={`${item.fileName}-${index}`}><i>{index + 1}</i><span><b>{item.inspection.bankName}</b><small>{item.fileName}</small><em>{formatDate(item.inspection.periodFrom)} — {formatDate(item.inspection.periodTo)} · счетов {item.inspection.accounts.length}</em></span><button aria-label={`Удалить ${item.fileName}`} onClick={() => setStatements((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></article>)}<button className="ps-analyze-files-button" disabled={processing} onClick={() => calculate(statements.map(({ text, fileName }) => ({ text, fileName })))}><Gauge /> Рассчитать по {statements.length} {statements.length === 1 ? "выписке" : "выпискам"} <ArrowRight /></button></div>}
        {rejectedFiles.length > 0 && <div className="ps-rejected-statements">{rejectedFiles.map((item) => <div className="ps-upload-error" key={item.fileName}><AlertTriangle /><span><b>Выписка «{item.fileName}» не распознана</b><small>{item.reason} Отправьте её на <a href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Нераспознанная выписка ${item.fileName}`)}`}>{supportEmail}</a> — мы проверим формат.</small></span></div>)}</div>}
        {error && <div className="ps-upload-error"><AlertTriangle /><span><b>Файл не добавлен</b><small>{error}</small></span></div>}
      </section>
      <aside className="ps-upload-side"><div className="ps-card"><LockKeyhole /><h3>Защищённая обработка</h3><p>TXT передаётся в защищённый серверный модуль для расчёта. Исходный файл не сохраняется; в кабинете остаются нормализованные операции, агрегаты и доказательства выводов согласно Политике конфиденциальности.</p></div><div className="ps-card ps-source-status"><h3>Что уже учитывает анализ</h3><span className="ready"><Check /> Несколько банков и счетов <b>готово</b></span><span className="ready"><Check /> Операционная выручка без кредитов и переводов <b>готово</b></span><span className="ready"><Check /> ЕГРЮЛ, официальная БФО и Правовой контур <b>подключено</b></span><span className="ready"><Check /> Маршруты по банкам <b>подключено</b></span><span className="ready"><Landmark /> СБ БКИ / НБКИ PDF <b>с отдельным согласием</b></span></div></aside>
    </div>
  </>;
}

export function Crm({ deals, analyses, selected, addDeal, updateDeal }: { deals: Deal[]; analyses: StoredAnalysis[]; selected: StoredAnalysis | null; addDeal: (deal: Omit<Deal, "id">) => void; updateDeal: (id: string, status: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chatDeal, setChatDeal] = useState<Deal | null>(null);
  const shown = deals.filter((deal) => `${deal.companyName} ${deal.product}`.toLowerCase().includes(query.toLowerCase()));
  const total = deals.reduce((sum, deal) => sum + deal.amount, 0);
  return <><PageHeading kicker="ЗАЯВКИ В БАНКИ" title="Все обращения в одном месте" body="Название продукта — основа карточки заявки. По каждому выбранному банку ведутся отдельный статус, история, комплект документов и чат с брокером." action={<button className="ps-primary-button" onClick={() => setOpen(!open)}><Plus /> Новая заявка</button>} /><div className="ps-crm-kpis"><span><small>ЗАЯВОК</small><b>{deals.length}</b></span><span><small>ЗАПРОШЕНО</small><b>{rubles(total)}</b></span><span><small>В БАНКАХ</small><b>{deals.filter((deal) => ["Отправлена в банк", "На рассмотрении у финансового партнёра", "Предварительное решение"].includes(deal.status)).length}</b></span><span><small>ОДОБРЕНО</small><b>{deals.filter((deal) => deal.status === "Одобрена").length}</b></span></div>{open && <DealForm analyses={analyses} selected={selected} close={() => setOpen(false)} submit={(deal) => { addDeal(deal); setOpen(false); }} />}<section className="ps-card ps-crm-table"><div className="ps-crm-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Банк, компания или продукт" /></label><span><ShieldCheck /> Статус меняет брокер; передача — только после согласия</span></div>{shown.length ? <div className="ps-table-scroll"><table><thead><tr><th>Заявка / клиент</th><th>Банк или партнёр</th><th>Сумма</th><th>Следующий шаг</th><th>Статус и история</th><th>Действия</th></tr></thead><tbody>{shown.map((deal) => <tr key={deal.id}><td><b>{deal.product}</b><small>{deal.companyName}</small></td><td><b>{deal.bank || "Выбирается"}</b><small>{deal.owner}</small></td><td><strong>{rubles(deal.amount)}</strong></td><td>{deal.nextAction}</td><td><span className="ps-application-status">{deal.status}</span><details className="ps-status-history"><summary>История · {deal.statusHistory?.length ?? 0}</summary>{deal.statusHistory?.map((item) => <p key={item.id}><b>{item.toStatus}</b><small>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))} · {item.publicComment}</small></p>)}</details></td><td><div className="ps-application-actions"><button className="ps-chat-open" onClick={() => setChatDeal(deal)}><MessageSquareText /> Чат</button>{!["Выдана", "Закрыта", "Отклонена", "Отменена клиентом"].includes(deal.status) && <button className="ps-cancel-application" onClick={() => window.confirm("Отменить заявку?") && updateDeal(deal.id, "Отменена клиентом")}>Отменить</button>}</div></td></tr>)}</tbody></table></div> : <div className="ps-empty-crm"><BriefcaseBusiness /><h3>Заявок пока нет</h3><p>Создайте обращение из подходящего маршрута или добавьте его вручную.</p><button onClick={() => setOpen(true)}>Создать первую заявку</button></div>}</section>{chatDeal && <ApplicationChat applicationId={chatDeal.id} title={`${chatDeal.product} · ${chatDeal.bank || "выбор банка"}`} companyInn={selected?.companyInn || ""} analysisId={chatDeal.analysisId} role="client" close={() => setChatDeal(null)} />}</>;
}

function DealForm({ analyses, selected, initialProduct, close, submit }: { analyses: StoredAnalysis[]; selected: StoredAnalysis | null; initialProduct?: string; close: () => void; submit: (deal: Omit<Deal, "id">) => void }) {
  const [analysisId, setAnalysisId] = useState(selected?.id ?? analyses[0]?.id ?? "");
  const [product, setProduct] = useState(initialProduct || "Оборотная линия");
  const [bank, setBank] = useState("");
  const [amount, setAmount] = useState(0);
  const [nextAction, setNextAction] = useState("Собрать документы и выбрать 3 партнёров");
  const company = analyses.find((item) => item.id === analysisId) ?? selected;
  return <div className="ps-deal-form ps-card"><div><span><small>НОВАЯ ЗАЯВКА В БАНК</small><h2>Подготовить обращение</h2></span><button onClick={close}><X /></button></div><div className="ps-form-grid"><label>Компания<select value={analysisId} onChange={(event) => setAnalysisId(event.target.value)}>{analyses.map((item) => <option key={item.id} value={item.id}>{item.companyName}</option>)}</select></label><label>Банк или партнёр<input value={bank} onChange={(event) => setBank(event.target.value)} placeholder="Можно выбрать позже" /></label><label>Продукт<select value={product} onChange={(event) => setProduct(event.target.value)}><option>Оборотная линия</option><option>Контрактный кредит</option><option>Овердрафт</option><option>Факторинг</option><option>Рефинансирование</option><option>Лизинг</option><option>Банковская гарантия</option></select></label><label>Сумма, ₽<input type="number" min="0" step="10000" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><label>Следующее действие<input value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></label></div><div className="ps-form-actions"><button onClick={close}>Отмена</button><button disabled={!company} onClick={() => company && submit({ analysisId: company.id, companyName: company.companyName, product, bank, amount, status: "Черновик", owner: "Клиент", nextAction: nextAction || "Выбрать банк и проверить документы" })}>Создать черновик <ArrowRight /></button></div><p className="ps-legal-line">Создание черновика не передаёт данные в банк. Перед отправкой потребуется отдельное согласие клиента.</p></div>;
}
