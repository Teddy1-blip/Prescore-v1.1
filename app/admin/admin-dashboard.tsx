"use client";

import Link from "next/link";
import { Activity, BadgeRussianRuble, BarChart3, BriefcaseBusiness, Building2, Database, FileArchive, Gauge, LayoutDashboard, LoaderCircle, LockKeyhole, Plus, RefreshCw, Search, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";

type Module = { moduleKey: string; label: string; enabled: number; updatedAt: string };
type Subscription = { id: string; analysisId: string; companyInn: string; companyName: string; userEmail: string; tier: "FREE" | "FULL"; paymentOrderId: string; grantedBy: string; grantedAt: string; revokedAt: string; updatedAt: string };
type PaymentOrder = { id: string; orderNumber: string; payerType: string; payerInn: string; payerName: string; companyInn: string; companyName: string; userEmail: string; amount: number; analysisId: string; productType: string; status: string; createdAt: string };
type ControlCategory = "stop_factor" | "policy_rule" | "recommendation" | "bank" | "product" | "metric";
type Control = { controlKey: string; category: ControlCategory; label: string; groupName: string; description: string; enabled: number; updatedAt?: string };
type AdminData = { admin: { displayName: string; email: string }; modules: Module[]; controls: Control[]; controlSummary: Record<ControlCategory, { total: number; enabled: number }>; subscriptions: Subscription[]; orders: PaymentOrder[]; summary: Record<string, number>; expert: { averageScore: number; criticalSignals: number; recommendationsCount: number; limitPotential: number }; recommendationThemes: Array<{ title: string; count: number }>; daily: Array<{ day: string; count: number }>; applicationStatuses: Array<{ status: string; count: number; amount: number }>; products: Array<{ product: string; count: number; amount: number }>; storage: { files?: number; bytes?: number; companies?: number } };

const rubles = (value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
const date = (value: string) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
const controlLabels: Record<ControlCategory, string> = { stop_factor: "Стоп-факторы", policy_rule: "Правила кредитной политики", recommendation: "Рекомендации", bank: "Банки и партнёры", product: "Финансовые продукты", metric: "Показатели отчёта" };

export default function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [controlCategory, setControlCategory] = useState<ControlCategory>("stop_factor");
  const [controlQuery, setControlQuery] = useState("");
  const [busyKey, setBusyKey] = useState("");

  async function load() {
    const response = await fetch("/api/admin");
    const body = await response.json() as AdminData & { error?: string };
    if (!response.ok) throw new Error(body.error || "Панель недоступна");
    setData(body);
    setError("");
  }
  async function change(body: Record<string, unknown>) {
    const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) throw new Error(payload.error || "Настройка не сохранена");
  }
  useEffect(() => {
    let active = true;
    fetch("/api/admin").then(async (response) => {
      const body = await response.json() as AdminData & { error?: string };
      if (!response.ok) throw new Error(body.error || "Панель недоступна");
      return body;
    }).then((body) => { if (active) setData(body); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Панель недоступна"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function toggleModule(item: Module) {
    if (!window.confirm(`${item.enabled ? "Отключить" : "Включить"} модуль «${item.label}» для всех кабинетов?`)) return;
    setBusyKey(`module:${item.moduleKey}`); setError("");
    try { await change({ type: "module", moduleKey: item.moduleKey, enabled: !item.enabled }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Модуль не изменён"); }
    finally { setBusyKey(""); }
  }
  async function toggleControl(item: Control) {
    if (!window.confirm(`Изменить настройку «${item.label}»? Изменение будет записано в журнал.`)) return;
    setBusyKey(item.controlKey); setError("");
    try { await change({ type: "control", controlKey: item.controlKey, enabled: !item.enabled }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Показатель не изменён"); }
    finally { setBusyKey(""); }
  }
  async function bulkControls(category: ControlCategory, enabled: boolean) {
    if (!window.confirm(`${enabled ? "Включить" : "Отключить"} всю группу «${controlLabels[category]}»?`)) return;
    setBusyKey(`bulk:${category}`); setError("");
    try { await change({ type: "bulk-control", category, enabled }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Группа не изменена"); }
    finally { setBusyKey(""); }
  }
  async function toggleAccess(item: Subscription) {
    if (!window.confirm(`${item.tier === "FULL" ? "Закрыть" : "Открыть"} FULL для анализа ${item.analysisId}?`)) return;
    setBusyKey(`access:${item.id}`); setError("");
    try { await change({ type: "access", id: item.id, enabled: item.tier !== "FULL" }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Доступ не изменён"); }
    finally { setBusyKey(""); }
  }
  async function confirmOrder(item: PaymentOrder) {
    if (!window.confirm(`Подтвердить оплату заказа ${item.orderNumber} и открыть FULL для выбранного анализа?`)) return;
    const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "confirm-order", id: item.id }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) { setError(body.error || "Не удалось подтвердить заказ"); return; }
    await load();
  }
  if (loading) return <main className="ad-loading"><LoaderCircle /><b>Загружаю центр управления…</b></main>;
  if (!data) return <main className="ad-loading"><LockKeyhole /><b>{error || "Нет доступа"}</b></main>;
  const summary = data.summary;
  const dailyMax = Math.max(1, ...data.daily.map((item) => Number(item.count)));
  const statusMax = Math.max(1, ...data.applicationStatuses.map((item) => Number(item.count)));
  const normalizedQuery = controlQuery.trim().toLocaleLowerCase("ru-RU");
  const visibleControls = data.controls.filter((item) => item.category === controlCategory && (!normalizedQuery || `${item.label} ${item.groupName} ${item.description} ${item.controlKey}`.toLocaleLowerCase("ru-RU").includes(normalizedQuery)));
  return <main className="ad-shell"><aside className="ad-sidebar"><Link href="/"><strong>Прескор</strong><small>АДМИН</small></Link><nav><a href="#overview"><LayoutDashboard /> Обзор</a><a href="#modules"><Gauge /> Модули</a><a href="#controls"><Settings2 /> Показатели</a><a href="#access"><UsersRound /> Доступы</a><a href="#applications"><BriefcaseBusiness /> Заявки</a><a href="#storage"><Database /> Хранилище</a></nav><div><ShieldCheck /><b>{data.admin.displayName}</b><small>{data.admin.email}</small></div><Link className="pv-logout" href="/logout">Выйти из кабинета</Link><Link className="pv-logout" href="/logout">Выйти из кабинета</Link></aside><section className="ad-main"><header><span><small>ЦЕНТР УПРАВЛЕНИЯ</small><b>Все данные Прескор</b></span><div><button onClick={() => void load()}><RefreshCw /> Обновить</button><Link href="/agent">Кабинет агента</Link><Link href="/dashboard">Кабинет клиента</Link></div></header><div className="ad-content">
    {error && <div className="ad-error">{error}</div>}
    <section className="ad-heading" id="overview"><div><span>ОПЕРАЦИОННЫЙ ДАШБОРД</span><h1>Клиенты, оплаты, доступы и продуктовые сигналы</h1><p>Единый контроль аналитики, заявок, документов и разовых доступов FULL к конкретным версиям анализа.</p></div><button onClick={() => setFormOpen(!formOpen)}><Plus /> Открыть FULL</button></section>
    {formOpen && <SubscriptionForm saved={async () => { await load(); setFormOpen(false); }} />}
    <div className="ad-kpis"><Kpi icon={<UsersRound />} label="КЛИЕНТОВ" value={String(summary.clients || 0)} note={`${summary.analyses || 0} анализов`} /><Kpi icon={<BadgeRussianRuble />} label="ОПЛАТЫ" value={rubles(summary.revenue)} note={`${summary.activeFull || 0} анализов FULL`} good /><Kpi icon={<BriefcaseBusiness />} label="ЗАЯВКИ" value={String(summary.applications || 0)} note={`${summary.approvals || 0} одобрено`} /><Kpi icon={<FileArchive />} label="ДОКУМЕНТЫ" value={String(summary.documents || 0)} note={`${summary.messages || 0} сообщений`} /></div>
    <div className="ad-kpis ad-expert-kpis"><Kpi icon={<Gauge />} label="СРЕДНИЙ B-SCORE" value={String(data.expert.averageScore)} note="по всем сохранённым анализам" good /><Kpi icon={<ShieldCheck />} label="КРИТИЧЕСКИЕ СИГНАЛЫ" value={String(data.expert.criticalSignals)} note="в экспертных заключениях" /><Kpi icon={<Activity />} label="РЕКОМЕНДАЦИИ" value={String(data.expert.recommendationsCount)} note="сформировано системой" /><Kpi icon={<BadgeRussianRuble />} label="ПОТЕНЦИАЛ ЛИМИТОВ" value={rubles(data.expert.limitPotential)} note="сумма расчётных верхних границ" /></div>
    <div className="ad-kpis"><Kpi icon={<Activity />} label="AI-ВОПРОСЫ" value={String(summary.aiQuestions || 0)} note={`${summary.aiSuccess || 0} успешных ответов`} /><Kpi icon={<Gauge />} label="AI-ТОКЕНЫ" value={Number(summary.aiTokens || 0).toLocaleString("ru-RU")} note={`средняя задержка ${Math.round(Number(summary.aiLatency || 0))} мс`} /><Kpi icon={<ShieldCheck />} label="АУДИТ" value={String(summary.auditEvents || 0)} note="событий действий и статусов" /><Kpi icon={<Database />} label="ХРАНИЛИЩЕ" value={`${data.storage.files || 0} файлов`} note={`${((data.storage.bytes || 0) / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} МБ`} /></div>
    <div className="ad-charts"><section className="ad-card"><header><span><small>ДИНАМИКА</small><h2>Новые анализы</h2></span><Activity /></header><div className="ad-bar-chart">{data.daily.map((item) => <span key={item.day}><i style={{ height: `${Math.max(8, Number(item.count) / dailyMax * 100)}%` }} /><b>{item.count}</b><small>{item.day.slice(5)}</small></span>)}</div></section><section className="ad-card"><header><span><small>ВОРОНКА</small><h2>Статусы заявок</h2></span><BarChart3 /></header><div className="ad-horizontal">{data.applicationStatuses.map((item) => <div key={item.status}><span><b>{item.status}</b><small>{item.count} · {rubles(item.amount)}</small></span><i><em style={{ width: `${Number(item.count) / statusMax * 100}%` }} /></i></div>)}</div></section></div>
    <section className="ad-card"><header><span><small>ЭКСПЕРТНАЯ АНАЛИТИКА</small><h2>Какие рекомендации формируются чаще</h2><p>Агрегировано из сохранённых кредитных заключений без раскрытия исходных назначений платежей.</p></span><ShieldCheck /></header><div className="ad-recommendations">{data.recommendationThemes.length ? data.recommendationThemes.map((item, index) => <div key={item.title}><i>{index + 1}</i><span><b>{item.title}</b><small>{item.count} раз(а)</small></span></div>) : <p>Рекомендации появятся после первых анализов.</p>}</div></section>
    <section className="ad-card" id="modules"><header><span><small>УПРАВЛЕНИЕ ПРОДУКТОМ</small><h2>Модули и вкладки</h2><p>Выключенный модуль скрывается в клиентском кабинете. Настройка применяется ко всем новым сессиям.</p></span><Gauge /></header><div className="ad-modules">{data.modules.map((item) => <button disabled={Boolean(busyKey)} key={item.moduleKey} className={item.enabled ? "enabled" : ""} onClick={() => void toggleModule(item)}><span><b>{item.label}</b><small>{busyKey === `module:${item.moduleKey}` ? "сохраняется…" : item.moduleKey}</small></span><i><em /></i></button>)}</div></section>
    <section className="ad-card ad-control-center" id="controls"><header><span><small>ГРАНУЛЯРНОЕ УПРАВЛЕНИЕ ВЫДАЧЕЙ</small><h2>Стоп-факторы, рекомендации, банки, продукты и показатели</h2><p>Отключение влияет на клиентский отчёт и подбор: сигнал исключается из активного заключения, рекомендация скрывается, а банк или продукт не попадает в маршруты. Изменения фиксируются в журнале аудита.</p></span><Settings2 /></header><div className="ad-control-summary">{(Object.entries(controlLabels) as Array<[ControlCategory, string]>).map(([category, label]) => { const item = data.controlSummary[category] ?? { total: 0, enabled: 0 }; return <button key={category} className={controlCategory === category ? "active" : ""} onClick={() => setControlCategory(category)}><span><b>{label}</b><small>{item.enabled} из {item.total} включено</small></span><strong>{item.total ? Math.round(item.enabled / item.total * 100) : 0}%</strong></button>; })}</div><div className="ad-control-toolbar"><label><Search /><input value={controlQuery} onChange={(event) => setControlQuery(event.target.value)} placeholder="Найти показатель, код, банк или продукт" /></label><div><button disabled={Boolean(busyKey)} onClick={() => void bulkControls(controlCategory, true)}>Включить все</button><button disabled={Boolean(busyKey)} onClick={() => void bulkControls(controlCategory, false)}>Отключить все</button></div></div><div className="ad-control-count">Показано {visibleControls.length} · {controlLabels[controlCategory]}</div><div className="ad-controls">{visibleControls.map((item) => <button disabled={Boolean(busyKey)} key={item.controlKey} className={item.enabled ? "enabled" : ""} onClick={() => void toggleControl(item)}><span><small>{item.groupName}</small><b>{item.label}</b><p>{item.description}</p><em>{item.controlKey}</em></span><i><em /></i></button>)}</div>{!visibleControls.length && <p className="ad-control-empty">По этому запросу настройки не найдены.</p>}</section>
    <section className="ad-card" id="access"><header><span><small>FREE / FULL</small><h2>Доступы к версиям анализа</h2><p>FULL открывается для одного конкретного расчёта без срока действия. Отключение возвращает этому расчёту безопасное представление FREE.</p></span><Building2 /></header><div className="ad-table"><table><thead><tr><th>Клиент</th><th>Анализ</th><th>Основание</th><th>Обновлён</th><th>Тариф</th><th></th></tr></thead><tbody>{data.subscriptions.map((item) => <tr key={item.id}><td><b>{item.companyName}</b><small>ИНН {item.companyInn} · {item.userEmail || "email не указан"}</small></td><td><small>{item.analysisId}</small></td><td><b>{item.grantedBy || "SYSTEM"}</b><small>{item.paymentOrderId || "без заказа"}</small></td><td>{date(item.updatedAt)}</td><td><span className={item.tier === "FULL" ? "good" : ""}>{item.tier}</span></td><td><button disabled={Boolean(busyKey)} onClick={() => void toggleAccess(item)}>{busyKey === `access:${item.id}` ? "Сохраняется…" : item.tier === "FULL" ? "Вернуть FREE" : "Открыть FULL"}</button></td></tr>)}</tbody></table></div></section>
    <section className="ad-card"><header><span><small>ЗАКАЗЫ НА ОПЛАТУ</small><h2>Разовые заказы Prescore Full</h2><p>Подтверждение фиксирует оплату 6 500 ₽ и открывает полный результат конкретного анализа. Если анализ ещё не создан, заказ останется ожидающим привязки.</p></span><BadgeRussianRuble /></header><div className="ad-table"><table><thead><tr><th>Заказ</th><th>Клиент</th><th>Анализ</th><th>Сумма</th><th>Статус</th><th></th></tr></thead><tbody>{data.orders.map((item) => <tr key={item.id}><td><b>{item.orderNumber}</b><small>{date(item.createdAt)}</small></td><td><b>{item.companyName}</b><small>ИНН {item.companyInn} · {item.userEmail}</small></td><td><small>{item.analysisId || "привязать к следующему анализу"}</small></td><td>{rubles(item.amount)}</td><td><span className={item.status === "Оплачен" ? "good" : ""}>{item.status}</span></td><td>{item.status !== "Оплачен" && <button onClick={() => void confirmOrder(item)}>Подтвердить оплату</button>}</td></tr>)}</tbody></table></div></section>
    <div className="ad-lower"><section className="ad-card" id="applications"><header><span><small>ПРОДУКТОВАЯ АНАЛИТИКА</small><h2>Что выбирают клиенты</h2></span><BriefcaseBusiness /></header><div className="ad-product-list">{data.products.map((item) => <div key={item.product}><span><b>{item.product}</b><small>{item.count} заявок</small></span><strong>{rubles(item.amount)}</strong></div>)}</div></section><section className="ad-card" id="storage"><header><span><small>ХРАНИЛИЩЕ ДОКУМЕНТОВ</small><h2>Пилотный контур</h2></span><Database /></header><div className="ad-storage"><b>{data.storage.files || 0} файлов</b><strong>{((data.storage.bytes || 0) / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} МБ</strong><span>{data.storage.companies || 0} компаний</span><p>Содержимое хранится с ключом ИНН / заявка / документ. Позже файлы можно перенести в отдельное объектное хранилище, сохранив идентификаторы и интерфейсы.</p></div></section></div>
  </div></section></main>;
}

function Kpi({ icon, label, value, note, good }: { icon: ReactNode; label: string; value: string; note: string; good?: boolean }) { return <article className={good ? "good" : ""}><i>{icon}</i><small>{label}</small><b>{value}</b><span>{note}</span></article>; }

function SubscriptionForm({ saved }: { saved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "subscription", companyName: form.get("companyName"), companyInn: form.get("companyInn"), userEmail: form.get("userEmail"), analysisId: form.get("analysisId"), payerType: form.get("payerType"), payerInn: form.get("payerInn"), amount: Number(form.get("amount")), paymentConfirmed: form.get("paymentConfirmed") === "on" }) }); const body = await response.json() as { error?: string }; if (!response.ok) { setError(body.error || "Не удалось включить доступ"); setSaving(false); return; } await saved(); }
  return <form className="ad-subscription-form" onSubmit={submit}><div><label>Компания<input name="companyName" placeholder="ООО «Компания»" required /></label><label>ИНН клиента<input name="companyInn" inputMode="numeric" required /></label><label>Email доступа<input name="userEmail" type="email" /></label><label>ID анализа (необязательно)<input name="analysisId" placeholder="Будет выбран последний по ИНН" /></label><label>Плательщик<select name="payerType"><option>Юридическое лицо</option><option>ИП</option><option>Физическое лицо</option></select></label><label>ИНН плательщика<input name="payerInn" inputMode="numeric" /></label><label>Сумма, ₽<input name="amount" type="number" defaultValue="6500" min="0" /></label></div><label className="ad-paid"><input name="paymentConfirmed" type="checkbox" defaultChecked /><span>Оплата подтверждена — учесть в выручке</span></label>{error && <p>{error}</p>}<button disabled={saving}>{saving ? "Открываю…" : "Открыть FULL"}</button></form>;
}
