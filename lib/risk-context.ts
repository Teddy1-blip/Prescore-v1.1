import { buildActionPlan } from "./action-plan";
import { buildCombinedInsights, buildFinancialAssessment, type CompanyProfileData } from "./company-profile";
import type { AnalysisResult, StopFactor } from "./prescore";
import { isFactorEnabled, productControlKey, type ControlState } from "./admin-controls";

type AnalysisSummary = Omit<AnalysisResult, "transactions"> & { transactions?: AnalysisResult["transactions"] };

export type UnifiedRiskContext = ReturnType<typeof buildUnifiedRiskContext>;

const money = (value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);

function sourceFactor(item: StopFactor): StopFactor {
  return {
    ...item,
    code: item.code || "SOURCE-UNSPECIFIED",
    decisionClass: item.decisionClass || (item.severity === "critical" ? "stop" : item.severity === "warning" ? "manual-review" : "information"),
    source: item.source || "Сверка источников",
    evidence: item.evidence || item.detail,
    needsReview: item.needsReview ?? item.severity !== "info",
  };
}

export function buildUnifiedRiskContext(profile: CompanyProfileData, analysis: AnalysisSummary, controls?: ControlState) {
  const assessment = buildFinancialAssessment(profile, analysis.score ?? 0);
  const combinedInsights = buildCombinedInsights(profile, analysis);
  const actionPlan = buildActionPlan(analysis, profile);
  const bki = analysis.creditHistory;
  const comparison = analysis.creditPortfolioComparison;
  const factors: StopFactor[] = analysis.factors.map(sourceFactor);

  for (const [index, item] of assessment.factors.entries()) factors.push(sourceFactor({
    code: `BFO-${String(index + 1).padStart(3, "0")}`,
    severity: item.severity,
    decisionClass: item.severity === "critical" ? "stop" : item.severity === "warning" ? "manual-review" : "information",
    source: item.title.includes("адрес") || item.title.includes("производ") || item.title.includes("ЕФРСБ") ? "Правовой контур" : "БФО",
    period: profile.finances.latestYear || "актуальный статус",
    evidence: item.detail,
    needsReview: item.severity !== "info",
    title: item.title,
    detail: item.detail,
    impact: item.impact,
    action: item.action,
  }));

  if (!bki) factors.push(sourceFactor({ code: "BKI-MISSING", severity: "warning", decisionClass: "manual-review", source: "БКИ", evidence: "Отчёт БКИ не загружен", needsReview: true, title: "Кредитный портфель не подтверждён", detail: "Остатки, лимиты, платёж и качество обслуживания долга не подтверждены отчётом БКИ.", impact: "Расчёт долговой ёмкости остаётся предварительным.", action: "Загрузить актуальный отчёт БКИ с отдельным согласием субъекта." }));
  if ((bki?.summary.overdueAmount ?? 0) > 0) factors.push(sourceFactor({ code: "BKI-CURRENT-OVERDUE", severity: "critical", decisionClass: "stop", source: "БКИ", period: bki?.reportDate || "дата отчёта", evidence: `Текущая просрочка ${money(bki?.summary.overdueAmount ?? 0)}`, needsReview: true, title: "Текущая просрочка по БКИ", detail: `В отчёте указана просроченная задолженность ${money(bki?.summary.overdueAmount ?? 0)}.`, impact: "Положительный вывод по новому необеспеченному долгу блокируется до проверки статуса.", action: "Получить актуальное подтверждение погашения либо выяснить предмет и статус просрочки." }));
  if (analysis.quarterlyReport?.verdictCode === "STOP" || analysis.quarterlyReport?.verdictCode === "HIGH_RISK") factors.push(sourceFactor({ code: "Q-STOP", severity: "critical", decisionClass: "stop", source: "Квартальная отчётность", period: analysis.quarterlyReport.period, evidence: analysis.quarterlyReport.verdict, needsReview: true, title: "Отказной промежуточный финансовый профиль", detail: analysis.quarterlyReport.verdict, impact: "Подача текущего комплекта с высокой вероятностью приведёт к отказу.", action: "Проверить корректность и полноту формы; использовать только достоверную принятую отчётность." }));
  if ((comparison?.paymentNotVisibleInStatements ?? 0) > 0) factors.push(sourceFactor({ code: "RECON-DEBT-PAYMENT", severity: "warning", decisionClass: "manual-review", source: "Сверка источников", period: bki?.reportDate || analysis.periodTo, evidence: `${money(comparison?.paymentNotVisibleInStatements ?? 0)} в месяц не видно в выписках`, needsReview: true, title: "Платежи БКИ не полностью видны в выписках", detail: `Расчётный платёж БКИ выше найденных списаний на ${money(comparison?.paymentNotVisibleInStatements ?? 0)} в месяц.`, impact: "Возможны неполные выписки или платёж с другого счёта.", action: "Добавить выписки остальных банков и графики кредитных договоров." }));
  if ((profile.contracts?.topCustomerShare ?? 0) > 50) factors.push(sourceFactor({ code: "CONTRACT-CONCENTRATION", severity: "warning", decisionClass: "manual-review", source: "Правовой контур", period: "актуальный реестр", evidence: `TOP-заказчик ${profile.contracts?.topCustomerShare}% наблюдаемой суммы`, needsReview: true, title: "Концентрация контрактного портфеля", detail: `На одного заказчика приходится ${profile.contracts?.topCustomerShare}% наблюдаемой суммы контрактов.`, impact: "Задержка приёмки или оплаты одного заказчика влияет на источник погашения.", action: "Проверить действующие этапы, неисполненный остаток, маржу и сроки оплаты." }));

  const activeFactors = controls ? factors.filter((item) => isFactorEnabled(item, controls)) : factors;
  const controlledAssessment = controls ? {
    ...assessment,
    factors: assessment.factors.filter((item) => isFactorEnabled({ title: item.title }, controls)),
    recommendations: assessment.recommendations.filter((item) => isFactorEnabled({ title: item.title }, controls)),
  } : assessment;
  const globalStops = activeFactors.filter((item) => item.decisionClass === "stop" || item.severity === "critical");
  const manualReview = activeFactors.filter((item) => item.decisionClass === "manual-review" || item.severity === "warning");
  const hasBfo = Boolean(profile.finances.latestYear);
  const fullData = Boolean(bki && hasBfo && analysis.quarterlyReport);
  const hardStop = globalStops.length > 0;
  const ready = !hardStop && Boolean(bki && hasBfo) && (assessment.index ?? 0) >= 620;
  const code = hardStop ? "STOP" : ready ? "GO" : "PREPARE";
  const verdict = hardStop ? "Подачу отложить до проверки стоп‑факторов" : ready ? "Можно готовить адресную подачу в 1–3 подходящих организации" : "Подача возможна после завершения подготовки";
  const adjusted = comparison?.adjustedLimitMax ?? analysis.metrics.estimatedLimitMax;
  const limitMax = hardStop ? Math.min(adjusted, analysis.metrics.avgMonthlyInflow * 0.08) : adjusted;
  const limitMin = Math.min(analysis.metrics.estimatedLimitMin, limitMax);
  const product = hardStop ? null : analysis.productFits?.find((item) => item.status === "recommended" && (!controls || !controls.disabled.has(productControlKey(item.product)))) ?? null;
  const contractText = profile.contracts?.totalCount
    ? `В доступной выборке реестра: ${profile.contracts.totalCount} контрактов; наблюдаемая сумма ${money(profile.contracts.totalAmount)}, активных ${profile.contracts.activeCount} на ${money(profile.contracts.activeAmount)}.`
    : "Контрактный портфель не подтверждён доступными реестровыми данными.";
  const bkiText = bki
    ? `БКИ: ${bki.obligations.length} обязательств, основной долг ${money(bki.summary.outstandingPrincipal)}, платёж ${money(bki.summary.monthlyPayment)} в месяц, обслуживание — ${bki.summary.debtServiceQuality.toLowerCase()}.`
    : "БКИ не загружено: остатки и совокупный ежемесячный платёж требуют подтверждения.";
  const confidenceParts = [analysis.metrics.dataQuality, assessment.confidence];
  if (bki) confidenceParts.push(bki.parserConfidence);
  if (analysis.quarterlyReport) confidenceParts.push(analysis.quarterlyReport.parserConfidence);
  const confidence = Math.min(99, Math.round(confidenceParts.reduce((sum, value) => sum + value, 0) / confidenceParts.length));

  const finalConclusion = {
    code, verdict, hardStop, limitMin, limitMax, product, confidence,
    conclusion: `Операционная выручка по счетам ${money(analysis.metrics.avgMonthlyInflow)} в месяц сопоставлена с БФО за ${profile.finances.latestYear || "неуказанный период"}, промежуточной отчётностью, правовыми событиями, контрактами и БКИ. ${contractText} ${bkiText}`,
    decision: hardStop
      ? `Положительный вывод не формируется: найдено глобальных стоп‑факторов — ${globalStops.length}. Каждый требует проверки первичного источника.`
      : `Глобальных стопов не выявлено. Аналитический ориентир после доступных корректировок — ${money(limitMin)}–${money(limitMax)}; ${product ? `приоритетный тип продукта: ${product.product}` : "тип продукта определяется после подтверждения цели"}.`,
    conditions: [...new Set([...globalStops, ...manualReview].map((item) => item.title))].slice(0, 8),
  };

  const strengths = [
    ...analysis.strengths.map((item) => ({ title: item.title, evidence: item.evidence, source: item.source })),
    ...assessment.strengths.map((title) => ({ title, evidence: `БФО ${profile.finances.latestYear || "не указано"}`, source: "БФО" })),
  ].slice(0, 6);

  return {
    version: "RISK-CONTEXT-2026.08",
    sourceManifest: {
      ...(analysis.sourceManifest ?? { bankStatements: [] }),
      bfo: profile.sourceManifest?.bfo ?? analysis.sourceManifest?.bfo,
      external: profile.sourceManifest?.external ?? analysis.sourceManifest?.external,
    },
    integrity: analysis.integrity,
    readiness: { code, fullData, hardStop, missing: [!hasBfo && "БФО", !analysis.quarterlyReport && "Квартальная отчётность", !bki && "БКИ"].filter(Boolean) },
    factors: activeFactors,
    globalStops,
    manualReview,
    strengths,
    assessment: controlledAssessment,
    combinedInsights,
    actionPlan,
    finalConclusion,
    evidence: [
      ...analysis.evidence,
      { id: "EV-BFO", conclusion: "Финансовая устойчивость", metric: "F-Score", value: assessment.fScore == null ? "Недостаточно данных" : String(assessment.fScore), source: "Официальная БФО", period: profile.finances.latestYear || "не указан" },
      { id: "EV-LEGAL", conclusion: "Правовой контур", metric: "События к проверке", value: String(profile.legal.legalCases + profile.legal.enforcements), source: "Официальные и открытые источники", period: "актуальный статус" },
      ...(bki ? [{ id: "EV-BKI", conclusion: "Кредитный портфель", metric: "Совокупный платёж", value: money(bki.summary.monthlyPayment), source: bki.source, period: bki.reportDate }] : []),
    ],
  };
}
