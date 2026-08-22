import { notFound, redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import type { AnalysisResult } from "../../../lib/prescore";
import type { CompanyProfileData } from "../../../lib/company-profile";
import { buildUnifiedRiskContext, type UnifiedRiskContext } from "../../../lib/risk-context";
import PrintButton from "./print-button";
import { applyAnalysisControls, metricEnabled, readControlState } from "../../../lib/admin-controls";
import { readableAnalysis } from "../../api/api-auth";
import { resolveAnalysisTier } from "../../../lib/entitlements";
import "./report.css";
import "../../prescore-ui-v1.css";

export const dynamic = "force-dynamic";

type Statement = { bind: (...values: unknown[]) => Statement; first: <T = unknown>() => Promise<T | null>; run: () => Promise<unknown> };
type Database = { prepare: (query: string) => Statement; batch: (statements: Statement[]) => Promise<Array<{ results: unknown[] }>> };
const money = (value: number | null | undefined) => value == null ? "Нет данных" : new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
const pct = (value: number | null | undefined) => value == null ? "Нет данных" : `${Math.round(value * 100)}%`;
const date = (value: string) => value ? new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00Z`)) : "—";

export default async function DynamicReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireChatGPTUser("/dashboard");
  const { id } = await params;
  const { env } = await import("cloudflare:workers");
  const db = env.DB as unknown as Database;
  const normalizedUser = { email: user.email.toLowerCase(), isAdmin: user.email.toLowerCase() === "dorogovab@gmail.com" };
  const access = await readableAnalysis<{ payload: string; companyInn: string; ownerEmail: string }>(db, id, normalizedUser);
  if (!access) notFound();
  const row = access.row;
  const tier = await resolveAnalysisTier(db, { analysisId: id, userEmail: row.ownerEmail, companyInn: row.companyInn, privileged: normalizedUser.isAdmin || access.access === "agent" });
  if (tier !== "FULL") redirect(`/checkout?analysisId=${encodeURIComponent(id)}`);
  const controls = await readControlState(db);
  const analysis = applyAnalysisControls(JSON.parse(row.payload) as AnalysisResult, controls);
  const profileRow = await db.prepare("SELECT payload FROM checko_profiles WHERE inn = ? LIMIT 1").bind(row.companyInn).first<{ payload: string }>();
  const profile = profileRow ? JSON.parse(profileRow.payload) as CompanyProfileData : null;
  const unified: UnifiedRiskContext | null = profile ? buildUnifiedRiskContext(profile, analysis, controls) : null;
  const conclusion = unified?.finalConclusion;
  const factors = unified?.factors ?? analysis.factors;
  const strengths = unified?.strengths ?? analysis.strengths;
  return <main className="dynamic-report">
    <PrintButton />
    <header className="report-cover"><div><span>ПРЕСКОР · КРЕДИТНО‑АНАЛИТИЧЕСКИЙ ОТЧЁТ</span><h1>{analysis.companyName}</h1><p>ИНН {analysis.companyInn} · период {date(analysis.periodFrom)} — {date(analysis.periodTo)}</p></div><aside><b>{conclusion?.code ?? "B"}</b><small>{conclusion?.verdict ?? analysis.readiness}</small></aside></header>

    <section className={`report-decision ${conclusion?.hardStop ? "stop" : "ready"}`}><div><small>ОБЩЕЕ ЗАКЛЮЧЕНИЕ</small>{metricEnabled("readiness", controls) && <h2>{conclusion?.verdict ?? analysis.readiness}</h2>}<p>{conclusion?.conclusion ?? "Заключение сформировано по банковскому потоку; для полного результата добавьте БФО, квартальную отчётность и БКИ."}</p><strong>{conclusion?.decision ?? "Расчётный диапазон предварительный и уточняется после сверки всех источников."}</strong></div><dl>{metricEnabled("estimated-limit", controls) && <div><dt>Диапазон</dt><dd>{money(conclusion?.limitMin ?? analysis.metrics.estimatedLimitMin)} — {money(conclusion?.limitMax ?? analysis.metrics.estimatedLimitMax)}</dd></div>}{metricEnabled("limit-confidence", controls) && <div><dt>Достоверность</dt><dd>{conclusion?.confidence ?? analysis.metrics.limitConfidence}%</dd></div>}<div><dt>Версия отчёта</dt><dd>{analysis.methodologyVersion ?? "PRESCORE"}</dd></div></dl></section>

    <section><h2>Полнота источников</h2><div className="source-grid"><article className="ok"><b>Выписки</b><span>{analysis.metrics.statements} файлов · {analysis.metrics.accounts} счетов</span></article><article className={profile?.finances.latestYear ? "ok" : "missing"}><b>БФО</b><span>{profile?.finances.latestYear || "не загружена"}</span></article><article className={analysis.quarterlyReport ? "ok" : "missing"}><b>Квартальная</b><span>{analysis.quarterlyReport?.period || "не загружена"}</span></article><article className={profile ? "ok" : "missing"}><b>Правовой контур</b><span>{profile ? "получен" : "не получен"}</span></article><article className={analysis.creditHistory ? "ok" : "missing"}><b>БКИ</b><span>{analysis.creditHistory ? `${analysis.creditHistory.obligations.length} обязательств` : "не загружено"}</span></article></div></section>

    <section><h2>Денежный поток</h2><div className="metric-grid">{metricEnabled("gross-inflow", controls) && <Metric label="Валовые поступления" value={money(analysis.metrics.grossInflow ?? analysis.metrics.inflow)} />}{metricEnabled("operating-inflow", controls) && <Metric label="Операционная выручка" value={money(analysis.metrics.operatingInflow ?? analysis.metrics.inflow)} />}{metricEnabled("excluded-inflow", controls) && <Metric label="Исключено из выручки" value={money((analysis.metrics.nonOperatingInflow ?? 0) + (analysis.metrics.unknownInflow ?? 0))} />}{metricEnabled("avg-monthly-inflow", controls) && <Metric label="Средняя выручка / месяц" value={money(analysis.metrics.avgMonthlyInflow)} />}{metricEnabled("monthly-trend", controls) && <Metric label="Тренд" value={`${analysis.metrics.monthlyTrend}%`} />}{metricEnabled("volatility", controls) && <Metric label="Волатильность" value={String(analysis.metrics.volatility)} />}{metricEnabled("top-one-concentration", controls) && <Metric label="TOP‑1 плательщик" value={pct(analysis.metrics.topOneConcentration)} />}{metricEnabled("debt-service-share", controls) && <Metric label="Долговой платёж / месяц" value={money(analysis.metrics.currentMonthlyDebtPayment)} />}{metricEnabled("liquidity", controls) && <><Metric label="Минимальный дневной остаток" value={money(analysis.metrics.minimumDailyBalance)} /><Metric label="Дни низкой ликвидности" value={analysis.metrics.cashGapDays == null ? "Нет данных" : String(analysis.metrics.cashGapDays)} /></>}</div></section>

    {profile && (metricEnabled("bfo", controls) || metricEnabled("legal", controls)) && <section><h2>БФО и правовой контур</h2><div className="metric-grid">{metricEnabled("bfo", controls) && <><Metric label={`Выручка БФО ${profile.finances.latestYear}`} value={money(profile.finances.revenue)} /><Metric label="Чистая прибыль" value={money(profile.finances.profit)} /><Metric label="Собственный капитал" value={money(profile.finances.equity)} /><Metric label="Текущая ликвидность" value={profile.finances.currentLiquidity == null ? "Нет данных" : String(profile.finances.currentLiquidity)} /><Metric label="Дебиторская задолженность" value={money(profile.finances.receivables)} /><Metric label="Кредиторская задолженность" value={money(profile.finances.payables)} /></>}{metricEnabled("legal", controls) && <><Metric label="Арбитражные дела" value={String(profile.legal.legalCases)} /><Metric label="Исполнительные производства" value={`${profile.legal.enforcements} · ${money(profile.legal.enforcementDebt)}`} /></>}</div></section>}

    <section><h2>Стоп‑факторы и сигналы</h2><table><thead><tr><th>Класс</th><th>Фактор</th><th>Доказательство</th><th>Источник / период</th><th>Действие</th></tr></thead><tbody>{factors.map((item) => <tr key={`${item.code}-${item.title}`}><td><span className={`pill ${item.severity}`}>{item.decisionClass === "stop" ? "СТОП" : item.severity === "warning" ? "ПРОВЕРИТЬ" : "ИНФО"}</span></td><td><b>{item.title}</b><small>{item.impact}</small></td><td>{item.evidence || item.detail}</td><td>{item.source || "Источник"}<small>{item.period}</small></td><td>{item.action}</td></tr>)}</tbody></table></section>

    <section><h2>Сильные стороны</h2><div className="strength-list">{strengths.length ? strengths.map((item) => <article key={item.title}><b>{item.title}</b><span>{"detail" in item ? item.detail : item.evidence}</span><small>{item.source}</small></article>) : <p>Недостаточно подтверждённых данных для выделения сильных сторон.</p>}</div></section>

    {analysis.creditHistory && metricEnabled("credit-portfolio", controls) && <section><h2>Кредитный портфель</h2><table><thead><tr><th>Кредитор / продукт</th><th>Статус / роль</th><th>Сумма или лимит</th><th>Остаток</th><th>Платёж</th><th>Ставка</th><th>Просрочка</th><th>Качество</th></tr></thead><tbody>{analysis.creditHistory.obligations.map((item) => <tr key={item.id}><td><b>{item.creditor}</b><small>{item.product}</small></td><td>{item.status}<small>{item.role}</small></td><td>{money(item.creditLimit ?? item.originalAmount)}</td><td>{money(item.totalOutstanding ?? item.outstandingPrincipal)}</td><td>{money(item.monthlyPayment ?? item.nextPaymentAmount)}</td><td>{item.annualRate == null ? "Нет данных" : `${item.annualRate}%`}</td><td>{money(item.overdueAmount)}</td><td>{item.paymentQuality}</td></tr>)}</tbody></table><p className="note">Роль субъекта: {analysis.creditHistory.relationshipToCompany || "не указана"}. {analysis.creditHistory.affectsCompanyDebt ? "Портфель учитывается в долге компании." : "Личный портфель показан отдельно и не добавлен к долгу компании."}</p></section>}

    <section><h2>Рекомендации 7 / 30 / 60</h2><div className="recommendations">{(unified?.actionPlan ?? []).flatMap((phase) => phase.items).map((item) => <article key={`${item.horizon}-${item.title}`}><i>{item.horizon}</i><div><b>{item.title}</b><p>{item.action}</p><small>Основание: {item.reason} · Результат: {item.result}</small></div></article>)}</div></section>

    {!conclusion?.hardStop && <section><h2>Подходящие типы финансирования</h2><div className="product-list">{analysis.productFits.filter((item) => item.status !== "not-now").map((item) => <article key={item.product}><b>{item.product}</b><span>{money(item.amountMin)} — {money(item.amountMax)}</span><p>{item.why.join(" · ")}</p><small>{item.conditions.join(" · ")}</small></article>)}</div></section>}

    {metricEnabled("evidence", controls) && <section><h2>Цепочка доказательств</h2><table><thead><tr><th>Вывод</th><th>Метрика</th><th>Значение</th><th>Источник</th><th>Период</th></tr></thead><tbody>{(unified?.evidence ?? analysis.evidence).map((item) => <tr key={item.id}><td>{item.conclusion}</td><td>{item.metric}</td><td><b>{item.value}</b></td><td>{item.source}</td><td>{item.period}</td></tr>)}</tbody></table></section>}

    <footer><p>Отчёт носит исключительно информационно‑аналитический характер. Он не является решением, гарантией одобрения, индивидуальной рекомендацией или офертой банка, МФО, лизинговой либо иной финансовой организации. Итоговые условия определяет выбранный кредитор после собственной проверки.</p><span>Сформировано {new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" }).format(new Date())} · ООО «СИТИМЭЙТС» · ИНН 5032333146 · ОГРН 1215000096816</span></footer>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <article><small>{label}</small><b>{value}</b></article>; }
