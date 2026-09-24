"use client";

import Link from "next/link";
import {WorkspaceShell, WorkspaceHeading, clientNav} from '../workspace-v3/shell';
import {useCanonicalReport,ReportStateView,CanonicalSummary,CanonicalPortfolio,CanonicalFinancing,SourceCards,reportHref} from '../workspace-v3/canonical';
import {AnalysisV3} from './report-v2/analysis-v3';
import {
  AlertTriangle, ArrowRight, BadgeRussianRuble, BriefcaseBusiness, Building2,
  Check, CheckCircle2, ChevronRight, CircleHelp, Database, FilePlus2, FileSearch,
  Download, Files, Gauge, Landmark, LayoutDashboard, LoaderCircle, LockKeyhole, Menu, Plus,
  MessageSquareText, RefreshCw, Search, ShieldCheck, Sparkles, Target, UploadCloud, UserRound,
  WalletCards, X, Zap, Trash2,
} from "lucide-react";
import { ChangeEvent, DragEvent, ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import "./dashboard.css";
import {
  type AnalysisResult, type StatementInput, type StatementInspection,
  inspectBankStatement,
} from "../../lib/prescore";
import CheckoProfile from "./checko-profile";
import BankOffers from "./bank-offers";
import CreditHistory from "./credit-history";
import type { CreditHistoryReport, CreditSubjectRelationship } from "../../lib/credit-history";
import type { QuarterlyFinancialReport } from "../../lib/quarterly-report";
import { buildActionPlan } from "../../lib/action-plan";
import { creditPolicyLayerCounts, creditPolicySummary } from "../../lib/credit-policy";
import { cashFlowWorkbook, downloadXlsx } from "../../lib/excel-export";
import DocumentsHub from "./documents-hub";
import ApplicationChat from "./application-chat";
import AiAnalyst from "./ai-analyst";
import FreeCompanyProfile from "./free-company-profile";
import { metricControlKey } from "../../lib/admin-controls";
import "../prescore-ui-v1.css";

type View = "overview" | "analyze" | "report" | "credit" | "company" | "offers" | "analyst" | "crm" | "documents" | "method";
const subscribeView = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};
const readView = (): View => {
  const requested = new URLSearchParams(window.location.search).get("view");
  const allowed: View[] = ["overview", "analyze", "report", "credit", "company", "offers", "analyst", "crm", "documents", "method"];
  return allowed.includes(requested as View) ? requested as View : "overview";
};
type StoredAnalysis = Omit<AnalysisResult, "transactions"> & {
  transactions?: AnalysisResult["transactions"];
  viewTier?: "FREE" | "FULL";
  lockedSummary?: { riskCount: number; visibleRiskCount: number; recommendationCount: number; productCount: number; hasCreditHistory: boolean; hasQuarterlyReport: boolean };
  freeFacts?: { netCashFlow: number; taxPayments: number; creditPayments: number; leasingPayments: number; personalTransfers: number; largestRecipients: Array<{ name: string; amount: number; share: number }> };
};
type Deal = {
  id: string; analysisId: string; companyName: string; product: string; amount: number;
  status: string; owner: string; nextAction: string; bank?: string; applicationGroupId?: string;
  consentAt?: string; createdAt?: string; updatedAt?: string;
  statusHistory?: Array<{ id: string; fromStatus: string; toStatus: string; actorRole: string; publicComment: string; createdAt: string }>;
};

const nav: Array<{ id: View; label: string; icon: ReactNode }> = [
  { id: "overview", label: "Обзор", icon: <LayoutDashboard /> },
  { id: "analyze", label: "Новый анализ", icon: <FileSearch /> },
  { id: "report", label: "Полный анализ", icon: <Gauge /> },
  { id: "credit", label: "БКИ и портфель", icon: <WalletCards /> },
  { id: "company", label: "Компания и отчётность", icon: <Building2 /> },
  { id: "offers", label: "Предложения банков", icon: <Landmark /> },
  { id: "analyst", label: "Кредитный аналитик", icon: <Sparkles /> },
  { id: "crm", label: "Заявки в банки", icon: <BriefcaseBusiness /> },
  { id: "documents", label: "Документы", icon: <Files /> },
  { id: "method", label: "Методология", icon: <Database /> },
];

const rubles = (value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
const compact = (value: number) => new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value) + " ₽";
const percent = (value: number) => `${Math.round(value * 100)}%`;
const formatDate = (value: string) => value ? new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00`)) : "—";
const statementWord = (value: number) => value % 10 === 1 && value % 100 !== 11 ? "выписка" : [2, 3, 4].includes(value % 10) && ![12, 13, 14].includes(value % 100) ? "выписки" : "выписок";
const metricVisible = (controls: Record<string, boolean>, key: string) => controls[metricControlKey(key)] !== false;

export default function Dashboard() {
  // Additive, permission-filtered entry from the internal report. Hydration stays on overview.
  const requestedView = useSyncExternalStore(subscribeView, readView, () => "overview" as View);
  const [chosenView, setView] = useState<View | null>(null);
  const view = chosenView ?? requestedView;
  const [menu, setMenu] = useState(false);
  const [analyses, setAnalyses] = useState<StoredAnalysis[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [toast, setToast] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [modules, setModules] = useState<Record<string, boolean>>({ overview: true, analysis: true, report: true, credit: true, company: true, offers: true, analyst: true, applications: true, documents: true, methodology: true, chats: true, exports: true });
  const [controls, setControls] = useState<Record<string, boolean>>({});
  const [readOnly, setReadOnly] = useState(false);

  const selected = analyses.find((item) => item.id === selectedId) ?? analyses[0] ?? null;
  const tier = selected?.viewTier ?? "FREE";
  const canonical = useCanonicalReport(selected?.id, selected);

  useEffect(() => {
    fetch("/api/modules")
      .then((response) => response.json() as Promise<{ modules?: Record<string, boolean>; controls?: Record<string, boolean> }>)
      .then((payload) => { if (payload.modules) setModules(payload.modules); if (payload.controls) setControls(payload.controls); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedClient = params.get("client");
    const requestedAnalysis = params.get("analysisId");
    const endpoint = requestedClient ? `/api/workspace?client=${encodeURIComponent(requestedClient)}&from=agent` : "/api/workspace";
    fetch(endpoint)
      .then(async (response) => {
        if (!response.ok) throw new Error("storage");
        return response.json() as Promise<{ analyses: StoredAnalysis[]; deals: Deal[]; readOnly?: boolean }>;
      })
      .then((data) => {
        setAnalyses(data.analyses ?? []);
        setDeals(data.deals ?? []);
        setReadOnly(Boolean(data.readOnly));
        if (requestedClient && data.analyses?.some((item) => item.id === requestedClient)) setSelectedId(requestedClient);
        else if (requestedAnalysis && data.analyses?.some((item) => item.id === requestedAnalysis)) setSelectedId(requestedAnalysis);
        else if (data.analyses?.[0]) setSelectedId(data.analyses[0].id);
      })
      .catch(() => setSaveWarning("Хранилище пока недоступно: анализ можно провести, но история не сохранится."))
      .finally(() => setLoadingWorkspace(false));
  }, []);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  async function acceptAnalysis(result: AnalysisResult) {
    setAnalyses((items) => [result as StoredAnalysis, ...items.filter((item) => item.id !== result.id)]);
    setSelectedId(result.id);
    setView((result as StoredAnalysis).viewTier === "FULL" ? "report" : "overview");
    setSaveWarning("");
    notify((result as StoredAnalysis).viewTier === "FULL" ? "Полный анализ рассчитан и сохранён" : "Бесплатный финансовый dashboard готов");
  }

  async function addDeal(input: Omit<Deal, "id">) {
    const optimistic = { ...input, id: globalThis.crypto?.randomUUID?.() ?? `deal-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    setDeals((items) => [optimistic, ...items]);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "deal", deal: optimistic }),
      });
      if (!response.ok) throw new Error("save");
      notify("Заявка в банк добавлена");
    } catch {
      setDeals((items) => items.filter((item) => item.id !== optimistic.id));
      notify("Не удалось сохранить заявку");
    }
  }

  async function addApplications(items: Array<{ bank: string; product: string; amount: number }>) {
    if (!selected || !items.length) return;
    const response = await fetch("/api/workspace", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "applications",
        analysisId: selected.id,
        companyName: selected.companyName,
        companyInn: selected.companyInn,
        consentAt: new Date().toISOString(),
        applications: items,
      }),
    });
    const body = await response.json() as { deals?: Deal[]; error?: string };
    if (!response.ok || !body.deals) throw new Error(body.error || "Не удалось создать заявки");
    setDeals((current) => [...body.deals!, ...current]);
    setView("crm");
    notify(`Создано заявок: ${body.deals.length}. Они появились у брокера.`);
  }

  async function attachCreditHistory(file: File, relationship: CreditSubjectRelationship): Promise<CreditHistoryReport> {
    if (!selected) throw new Error("Сначала выполните анализ банковских выписок.");
    const previous = analyses;
    try {
      const form = new FormData();
      form.set("analysisId", selected.id);
      form.set("sourceType", "BKI");
      form.set("relationship", relationship);
      form.set("file", file);
      const response = await fetch("/api/source-documents", { method: "POST", body: form });
      const body = await response.json() as { analysis?: StoredAnalysis; report?: CreditHistoryReport; error?: string };
      if (!response.ok || !body.analysis || !body.report) throw new Error(body.error || "save");
      const updated = body.analysis;
      setAnalyses((items) => items.map((item) => item.id === selected.id ? updated : item));
      setSaveWarning("");
      notify("Кредитный портфель добавлен к анализу");
      return body.report;
    } catch (caught) {
      setAnalyses(previous);
      throw new Error(caught instanceof Error ? caught.message : "Портфель рассчитан, но сохранить его в кабинете не удалось.");
    }
  }

  async function attachQuarterlyReport(file: File): Promise<QuarterlyFinancialReport> {
    if (!selected) throw new Error("Сначала выполните анализ банковских выписок.");
    const previous = analyses;
    try {
      const form = new FormData();
      form.set("analysisId", selected.id);
      form.set("sourceType", "QUARTERLY");
      form.set("file", file);
      const response = await fetch("/api/source-documents", { method: "POST", body: form });
      const body = await response.json() as { analysis?: StoredAnalysis; report?: QuarterlyFinancialReport; error?: string };
      if (!response.ok || !body.analysis || !body.report) throw new Error(body.error || "save");
      const updated = body.analysis;
      setAnalyses((items) => items.map((item) => item.id === selected.id ? updated : item));
      setSaveWarning(""); notify("Квартальная отчётность добавлена в общее заключение");
      return body.report;
    } catch (caught) {
      setAnalyses(previous);
      throw new Error(caught instanceof Error ? caught.message : "Q‑оценка рассчитана, но сохранить её в кабинете не удалось.");
    }
  }

  async function updateDeal(id: string, status: string) {
    const previous = deals;
    setDeals((items) => items.map((item) => item.id === id ? { ...item, status } : item));
    try {
      const response = await fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      if (!response.ok) throw new Error("save");
    } catch {
      setDeals(previous);
      notify("Статус не сохранён");
    }
  }

  function choose(next: View) { setView(next); setMenu(false); const url=new URL(window.location.href);url.searchParams.set('view',next);if(selected)url.searchParams.set('analysisId',selected.id);window.history.replaceState(null,'',url); }

  const moduleKeyForView: Record<View, string> = { overview: "overview", analyze: "analysis", report: "report", credit: "credit", company: "company", offers: "offers", analyst: "analyst", crm: "applications", documents: "documents", method: "methodology" };
  const availableNav = nav.filter((item) => modules[moduleKeyForView[item.id]] !== false && (!readOnly || !["analyze", "crm"].includes(item.id)));
  const effectiveView = availableNav.some((item) => item.id === view) ? view : availableNav[0]?.id ?? "overview";

  const href=reportHref(selected?.id);
  return <WorkspaceShell active={effectiveView} role={readOnly?'BROKER':'CLIENT'} nav={clientNav.filter(n=>availableNav.some(x=>x.id===n.id))} onNavigate={id=>choose(id as View)} company={<label className="wv-select">Компания / версия анализа<select aria-label="Компания и версия анализа" value={selected?.id??''} onChange={e=>setSelectedId(e.target.value)}>{!analyses.length&&<option value="">Новая компания</option>}{analyses.map(a=><option key={a.id} value={a.id}>{a.companyName} · {a.periodTo} · {a.id.slice(0,8)}</option>)}</select></label>} tools={<>{selected&&<span className="wv-pill">{tier} · ИНН {selected.companyInn}</span>}{!readOnly&&modules.analysis!==false&&<button className="wv-button" onClick={()=>choose('analyze')}>Новый анализ +</button>}</>}>
    {saveWarning&&<p className="wv-notice" role="alert">{saveWarning}</p>}
    {readOnly&&<p className="wv-notice">Досье закреплённого клиента · только чтение. Заявки и документы — в кабинете брокера. <Link href="/agent">Вернуться к работе с клиентами ↗</Link></p>}
    {loadingWorkspace?<Loading/>:<>
    {effectiveView==='overview'&&<><WorkspaceHeading eyebrow="РАБОТА С КОМПАНИЕЙ" title="От понимания — к действию" text={selected?`${selected.companyName} · версия ${selected.id.slice(0,8)}`:'Соберите финансовый профиль и определите следующий шаг.'}/>{canonical.status==='READY'?<CanonicalSummary model={canonical.model} href={href} applications={deals.filter(d=>d.analysisId===selected?.id).length}/>:<><ReportStateView state={canonical} id={selected?.id}/>{selected&&tier==='FREE'&&<FreeOverview selected={selected} deals={deals} analyses={analyses} openAnalysis={id=>{setSelectedId(id);choose('report');}} start={()=>choose('analyze')}/>}</>}</>}
    {effectiveView==='analyze'&&!readOnly&&<Analyze onResult={acceptAnalysis}/>}
    {effectiveView==='report'&&(canonical.status==='READY'?<div className="wv-embedded-analysis"><AnalysisV3 model={canonical.model} realAnalysisId={selected?.id}/>{selected&&<details className="wv-legacy"><summary>Банковские операции и выгрузка ОДДС</summary><p className="wv-notice">Детализация сохранённого банковского источника. Не заменяет канонический анализ выше.</p><button className="wv-button secondary" onClick={()=>downloadXlsx(`ОДДС_${selected.companyInn}_${selected.periodTo}.xlsx`,cashFlowWorkbook(selected))}>Выгрузить ОДДС · Excel</button><Normalization analysis={selected}/></details>}</div>:<ReportStateView state={canonical} id={selected?.id}/>)}
    {effectiveView==='credit'&&<>{canonical.status==='READY'?<CanonicalPortfolio model={canonical.model}/>:<ReportStateView state={canonical} id={selected?.id}/>}<details className="wv-legacy"><summary>Кредитная история — подробности источника БКИ</summary><div>{selected&&tier==='FULL'?<CreditHistory key={selected.id} analysis={selected} onAttach={attachCreditHistory} readOnly={readOnly}/>:<p>Добавление источника доступно владельцу FULL-анализа. Портфель выше отражает канонический результат.</p>}</div></details></>}
    {effectiveView==='offers'&&<>{canonical.status==='READY'?<CanonicalFinancing model={canonical.model} href={href}/>:<ReportStateView state={canonical} id={selected?.id}/>}<div className="wv-section-heading"><h2>Подготовить обращение</h2>{!readOnly&&<button className="wv-button" onClick={()=>choose('crm')}>Перейти к заявкам ↗</button>}</div>{selected&&tier==='FULL'&&!readOnly&&<details className="wv-legacy"><summary>Каталог партнёров и существующий подбор заявки</summary><p className="wv-notice">Каталог использует прежние параметры подбора. Они не заменяют каноническую долговую ёмкость и не являются одобренным лимитом.</p><BankOffers analysis={selected} onSubmitApplications={addApplications}/></details>}</>}
    {effectiveView==='documents'&&<>{canonical.status==='READY'&&<><WorkspaceHeading eyebrow="ИСТОЧНИКИ" title="На чём основан анализ"/><SourceCards model={canonical.model}/><p className="wv-source-impact">Загрузка файла в досье не меняет результат анализа автоматически. Добавление БКИ или квартальной отчётности выполняется через соответствующий разбор источника.</p></>}{selected?<DocumentsHub key={selected.id} companyInn={selected.companyInn} companyName={selected.companyName} analysisId={selected.id} readOnly={readOnly}/>:<EmptyDashboard start={()=>choose('analyze')}/>}</>}
    {effectiveView==='crm'&&!readOnly&&<Crm deals={deals} analyses={analyses} selected={selected} addDeal={addDeal} updateDeal={updateDeal}/>}
    {effectiveView==='company'&&(selected?(tier==='FULL'&&!readOnly?<CheckoProfile analysis={selected} onAttachQuarterly={attachQuarterlyReport}/>:<FreeCompanyProfile analysisId={selected.id} inn={selected.companyInn} companyName={selected.companyName} createGuarantee={(contract)=>{if(readOnly)return;void addDeal({analysisId:selected.id,companyName:selected.companyName,product:"Банковская гарантия по ЕИС",amount:0,status:"Новая",owner:"Не назначен",nextAction:`Подтвердить обеспечение по закупке ${contract?.number||"из открытого реестра"}`,bank:"Подбор банка",consentAt:new Date().toISOString()});choose('crm');}}/>):<EmptyDashboard start={()=>choose('analyze')}/>)}
    {effectiveView==='analyst'&&<><p className="wv-notice">Прежний кредитный аналитик · legacy AI. Не является каноническим заключением Expertise и не изменяет расчёты. Block 19 не подключён.</p>{selected&&tier==='FULL'&&!readOnly?<AiAnalyst analysisId={selected.id}/>:<UpgradeGate analysis={selected} area="Кредитный аналитик" text="Доступность инструмента определяется существующими правами и тарифом."/>}</>}
    {effectiveView==='method'&&<Methodology/>}
    </>}{toast&&<div className="ps-toast" role="status">{toast}</div>}
  </WorkspaceShell>;
}

function Loading() { return <div className="ps-loading"><LoaderCircle /><b>Загружаю рабочий кабинет…</b></div>; }

function PageHeading({ kicker, title, body, action }: { kicker: string; title: string; body: string; action?: ReactNode }) {
  return <div className="ps-heading"><div><span>{kicker}</span><h1>{title}</h1><p>{body}</p></div>{action}</div>;
}

function UpgradeGate({ analysis, area, text, freeAction }: { analysis: StoredAnalysis | null; area: string; text: string; freeAction?: ReactNode }) {
  if (!analysis) return <EmptyDashboard start={() => { window.location.href = "/dashboard"; }} />;
  return <div className="ps-access-gate"><LockKeyhole /><span>PRESCORE FULL · {area.toUpperCase()}</span><h1>{area}</h1><p>{text}</p><div className="ps-gate-actions"><Link href={`/checkout?analysisId=${encodeURIComponent(analysis.id)}`}>Открыть полный анализ — 6 500 ₽</Link>{freeAction}</div><small>Оплата открывает эту конкретную версию анализа. Это не подписка и не банковское решение.</small></div>;
}

function Overview({ analyses, deals, selected, controls, openAnalysis, start }: { analyses: StoredAnalysis[]; deals: Deal[]; selected: StoredAnalysis | null; controls: Record<string, boolean>; openAnalysis: (id: string) => void; start: () => void }) {
  if (!selected) return <EmptyDashboard start={start} />;
  if (selected.viewTier !== "FULL") return <FreeOverview analyses={analyses} deals={deals} selected={selected} openAnalysis={openAnalysis} start={start} />;
  const critical = selected.factors.filter((factor) => factor.severity === "critical").length;
  return <>
    <PageHeading kicker="ФИНАНСОВАЯ ГОТОВНОСТЬ" title="Картина финансирования на сегодня" body="Банковский поток уже нормализован, ключевые риски объяснены, следующий шаг определён." action={<button className="ps-outline-button" onClick={start}><FilePlus2 /> Открыть анализ</button>} />
    <div className="ps-kpis">
      {metricVisible(controls, "prescore-index") && <Kpi icon={<Gauge />} label="B-Score" value={`${selected.score} · ${selected.grade}`} note={selected.readiness} tone={selected.score >= 620 ? "good" : "warn"} />}
      {metricVisible(controls, "avg-monthly-inflow") && <Kpi icon={<WalletCards />} label="Операционная выручка / мес." value={compact(selected.metrics.avgMonthlyInflow)} note={`${selected.metrics.months} мес. истории · без кредитов и переводов`} />}
      {metricVisible(controls, "estimated-limit") && <Kpi icon={<Target />} label="Расчётный диапазон" value={`${compact(selected.metrics.estimatedLimitMin)} — ${compact(selected.metrics.estimatedLimitMax)}`} note="Не является офертой банка" />}
      <Kpi icon={<BriefcaseBusiness />} label="Заявки в работе" value={`${deals.length}`} note={deals.length ? "В партнёрском контуре" : "Можно создать из рекомендации"} />
    </div>
    <div className="ps-overview-grid">
      {metricVisible(controls, "monthly-trend") && <section className="ps-card ps-chart-card"><CardTitle title="Динамика поступлений и списаний" subtitle={`${formatDate(selected.periodFrom)} — ${formatDate(selected.periodTo)}`} /><MonthlyChart rows={selected.monthly} /></section>}
      <section className="ps-card ps-next-action"><span><Sparkles /> СЛЕДУЮЩЕЕ ЛУЧШЕЕ ДЕЙСТВИЕ</span><h2>{selected.recommendations[0]?.title ?? "Дополнить данные"}</h2><p>{selected.recommendations[0]?.rationale ?? "Добавьте БФО и кредитные договоры для полного профиля."}</p><button onClick={() => openAnalysis(selected.id)}>Открыть полный отчёт <ArrowRight /></button></section>
    </div>
    <div className="ps-overview-grid lower">
      <section className="ps-card"><CardTitle title="Ключевые сигналы" subtitle="Автоматическая проверка стоп-факторов" /><div className="ps-signal-list">{selected.factors.slice(0, 4).map((factor) => <div key={factor.title} className={factor.severity}><i>{factor.severity === "info" ? <Check /> : <AlertTriangle />}</i><span><b>{factor.title}</b><small>{factor.detail}</small></span></div>)}</div></section>
      <section className="ps-card"><CardTitle title="Последние анализы" subtitle={`${analyses.length} сохранено в кабинете`} /><div className="ps-history">{analyses.slice(0, 4).map((item) => <button key={item.id} onClick={() => openAnalysis(item.id)}><i>{item.grade}</i><span><b>{item.companyName}</b><small>{item.fileName} · {formatDate(item.periodTo)}</small></span><strong>{item.score}</strong><ChevronRight /></button>)}</div></section>
    </div>
    <div className="ps-overview-grid lower"><section className="ps-card"><CardTitle title="Подтверждённые сильные стороны" subtitle="Только выводы с метрикой и источником" /><div className="ps-signal-list">{(selected.strengths ?? []).length ? selected.strengths.slice(0, 4).map((item) => <div key={item.title} className="info"><i><Check /></i><span><b>{item.title}</b><small>{item.detail} · {item.source}</small></span></div>) : <div className="warning"><i><AlertTriangle /></i><span><b>Недостаточно подтверждений</b><small>Добавьте БФО, квартальную отчётность и БКИ.</small></span></div>}</div></section><section className="ps-card"><CardTitle title="Главные риски" subtitle="Приоритет до выбора продукта" /><div className="ps-signal-list">{(selected.topRisks ?? []).length ? selected.topRisks.slice(0, 4).map((item) => <div key={item.title} className="warning"><i><AlertTriangle /></i><span><b>{item.title}</b><small>{item.evidence} · {item.source}</small></span></div>) : <div className="info"><i><Check /></i><span><b>Критических сигналов по выпискам нет</b><small>Полный вывод появится после сверки остальных источников.</small></span></div>}</div></section></div>
    {critical > 0 && <div className="ps-critical-banner"><AlertTriangle /><span><b>До подачи заявки нужно устранить критические сигналы: {critical}.</b><small>Прескор показывает причину, её влияние и конкретное действие для подготовки.</small></span><button onClick={() => openAnalysis(selected.id)}>Посмотреть</button></div>}
  </>;
}

function FreeOverview({ analyses, deals, selected, openAnalysis, start }: { analyses: StoredAnalysis[]; deals: Deal[]; selected: StoredAnalysis; openAnalysis: (id: string) => void; start: () => void }) {
  const facts = selected.freeFacts ?? { netCashFlow: selected.metrics.inflow - selected.metrics.outflow, taxPayments: null, creditPayments: null, leasingPayments: null, personalTransfers: null, largestRecipients: [] };
  const lowLiquidity = selected.metrics.cashGapDays;
  const observedMoney = (n:number|null|undefined) => n == null ? "Недостаточно данных" : rubles(n);
  return <>
    <PageHeading kicker="ФИНАНСОВАЯ КАРТИНА · FREE" title="Что происходит с деньгами бизнеса" body="Фактические обороты, контрагенты, платежи и ликвидность без платной кредитной интерпретации." action={<button className="ps-outline-button" onClick={start}><FilePlus2 /> Добавить выписки</button>} />
    <div className="ps-kpis">
      <Kpi icon={<WalletCards />} label="Входящие поступления" value={compact(selected.metrics.inflow)} note={`${selected.metrics.months} мес. · ${selected.bankNames.length} банков`} />
      <Kpi icon={<ArrowRight />} label="Исходящие платежи" value={compact(selected.metrics.outflow)} note={`Чистый поток ${compact(facts.netCashFlow)}`} />
      <Kpi icon={<TrendingIcon />} label="Среднемесячные поступления" value={compact(selected.metrics.avgMonthlyInflow)} note={`Динамика ${selected.metrics.monthlyTrend >= 0 ? "+" : ""}${selected.metrics.monthlyTrend}%`} />
      <Kpi icon={<BriefcaseBusiness />} label="Заявки доступны бесплатно" value={`${deals.length}`} note="Кредит, БГ и другие продукты" tone="good" />
    </div>
    <div className="ps-overview-grid"><section className="ps-card ps-chart-card"><CardTitle title="Поступления и списания по месяцам" subtitle={`${formatDate(selected.periodFrom)} — ${formatDate(selected.periodTo)}`} /><MonthlyChart rows={selected.monthly} /></section><section className="ps-card"><CardTitle title="Концентрация покупателей" subtitle="Доля операционных поступлений" /><div className="ps-free-concentration"><span><small>TOP‑1</small><b>{percent(selected.metrics.topOneConcentration)}</b></span><span><small>TOP‑3</small><b>{percent(selected.metrics.topThreeConcentration)}</b></span><span><small>TOP‑5</small><b>{percent(selected.metrics.topFiveConcentration)}</b></span></div><div className="ps-history">{selected.topCounterparties.map((item) => <span key={item.name}><b>{item.name}</b><small>{rubles(item.amount)} · {percent(item.share)}</small></span>)}</div></section></div>
    <div className="ps-overview-grid lower"><section className="ps-card"><CardTitle title="Структура значимых списаний" subtitle="Категории определены по назначениям платежей" /><div className="ps-finance-table"><span><small>Налоги</small><b>{observedMoney(facts.taxPayments)}</b></span><span><small>Кредитные платежи</small><b>{observedMoney(facts.creditPayments)}</b></span><span><small>Лизинг</small><b>{observedMoney(facts.leasingPayments)}</b></span><span><small>Физическим лицам</small><b>{observedMoney(facts.personalTransfers)}</b></span></div></section><section className="ps-card"><CardTitle title="Остатки и ликвидность" subtitle="Факты по загруженному периоду" /><div className="ps-finance-table"><span><small>Конечный остаток</small><b>{observedMoney(selected.metrics.endingBalance)}</b></span><span><small>Средний дневной</small><b>{observedMoney(selected.metrics.averageDailyBalance)}</b></span><span><small>Минимальный остаток</small><b>{observedMoney(selected.metrics.minimumDailyBalance)}</b></span><span><small>Дни низкой ликвидности</small><b>{lowLiquidity ?? "Недостаточно данных"}</b></span></div>{lowLiquidity != null && lowLiquidity > 0 && <p className="ps-warning"><AlertTriangle />В периоде есть дни низкого запаса ликвидности. Экспертная оценка причин и влияния доступна в FULL.</p>}</section></div>
    <div className="ps-overview-grid lower"><section className="ps-card"><CardTitle title="Крупнейшие получатели" subtitle="Агрегировано по исходящим платежам" /><div className="ps-history">{facts.largestRecipients.length ? facts.largestRecipients.map((item) => <span key={item.name}><b>{item.name}</b><small>{rubles(item.amount)} · {percent(item.share)}</small></span>) : <span><b>Нет достаточных данных</b><small>Получатели появятся после классификации операций.</small></span>}</div></section><section className="ps-card ps-next-action"><span><LockKeyhole /> PRESCORE FULL</span><h2>{selected.lockedSummary ? `${selected.lockedSummary.riskCount} факторов требуют дополнительной оценки` : "Полный анализ выбранной версии"}</h2><p>Откройте Prescore Index, готовность к финансированию, полные риски, БКИ, рекомендации 7/30/60 и персональную карту финансирования.</p><button onClick={() => openAnalysis(selected.id)}>Посмотреть, что откроется <ArrowRight /></button></section></div>
    <div className="ps-overview-grid lower"><section className="ps-card"><CardTitle title="Банки в загруженных выписках" subtitle={`${selected.metrics.statements} ${statementWord(selected.metrics.statements)} · ${selected.metrics.accounts} счетов`} /><div className="ps-history">{selected.bankNames.map((bank) => <span key={bank}><b>{bank}</b><small>Источник банковского потока</small></span>)}</div></section><section className="ps-card"><CardTitle title="Последние анализы" subtitle={`${analyses.length} сохранено в кабинете`} /><div className="ps-history">{analyses.slice(0, 4).map((item) => <button key={item.id} onClick={() => openAnalysis(item.id)}><i>{item.viewTier ?? "FREE"}</i><span><b>{item.companyName}</b><small>{item.fileName} · {formatDate(item.periodTo)}</small></span><ChevronRight /></button>)}</div></section></div>
  </>;
}

function TrendingIcon() { return <span aria-hidden="true">↗</span>; }

function EmptyDashboard({ start }: { start: () => void }) {
  return <div className="ps-empty-dashboard"><div className="ps-empty-icon"><FileSearch /></div><span>ПЕРВЫЙ АНАЛИЗ</span><h1>Превратите банковские выписки в понятный профиль финансирования.</h1><p>Загрузите TXT из одного или нескольких банков. Прескор проверит единый ИНН, объединит обороты, исключит внутренние переводы, рассчитает метрики и предложит следующие действия.</p><button onClick={start}><UploadCloud /> Загрузить выписки <ArrowRight /></button><div><span><ShieldCheck /> Исходные файлы не сохраняются</span><span><Zap /> Результат за несколько секунд</span><span><Database /> В кабинете остаются агрегаты</span></div></div>;
}

function Kpi({ icon, label, value, note, tone = "" }: { icon: ReactNode; label: string; value: string; note: string; tone?: string }) {
  return <div className={`ps-kpi ${tone}`}><div>{icon}<small>ПО ДАННЫМ</small></div><p>{label}</p><strong>{value}</strong><span>{note}</span></div>;
}

function CardTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div className="ps-card-title"><span><b>{title}</b><small>{subtitle}</small></span></div>; }

function MonthlyChart({ rows }: { rows: StoredAnalysis["monthly"] }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.inflow, row.outflow]));
  return <div className="ps-monthly-chart"><div className="ps-chart-bars">{rows.map((row) => <div className="ps-month" key={row.month}><div data-tooltip={`Поступления: ${rubles(row.inflow)}\nСписания: ${rubles(row.outflow)}`} aria-label={`${row.month}. Поступления ${rubles(row.inflow)}, списания ${rubles(row.outflow)}`}><i className="in" style={{ height: `${Math.max(4, row.inflow / max * 100)}%` }} /><i className="out" style={{ height: `${Math.max(4, row.outflow / max * 100)}%` }} /></div><span>{row.month}</span></div>)}</div><div className="ps-chart-legend"><span><i className="in" />Поступления</span><span><i className="out" />Списания</span></div></div>;
}

function Analyze({ onResult }: { onResult: (result: AnalysisResult) => void }) {
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
      onResult(result);
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
    setRejectedFiles(rejected.map((item) => ({ fileName: item.fileName, reason: item.reason })));
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
    <PageHeading kicker="БЕСПЛАТНЫЙ ФИНАНСОВЫЙ DASHBOARD" title="Соберите банковский поток компании" body="Каждый расчёт сохраняется отдельной версией. FREE сразу покажет фактические обороты, динамику, контрагентов и ликвидность; FULL можно открыть позже без повторного расчёта." />
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

function Report({ analysis, controls, readOnly, openAnalyze }: { analysis: StoredAnalysis | null; controls: Record<string, boolean>; readOnly: boolean; openAnalyze: () => void }) {
  const [tab, setTab] = useState<"summary" | "factors" | "transactions">("summary");
  if (!analysis) return <EmptyDashboard start={openAnalyze} />;
  const scoreAngle = `${Math.min(100, analysis.score / 10) * 3.6}deg`;
  return <>
    <PageHeading kicker="КРЕДИТНЫЙ ПРОФИЛЬ" title={`${analysis.companyName} · ${analysis.grade}`} body={`${analysis.sourceFiles?.length ?? 1} ${statementWord(analysis.sourceFiles?.length ?? 1)} · ${(analysis.bankNames ?? []).join(", ") || "банк не определён"} · период ${formatDate(analysis.periodFrom)} — ${formatDate(analysis.periodTo)}.`} action={<div className="ps-heading-actions"><Link className="ps-outline-button" href={`/report/${analysis.id}`} target="_blank"><Download /> Сформировать PDF</Link>{!readOnly && <button className="ps-outline-button" onClick={openAnalyze}><RefreshCw /> Пересчитать</button>}</div>} />
    <div className="ps-report-hero">
      {metricVisible(controls, "prescore-index") && <section className="ps-score-panel"><div className="ps-score-ring" style={{ background: `conic-gradient(var(--teal) 0 ${scoreAngle}, #dce7e8 ${scoreAngle} 360deg)` }}><div><strong>{analysis.score}</strong><span>из 1000</span></div></div><div><span>B-SCORE · БАНКОВСКИЙ ПОТОК</span>{metricVisible(controls, "readiness") && <h2>{analysis.readiness}</h2>}<p>Оценка объясняется активными группами факторов. Это предварительная аналитическая оценка, а не решение конкретного банка.</p><div><b>Класс {analysis.grade}</b>{metricVisible(controls, "data-quality") && <small>Качество данных {analysis.metrics.dataQuality}%</small>}</div></div></section>}
      {metricVisible(controls, "estimated-limit") && <section className="ps-limit-panel"><span><BadgeRussianRuble /> РАСЧЁТНЫЙ ДИАПАЗОН</span><strong>{rubles(analysis.metrics.estimatedLimitMin)} — {rubles(analysis.metrics.estimatedLimitMax)}</strong><p>Расчёт строится от допустимого ежемесячного платежа, видимого долга, стресс-потока и риск-корректировок.</p><div className="ps-limit-mini">{metricVisible(controls, "payment-capacity") && <span><small>Допустимый платёж</small><b>{rubles(analysis.metrics.baseMonthlyPaymentCapacity ?? 0)} / мес.</b></span>}{metricVisible(controls, "stress-limit") && <span><small>Стресс-ориентир</small><b>{rubles(analysis.metrics.stressLimitMax ?? analysis.metrics.estimatedLimitMin)}</b></span>}{metricVisible(controls, "limit-confidence") && <span><small>Достоверность</small><b>{analysis.metrics.limitConfidence ?? analysis.metrics.dataQuality}%</b></span>}</div><small>Информационно-аналитический ориентир. Не является решением банка, гарантией одобрения или офертой.</small></section>}
    </div>
    <div className="ps-report-tabs"><button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>Метрики и рекомендации</button><button className={tab === "factors" ? "active" : ""} onClick={() => setTab("factors")}>Стоп-факторы <i>{analysis.factors.length}</i></button><button className={tab === "transactions" ? "active" : ""} onClick={() => setTab("transactions")}>Нормализация</button></div>
    {tab === "summary" && <ReportSummary analysis={analysis} controls={controls} />}{tab === "factors" && <Factors analysis={analysis} />}{tab === "transactions" && <Normalization analysis={analysis} />}
  </>;
}

function ReportSummary({ analysis, controls }: { analysis: StoredAnalysis; controls: Record<string, boolean> }) {
  const metrics = analysis.metrics;
  const cards = [["gross-inflow", "Валовые поступления", rubles(metrics.grossInflow ?? metrics.inflow), "до классификации"], ["operating-inflow", "Операционная выручка", rubles(metrics.operatingInflow ?? metrics.inflow), `${metrics.months} мес. · кредиты исключены`], ["excluded-inflow", "Неоперационные / неясные", rubles((metrics.nonOperatingInflow ?? 0) + (metrics.unknownInflow ?? 0)), "не увеличивают лимит"], ["avg-monthly-inflow", "Средняя выручка / мес.", rubles(metrics.avgMonthlyInflow), `${metrics.monthlyTrend >= 0 ? "+" : ""}${metrics.monthlyTrend}% тренд`], ["statements-accounts", "Выписки и счета", `${metrics.statements ?? analysis.sourceFiles?.length ?? 1} / ${metrics.accounts ?? 1}`, "файлов / расчетных счетов"], ["top-one-concentration", "Концентрация TOP-1", percent(metrics.topOneConcentration), metrics.topOneConcentration > .5 ? "повышенная" : "приемлемая"], ["debt-service-share", "Долговые платежи", percent(metrics.debtServiceShare), "от операционной выручки"], ["risky-outflow-share", "Рискованные списания", percent(metrics.riskyOutflowShare), "наличные и физлица"], ["tax-regularity", "Налоговая регулярность", percent(metrics.taxRegularity), "месяцев с платежами"]].filter(([key]) => metricVisible(controls, key));
  const products = analysis.productFits ?? [];
  const actionPlan = buildActionPlan(analysis);
  return <div className="ps-report-grid"><div>
    <div className="ps-report-exportbar"><span><b>Отчёт о движении денежных средств</b><small>Помесячный ОДДС, категории и параметры источников</small></span><button className="ps-outline-button" onClick={() => downloadXlsx(`ОДДС_${analysis.companyInn}_${analysis.periodTo}.xlsx`, cashFlowWorkbook(analysis))}><Download /> Выгрузить Excel</button></div>
    <div className="ps-metric-grid">{cards.map(([key, label, value, note]) => <div className="ps-card" key={key}><small>{label}</small><strong>{value}</strong><span>{note}</span></div>)}</div>
    {metricVisible(controls, "estimated-limit") && <section className="ps-card ps-limit-method"><CardTitle title="Как сформирован диапазон финансирования" subtitle="От подтверждённой операционной выручки к допустимому платежу и стресс‑ориентиру" /><div className="ps-limit-flow"><span><small>Средняя операционная выручка</small><b>{rubles(metrics.avgMonthlyInflow)}</b></span><ArrowRight /><span><small>Видимые долговые платежи</small><b>{rubles(metrics.currentMonthlyDebtPayment ?? metrics.avgMonthlyInflow * metrics.debtServiceShare)}</b></span><ArrowRight /><span><small>Допустимый новый платёж</small><b>{rubles(metrics.baseMonthlyPaymentCapacity ?? 0)}</b></span><ArrowRight /><span><small>Расчётный диапазон</small><b>{rubles(metrics.estimatedLimitMin)} — {rubles(metrics.estimatedLimitMax)}</b></span></div><p>Учитываются только подтверждённая операционная выручка, долговая нагрузка, стресс денежного потока, концентрация, волатильность, длина истории и качество данных. Формулы и веса являются внутренней методологией. Кредитор использует собственную модель.</p></section>}
    <section className="ps-recommendations"><div className="ps-rec-title"><Sparkles /><span><small>ФИНАНСОВЫЕ · ЮРИДИЧЕСКИЕ · ДОЛГОВЫЕ ДЕЙСТВИЯ</small><h2>Как улучшить положение компании</h2></span></div>{analysis.recommendations.map((item, index) => <article key={`${item.product}-${index}`} className={item.priority}><div><span>{item.product}</span><i>{String(index + 1).padStart(2, "0")}</i></div><h3>{item.title}</h3><p>{item.rationale}</p><small>{item.action}</small>{(item.expectedEffect || item.horizon) && <dl><div><dt>Контрольный результат</dt><dd>{item.expectedEffect || "Усиление кредитного профиля"}</dd></div><div><dt>Срок</dt><dd>{item.horizon || "По плану подготовки"}</dd></div></dl>}</article>)}</section>
    <section className="ps-card ps-action-plan"><CardTitle title="План 7 / 30 / 60" subtitle="Не общие советы: действие, ответственный и проверяемый результат на каждом горизонте" /><div>{actionPlan.map((phase) => <article key={phase.horizon}><header><strong>{phase.horizon}</strong><span><small>ДНЕЙ</small><b>{phase.title}</b></span></header>{phase.items.map((item) => <div key={item.title} className={item.priority}><span><h3>{item.title}</h3><p>{item.action}</p></span><dl><div><dt>Почему</dt><dd>{item.reason}</dd></div><div><dt>Результат</dt><dd>{item.result}</dd></div><div><dt>Ответственный</dt><dd>{item.owner}</dd></div></dl></div>)}</article>)}</div><p className="ps-plan-rule"><ShieldCheck /> План не предлагает исправлять достоверную отчётность или создавать искусственные операции. Если показатель фактически отказной, текущий комплект не подаётся: сначала подтверждаются причины, устраняются законные управляемые риски и накапливается новая фактическая динамика.</p></section>
    {products.length > 0 && <section className="ps-card ps-product-fit"><CardTitle title="Какие продукты подходят и почему" subtitle="Продукт, ориентир суммы, доказательства и условия" /><div>{products.map((item) => <article className={item.status} key={item.product}><header><span><small>{item.statusLabel}</small><h3>{item.product}</h3></span><b>{item.amountMax > 0 ? `${rubles(item.amountMin)} — ${rubles(item.amountMax)}` : "Сумма после документов"}</b></header><div><span><strong>Почему</strong>{item.why.map((reason) => <p key={reason}><Check />{reason}</p>)}</span><span><strong>Что подтвердить</strong>{item.conditions.map((condition) => <p key={condition}><ArrowRight />{condition}</p>)}</span></div></article>)}</div><small>Подбор носит информационно-аналитический характер и не является индивидуальным предложением банка.</small></section>}
    {metricVisible(controls, "monthly-trend") && <section className="ps-card ps-report-chart"><CardTitle title="Денежный поток" subtitle="Внутренние переводы и дубли исключены" /><MonthlyChart rows={analysis.monthly} /></section>}
    {metricVisible(controls, "top-one-concentration") && <section className="ps-card"><CardTitle title="Концентрация поступлений" subtitle="Крупнейшие плательщики" /><div className="ps-counterparties">{analysis.topCounterparties.map((item, index) => <div key={`${item.name}-${index}`}><i>{index + 1}</i><span><b>{item.name}</b><small>{rubles(item.amount)}</small></span><div><em style={{ width: `${Math.max(3, item.share * 100)}%` }} /></div><strong>{percent(item.share)}</strong></div>)}</div></section>}
  </div></div>;
}

function Factors({ analysis }: { analysis: StoredAnalysis }) {
  return <div className="ps-factors-page"><section className="ps-card"><CardTitle title="Автоматические проверки банковского потока" subtitle="Причина, влияние на кредитное решение и действие для исправления" /><div className="ps-factor-table">{analysis.factors.map((factor, index) => <div key={`${factor.title}-${index}`} className={factor.severity}><i>{factor.severity === "info" ? <CheckCircle2 /> : <AlertTriangle />}</i><span><b>{factor.title}</b><small>{factor.detail}</small>{factor.impact && <p><strong>Влияние:</strong> {factor.impact}</p>}{factor.action && <p><strong>Что сделать:</strong> {factor.action}</p>}</span><em>{factor.severity === "critical" ? "СТОП" : factor.severity === "warning" ? "ВНИМАНИЕ" : "ПРОЙДЕНО"}</em></div>)}</div></section><aside className="ps-card"><ShieldCheck /><h3>Полный анализ: три расчётных слоя + БКИ</h3><p><b>B · Банковский поток</b> показывает реальные обороты, долговые платежи и дисциплину.</p><p><b>F · БФО</b> оценивает ликвидность, капитал, прибыльность и оборотный капитал.</p><p><b>L · Правовой контур</b> проверяет статус, ФССП и иные юридические сигналы.</p><p><b>C · Кредитная история</b> формирует портфель и уточняет долговую ёмкость отдельно, только после подтверждения законного основания.</p></aside></div>;
}

function Normalization({ analysis }: { analysis: StoredAnalysis }) {
  const rows = analysis.transactions?.slice(0, 30) ?? [];
  if (!rows.length) return <div className="ps-card ps-no-raw"><LockKeyhole /><h2>Детализация недоступна для старого анализа</h2><p>В ранних версиях сохранялись только агрегаты. Пересчитайте выписки: новый серверный контур сохранит нормализованные операции с маскированными номерами счетов.</p><div><Check /> Внутренние переводы исключаются из оборота<br/><Check /> Кредиты, возвраты и взносы не считаются выручкой<br/><Check /> Каждая категория содержит основание классификации</div></div>;
  return <section className="ps-card ps-normalized"><CardTitle title="Нормализованные операции текущей сессии" subtitle={`Показано ${Math.min(30, rows.length)} из ${analysis.metrics.transactions}`} /><div className="ps-table-scroll"><table><thead><tr><th>Дата</th><th>Направление</th><th>Контрагент</th><th>Категория</th><th>Сумма</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.id}-${index}`}><td>{formatDate(row.date)}</td><td><span className={row.direction}>{row.direction === "in" ? "Поступление" : row.direction === "out" ? "Списание" : "Не определено"}</span></td><td><b>{row.counterparty}</b><small>{row.counterpartyInn || "ИНН не указан"}</small></td><td>{categoryLabel(row.category)}</td><td><strong>{rubles(row.amount)}</strong></td></tr>)}</tbody></table></div></section>;
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = { revenue: "Операционная выручка", loan_inflow: "Кредит / заём", owner_funding: "Взнос собственника", refund_in: "Возврат поступивший", refund_out: "Возврат покупателю", tax: "Налоги", payroll: "Зарплата", personal: "Физлица", cash: "Наличные", debt: "Погашение кредита", leasing: "Лизинг", supplier: "Поставщики", internal: "Внутренний перевод", other: "Не классифицировано" };
  return labels[category] ?? category;
}

function Crm({ deals, analyses, selected, addDeal, updateDeal }: { deals: Deal[]; analyses: StoredAnalysis[]; selected: StoredAnalysis | null; addDeal: (deal: Omit<Deal, "id">) => void; updateDeal: (id: string, status: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chatDeal, setChatDeal] = useState<Deal | null>(null);
  const shown = deals.filter((deal) => `${deal.companyName} ${deal.product}`.toLowerCase().includes(query.toLowerCase()));
  const total = deals.reduce((sum, deal) => sum + deal.amount, 0);
  return <><PageHeading kicker="ЗАЯВКИ В БАНКИ" title="Все обращения в одном месте" body="Название продукта — основа карточки заявки. По каждому выбранному банку ведутся отдельный статус, история, комплект документов и чат с брокером." action={<button className="ps-primary-button" onClick={() => setOpen(!open)}><Plus /> Новая заявка</button>} /><div className="ps-crm-kpis"><span><small>ЗАЯВОК</small><b>{deals.length}</b></span><span><small>ЗАПРОШЕНО</small><b>{rubles(total)}</b></span><span><small>В БАНКАХ</small><b>{deals.filter((deal) => ["Отправлена в банк", "На рассмотрении у финансового партнёра", "Предварительное решение"].includes(deal.status)).length}</b></span><span><small>ОДОБРЕНО</small><b>{deals.filter((deal) => deal.status === "Одобрена").length}</b></span></div>{open && <DealForm analyses={analyses} selected={selected} close={() => setOpen(false)} submit={(deal) => { addDeal(deal); setOpen(false); }} />}<section className="ps-card ps-crm-table"><div className="ps-crm-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Банк, компания или продукт" /></label><span><ShieldCheck /> Статус меняет брокер; передача — только после согласия</span></div>{shown.length ? <div className="ps-table-scroll"><table><thead><tr><th>Заявка / клиент</th><th>Банк или партнёр</th><th>Сумма</th><th>Следующий шаг</th><th>Статус и история</th><th>Действия</th></tr></thead><tbody>{shown.map((deal) => <tr key={deal.id}><td><b>{deal.product}</b><small>{deal.companyName}</small><small>Версия анализа: {deal.analysisId?.slice(0,8)||"Не привязана"}</small></td><td><b>{deal.bank || "Выбирается"}</b><small>{deal.owner}</small></td><td><strong>{rubles(deal.amount)}</strong></td><td>{deal.nextAction}</td><td><span className="ps-application-status">{deal.status}</span><details className="ps-status-history"><summary>История · {deal.statusHistory?.length ?? 0}</summary>{deal.statusHistory?.map((item) => <p key={item.id}><b>{item.toStatus}</b><small>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))} · {item.publicComment}</small></p>)}</details></td><td><div className="ps-application-actions"><button className="ps-chat-open" onClick={() => setChatDeal(deal)}><MessageSquareText /> Чат</button>{!["Выдана", "Закрыта", "Отклонена", "Отменена клиентом"].includes(deal.status) && <button className="ps-cancel-application" onClick={() => window.confirm("Отменить заявку?") && updateDeal(deal.id, "Отменена клиентом")}>Отменить</button>}</div></td></tr>)}</tbody></table></div> : <div className="ps-empty-crm"><BriefcaseBusiness /><h3>Заявок пока нет</h3><p>Создайте обращение из подходящего маршрута или добавьте его вручную.</p><button onClick={() => setOpen(true)}>Создать первую заявку</button></div>}</section>{chatDeal && <ApplicationChat applicationId={chatDeal.id} title={`${chatDeal.product} · ${chatDeal.bank || "выбор банка"}`} companyInn={selected?.companyInn || ""} analysisId={chatDeal.analysisId} role="client" close={() => setChatDeal(null)} />}</>;
}

function DealForm({ analyses, selected, initialProduct, close, submit }: { analyses: StoredAnalysis[]; selected: StoredAnalysis | null; initialProduct?: string; close: () => void; submit: (deal: Omit<Deal, "id">) => void }) {
  const [analysisId, setAnalysisId] = useState(selected?.id ?? analyses[0]?.id ?? "");
  const [product, setProduct] = useState(initialProduct || selected?.recommendations[0]?.product || "Оборотная линия");
  const [bank, setBank] = useState("");
  const [amount, setAmount] = useState(0);
  const [nextAction, setNextAction] = useState("Собрать документы и выбрать 3 партнёров");
  const company = analyses.find((item) => item.id === analysisId) ?? selected;
  return <div className="ps-deal-form ps-card"><div><span><small>НОВАЯ ЗАЯВКА В БАНК</small><h2>Подготовить обращение</h2></span><button onClick={close}><X /></button></div><div className="ps-form-grid"><label>Компания<select value={analysisId} onChange={(event) => setAnalysisId(event.target.value)}>{analyses.map((item) => <option key={item.id} value={item.id}>{item.companyName} · {item.periodTo}</option>)}</select></label><label>Банк или партнёр<input value={bank} onChange={(event) => setBank(event.target.value)} placeholder="Можно выбрать позже" /></label><label>Продукт<select value={product} onChange={(event) => setProduct(event.target.value)}><option>Оборотная линия</option><option>Контрактный кредит</option><option>Овердрафт</option><option>Факторинг</option><option>Рефинансирование</option><option>Лизинг</option><option>Банковская гарантия</option></select></label><label>Сумма, ₽<input type="number" min="0" step="10000" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><label>Следующее действие<input value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></label></div><div className="ps-form-actions"><button onClick={close}>Отмена</button><button disabled={!company} onClick={() => company && submit({ analysisId: company.id, companyName: company.companyName, product, bank, amount, status: "Черновик", owner: "Клиент", nextAction: nextAction || "Выбрать банк и проверить документы" })}>Создать черновик <ArrowRight /></button></div><p className="ps-legal-line">Создание черновика не передаёт данные в банк. Перед отправкой потребуется отдельное согласие клиента.</p></div>;
}

function Methodology() {
  const layers: Array<[string, string]> = [["Стабильность оборота", "Динамика и повторяемость операционных поступлений"], ["Ликвидность", "Остатки, кассовые разрывы и запас оплаты обязательств"], ["Финансовая дисциплина", "Налоги, назначение списаний и качество данных"], ["Концентрация", "Зависимость от крупнейших источников выручки"], ["Долговая нагрузка", "Подтверждённые платежи по выпискам и БКИ"], ["Финансовая отчётность", "Капитал, прибыль, ликвидность и структура баланса"], ["Правовой контур", "Статус и события, требующие проверки"], ["Сверка источников", "Расхождения между выписками, БФО, БКИ и контрактами"]];
  const layerCounts = creditPolicyLayerCounts();
  return <><PageHeading kicker="ОБЪЯСНИМАЯ МОДЕЛЬ" title="Как устроен анализ Прескор" body="Показываем источники, смысл показателей и доказательства каждого вывода. Точные веса, пороги и внутренние правила остаются серверной методологией и не раскрываются в кабинете." /><div className="ps-method-layout"><section className="ps-card"><CardTitle title="Что проверяет расчёт" subtitle="Категории факторов без раскрытия формул и весов" /><div className="ps-weights">{layers.map(([name, detail]) => <div key={name}><span><b>{name}</b><small>{detail}</small></span><div><i style={{ width: "100%" }} /></div><strong>Проверка</strong></div>)}</div></section><aside><div className="ps-card ps-method-principle"><ShieldCheck /><span>ПРИНЦИП МОДЕЛИ</span><h3>Объяснимый результат</h3><p>Расчёт детерминирован и выполняется на сервере. AI может объяснить готовый вывод, но не считает индекс и не меняет решение ядра.</p></div><div className="ps-card ps-index-roadmap"><h3>Единый кредитный профиль</h3><span><i className="done"><Check /></i><b>B · Банковский поток</b><small>операционная выручка и движение денег</small></span><span><i className="done"><Check /></i><b>F · Финансовая отчётность</b><small>баланс и финансовый результат</small></span><span><i className="done"><Check /></i><b>L · Правовой контур</b><small>статус и события к проверке</small></span><span><i>C</i><b>Кредитная история</b><small>отдельный портфель и долговая ёмкость</small></span></div></aside></div><section className="ps-card ps-policy-coverage"><div><small>КРЕДИТНАЯ ПОЛИТИКА · ВЕРСИЯ 1.1</small><h2>{creditPolicySummary.total} проверок в каталоге правил</h2><p>Глобальный стоп, блок анализа, стоп конкретного маршрута, высокий риск и зона внимания разделены. Отсутствующее поле не считается нулём: система показывает, какой источник требуется.</p></div><div className="ps-policy-kpis"><span><b>{creditPolicySummary.automated}</b><small>автоматических проверок</small></span><span><b>{creditPolicySummary.partial}</b><small>комбинированных проверок</small></span><span><b>{creditPolicySummary.dataRequired}</b><small>активируются по документу или ручной проверке</small></span><span><b>{creditPolicySummary.layers.length}</b><small>аналитических слоёв</small></span></div><div className="ps-policy-layers">{Object.entries(layerCounts).map(([layer, count]) => <span key={layer}><b>{layer}</b><i>{count}</i></span>)}</div><p className="ps-plan-rule"><ShieldCheck /> Внутренние формулы, веса и банковские модели не публикуются. Прескор не обещает одобрение: он объясняет риск и формирует проверяемый маршрут.</p></section></>;
}
