"use client";

import { AlertTriangle, ArrowRight, Building2, CheckCircle2, FileSearch, FileSpreadsheet, Gauge, RefreshCw, Scale, ShieldCheck, TrendingUp, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import type { CompanyProfileData } from "../../lib/company-profile";
import type { AnalysisResult } from "../../lib/prescore";
import type { UnifiedRiskContext } from "../../lib/risk-context";
import type { QuarterlyFinancialReport } from "../../lib/quarterly-report";
import QuarterlyReport from "./quarterly-report";

const money = (value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
const moneyOrDash = (value: number | null) => value == null ? "Нет данных" : money(value);
const date = (value: string) => value ? new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00`)) : "—";
const pct = (value: number | null) => value == null ? "—" : `${value}%`;
const initials = (value: string) => value.replace(/^(ООО|ПАО|АО|ИП)\s*[«"]?/i, "").replace(/[»"]/g, "").trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "RU";

type AnalysisSummary = Omit<AnalysisResult, "transactions"> & { transactions?: AnalysisResult["transactions"] };

export default function CheckoProfile({ analysis, onAttachQuarterly }: { analysis: AnalysisSummary | null; onAttachQuarterly: (report: QuarterlyFinancialReport) => Promise<void> }) {
  const inn = (analysis?.companyInn ?? "").replace(/\D/g, "");
  const [profile, setProfile] = useState<CompanyProfileData | null>(null);
  const [unified, setUnified] = useState<UnifiedRiskContext | null>(null);
  const [loading, setLoading] = useState(Boolean(inn));
  const [error, setError] = useState("");
  const assessment = unified?.assessment ?? null;
  const combinedInsights = unified?.combinedInsights ?? [];
  const finalConclusion = unified?.finalConclusion ?? null;
  const actionPlan = unified?.actionPlan ?? [];

  async function load(refresh = false) {
    if (!inn) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/checko?inn=${encodeURIComponent(inn)}&analysisId=${encodeURIComponent(analysis?.id || "")}${refresh ? "&refresh=1" : ""}`);
      const body = await response.json() as CompanyProfileData & { error?: string };
      if (!response.ok) throw new Error(body.error || "Не удалось получить профиль компании");
      setProfile(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось получить профиль компании");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!inn) return;
    const controller = new AbortController();
    fetch(`/api/checko?inn=${encodeURIComponent(inn)}&analysisId=${encodeURIComponent(analysis?.id || "")}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as CompanyProfileData & { error?: string };
        if (!response.ok) throw new Error(body.error || "Не удалось получить профиль компании");
        return body;
      })
      .then(setProfile)
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Не удалось получить профиль компании");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [inn, analysis?.id]);

  useEffect(() => {
    if (!profile || !analysis?.id) return;
    const controller = new AbortController();
    fetch(`/api/conclusion?analysisId=${encodeURIComponent(analysis.id)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as UnifiedRiskContext & { error?: string };
        if (!response.ok) throw new Error(body.error || "Не удалось сформировать заключение");
        return body;
      })
      .then(setUnified)
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Не удалось сформировать заключение");
      });
    return () => controller.abort();
  }, [profile, analysis?.id, analysis?.creditHistory, analysis?.quarterlyReport]);

  if (!analysis) return <div className="ps-checko-empty"><Building2 /><h1>Сначала проведите анализ выписок</h1><p>Прескор определит компанию и ИНН, после чего запросит ЕГРЮЛ, БФО и юридические сведения.</p></div>;
  if (!inn) return <div className="ps-checko-empty"><AlertTriangle /><h1>ИНН не найден в выписках</h1><p>Проверьте, что в TXT присутствуют ИНН владельца и его расчетный счет.</p></div>;

  return <>
    <div className="ps-heading"><div><span>ОФИЦИАЛЬНЫЕ И ОТКРЫТЫЕ ИСТОЧНИКИ</span><h1>БФО и кредитная экспертность</h1><p>Официальная отчётность преобразуется в F‑Score, стоп‑факторы и план подготовки. Вместе с банковским потоком и правовым контуром формируется индекс Прескор.</p></div><button className="ps-outline-button" onClick={() => load(true)} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /> Обновить данные</button></div>
    {loading && !profile && <div className="ps-checko-loading"><RefreshCw className="spin" /><b>Получаем профиль по ИНН {inn}…</b><span>Запрашиваем официальные сведения и приводим их к модели Прескор.</span></div>}
    {error && <div className="ps-checko-error"><AlertTriangle /><span><b>Внешний источник не вернул профиль</b><small>{error}</small></span><button onClick={() => load(true)}>Повторить</button></div>}
    <QuarterlyReport analysis={analysis} onAttach={onAttachQuarterly} />
    {profile && assessment && <>
      <section className="ps-checko-company ps-card">
        <div className="ps-checko-logo">{initials(profile.company.name)}</div>
        <div><span>ИНН {profile.inn} · ОГРН {profile.company.ogrn || "—"}</span><h2>{profile.company.name || analysis.companyName}</h2><p>{profile.company.okvedCode ? `${profile.company.okvedCode} · ` : ""}{profile.company.okved || "Вид деятельности не указан"}</p></div>
        <aside><small>СТАТУС ЕГРЮЛ</small><b className={profile.company.status.toLowerCase().includes("действ") ? "good" : "warn"}>{profile.company.status}</b><span>Регистрация: {date(profile.company.registrationDate)}</span></aside>
      </section>

      {finalConclusion && <section className={`ps-full-conclusion ps-card ${finalConclusion.code.toLowerCase()}`}>
        <header><div><span>ОБЩЕЕ КРЕДИТНОЕ ЗАКЛЮЧЕНИЕ · {finalConclusion.code}</span><h2>{finalConclusion.verdict}</h2><p>Выписки + БФО + правовой контур + контракты из официальных реестров + БКИ</p></div><aside><small>ДОСТОВЕРНОСТЬ</small><strong>{finalConclusion.confidence}%</strong></aside></header>
        <div className="ps-full-conclusion-body"><article><h3>Экспертный вывод</h3><p>{finalConclusion.conclusion}</p><p><b>{finalConclusion.decision}</b></p></article><aside><span><small>Расчётный диапазон</small><b>{money(finalConclusion.limitMin)} - {money(finalConclusion.limitMax)}</b></span><span><small>Основной продукт</small><b>{finalConclusion.product?.product ?? "После подтверждения цели"}</b></span><span><small>Решение Прескор</small><b>{finalConclusion.hardStop ? "Сначала устранить стоп" : "Подготовленная подача"}</b></span></aside></div>
        <div className="ps-conclusion-sources"><span className="ready"><CheckCircle2 /><b>Выписки</b><small>{analysis.metrics.statements} файлов · {analysis.metrics.months} мес.</small></span><span className={profile.finances.latestYear ? "ready" : "missing"}><TrendingUp /><b>БФО</b><small>{profile.finances.latestYear || "не найдена"}</small></span><span className={analysis.quarterlyReport ? "ready" : "missing"}><FileSpreadsheet /><b>Квартальная</b><small>{analysis.quarterlyReport?.period ?? "не загружена"}</small></span><span className="ready"><Scale /><b>Правовой контур</b><small>{profile.legal.legalCases + profile.legal.enforcements} событий к проверке</small></span><span className={profile.contracts?.totalCount ? "ready" : "missing"}><FileSearch /><b>Контракты</b><small>{profile.contracts?.totalCount ?? 0} записей</small></span><span className={analysis.creditHistory ? "ready" : "missing"}><WalletCards /><b>БКИ</b><small>{analysis.creditHistory ? `${analysis.creditHistory.obligations.length} обязательств` : "не загружено"}</small></span></div>
        <div className="ps-conclusion-conditions"><b>{finalConclusion.conditions.length ? "Что ограничивает решение" : "Условия для подачи выполнены"}</b>{finalConclusion.conditions.length ? finalConclusion.conditions.map((item) => <span key={item}><AlertTriangle />{item}</span>) : <span><CheckCircle2 />Критические взаимные противоречия источников не выявлены</span>}</div>
        <p className="ps-legal-disclaimer">Заключение носит информационно-аналитический характер, не является решением, рейтингом или предложением банка и не заменяет проверку первичных документов.</p>
      </section>}

      <div className="ps-financial-score-grid">
        <article className="index"><Gauge /><span><small>ИНДЕКС ПРЕСКОР</small><strong>{assessment.index ?? "—"}<em>{assessment.index == null ? "" : " / 1000"}</em></strong><b>Класс {assessment.grade}</b></span></article>
        <article><FileSearch /><span><small>B · БАНКОВСКИЙ ПОТОК</small><strong>{Math.round((analysis.score ?? 0) * .5)}<em> / 500</em></strong><b>B‑Score {analysis.score ?? "—"}</b></span></article>
        <article><TrendingUp /><span><small>F · ФИНАНСОВАЯ ОТЧЁТНОСТЬ</small><strong>{assessment.fScore ?? "—"}<em> / 400</em></strong><b>БФО {profile.finances.latestYear || "не найдена"}</b></span></article>
        <article><Scale /><span><small>L · ПРАВОВОЙ КОНТУР</small><strong>{assessment.legalScore}<em> / 100</em></strong><b>ЕГРЮЛ, ФССП, события</b></span></article>
      </div>

      <section className={`ps-expert-verdict ps-card ${assessment.factors.some((item) => item.severity === "critical") ? "critical" : "ready"}`}>
        <ShieldCheck /><div><small>ЭКСПЕРТНОЕ ЗАКЛЮЧЕНИЕ · ДОСТОВЕРНОСТЬ РАСЧЁТА {assessment.confidence}%</small><h2>{assessment.verdict}</h2><p>Это объяснимая аналитическая оценка, а не банковское решение. Каждый фактор ниже связан с показателем БФО и содержит действие.</p></div>
        <aside><b>Сильные стороны</b>{assessment.strengths.length ? assessment.strengths.map((item) => <span key={item}><CheckCircle2 />{item}</span>) : <span><AlertTriangle />Недостаточно данных для подтверждения сильных сторон</span>}</aside>
      </section>

      <div className="ps-checko-kpis">
        <article><FileSearch /><span><small>ВЫРУЧКА · БФО {profile.finances.latestYear || "—"}</small><strong>{money(profile.finances.revenue)}</strong><em>{profile.finances.revenueGrowth == null ? "Без годового сравнения" : `${profile.finances.revenueGrowth >= 0 ? "+" : ""}${profile.finances.revenueGrowth}% г/г`}</em></span></article>
        <article><TrendingUp /><span><small>ЧИСТАЯ ПРИБЫЛЬ</small><strong>{money(profile.finances.profit)}</strong><em>Рентабельность продаж {pct(profile.finances.returnOnSales)}</em></span></article>
        <article><ShieldCheck /><span><small>СОБСТВЕННЫЙ КАПИТАЛ</small><strong>{money(profile.finances.equity)}</strong><em>Автономия {pct(profile.finances.autonomy)}</em></span></article>
        <article><Scale /><span><small>ЮРИДИЧЕСКИЕ СОБЫТИЯ</small><strong>{profile.legal.legalCases + profile.legal.enforcements}</strong><em>{profile.legal.enforcements} исполнительных производств</em></span></article>
      </div>

      <section className="ps-card ps-financial-metrics"><div className="ps-card-title"><span><b>Кредитный анализ БФО</b><small>Показатель, банковский ориентир и смысл для кредитного решения</small></span></div><div>{assessment.metrics.map((metric) => <article className={metric.status} key={metric.label}><span><i />{metric.label}</span><strong>{metric.value}</strong><b>{metric.benchmark}</b><p>{metric.explanation}</p></article>)}</div></section>

      {combinedInsights.length > 0 && <section className="ps-card ps-combined-analysis"><div className="ps-card-title"><span><b>Комбинационный кредитный анализ</b><small>Выписки + БФО + правовой контур: вывод формируется только при совпадении нескольких сигналов</small></span></div><div>{combinedInsights.map((item) => <article className={item.severity} key={item.title}><header><i /> <span><small>{item.severity === "positive" ? "ПОДТВЕРЖДЕНО" : item.severity === "critical" ? "КРИТИЧЕСКАЯ СВЯЗКА" : "ТРЕБУЕТ ПОЯСНЕНИЯ"}</small><h3>{item.title}</h3></span></header><p><b>Факты:</b> {item.evidence}</p><p><b>Экспертный вывод:</b> {item.conclusion}</p><dl><div><dt>Влияние на решение</dt><dd>{item.impact}</dd></div><div><dt>Что сделать</dt><dd>{item.action}</dd></div></dl></article>)}</div></section>}

      {analysis.creditHistory && <section className="ps-card ps-evidence-section"><div className="ps-card-title"><span><b>Кредитный портфель по БКИ</b><small>Лимит, остаток, платёж, ставка и качество обслуживания входят в общее заключение</small></span></div><div className="ps-evidence-table"><table><thead><tr><th>Кредитор</th><th>Продукт</th><th>Сумма / лимит</th><th>Остаток</th><th>Платёж</th><th>Ставка</th><th>Качество</th></tr></thead><tbody>{analysis.creditHistory.obligations.map((item) => <tr key={item.id}><td><b>{item.creditor}</b><small>{item.status}</small></td><td>{item.product}</td><td>{moneyOrDash(item.creditLimit ?? item.originalAmount)}</td><td>{moneyOrDash(item.totalOutstanding ?? item.outstandingPrincipal)}</td><td>{moneyOrDash(item.monthlyPayment ?? item.nextPaymentAmount)}</td><td>{item.annualRate == null ? "Нет данных" : `${item.annualRate}%`}</td><td><span className={item.paymentQuality === "Без просрочек" ? "good" : item.paymentQuality === "Недостаточно данных" ? "neutral" : "bad"}>{item.paymentQuality}</span></td></tr>)}</tbody></table></div></section>}

      {profile.contracts && <section className="ps-card ps-contract-evidence"><div className="ps-card-title"><span><b>Контрактный портфель по официальным реестрам</b><small>Госконтракты и договоры 44-ФЗ / 223-ФЗ как подтверждение будущего потока и концентрации</small></span></div><div className="ps-contract-kpis"><span><small>Всего контрактов</small><b>{profile.contracts.totalCount}</b></span><span><small>Общая сумма</small><b>{money(profile.contracts.totalAmount)}</b></span><span><small>Активные</small><b>{profile.contracts.activeCount} · {money(profile.contracts.activeAmount)}</b></span><span><small>TOP-заказчик</small><b>{profile.contracts.topCustomerShare == null ? "Нет данных" : `${profile.contracts.topCustomerShare}%`}</b></span></div>{profile.contracts.items.length > 0 && <div className="ps-evidence-table"><table><thead><tr><th>Контракт</th><th>Заказчик</th><th>Закон</th><th>Сумма</th><th>Заключён</th><th>Срок исполнения</th><th>Статус</th></tr></thead><tbody>{profile.contracts.items.map((item, index) => <tr key={`${item.number}-${index}`}><td>{item.number || "—"}</td><td><b>{item.customer}</b></td><td>{item.law}</td><td>{money(item.amount)}</td><td>{item.signedAt || "—"}</td><td>{item.executionAt || "—"}</td><td><span className={/исполнен|заверш/i.test(item.status) ? "good" : "neutral"}>{item.status}</span></td></tr>)}</tbody></table></div>}<p className="ps-legal-disclaimer">Контракты подтверждают портфель заказов, но не гарантируют будущую выручку: учитываются срок исполнения, неисполненный остаток, маржа, приёмка, расторжения, штрафы и концентрация на заказчиках. Общая цена контракта не считается доступным лимитом.</p></section>}

      <section className="ps-card ps-action-plan ps-action-plan-full"><div className="ps-card-title"><span><b>Расширенный план 7 / 30 / 60</b><small>Сформирован из выписок, БФО, квартальной формы, правового контура, контрактов и БКИ</small></span></div><div>{actionPlan.map((phase) => <article key={phase.horizon}><header><strong>{phase.horizon}</strong><span><small>ДНЕЙ</small><b>{phase.title}</b></span></header>{phase.items.map((item) => <div key={item.title} className={item.priority}><span><h3>{item.title}</h3><p>{item.action}</p></span><dl><div><dt>Основание</dt><dd>{item.reason}</dd></div><div><dt>Контрольный результат</dt><dd>{item.result}</dd></div><div><dt>Ответственный</dt><dd>{item.owner}</dd></div></dl></div>)}</article>)}</div><p className="ps-plan-rule"><ShieldCheck /> Достоверные показатели и документы не изменяются ради заявки. При отказном профиле план помогает проверить причины, законно снизить управляемые риски и накопить подтверждённую динамику.</p></section>

      <div className="ps-financial-analysis-grid">
        <section className="ps-card"><div className="ps-card-title"><span><b>Стоп‑факторы БФО и правового контура</b><small>Сигнал → влияние → исправление</small></span></div><div className="ps-financial-factor-list">{assessment.factors.length ? assessment.factors.map((factor) => <article className={factor.severity} key={factor.title}>{factor.severity === "info" ? <CheckCircle2 /> : <AlertTriangle />}<div><span>{factor.severity === "critical" ? "СТОП" : factor.severity === "warning" ? "ПРОВЕРИТЬ" : "ИНФО"}</span><h3>{factor.title}</h3><p>{factor.detail}</p><dl><div><dt>Влияние</dt><dd>{factor.impact}</dd></div><div><dt>Что сделать</dt><dd>{factor.action}</dd></div></dl></div></article>) : <div className="ps-no-financial-factors"><CheckCircle2 /><b>Критических сигналов не найдено</b><span>Перед подачей всё равно требуется проверка кредитной истории и документов сделки.</span></div>}</div></section>
        <aside className="ps-card ps-financial-plan"><div className="ps-card-title"><span><b>План подготовки</b><small>Приоритетные действия по профилю</small></span></div>{assessment.recommendations.map((item, index) => <article key={`${item.title}-${index}`}><i>{String(index + 1).padStart(2, "0")}</i><div><span>{item.horizon}</span><h3>{item.title}</h3><p>{item.reason}</p><b>{item.action}</b></div><ArrowRight /></article>)}</aside>
      </div>

      <div className="ps-checko-grid">
        <section className="ps-card"><div className="ps-card-title"><span><b>Структура баланса и результата</b><small>Отсутствующее поле показывается как «Нет данных», а не как ноль</small></span></div><div className="ps-finance-table"><span><small>Активы</small><b>{profile.finances.latestYear ? money(profile.finances.assets) : "Нет данных"}</b></span><span><small>Внеоборотные активы</small><b>{moneyOrDash(profile.finances.nonCurrentAssets ?? null)}</b></span><span><small>Оборотные активы</small><b>{profile.finances.latestYear ? money(profile.finances.currentAssets) : "Нет данных"}</b></span><span><small>Запасы</small><b>{moneyOrDash(profile.finances.inventories ?? null)}</b></span><span><small>НДС по приобретённым ценностям</small><b>{moneyOrDash(profile.finances.inputVat ?? null)}</b></span><span><small>Дебиторская задолженность</small><b>{profile.finances.latestYear ? money(profile.finances.receivables) : "Нет данных"}</b></span><span><small>Денежные средства</small><b>{profile.finances.latestYear ? money(profile.finances.cash) : "Нет данных"}</b></span><span><small>Собственный капитал</small><b>{profile.finances.latestYear ? money(profile.finances.equity) : "Нет данных"}</b></span><span><small>Долгосрочные обязательства</small><b>{moneyOrDash(profile.finances.longTermLiabilities ?? null)}</b></span><span><small>Долгосрочные займы</small><b>{moneyOrDash(profile.finances.longTermBorrowings ?? null)}</b></span><span><small>Краткосрочные займы</small><b>{moneyOrDash(profile.finances.shortTermBorrowings ?? null)}</b></span><span><small>Кредиторская задолженность</small><b>{profile.finances.latestYear ? money(profile.finances.payables) : "Нет данных"}</b></span><span><small>Валовая прибыль</small><b>{moneyOrDash(profile.finances.grossProfit ?? null)}</b></span><span><small>Прибыль от продаж</small><b>{moneyOrDash(profile.finances.operatingProfit ?? null)}</b></span><span><small>Проценты к уплате</small><b>{moneyOrDash(profile.finances.interestExpense ?? null)}</b></span><span><small>Чистый оборотный капитал</small><b>{moneyOrDash(profile.finances.workingCapital ?? null)}</b></span><span><small>Долг / капитал</small><b>{profile.finances.debtToEquity ?? "Нет данных"}</b></span><span><small>Покрытие процентов</small><b>{profile.finances.interestCoverage ?? "Нет данных"}</b></span></div></section>
        <section className="ps-card"><div className="ps-card-title"><span><b>Юридический контур</b><small>Количество события само по себе не является выводом: проверяются роль, сумма, дата и текущий статус</small></span></div><div className="ps-legal-list"><span><b>{profile.legal.legalCases}</b><small>арбитражных дел</small></span><span><b>{profile.legal.enforcements}</b><small>исполнительных производств</small></span><span><b>{money(profile.legal.enforcementDebt)}</b><small>видимый остаток ФССП</small></span><span><b>{profile.legal.inspections}</b><small>проверок</small></span><span><b>{profile.legal.bankruptcyMessages}</b><small>сообщений ЕФРСБ — не равно банкротству</small></span></div><p className="ps-legal-disclaimer">Правовой блок носит информационно-аналитический характер, не является юридическим заключением и не заменяет проверку первичных документов.</p></section>
      </div>

      <section className="ps-card ps-company-details wide"><div className="ps-card-title"><span><b>Реквизиты и управление</b><small>Данные ЕГРЮЛ</small></span></div><div><p><small>Юридический адрес</small><b>{profile.company.address || "—"}</b></p><p><small>Регион</small><b>{profile.company.region || "—"}</b></p><p><small>Уставный капитал</small><b>{money(profile.company.capital)}</b></p><p><small>Учредителей</small><b>{profile.company.foundersCount}</b></p>{profile.company.managers.map((manager) => <p key={`${manager.inn}-${manager.name}`}><small>{manager.position || "Руководитель"}</small><b>{manager.name}</b></p>)}</div></section>

      {Boolean(profile.externalBanks?.length) && <section className="ps-card ps-company-details wide"><div className="ps-card-title"><span><b>Банковские реквизиты во внешних данных</b><small>Реестровая связь не подтверждает, что счёт действует сейчас</small></span></div><div>{profile.externalBanks?.map((bank, index) => <p key={`${bank.bik}-${bank.account}-${index}`}><small>{bank.status}</small><b>{bank.name}{bank.bik ? ` · БИК ${bank.bik}` : ""}{bank.account ? ` · ${bank.account}` : ""}</b><span>{bank.evidence}</span></p>)}</div></section>}

      <div className="ps-checko-source"><ShieldCheck /><span><b>Официальные и открытые источники</b><small>{profile.cached ? "Показан сохранённый профиль — повторные запросы не выполнялись." : "Получены свежие данные и сохранены на 24 часа."} Обновлено {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(profile.fetchedAt))}.</small></span>{profile.failedMethods.length > 0 && <em>Частично недоступны: {profile.failedMethods.join(", ")}</em>}</div>
    </>}
  </>;
}
