"use client";

import Link from "next/link";
import {WorkspaceShell,WorkspaceHeading,brokerNav} from '../workspace-v3/shell';
import {BrokerClients,BrokerQueue,useBrokerReports} from '../workspace-v3/broker';
import {
  ArrowRight, BadgeRussianRuble, BriefcaseBusiness, CheckCircle2,
  ChevronRight, CircleHelp, Copy, ExternalLink, LayoutDashboard,
  FileSpreadsheet, Link2, LoaderCircle, Menu, MessageSquareText, Network, Plus, Search, ShieldCheck, TrendingUp, UserPlus, UsersRound, X,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { recurringCuratorPayment, recurringReferralPayment } from "../../lib/partner-public";
import { matchGuaranteePolicies } from "../../lib/bank-guarantees";
import "./agent.css";
import "../prescore-ui-v1.css";
import ApplicationChat from "../dashboard/application-chat";

type Lead = {
  id: string; companyName: string; companyInn: string; contactName: string; phone: string; email: string;
  source: string; status: string; subscriptionStatus: string; paidFullOrders?: number; analysisId?: string | null; createdAt: string;
};
type Application = {
  id: string; leadId: string; analysisId?: string; companyName: string; bank: string; product: string;
  requestedAmount: number; calculatedLimit: number; status: string; nextAction: string;
};
type CuratedAgent = { agentCode: string; name: string; agency: string; city: string; status: string; createdAt: string; clientsCount: number; activeSubscriptions: number; monthlyIncome: number };
type OfferOption = { id: string; bank: string; product: string; kind: string };
type AgentData = { agent: { code: string; name: string; referralPath: string; isAdmin?: boolean }; modules?: { prospects?: boolean }; leads: Lead[]; applications: Application[]; offerOptions: OfferOption[]; applicationForecast: number; curator: { referralPath: string; agents: CuratedAgent[]; agentsCount: number; clientsCount: number; activeSubscriptions: number; monthlyIncome: number } };

const agentCode = "";
const columns = ["Новый клиент", "Анализ готов", "Подготовка заявки", "Подготовка документов", "Требуются документы", "На рассмотрении у финансового партнёра", "Предварительное решение", "Одобрена", "Выдана", "Отклонена", "Закрыта"];
const rubles = (value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
const compact = (value: number) => new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value) + " ₽";

export default function AgentDashboard() {
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view,setView]=useState('overview');
  useEffect(()=>{const sync=()=>{const id=window.location.hash.slice(1);setView(brokerNav.some(n=>n.id===id)?id:'overview');};sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
  const reports=useBrokerReports(data?.leads??[]);
  function navigate(id:string){setView(id);window.history.replaceState(null,'','#'+id);}

  const [toast, setToast] = useState("");
  const [leadOpen, setLeadOpen] = useState(false);
  const [appOpen, setAppOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chatApplication, setChatApplication] = useState<Application | null>(null);

  async function load() {
    const response = await fetch("/api/agent");
    const body = await response.json() as AgentData & { error?: string };
    if (!response.ok) throw new Error(body.error || "Не удалось загрузить кабинет");
    setData(body);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/agent")
      .then((response) => { if (!response.ok) throw new Error("load"); return response.json() as Promise<AgentData>; })
      .then((payload) => { if (active) setData(payload); })
      .catch(() => { if (active) setToast("Не удалось загрузить данные"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const effectiveAgentCode = data?.agent.code || "";
  const referralUrl = typeof window === "undefined" ? `/ref/${effectiveAgentCode}` : `${window.location.origin}/ref/${effectiveAgentCode}`;
  const curatorUrl = typeof window === "undefined" ? `/agent-ref/${effectiveAgentCode}` : `${window.location.origin}/agent-ref/${effectiveAgentCode}`;
  const activeSubscriptions = data?.leads.reduce((sum, lead) => sum + (Number(lead.paidFullOrders) || (["FULL", "Активна"].includes(lead.subscriptionStatus) ? 1 : 0)), 0) ?? 0;
  const recurringIncome = activeSubscriptions * recurringReferralPayment;
  const bankPipeline = data?.applicationForecast ?? 0;
  const filteredLeads = data?.leads.filter((lead) => `${lead.companyName} ${lead.companyInn} ${lead.contactName}`.toLowerCase().includes(query.toLowerCase())) ?? [];

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 3200); }
  async function copyReferral() {
    try { await navigator.clipboard.writeText(referralUrl); notify("Реферальная ссылка скопирована"); }
    catch { notify("Не удалось скопировать — выделите ссылку вручную"); }
  }
  async function copyCurator() {
    try { await navigator.clipboard.writeText(curatorUrl); notify("Ссылка куратора скопирована"); }
    catch { notify("Не удалось скопировать — выделите ссылку вручную"); }
  }
  async function updateStatus(id: string, status: string, entity: "lead" | "application") {
    try {
      const response = await fetch("/api/agent", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, entity }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Статус не сохранён");
      await load(); notify("Статус обновлён");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Статус не сохранён"); }
  }

  return <WorkspaceShell role="BROKER" active={view} nav={[...brokerNav,...(data?.modules?.prospects!==false?[{id:'prospects',label:'База для прозвона',href:'/agent/prospects',secondary:true}]:[]),...(data?.agent.isAdmin?[{id:'admin',label:'Администратор',href:'/admin',secondary:true}]:[])]} onNavigate={navigate} company={<><b>{data?.agent.name??'Кабинет брокера'}</b><small>{effectiveAgentCode}</small></>} tools={<><button className="wv-button secondary" onClick={()=>setLeadOpen(true)}>Добавить клиента +</button><button className="wv-button" onClick={()=>setAppOpen(true)}>Новая заявка +</button></>}>
  <WorkspaceHeading eyebrow="РАБОТА С КЛИЕНТАМИ" title={brokerNav.find(n=>n.id===view)?.label??'Рабочий стол'} text="Компания, факты, следующий шаг. Аналитика Prescore и движение заявки — рядом, с раздельными статусами."/>
  {loading?<p role="status">Загружаем рабочий портфель…</p>:!data?<p className="wv-notice" role="alert">Не удалось загрузить кабинет. <button onClick={()=>window.location.reload()}>Повторить</button></p>:<>
  {view==='overview'&&<BrokerQueue leads={data.leads} states={reports} applications={data.applications} onNavigate={navigate}/>}
  {view==='clients'&&<BrokerClients leads={data.leads} states={reports} applications={data.applications}/>}
  {view==='documents'&&<BrokerQueue documentsOnly leads={data.leads} states={reports} applications={data.applications} onNavigate={navigate}/>}
{view==='curator'&&<>        <div className="ag-kpis">
          <Kpi icon={<UsersRound />} label="КЛИЕНТЫ" value={String(data?.leads.length ?? 0)} note={`${activeSubscriptions} оплаченных FULL-анализов`} />
          <Kpi icon={<BadgeRussianRuble />} label="FULL-АНАЛИЗЫ" value={compact(recurringIncome)} note={`${rubles(recurringReferralPayment)} с каждого оплаченного анализа`} good />
          <Kpi icon={<BriefcaseBusiness />} label="ЗАЯВКИ В БАНКИ" value={String(data?.applications.length ?? 0)} note={`${compact(data?.applications.reduce((sum, item) => sum + item.requestedAmount, 0) ?? 0)} запрошено`} />
          <Kpi icon={<TrendingUp />} label="ПРОГНОЗ ПО ВЫДАЧАМ" value={compact(bankPipeline)} note="По средней внутренней доходности" good />
        </div></>}

        {view==='referral'&&<section className="ag-referral" id="referral"><div><i><Link2 /></i><span><small>ПЕРСОНАЛЬНАЯ РЕФЕРАЛЬНАЯ ССЫЛКА</small><h2>Клиент автоматически попадёт в вашу CRM</h2><p>По ссылке клиент оставит данные и согласие. Карточка появится в колонке «Новый клиент».</p></span></div><div><code>{referralUrl}</code><button onClick={copyReferral} disabled={!effectiveAgentCode}><Copy /> Копировать</button>{effectiveAgentCode && <Link href={`/ref/${effectiveAgentCode}`} target="_blank">Открыть <ExternalLink /></Link>}</div></section>}

        {view==='curator'&&<section className="ag-curator" id="curator"><div className="ag-section-title"><div><span>КУРАТОР · ВТОРОЙ УРОВЕНЬ</span><h2>Привлекайте агентов и получайте 10% с их FULL-анализов</h2><p>Куратор не видит компании, ИНН, контакты, документы и заявки клиентов привлечённого агента. Доступны только агрегаты для расчёта вознаграждения.</p></div></div><div className="ag-curator-layout"><article className="ag-curator-link"><i><Network /></i><small>ССЫЛКА ДЛЯ ПРИВЛЕЧЕНИЯ АГЕНТОВ</small><code>{curatorUrl}</code><div><button onClick={copyCurator} disabled={!effectiveAgentCode}><Copy /> Копировать</button>{effectiveAgentCode && <Link href={`/agent-ref/${effectiveAgentCode}`} target="_blank">Открыть <ExternalLink /></Link>}</div><p>Агент сохраняет свои 30% — {rubles(recurringReferralPayment)} с клиента. Вы получаете ещё 10% — {rubles(recurringCuratorPayment)} за каждый оплаченный FULL-анализ его клиента.</p></article><div className="ag-curator-kpis"><Kpi icon={<UsersRound />} label="ПРИВЛЕЧЕНО АГЕНТОВ" value={String(data?.curator.agentsCount ?? 0)} note="Только ваша структура" /><Kpi icon={<BriefcaseBusiness />} label="КЛИЕНТОВ У АГЕНТОВ" value={String(data?.curator.clientsCount ?? 0)} note="Без раскрытия данных клиентов" /><Kpi icon={<BadgeRussianRuble />} label="ДОХОД КУРАТОРА" value={compact(data?.curator.monthlyIncome ?? 0)} note={`${rubles(recurringCuratorPayment)} с оплаченного FULL-анализа`} good /></div></div><div className="ag-card ag-curator-table"><div className="ag-card-head"><span><small>АГЕНТСКАЯ СТРУКТУРА</small><h2>Результаты привлечённых агентов</h2></span><em><ShieldCheck /> Клиентские данные скрыты</em></div><div className="ag-table-scroll"><table><thead><tr><th>Агент</th><th>Статус</th><th>Клиентов всего</th><th>Оплаченных FULL</th><th>Ваши 10%</th></tr></thead><tbody>{data?.curator.agents.map((agent) => <tr key={agent.agentCode}><td><b>{agent.name}</b><small>{agent.agency} · {agent.city} · {agent.agentCode}</small></td><td><span className={agent.status === "Активен" ? "ag-pill good" : "ag-pill"}>{agent.status}</span></td><td><strong>{agent.clientsCount}</strong></td><td><strong>{agent.activeSubscriptions}</strong></td><td><strong>{rubles(agent.monthlyIncome)}</strong></td></tr>)}</tbody></table></div><p className="ag-table-note">Расчётный доход: количество оплаченных FULL-анализов второго уровня × 6 500 ₽ × 10%. Вознаграждение возникает только после фактической оплаты FULL-анализа.</p></div></section>}

        {leadOpen && <LeadForm close={() => setLeadOpen(false)} saved={async () => { await load(); setLeadOpen(false); notify("Клиент добавлен в CRM"); }} />}
        {appOpen && data && <ApplicationForm leads={data.leads} offers={data.offerOptions} close={() => setAppOpen(false)} saved={async () => { await load(); setAppOpen(false); notify("Заявка добавлена в воронку"); }} />}

        {view==='pipeline'&&<section className="ag-section" id="pipeline"><div className="ag-section-title"><div><span>ВОРОНКА ПРОДАЖ</span><h2>Путь клиента от ссылки до выдачи</h2></div><button onClick={() => setAppOpen(true)}><Plus /> Добавить заявку</button></div><div className="ag-pipeline">{columns.map((column) => {
          const leadCards = filteredLeads.filter((lead) => lead.status === column);
          const appCards = (data?.applications ?? []).filter((app) => app.status === column);
          return <div className="ag-column" key={column}><header><b>{column}</b><i>{leadCards.length + appCards.length}</i></header>{leadCards.map((lead) => <article key={lead.id}><small>{lead.source}</small><h3>{lead.companyName}</h3><p>ИНН {lead.companyInn}</p><strong>{["FULL", "Активна"].includes(lead.subscriptionStatus) ? `+${rubles(recurringReferralPayment)} за FULL` : "Ожидает оплаты FULL"}</strong><select value={lead.status} onChange={(event) => updateStatus(lead.id, event.target.value, "lead")}>{columns.slice(0, 3).map((item) => <option key={item}>{item}</option>)}</select></article>)}{appCards.map((app) => <article key={app.id} className="bank-card"><small>{app.bank} · {app.companyName}</small><h3>{app.product}</h3><p>Запрошено {compact(app.requestedAmount)}</p><strong>{app.nextAction}</strong><select value={app.status} onChange={(event) => updateStatus(app.id, event.target.value, "application")}>{columns.slice(2).map((item) => <option key={item}>{item}</option>)}</select><button className="ag-chat-button" onClick={() => setChatApplication(app)}><MessageSquareText /> Чат с клиентом</button></article>)}</div>;
        })}</div></section>}

{view==='applications'&&<section className="ag-card" id="applications"><div className="ag-section-title"><div><span>ЗАЯВКИ В БАНКИ И ПАРТНЁРАМ</span><h2>Заявки и следующие действия</h2></div><button onClick={() => setAppOpen(true)}><Plus /> Новая заявка</button></div><div className="ag-table-scroll"><table><thead><tr><th>Продукт / клиент</th><th>Банк или партнёр</th><th>Запрошено</th><th>База прогноза вознаграждения · legacy</th><th>Статус</th><th>Следующий шаг</th><th>Связь</th></tr></thead><tbody>{data?.applications.map((app) => <tr key={app.id}><td><b>{app.product}</b><small>{app.companyName}</small><small>Версия: {app.analysisId?.slice(0,8)||"Не привязана"}</small></td><td><b>{app.bank}</b></td><td>{rubles(app.requestedAmount)}</td><td>{rubles(app.calculatedLimit)}</td><td><span className="ag-pill">{app.status}</span></td><td>{app.nextAction}</td><td><button className="ag-chat-button" onClick={() => setChatApplication(app)}><MessageSquareText /> Чат</button></td></tr>)}</tbody></table></div><p className="ag-table-note">Сохранённая база прогноза вознаграждения — параметр заявки, не каноническая ёмкость и не одобренный банковский лимит. Статус заявки отделён от оценки Prescore. Доходность партнёра не раскрывается.</p></section>}
      </>}
    {chatApplication && <ApplicationChat applicationId={chatApplication.id} title={`${chatApplication.product} · ${chatApplication.bank}`} companyInn={data?.leads.find((lead) => lead.id === chatApplication.leadId)?.companyInn || ""} analysisId={chatApplication.analysisId || ""} role="broker" close={() => setChatApplication(null)} />}
    {toast && <div className="ag-toast"><CheckCircle2 /> {toast}</div>}
  </WorkspaceShell>;
}

function Kpi({ icon, label, value, note, good }: { icon: ReactNode; label: string; value: string; note: string; good?: boolean }) {
  return <article className={good ? "ag-kpi good" : "ag-kpi"}><i>{icon}</i><small>{label}</small><b>{value}</b><p>{note}</p></article>;
}

function LeadForm({ close, saved }: { close: () => void; saved: () => void }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "lead", agentCode, companyName: form.get("companyName"), companyInn: form.get("companyInn"), contactName: form.get("contactName"), phone: form.get("phone"), email: form.get("email"), consent: form.get("consent") === "on", source: "Добавлен агентом" }) });
    if (!response.ok) { const body = await response.json() as { error?: string }; setError(body.error || "Не удалось сохранить"); setSaving(false); return; } await saved();
  }
  return <form className="ag-modal" onSubmit={submit}><div className="ag-modal-title"><span><small>НОВЫЙ КЛИЕНТ</small><h2>Добавить в CRM</h2></span><button type="button" onClick={close}><X /></button></div><div className="ag-form-grid"><label>Компания<input name="companyName" placeholder="ООО «Компания»" required /></label><label>ИНН<input name="companyInn" inputMode="numeric" pattern="[0-9]{10}|[0-9]{12}" required /></label><label>Контактное лицо<input name="contactName" required /></label><label>Телефон<input name="phone" type="tel" /></label><label>Email<input name="email" type="email" /></label></div><label className="ag-consent"><input type="checkbox" name="consent" required /><span>Подтверждаю, что получил согласие клиента на передачу и обработку указанных данных в Прескор.</span></label>{error && <p className="ag-error">{error}</p>}<div className="ag-actions"><button type="button" onClick={close}>Отмена</button><button disabled={saving}>{saving ? "Сохраняю…" : <>Добавить клиента <ArrowRight /></>}</button></div></form>;
}

function ApplicationForm({ leads, offers, close, saved }: { leads: Lead[]; offers: OfferOption[]; close: () => void; saved: () => void }) {
  const [mode, setMode] = useState<"credit" | "guarantee">("credit"); const [leadId, setLeadId] = useState(leads[0]?.id ?? ""); const [offerIndex, setOfferIndex] = useState(0); const [limit, setLimit] = useState(8_000_000); const [law, setLaw] = useState("44-ФЗ"); const [guaranteeType, setGuaranteeType] = useState("Исполнение контракта"); const [noticeNumber, setNoticeNumber] = useState(""); const [termDays, setTermDays] = useState(365); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const lead = leads.find((item) => item.id === leadId); const offer = offers[offerIndex];
  const guaranteeMatches = matchGuaranteePolicies({ amount: limit, law, guaranteeType, termDays }); const eligiblePolicies = guaranteeMatches.filter((item) => item.eligible);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!lead || (mode === "credit" && !offer)) return; setSaving(true); setError(""); try { const guarantee = mode === "guarantee"; const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "application", applicationType: guarantee ? "guarantee" : "credit", agentCode, leadId: lead.id, analysisId: lead.analysisId || "", companyName: lead.companyName, bank: guarantee ? "Подбор по условиям БГ" : offer.bank, product: guarantee ? "Банковская гарантия" : offer.product, requestedAmount: limit, calculatedLimit: limit, law, guaranteeType, noticeNumber, termDays, nextAction: guarantee ? `Проверить извещение ${noticeNumber || "не указано"}, комплект документов и согласие клиента; ${law}, ${guaranteeType}, срок ${termDays} дней` : "Проверить комплект документов и согласие на передачу в банк" }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || "Не удалось добавить заявку"); await saved(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось добавить заявку"); setSaving(false); } }
  return <form className="ag-modal" onSubmit={submit}><div className="ag-modal-title"><span><small>НОВАЯ ЗАЯВКА</small><h2>Добавить в воронку</h2></span><button type="button" onClick={close}><X /></button></div><div className="ag-application-kind"><button type="button" className={mode === "credit" ? "active" : ""} onClick={() => setMode("credit")}>Кредит / факторинг / лизинг</button><button type="button" className={mode === "guarantee" ? "active" : ""} onClick={() => setMode("guarantee")}>Банковская гарантия</button></div><div className="ag-form-grid"><label>Клиент<select value={leadId} onChange={(event) => setLeadId(event.target.value)}>{leads.map((item) => <option value={item.id} key={item.id}>{item.companyName}</option>)}</select></label>{mode === "credit" ? <label>Партнёр и продукт<select value={offerIndex} onChange={(event) => setOfferIndex(Number(event.target.value))}>{offers.map((item, index) => <option value={index} key={item.id}>{item.kind} · {item.bank} · {item.product}</option>)}</select></label> : <><label>Закон / закупка<select value={law} onChange={(event) => setLaw(event.target.value)}><option>44-ФЗ</option><option>223-ФЗ</option><option>615-ПП</option><option>275-ФЗ</option><option>Коммерция</option></select></label><label>Вид гарантии<select value={guaranteeType} onChange={(event) => setGuaranteeType(event.target.value)}><option>Участие</option><option>Исполнение контракта</option><option>Возврат аванса</option><option>Гарантийные обязательства</option></select></label><label>Номер извещения<input value={noticeNumber} onChange={(event) => setNoticeNumber(event.target.value)} placeholder="Из ЕИС / Gold44" /></label><label>Срок гарантии, дней<input type="number" min="1" max="3650" value={termDays} onChange={(event) => setTermDays(Number(event.target.value))} /></label></>}<label>{mode === "guarantee" ? "Сумма гарантии, ₽" : "Запрашиваемая сумма, ₽"}<input type="number" min="100000" step="100000" value={limit} onChange={(event) => setLimit(Number(event.target.value))} /></label><div className="ag-form-result"><small>{mode === "guarantee" ? "ПРЕДВАРИТЕЛЬНО ПО УСЛОВИЯМ" : "ПАРАМЕТР ЗАЯВКИ"}</small><b>{rubles(limit)}</b><span>{mode === "guarantee" ? `${eligiblePolicies.length} внутренних маршрутов. Подтверждённые названия: ${eligiblePolicies.filter((item) => item.policy.providerConfirmed).map((item) => item.policy.provider).join(", ") || "нет в исходнике"}. Финально проверяются ОПФ, возраст, регион, заказчик и срок.` : "Внутренний прогноз рассчитывается автоматически и отдельно не отображается"}</span></div></div>{error && <p className="ag-error">{error}</p>}<p className="ag-table-note">Предварительное соответствие не является решением банка. До передачи данных повторно проверяются политика партнёра, документы и отдельное согласие клиента.</p><div className="ag-actions"><button type="button" onClick={close}>Отмена</button><button disabled={saving || !lead || (mode === "credit" && !offer)}>{saving ? "Сохраняю…" : <>Добавить заявку <ArrowRight /></>}</button></div></form>;
}
