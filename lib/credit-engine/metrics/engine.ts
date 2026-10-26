import {applyConflictKnowledge} from "./conflicts.ts";
import type {TransactionConflict} from "../normalization/conflicts.ts";
import type { NormalizedTransaction } from "../../prescore.ts";
import type { EconomicCategory, ClassificationConfidence, ClassificationTag } from "../contracts/classification.ts";
import type { AnalysisIntegritySummary, AnalysisSourceManifest, MonthCoverageStatus } from "../contracts/sources.ts";
import {
  BANK_STATEMENT_METRICS_VERSION,
  type BankStatementMetricsV2,
  type ConcentrationGroup,
  type MetricConfidence,
  type MetricConfidenceBreakdown,
  type MetricResult,
  type MetricsComparisonReasonCode,
  type MetricsComparisonSummary,
  type MonthlyCashFlowV2,
} from "../contracts/metrics.ts";

type LegacyMetrics = Record<string, number | null>;

export type MetricsEngineInput = {
  transactions: NormalizedTransaction[];
  conflicts?: TransactionConflict[];
  integrity?: AnalysisIntegritySummary;
  sourceManifest?: AnalysisSourceManifest;
  periodFrom?: string | null;
  periodTo?: string | null;
  openingBalance?: number | null;
  legacyMetrics?: LegacyMetrics;
};

type ClassifiedTransaction = NormalizedTransaction & {
  economicCategory: EconomicCategory;
  economicConfidence: ClassificationConfidence;
  economicTags: ClassificationTag[];
};

type Aggregate = {
  amount: number;
  count: number;
  confidence: MetricConfidenceBreakdown;
  transactions: ClassifiedTransaction[];
  warnings: string[];
};

const OPERATING_RECEIPTS: EconomicCategory[] = ["SALE_PROCEEDS", "CUSTOMER_ADVANCE", "ACQUIRING_SETTLEMENT", "MARKETPLACE_SETTLEMENT"];
const FINANCING_INFLOWS: EconomicCategory[] = ["BANK_LOAN_RECEIVED", "OTHER_LOAN_RECEIVED", "OWNER_LOAN_RECEIVED", "FACTORING_PROCEEDS"];
const DEBT_SERVICE: EconomicCategory[] = ["LOAN_PRINCIPAL_PAYMENT", "INTEREST_PAYMENT", "DEBT_SERVICE_UNSPLIT", "LEASING_PAYMENT"];
const INTERMEDIARY_TAGS: ClassificationTag[] = ["PAYMENT_INTERMEDIARY", "MARKETPLACE", "ACQUIRING"];
const ALL_NON_OPERATING_INFLOW: EconomicCategory[] = [
  ...FINANCING_INFLOWS,
  "OWNER_CONTRIBUTION", "OWNER_FUNDING_UNSPECIFIED", "LOAN_REPAYMENT_RECEIVED", "TAX_REFUND", "REFUND_RECEIVED",
  "SUBSIDY_GRANT", "INSURANCE_PAYOUT", "ASSET_SALE_PROCEEDS", "OTHER_INFLOW", "UNKNOWN_INFLOW",
];

const round = (value: number, digits = 4) => {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
};

function emptyBreakdown(): MetricConfidenceBreakdown {
  return { highConfidenceAmount: 0, mediumConfidenceAmount: 0, lowConfidenceAmount: 0, unknownConfidenceAmount: 0 };
}

function confidenceBucket(confidence: ClassificationConfidence): keyof MetricConfidenceBreakdown {
  if (confidence === "HIGH") return "highConfidenceAmount";
  if (confidence === "MEDIUM") return "mediumConfidenceAmount";
  if (confidence === "LOW") return "lowConfidenceAmount";
  return "unknownConfidenceAmount";
}

function fallbackCategory(transaction: NormalizedTransaction): EconomicCategory {
  if (transaction.direction === "in") return "UNKNOWN_INFLOW";
  if (transaction.direction === "out") return "UNKNOWN_OUTFLOW";
  return "UNKNOWN_DIRECTION";
}

function classifyTransactions(items: NormalizedTransaction[]): ClassifiedTransaction[] {
  const seen = new Set<string>();
  const retained: ClassifiedTransaction[] = [];
  for (const item of items) {
    const id = item.canonicalTransactionId || item.id;
    if (item.duplicateStatus === "EXACT" && item.duplicateOfTransactionId) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    retained.push({
      ...item,
      economicCategory: item.classification?.primaryCategory ?? fallbackCategory(item),
      economicConfidence: item.classification?.confidence ?? "UNKNOWN",
      economicTags: item.classification?.tags ?? [],
    });
  }
  return retained;
}

function aggregate(items: ClassifiedTransaction[], categories?: EconomicCategory[]): Aggregate {
  const selected = categories ? items.filter((item) => categories.includes(item.economicCategory)) : items;
  const confidence = emptyBreakdown();
  let amount = 0;
  for (const item of selected) {
    amount += item.amount;
    confidence[confidenceBucket(item.economicConfidence)] += item.amount;
  }
  return { amount: round(amount, 2), count: selected.length, confidence, transactions: selected, warnings: [] };
}

function aggregateUnion(...groups: Aggregate[]): Aggregate {
  const transactions = groups.flatMap((item) => item.transactions);
  return aggregate(transactions);
}

function metricConfidence(aggregateValue: Aggregate, integrity: AnalysisIntegritySummary | undefined, options: { identityCoverage?: number; unknownShare?: number; coverageLimited?: boolean } = {}): MetricConfidence {
  if (!aggregateValue.count && aggregateValue.amount === 0) {
    if (!integrity) return "UNKNOWN";
    return (integrity.confidence ?? 0) >= 70 ? "HIGH" : (integrity.confidence ?? 0) >= 45 ? "MEDIUM" : "LOW";
  }
  const total = Math.max(aggregateValue.amount, 1);
  const uncertain = (aggregateValue.confidence.lowConfidenceAmount + aggregateValue.confidence.unknownConfidenceAmount) / total;
  const medium = aggregateValue.confidence.mediumConfidenceAmount / total;
  const integrityScore = integrity?.confidence ?? null;
  if (integrityScore === null || uncertain > 0.25 || (options.identityCoverage ?? 1) < 0.5 || (options.unknownShare ?? 0) > 0.25) return "LOW";
  if (integrityScore < 70 || uncertain > 0.05 || medium > 0.4 || (options.identityCoverage ?? 1) < 0.8 || options.coverageLimited) return "MEDIUM";
  return "HIGH";
}

type MetricOptions = {
  value?: number | null;
  unit?: MetricResult["unit"];
  status?: MetricResult["status"];
  confidence?: MetricResult["confidence"];
  basis: string;
  included: EconomicCategory[];
  excluded?: EconomicCategory[];
  aggregate?: Aggregate;
  warnings?: string[];
  evidence?: string[];
};

function metric(code: string, input: MetricsEngineInput, options: MetricOptions): MetricResult {
  const sourceCount = input.sourceManifest?.bankStatements.length ?? new Set(options.aggregate?.transactions.map((item) => item.sourceId || item.sourceFileName).filter(Boolean)).size;
  const value = options.value === undefined ? options.aggregate?.amount ?? null : options.value;
  return {
    code,
    version: BANK_STATEMENT_METRICS_VERSION,
    value: value === null ? null : round(value, options.unit === "RUB" || !options.unit ? 2 : 4),
    unit: options.unit ?? "RUB",
    status: options.status ?? (value === null ? "UNKNOWN" : "KNOWN"),
    confidence: options.confidence ?? metricConfidence(options.aggregate ?? aggregate([]), input.integrity),
    periodFrom: input.periodFrom ?? null,
    periodTo: input.periodTo ?? null,
    transactionCount: options.aggregate?.count ?? 0,
    sourceCount,
    calculationBasis: options.basis,
    includedCategories: options.included,
    ...(options.excluded ? { excludedCategories: options.excluded } : {}),
    ...(options.aggregate ? { confidenceBreakdown: options.aggregate.confidence } : {}),
    ...(options.evidence?.length ? { evidence: options.evidence.slice(0, 10) } : {}),
    warnings: [...new Set([...(options.aggregate?.warnings ?? []), ...(options.warnings ?? [])])],
  };
}

function ratioMetric(code: string, input: MetricsEngineInput, numerator: Aggregate, denominator: Aggregate, basis: string, included: EconomicCategory[]): MetricResult {
  const unavailable = denominator.amount === 0;
  return metric(code, input, {
    value: unavailable ? null : numerator.amount / denominator.amount,
    unit: "RATIO",
    status: unavailable ? "NOT_APPLICABLE" : "KNOWN",
    confidence: unavailable ? "UNKNOWN" : metricConfidence(aggregateUnion(numerator, denominator), input.integrity),
    basis,
    included,
    aggregate: numerator,
    warnings: unavailable ? ["ZERO_DENOMINATOR"] : [],
  });
}

function monthKey(date: string | undefined) {
  return /^\d{4}-\d{2}/.test(date ?? "") ? (date ?? "").slice(0, 7) : null;
}

function calendarSeries(items: ClassifiedTransaction[], input: MetricsEngineInput): Array<MonthlyCashFlowV2 & {operatingReceipts:number}> {
  const coverage = input.integrity?.calendarCoverage ?? [];
  const coverageByMonth = new Map(coverage.map((item) => [item.month, item]));
  const transactionMonths = [...new Set(items.map((item) => monthKey(item.date)).filter((item): item is string => Boolean(item)))];
  const months = [...new Set([...coverageByMonth.keys(), ...transactionMonths])].sort();
  return months.map((month) => {
    const rows = items.filter((item) => monthKey(item.date) === month);
    const categoryAmount = (categories: EconomicCategory[]) => aggregate(rows, categories).amount;
    const external = rows.filter((item) => item.economicCategory !== "INTERNAL_TRANSFER");
    const observedCoverage: MonthCoverageStatus = coverageByMonth.get(month)?.status ?? "PARTIAL";
    return {
      month,
      coverage: observedCoverage,
      operatingReceipts: categoryAmount(OPERATING_RECEIPTS),
      externalInflows: round(external.filter((item) => item.direction === "in").reduce((sum, item) => sum + item.amount, 0), 2),
      externalOutflows: round(external.filter((item) => item.direction === "out").reduce((sum, item) => sum + item.amount, 0), 2),
      supplierPayments: categoryAmount(["SUPPLIER_PAYMENT"]),
      taxPayments: categoryAmount(["TAX_PAYMENT", "SOCIAL_CONTRIBUTION"]),
      payrollPayments: categoryAmount(["PAYROLL"]),
      debtService: categoryAmount(DEBT_SERVICE),
      unclearIndividualAndCash: categoryAmount(["INDIVIDUAL_UNCLEAR_PAYMENT", "CASH_WITHDRAWAL"]),
      unknownInflows: categoryAmount(["UNKNOWN_INFLOW"]),
      warnings: [
        ...(observedCoverage === "MISSING" ? ["MISSING_MONTH_NOT_ZERO"] : []),
        ...(observedCoverage === "PARTIAL" ? ["PARTIAL_MONTH_NOT_COMPARABLE"] : []),
        ...(observedCoverage === "OVERLAP" ? ["OVERLAP_MONTH_DEDUP_REQUIRED"] : []),
      ],
    };
  });
}

function monthlyMetrics(monthly: Array<MonthlyCashFlowV2 & {operatingReceipts:number}>, operating: Aggregate, input: MetricsEngineInput, unknownShare: number) {
  const observed = monthly.filter((item) => item.coverage !== "MISSING");
  const full = monthly.filter((item) => item.coverage === "FULL");
  const observedAverage = observed.length ? observed.reduce((sum, item) => sum + item.operatingReceipts, 0) / observed.length : null;
  const unobservedAccount = input.integrity?.calendarCoverage?.some(m=>m.warnings.includes('UNOBSERVED_ACCOUNT_PERIOD')) ?? false;
  const fullAverage = !unobservedAccount && full.length ? full.reduce((sum, item) => sum + item.operatingReceipts, 0) / full.length : null;
  let trend: number | null = null;
  if (!unobservedAccount && full.length >= 4) {
    const split = Math.floor(full.length / 2);
    const first = full.slice(0, split);
    const last = full.slice(-split);
    const firstAverage = first.reduce((sum, item) => sum + item.operatingReceipts, 0) / first.length;
    const lastAverage = last.reduce((sum, item) => sum + item.operatingReceipts, 0) / last.length;
    trend = firstAverage === 0 ? null : (lastAverage / firstAverage - 1) * 100;
  }
  let volatility: number | null = null;
  if (full.length >= 3 && fullAverage !== null && fullAverage !== 0) {
    const variance = full.reduce((sum, item) => sum + (item.operatingReceipts - fullAverage) ** 2, 0) / full.length;
    volatility = Math.sqrt(variance) / fullAverage;
  }
  const peakToAverage = fullAverage && full.length ? Math.max(...full.map((item) => item.operatingReceipts)) / fullAverage : null;
  const partialWarning = monthly.some((item) => item.coverage === "PARTIAL") ? ["PARTIAL_MONTH_EXCLUDED"] : [];
  const missingWarning = monthly.some((item) => item.coverage === "MISSING") ? ["MISSING_MONTH_NOT_ZERO"] : [];
  return {
    observedAverage: metric("BSM-OPER-010", input, { value: observedAverage, confidence: metricConfidence(operating, input.integrity, { unknownShare }), basis: "Operating cash receipts divided by observed non-missing months", included: OPERATING_RECEIPTS, aggregate: operating, warnings: missingWarning }),
    fullAverage: metric("BSM-OPER-011", input, { value: fullAverage, confidence: metricConfidence(operating, input.integrity, { unknownShare }), basis: "Operating cash receipts divided by FULL calendar months only", included: OPERATING_RECEIPTS, aggregate: operating, warnings: [...partialWarning, ...missingWarning, ...(unobservedAccount ? ["UNOBSERVED_ACCOUNT_PERIOD"] : [])] }),
    trend: metric("BSM-OPER-012", input, { value: trend, unit: "PERCENT", status: trend === null ? "UNKNOWN" : "KNOWN", basis: "Difference between average operating receipts in first and second halves of at least four FULL months", included: OPERATING_RECEIPTS, aggregate: operating, warnings: trend === null ? ["INSUFFICIENT_FULL_MONTHS_FOR_TREND"] : [] }),
    volatility: metric("BSM-OPER-013", input, { value: volatility, unit: "RATIO", status: volatility === null ? "UNKNOWN" : "KNOWN", basis: "Coefficient of variation across at least three FULL months", included: OPERATING_RECEIPTS, aggregate: operating, warnings: volatility === null ? ["INSUFFICIENT_FULL_MONTHS_FOR_VOLATILITY"] : [] }),
    peakToAverage: metric("BSM-OPER-014", input, { value: peakToAverage, unit: "RATIO", status: peakToAverage === null ? "UNKNOWN" : "KNOWN", basis: "Peak FULL-month operating receipts divided by FULL-month average; not a seasonality conclusion", included: OPERATING_RECEIPTS, aggregate: operating }),
    seasonalityEligibility: metric("BSM-OPER-015", input, { value: full.length >= 12 ? 1 : 0, unit: "COUNT", basis: "At least twelve FULL months required before seasonality analysis", included: OPERATING_RECEIPTS, aggregate: operating, warnings: full.length >= 12 ? [] : ["INSUFFICIENT_HISTORY_FOR_SEASONALITY"] }),
    trendStatus: (trend === null ? "INSUFFICIENT_DATA" : "AVAILABLE") as "INSUFFICIENT_DATA" | "AVAILABLE",
    seasonalityStatus: (full.length >= 12 ? "ELIGIBLE" : "INSUFFICIENT_HISTORY") as "ELIGIBLE" | "INSUFFICIENT_HISTORY",
  };
}

function normalizedName(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[«»"']/g, "").replace(/\b(ооо|ао|пао|ип)\b/g, "").replace(/[^а-яa-z0-9]+/gi, " ").trim();
}

function isMissingCounterpartyName(value: string) {
  return !value || ["контрагент не указан", "не указан", "unknown", "n a", "нет данных"].includes(value);
}

function concentration(items: ClassifiedTransaction[], denominator: number): { groups: ConcentrationGroup[]; identityCoverage: number; identifiedAmount: number } {
  const grouped = new Map<string, { displayName: string; inn: string | null; amount: number; confidence: ConcentrationGroup["identityConfidence"] }>();
  let identifiedAmount = 0;
  for (const item of items) {
    const inn = item.counterpartyInn?.trim() || null;
    const name = normalizedName(item.counterparty || "");
    if (!inn && isMissingCounterpartyName(name)) continue;
    identifiedAmount += item.amount;
    const key = inn ? `INN:${inn}` : `NAME:${name}`;
    const prior = grouped.get(key);
    grouped.set(key, {
      displayName: prior?.displayName ?? item.counterparty ?? key,
      inn,
      amount: (prior?.amount ?? 0) + item.amount,
      confidence: inn ? "HIGH" : name ? "MEDIUM" : "UNKNOWN",
    });
  }
  const groups = [...grouped.entries()].map(([key, item]) => ({
    key,
    displayName: item.displayName,
    inn: item.inn,
    amount: round(item.amount, 2),
    share: denominator ? round(item.amount / denominator, 4) : 0,
    identityConfidence: item.confidence,
  })).sort((left, right) => right.amount - left.amount || left.key.localeCompare(right.key));
  return { groups, identityCoverage: denominator ? identifiedAmount / denominator : 0, identifiedAmount };
}

function topMetric(code: string, input: MetricsEngineInput, groups: ConcentrationGroup[], top: number, denominator: number, aggregateValue: Aggregate, identityCoverage: number, basis: string, unknownShare = 0): MetricResult {
  const unavailable = denominator === 0;
  const identityUnavailable = !unavailable && identityCoverage === 0;
  const value = unavailable || identityUnavailable ? null : groups.slice(0, top).reduce((sum, item) => sum + item.amount, 0) / denominator;
  const identityQuality = unavailable ? 0 : groups.reduce((sum, item) => {
    const weight = item.identityConfidence === "HIGH" ? 1 : item.identityConfidence === "MEDIUM" ? 0.7 : item.identityConfidence === "LOW" ? 0.4 : 0;
    return sum + item.amount * weight;
  }, 0) / denominator;
  return metric(code, input, {
    value,
    unit: "RATIO",
    status: unavailable ? "NOT_APPLICABLE" : identityCoverage < 1 ? "PARTIAL" : "KNOWN",
    confidence: unavailable ? "UNKNOWN" : metricConfidence(aggregateValue, input.integrity, { identityCoverage: Math.min(identityCoverage, identityQuality), unknownShare }),
    basis,
    included: [...new Set(aggregateValue.transactions.map((item) => item.economicCategory))],
    aggregate: aggregateValue,
    warnings: [...(unavailable ? ["NO_ELIGIBLE_FLOW"] : []), ...(identityCoverage < 1 ? ["COUNTERPARTY_IDENTITY_INCOMPLETE"] : [])],
  });
}

function buildConcentration(items: ClassifiedTransaction[], operating: Aggregate, input: MetricsEngineInput, unknownShare: number) {
  const isIntermediary = (item: ClassifiedTransaction) => ["MARKETPLACE_SETTLEMENT", "ACQUIRING_SETTLEMENT"].includes(item.economicCategory)
    || item.economicTags.some((tag) => INTERMEDIARY_TAGS.includes(tag));
  const directRows = operating.transactions.filter((item) => !isIntermediary(item));
  const intermediaryRows = operating.transactions.filter(isIntermediary);
  const marketplaceRows = operating.transactions.filter((item) => item.economicCategory === "MARKETPLACE_SETTLEMENT" || item.economicTags.includes("MARKETPLACE"));
  const acquiringRows = operating.transactions.filter((item) => item.economicCategory === "ACQUIRING_SETTLEMENT" || item.economicTags.includes("ACQUIRING"));
  const direct = aggregate(directRows);
  const intermediary = aggregate(intermediaryRows);
  const marketplace = aggregate(marketplaceRows);
  const acquiring = aggregate(acquiringRows);
  const directRanked = concentration(directRows, direct.amount);
  const platformRanked = concentration(intermediaryRows, intermediary.amount);
  const directCoverage = operating.amount ? direct.amount / operating.amount : null;
  const topTransactions = [...operating.transactions].sort((a, b) => b.amount - a.amount).slice(0, 3).reduce((sum, item) => sum + item.amount, 0);
  return {
    directCustomerTop1: topMetric("BSM-CUST-001", input, directRanked.groups, 1, direct.amount, direct, directRanked.identityCoverage, "Largest identifiable direct buyer divided by direct operating receipts; intermediaries excluded", unknownShare),
    directCustomerTop3: topMetric("BSM-CUST-002", input, directRanked.groups, 3, direct.amount, direct, directRanked.identityCoverage, "Three largest identifiable direct buyers divided by direct operating receipts; intermediaries excluded", unknownShare),
    directCustomerTop5: topMetric("BSM-CUST-003", input, directRanked.groups, 5, direct.amount, direct, directRanked.identityCoverage, "Five largest identifiable direct buyers divided by direct operating receipts; intermediaries excluded", unknownShare),
    directCustomerConcentrationCoverage: metric("BSM-CUST-004", input, { value: directCoverage, unit: "RATIO", status: directCoverage === null ? "NOT_APPLICABLE" : "KNOWN", basis: "Direct operating receipts divided by all operating cash receipts", included: OPERATING_RECEIPTS, aggregate: direct }),
    directCustomerIdentityCoverage: metric("BSM-CUST-005", input, { value: direct.amount ? directRanked.identityCoverage : null, unit: "RATIO", status: direct.amount ? (directRanked.identityCoverage < 1 ? "PARTIAL" : "KNOWN") : "NOT_APPLICABLE", basis: "Direct operating receipts attributable to an INN or normalized name", included: OPERATING_RECEIPTS, aggregate: direct }),
    intermediatedOperatingShare: ratioMetric("BSM-CUST-006", input, intermediary, operating, "Intermediated operating receipts divided by operating cash receipts", OPERATING_RECEIPTS),
    marketplaceShare: ratioMetric("BSM-CUST-007", input, marketplace, operating, "Marketplace settlement receipts divided by operating cash receipts", ["MARKETPLACE_SETTLEMENT"]),
    acquiringShare: ratioMetric("BSM-CUST-008", input, acquiring, operating, "Acquiring settlement receipts divided by operating cash receipts", ["ACQUIRING_SETTLEMENT"]),
    platformTop1: topMetric("BSM-CUST-009", input, platformRanked.groups, 1, intermediary.amount, intermediary, platformRanked.identityCoverage, "Largest platform divided by identified intermediated operating receipts"),
    platformTop3: topMetric("BSM-CUST-010", input, platformRanked.groups, 3, intermediary.amount, intermediary, platformRanked.identityCoverage, "Three largest platforms divided by identified intermediated operating receipts"),
    top3OperatingReceiptsShare: metric("BSM-CUST-011", input, { value: operating.amount ? topTransactions / operating.amount : null, unit: "RATIO", status: operating.amount ? "KNOWN" : "NOT_APPLICABLE", basis: "Three largest individual operating receipt transactions divided by operating cash receipts; not customer concentration", included: OPERATING_RECEIPTS, aggregate: operating }),
    directGroups: directRanked.groups.slice(0, 25),
    platformGroups: platformRanked.groups.slice(0, 25),
  };
}

function buildSuppliers(items: ClassifiedTransaction[], input: MetricsEngineInput) {
  const supplier = aggregate(items, ["SUPPLIER_PAYMENT"]);
  const ranked = concentration(supplier.transactions, supplier.amount);
  const months = new Set(supplier.transactions.map((item) => monthKey(item.date)).filter(Boolean)).size;
  return {
    supplierPaymentAmount: metric("BSM-SUP-001", input, { basis: "Payments classified as supplier payments", included: ["SUPPLIER_PAYMENT"], aggregate: supplier }),
    supplierTop1: topMetric("BSM-SUP-002", input, ranked.groups, 1, supplier.amount, supplier, ranked.identityCoverage, "Largest identifiable supplier divided by supplier payments"),
    supplierTop3: topMetric("BSM-SUP-003", input, ranked.groups, 3, supplier.amount, supplier, ranked.identityCoverage, "Three largest identifiable suppliers divided by supplier payments"),
    supplierTop5: topMetric("BSM-SUP-004", input, ranked.groups, 5, supplier.amount, supplier, ranked.identityCoverage, "Five largest identifiable suppliers divided by supplier payments"),
    supplierPaymentMonths: metric("BSM-SUP-005", input, { value: months, unit: "MONTHS", basis: "Distinct observed months containing supplier payments", included: ["SUPPLIER_PAYMENT"], aggregate: supplier }),
    identityCoverage: metric("BSM-SUP-006", input, { value: supplier.amount ? ranked.identityCoverage : null, unit: "RATIO", status: supplier.amount ? (ranked.identityCoverage < 1 ? "PARTIAL" : "KNOWN") : "NOT_APPLICABLE", basis: "Supplier payments attributable to an INN or normalized name", included: ["SUPPLIER_PAYMENT"], aggregate: supplier }),
    groups: ranked.groups.slice(0, 25),
  };
}

function buildLiquidity(items: ClassifiedTransaction[], input: MetricsEngineInput, qualityWarnings: string[]) {
  const finiteBalance = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? value : null;
  const endingBalance = finiteBalance(input.legacyMetrics?.endingBalance);
  const openingBalance = finiteBalance(input.openingBalance);
  const external = items.filter((item) => item.economicCategory !== "INTERNAL_TRANSFER");
  const outgoing = external.filter((item) => item.direction === "out");
  const sources = input.sourceManifest?.bankStatements ?? [];
  const allBalancesKnown = sources.length > 0 && sources.every((source) =>
    source.fieldAvailability?.openingBalance === "KNOWN" && source.fieldAvailability?.endingBalance === "KNOWN");
  const dateMillis = (date: string | null | undefined) => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const ms = Date.parse(date + "T00:00:00Z");
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date ? ms : null;
  };
  const from = dateMillis(input.periodFrom), to = dateMillis(input.periodTo);
  const periodDays = from !== null && to !== null && to >= from ? (to - from) / 86400000 + 1 : null;
  const complete = openingBalance !== null && endingBalance !== null && periodDays !== null && allBalancesKnown;
  const periodTooLong = periodDays !== null && periodDays > 740;
  const movementsIncomplete = items.some((item) => {
    const date = dateMillis(item.date);
    return date === null || from === null || to === null || date < from || date > to
      || !["in", "out"].includes(item.direction) || !Number.isFinite(item.amount) || item.amount < 0;
  });
  const dailyBalances: number[] = [];
  let balanceReconciliationMismatch = false;
  if (complete && !periodTooLong && !movementsIncomplete) {
    const netByDay = new Map<string, number>();
    // Balances cover supplied accounts, not just company-external cash flow.
    // Retain both observed internal-transfer legs: they cancel only when both
    // are in this perimeter on the same posting day. Revenue still excludes them.
    for (const item of items) {
      const signed = item.direction === "in" ? item.amount : -item.amount;
      netByDay.set(item.date, (netByDay.get(item.date) ?? 0) + signed);
    }
    let balance = openingBalance;
    for (let day = 0; day < periodDays; day++) {
      const key = new Date(from! + day * 86400000).toISOString().slice(0, 10);
      balance = round(balance + (netByDay.get(key) ?? 0), 2);
      dailyBalances.push(balance);
    }
    balanceReconciliationMismatch = Math.abs(balance - endingBalance) > Math.max(1, Math.abs(endingBalance) * 0.0001);
    // A failed conservation check is not a measured negative balance or cash gap.
    // Preserve the reported endpoint, but publish no unsupported daily statistics.
    if (balanceReconciliationMismatch) dailyBalances.length = 0;
  }
  const average = dailyBalances.length ? dailyBalances.reduce((sum, value) => sum + value, 0) / dailyBalances.length : null;
  const minimum = dailyBalances.length ? Math.min(...dailyBalances) : null;
  const days = dailyBalances.length;
  const averageDailyOutflow = days ? outgoing.reduce((sum, item) => sum + item.amount, 0) / days : 0;
  const lowThreshold = averageDailyOutflow * 3;
  const nearZeroThreshold = Math.max(1, averageDailyOutflow * 0.25);
  const commonWarnings = [
    ...(!complete ? ["ENDING_BALANCE_OR_PERIOD_NOT_CONFIRMED"] : []),
    ...(complete && periodTooLong ? ["BALANCE_PERIOD_TOO_LONG"] : []),
    ...(complete && movementsIncomplete ? ["BALANCE_MOVEMENTS_INCOMPLETE"] : []),
    ...(balanceReconciliationMismatch ? ["BALANCE_RECONCILIATION_MISMATCH"] : []),
  ];
  const factualMetric = (code: string, value: number | null, basis: string, unit: MetricResult["unit"] = "RUB") => metric(code, input, {
    value,
    unit,
    status: value === null ? "UNKNOWN" : "KNOWN",
    confidence: value === null || !complete ? "UNKNOWN" : qualityWarnings.includes("INCOMPLETE_BALANCE_COVERAGE") ? "LOW" : "MEDIUM",
    basis,
    included: [...new Set(items.map((item) => item.economicCategory))],
    excluded: items.some((item) => item.economicCategory === "INTERNAL_TRANSFER") ? [] : ["INTERNAL_TRANSFER"],
    warnings: [...commonWarnings, "ACCOUNT_COVERAGE_NOT_PROVEN", ...(qualityWarnings.includes("INCOMPLETE_BALANCE_COVERAGE") ? ["INCOMPLETE_ACCOUNT_OR_BALANCE_COVERAGE"] : [])],
  });
  return {
    endingBalance: factualMetric("BSM-LIQ-001", endingBalance, "Aggregate confirmed ending balance across supplied statements"),
    averageDailyBalance: factualMetric("BSM-LIQ-002", average, items.some((item) => item.economicCategory === "INTERNAL_TRANSFER")
      ? "Daily balance of supplied accounts reconstructed from confirmed opening balance and all retained account cash movements, including internal transfers, and reconciled against confirmed ending balance."
      : "Daily company balance reconstructed forward from confirmed opening balance using external cash movements and reconciled against confirmed ending balance."),
    minimumDailyBalance: factualMetric("BSM-LIQ-003", minimum, "Minimum reconstructed aggregate daily balance"),
    lowLiquidityDays: factualMetric("BSM-LIQ-004", dailyBalances.length ? dailyBalances.filter((value) => value < lowThreshold).length : null, "Days with reconstructed balance below three days of average external outflow", "DAYS"),
    nearZeroBalanceDays: factualMetric("BSM-LIQ-005", dailyBalances.length ? dailyBalances.filter((value) => value <= nearZeroThreshold).length : null, "Days with reconstructed balance at or below 25% of average daily external outflow", "DAYS"),
    negativeReconstructedBalanceDays: factualMetric("BSM-LIQ-006", dailyBalances.length ? dailyBalances.filter((value) => value < 0).length : null, "Days with a negative reconstructed aggregate balance", "DAYS"),
  };
}

function splitDebt(items: ClassifiedTransaction[]) {
  const principalRows = items.filter((item) => item.economicCategory === "LOAN_PRINCIPAL_PAYMENT");
  const interestRows = items.filter((item) => item.economicCategory === "INTEREST_PAYMENT");
  const unsplitRows: ClassifiedTransaction[] = [];
  let splitPrincipal = 0;
  let splitInterest = 0;
  let splitPrincipalCount = 0;
  let splitInterestCount = 0;
  const splitPrincipalConfidence = emptyBreakdown();
  const splitInterestConfidence = emptyBreakdown();
  const warnings: string[] = [];
  for (const item of items.filter((row) => row.economicCategory === "DEBT_SERVICE_UNSPLIT")) {
    const components = item.classification?.components ?? [];
    const amounts = components.map((component) => component.amount);
    const valid = amounts.length >= 2 && amounts.every((amount): amount is number => amount !== null && Number.isFinite(amount) && amount >= 0)
      && Math.abs(amounts.reduce((sum, amount) => sum + amount, 0) - item.amount) <= Math.max(0.01, item.amount * 0.000001);
    if (!valid) {
      unsplitRows.push(item);
      if (components.length) warnings.push(`INVALID_DEBT_COMPONENT_SPLIT:${item.canonicalTransactionId || item.id}`);
      continue;
    }
    for (const component of components) {
      if (component.category === "LOAN_PRINCIPAL_PAYMENT") {
        splitPrincipal += component.amount ?? 0;
        splitPrincipalCount += 1;
        splitPrincipalConfidence[confidenceBucket(component.confidence)] += component.amount ?? 0;
      }
      if (component.category === "INTEREST_PAYMENT") {
        splitInterest += component.amount ?? 0;
        splitInterestCount += 1;
        splitInterestConfidence[confidenceBucket(component.confidence)] += component.amount ?? 0;
      }
    }
  }
  const principal = aggregate(principalRows);
  const interest = aggregate(interestRows);
  const unsplit = aggregate(unsplitRows);
  principal.amount = round(principal.amount + splitPrincipal, 2);
  interest.amount = round(interest.amount + splitInterest, 2);
  principal.count += splitPrincipalCount;
  interest.count += splitInterestCount;
  for (const key of Object.keys(splitPrincipalConfidence) as Array<keyof MetricConfidenceBreakdown>) principal.confidence[key] += splitPrincipalConfidence[key];
  for (const key of Object.keys(splitInterestConfidence) as Array<keyof MetricConfidenceBreakdown>) interest.confidence[key] += splitInterestConfidence[key];
  principal.warnings = warnings;
  interest.warnings = warnings;
  unsplit.warnings = warnings;
  return { principal, interest, unsplit, warnings, splitUsed: splitPrincipal + splitInterest > 0 };
}

function difference(legacyValue: number | null, v2Value: number | null) {
  if (legacyValue === null || v2Value === null) return { absoluteDiff: null, relativeDiff: null };
  const absoluteDiff = v2Value - legacyValue;
  return { absoluteDiff: round(absoluteDiff, 4), relativeDiff: legacyValue === 0 ? null : round(absoluteDiff / Math.abs(legacyValue), 4) };
}

function buildComparison(legacy: LegacyMetrics | undefined, metrics: BankStatementMetricsV2, reasons: Set<MetricsComparisonReasonCode>): MetricsComparisonSummary {
  const rows: Array<{ metric: string; legacy: number | null; v2: number | null; reasonCodes: MetricsComparisonReasonCode[]; changed: boolean }> = [
    { metric: "operating inflow → operating cash receipts", legacy: legacy?.operatingInflow ?? null, v2: metrics.operating.operatingCashReceipts.value, reasonCodes: [...reasons].filter((item) => ["FACTORING_EXCLUDED_FROM_OPERATING", "OWNER_LOAN_EXCLUDED", "UNKNOWN_INFLOW_EXCLUDED"].includes(item)), changed: true },
    { metric: "avg monthly inflow → observed monthly operating average", legacy: legacy?.avgMonthlyInflow ?? null, v2: metrics.operating.observedMonthlyOperatingAverage.value, reasonCodes: [...reasons].filter((item) => ["MISSING_MONTH_NOT_ZERO"].includes(item)), changed: true },
    { metric: "avg monthly inflow → full-month operating average", legacy: legacy?.avgMonthlyInflow ?? null, v2: metrics.operating.fullMonthOperatingAverage.value, reasonCodes: [...reasons].filter((item) => ["PARTIAL_MONTH_EXCLUDED", "MISSING_MONTH_NOT_ZERO"].includes(item)), changed: true },
    { metric: "Top-1 → direct customer Top-1", legacy: legacy?.topOneConcentration ?? null, v2: metrics.customers.directCustomerTop1.value, reasonCodes: [...reasons].filter((item) => ["MARKETPLACE_INTERMEDIARY", "ACQUIRING_INTERMEDIARY", "COUNTERPARTY_AGGREGATION_CHANGED"].includes(item)), changed: true },
    { metric: "tax regularity → tax payment month share", legacy: legacy?.taxRegularity ?? null, v2: metrics.tax.taxPaymentMonthShare.value, reasonCodes: ["DEFINITION_CHANGED"], changed: true },
    { metric: "risky outflow share → unclear individual + cash share", legacy: legacy?.riskyOutflowShare ?? null, v2: metrics.individualAndCash.unclearIndividualAndCashShare.value, reasonCodes: ["DEFINITION_CHANGED"], changed: true },
    { metric: "debt service share → v2 debt service ratio", legacy: legacy?.debtServiceShare ?? null, v2: metrics.debtService.debtServiceToOperatingReceipts.value, reasonCodes: [...reasons].filter((item) => item === "DEBT_SPLIT_REFINED"), changed: true },
    { metric: "seasonality → peak-to-average", legacy: legacy?.seasonality ?? null, v2: metrics.operating.peakToAverageRatio.value, reasonCodes: ["DEFINITION_CHANGED"], changed: true },
    { metric: "seasonality → seasonality eligibility", legacy: legacy?.seasonality ?? null, v2: metrics.operating.seasonalityEligibility.value, reasonCodes: ["DEFINITION_CHANGED"], changed: true },
  ];
  const comparisons = rows.map((row) => ({
    metric: row.metric,
    legacyValue: row.legacy,
    v2Value: row.v2,
    ...difference(row.legacy, row.v2),
    reasonCodes: row.reasonCodes.length ? row.reasonCodes : ["DEFINITION_CHANGED" as const],
    definitionChanged: row.changed,
  }));
  const material = comparisons.filter((item) => item.absoluteDiff === null || Math.abs(item.absoluteDiff) > 0.0001 || item.definitionChanged);
  return {
    version: BANK_STATEMENT_METRICS_VERSION,
    totalCompared: comparisons.length,
    materialDifferenceCount: material.length,
    comparisons,
    materialDifferences: material.slice(0, 25),
    materialDifferencesTruncated: material.length > 25 || undefined,
  };
}

export function buildBankStatementMetricsV2(input: MetricsEngineInput): { metricsV2: BankStatementMetricsV2; metricsComparison: MetricsComparisonSummary } {
  const items = classifyTransactions(input.transactions);
  const byCategory = (categories: EconomicCategory[]) => aggregate(items, categories);
  const external = items.filter((item) => item.economicCategory !== "INTERNAL_TRANSFER");
  const externalIn = aggregate(external.filter((item) => item.direction === "in"));
  const externalOut = aggregate(external.filter((item) => item.direction === "out"));
  const operating = byCategory(OPERATING_RECEIPTS);
  const sale = byCategory(["SALE_PROCEEDS"]);
  const advance = byCategory(["CUSTOMER_ADVANCE"]);
  const acquiring = byCategory(["ACQUIRING_SETTLEMENT"]);
  const marketplace = byCategory(["MARKETPLACE_SETTLEMENT"]);
  const bankLoan = byCategory(["BANK_LOAN_RECEIVED"]);
  const otherLoan = byCategory(["OTHER_LOAN_RECEIVED"]);
  const ownerLoan = byCategory(["OWNER_LOAN_RECEIVED"]);
  const factoring = byCategory(["FACTORING_PROCEEDS"]);
  const financing = aggregateUnion(bankLoan, otherLoan, ownerLoan, factoring);
  const supplier = byCategory(["SUPPLIER_PAYMENT"]);
  const rent = byCategory(["RENT_PAYMENT"]);
  const payroll = byCategory(["PAYROLL"]);
  const employeeReimbursement = byCategory(["EMPLOYEE_REIMBURSEMENT"]);
  const individualBusiness = byCategory(["INDIVIDUAL_BUSINESS_PAYMENT"]);
  const individualUnclear = byCategory(["INDIVIDUAL_UNCLEAR_PAYMENT"]);
  const cashWithdrawal = byCategory(["CASH_WITHDRAWAL"]);
  const tax = byCategory(["TAX_PAYMENT"]);
  const social = byCategory(["SOCIAL_CONTRIBUTION"]);
  const taxAndSocial = aggregateUnion(tax, social);
  const debtSplit = splitDebt(items);
  const leasing = byCategory(["LEASING_PAYMENT"]);
  const debtService = byCategory(DEBT_SERVICE);
  debtService.warnings = debtSplit.warnings;
  const unknownInflow = byCategory(["UNKNOWN_INFLOW"]);
  const unknownShare = externalIn.amount ? unknownInflow.amount / externalIn.amount : 0;
  const monthly = calendarSeries(items, input);
  const calendar = monthlyMetrics(monthly, operating, input, unknownShare);
  const fullMonths = monthly.filter((item) => item.coverage === "FULL").length;
  const partialMonths = monthly.filter((item) => item.coverage === "PARTIAL").length;
  const missingMonths = monthly.filter((item) => item.coverage === "MISSING").length;
  const overlapMonths = monthly.filter((item) => item.coverage === "OVERLAP").length;
  const taxMonths = new Set(taxAndSocial.transactions.map((item) => monthKey(item.date)).filter(Boolean)).size;
  const payrollMonths = new Set(payroll.transactions.map((item) => monthKey(item.date)).filter(Boolean)).size;
  const observedMonths = monthly.filter((item) => item.coverage !== "MISSING").length;
  const reasons = new Set<MetricsComparisonReasonCode>(["DEFINITION_CHANGED"]);
  if (factoring.amount) reasons.add("FACTORING_EXCLUDED_FROM_OPERATING");
  if (ownerLoan.amount) reasons.add("OWNER_LOAN_EXCLUDED");
  if (marketplace.amount) reasons.add("MARKETPLACE_INTERMEDIARY");
  if (acquiring.amount) reasons.add("ACQUIRING_INTERMEDIARY");
  if (partialMonths) reasons.add("PARTIAL_MONTH_EXCLUDED");
  if (missingMonths) reasons.add("MISSING_MONTH_NOT_ZERO");
  if (unknownInflow.amount) reasons.add("UNKNOWN_INFLOW_EXCLUDED");
  if (debtSplit.splitUsed) reasons.add("DEBT_SPLIT_REFINED");
  if (items.some((item) => item.economicCategory === "INTERNAL_TRANSFER")) reasons.add("INTERNAL_TRANSFER_RECONCILED");
  if (items.some((item) => item.counterpartyInn)) reasons.add("COUNTERPARTY_AGGREGATION_CHANGED");

  const customers = buildConcentration(items, operating, input, unknownShare);
  const suppliers = buildSuppliers(items, input);
  const other = (category: EconomicCategory) => byCategory([category]);
  const lowAndUnknown = items.reduce((result, item) => {
    result[item.economicConfidence] += item.amount;
    return result;
  }, { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 } as Record<ClassificationConfidence, number>);
  const qualityWarnings = [
    ...(input.integrity?.warnings ?? []),
    ...(unknownInflow.amount / Math.max(1, externalIn.amount) > 0.2 ? ["MATERIAL_UNKNOWN_INFLOW_SHARE"] : []),
    ...debtSplit.warnings,
    ...(input.sourceManifest?.bankStatements.some((source) => source.fieldAvailability?.openingBalance === "UNKNOWN" || source.fieldAvailability?.endingBalance === "UNKNOWN") ? ["INCOMPLETE_BALANCE_COVERAGE"] : []),
  ];
  const liquidity = buildLiquidity(items, input, qualityWarnings);

  const metricsV2: BankStatementMetricsV2 = {
    version: BANK_STATEMENT_METRICS_VERSION,
    mode: "SHADOW",
    period: { from: input.periodFrom ?? null, to: input.periodTo ?? null, fullMonths, partialMonths, missingMonths, overlapMonths },
    cashFlow: {
      grossExternalCashInflow: metric("BSM-CASH-001", input, { basis: "All retained external incoming transactions; internal transfers excluded", included: [...OPERATING_RECEIPTS, ...ALL_NON_OPERATING_INFLOW], excluded: ["INTERNAL_TRANSFER"], aggregate: externalIn }),
      grossExternalCashOutflow: metric("BSM-CASH-002", input, { basis: "All retained external outgoing transactions; internal transfers excluded", included: [...new Set(externalOut.transactions.map((item) => item.economicCategory))], excluded: ["INTERNAL_TRANSFER"], aggregate: externalOut }),
      netExternalCashFlow: metric("BSM-CASH-003", input, { value: externalIn.amount - externalOut.amount, basis: "Gross external cash inflow minus gross external cash outflow", included: [...new Set(external.map((item) => item.economicCategory))], excluded: ["INTERNAL_TRANSFER"], aggregate: aggregateUnion(externalIn, externalOut) }),
    },
    operating: {
      operatingCashReceipts: metric("BSM-OPER-001", input, { confidence: metricConfidence(operating, input.integrity, { unknownShare }), basis: "Cash receipts classified as sales, customer advances, acquiring settlements, or marketplace settlements", included: OPERATING_RECEIPTS, excluded: ALL_NON_OPERATING_INFLOW, aggregate: operating }),
      saleProceedsAmount: metric("BSM-OPER-002", input, { basis: "Receipts classified as sale proceeds", included: ["SALE_PROCEEDS"], aggregate: sale }),
      customerAdvanceAmount: metric("BSM-OPER-003", input, { basis: "Receipts classified as customer advances", included: ["CUSTOMER_ADVANCE"], aggregate: advance }),
      acquiringSettlementAmount: metric("BSM-OPER-004", input, { basis: "Receipts classified as acquiring settlements", included: ["ACQUIRING_SETTLEMENT"], aggregate: acquiring }),
      marketplaceSettlementAmount: metric("BSM-OPER-005", input, { basis: "Receipts classified as marketplace settlements", included: ["MARKETPLACE_SETTLEMENT"], aggregate: marketplace }),
      supplierPayments: metric("BSM-OPER-006", input, { basis: "Payments classified as supplier payments", included: ["SUPPLIER_PAYMENT"], aggregate: supplier }),
      rentPayments: metric("BSM-OPER-007", input, { basis: "Payments classified as rent", included: ["RENT_PAYMENT"], aggregate: rent }),
      employeeReimbursements: metric("BSM-OPER-008", input, { basis: "Payments classified as employee reimbursements", included: ["EMPLOYEE_REIMBURSEMENT"], aggregate: employeeReimbursement }),
      individualBusinessPayments: metric("BSM-OPER-009", input, { basis: "Business-purpose payments to individuals or self-employed persons", included: ["INDIVIDUAL_BUSINESS_PAYMENT"], aggregate: individualBusiness }),
      observedMonthlyOperatingAverage: calendar.observedAverage,
      fullMonthOperatingAverage: calendar.fullAverage,
      operatingReceiptsTrend: calendar.trend,
      operatingReceiptsVolatility: calendar.volatility,
      peakToAverageRatio: calendar.peakToAverage,
      seasonalityEligibility: calendar.seasonalityEligibility,
      trendStatus: calendar.trendStatus,
      seasonalityStatus: calendar.seasonalityStatus,
    },
    financing: {
      financingCashInflow: metric("BSM-FIN-001", input, { basis: "Bank, other, owner loan, and factoring financing inflows", included: FINANCING_INFLOWS, aggregate: financing }),
      bankLoanInflow: metric("BSM-FIN-002", input, { basis: "Bank loan receipts", included: ["BANK_LOAN_RECEIVED"], aggregate: bankLoan }),
      otherLoanInflow: metric("BSM-FIN-003", input, { basis: "Non-bank non-owner loan receipts", included: ["OTHER_LOAN_RECEIVED"], aggregate: otherLoan }),
      ownerLoanInflow: metric("BSM-FIN-004", input, { basis: "Owner loan receipts", included: ["OWNER_LOAN_RECEIVED"], aggregate: ownerLoan }),
      factoringInflow: metric("BSM-FIN-005", input, { basis: "Factoring financing receipts; excluded from operating cash receipts", included: ["FACTORING_PROCEEDS"], aggregate: factoring }),
    },
    ownerFunding: {
      ownerContributionAmount: metric("BSM-OWN-001", input, { basis: "Owner contributions not evidenced as loans", included: ["OWNER_CONTRIBUTION"], aggregate: other("OWNER_CONTRIBUTION") }),
      ownerFundingUnspecifiedAmount: metric("BSM-OWN-002", input, { basis: "Owner funding whose legal nature is unspecified", included: ["OWNER_FUNDING_UNSPECIFIED"], aggregate: other("OWNER_FUNDING_UNSPECIFIED") }),
    },
    otherInflows: {
      loanRepaymentReceivedAmount: metric("BSM-IN-001", input, { basis: "Repayment of loans previously issued", included: ["LOAN_REPAYMENT_RECEIVED"], aggregate: other("LOAN_REPAYMENT_RECEIVED") }),
      taxRefundAmount: metric("BSM-IN-002", input, { basis: "Tax refunds", included: ["TAX_REFUND"], aggregate: other("TAX_REFUND") }),
      refundReceivedAmount: metric("BSM-IN-003", input, { basis: "Other refunds received without automatic operating netting", included: ["REFUND_RECEIVED"], aggregate: other("REFUND_RECEIVED") }),
      subsidyGrantAmount: metric("BSM-IN-004", input, { basis: "Subsidies and grants", included: ["SUBSIDY_GRANT"], aggregate: other("SUBSIDY_GRANT") }),
      insurancePayoutAmount: metric("BSM-IN-005", input, { basis: "Insurance payouts", included: ["INSURANCE_PAYOUT"], aggregate: other("INSURANCE_PAYOUT") }),
      assetSaleProceedsAmount: metric("BSM-IN-006", input, { basis: "Cash proceeds from asset sales", included: ["ASSET_SALE_PROCEEDS"], aggregate: other("ASSET_SALE_PROCEEDS") }),
      otherInflowAmount: metric("BSM-IN-007", input, { basis: "Other identified non-operating inflows", included: ["OTHER_INFLOW"], aggregate: other("OTHER_INFLOW") }),
      unknownInflowAmount: metric("BSM-IN-008", input, { basis: "Incoming cash whose economic nature is not sufficiently evidenced", included: ["UNKNOWN_INFLOW"], aggregate: unknownInflow }),
      unknownInflowShare: ratioMetric("BSM-IN-009", input, unknownInflow, externalIn, "Unknown inflow divided by gross external cash inflow", ["UNKNOWN_INFLOW"]),
      unknownInflowCount: metric("BSM-IN-010", input, { value: unknownInflow.count, unit: "COUNT", basis: "Count of unknown inflow transactions", included: ["UNKNOWN_INFLOW"], aggregate: unknownInflow }),
    },
    debtService: {
      loanPrincipalPaid: metric("BSM-DEBT-001", input, { basis: "Explicit principal plus validated principal components", included: ["LOAN_PRINCIPAL_PAYMENT", "DEBT_SERVICE_UNSPLIT"], aggregate: debtSplit.principal }),
      interestPaid: metric("BSM-DEBT-002", input, { basis: "Explicit interest plus validated interest components", included: ["INTEREST_PAYMENT", "DEBT_SERVICE_UNSPLIT"], aggregate: debtSplit.interest }),
      unsplitDebtService: metric("BSM-DEBT-003", input, { basis: "Debt service payments without a validated principal/interest split", included: ["DEBT_SERVICE_UNSPLIT"], aggregate: debtSplit.unsplit }),
      leasingPaid: metric("BSM-DEBT-004", input, { basis: "Leasing cash payments", included: ["LEASING_PAYMENT"], aggregate: leasing }),
      debtServiceCashOutflow: metric("BSM-DEBT-005", input, { basis: "Principal plus interest plus unsplit debt service plus leasing", included: DEBT_SERVICE, aggregate: debtService }),
      debtServiceToOperatingReceipts: ratioMetric("BSM-DEBT-006", input, debtService, operating, "Debt service cash outflow divided by operating cash receipts", DEBT_SERVICE),
      factoringFeeAmount: metric("BSM-DEBT-007", input, { basis: "Factoring fees kept separate from debt service", included: ["FACTORING_FEE"], aggregate: other("FACTORING_FEE") }),
    },
    tax: {
      taxPaymentsAmount: metric("BSM-TAX-001", input, { basis: "Tax payments", included: ["TAX_PAYMENT"], aggregate: tax }),
      socialContributionsAmount: metric("BSM-TAX-002", input, { basis: "Social contributions", included: ["SOCIAL_CONTRIBUTION"], aggregate: social }),
      taxAndSocialAmount: metric("BSM-TAX-003", input, { basis: "Tax payments plus social contributions", included: ["TAX_PAYMENT", "SOCIAL_CONTRIBUTION"], aggregate: taxAndSocial }),
      taxPaymentMonths: metric("BSM-TAX-004", input, { value: taxMonths, unit: "MONTHS", basis: "Distinct observed months with tax or social payments", included: ["TAX_PAYMENT", "SOCIAL_CONTRIBUTION"], aggregate: taxAndSocial }),
      taxPaymentMonthShare: metric("BSM-TAX-005", input, { value: observedMonths ? taxMonths / observedMonths : null, unit: "RATIO", status: observedMonths ? "KNOWN" : "UNKNOWN", basis: "Months with tax or social payments divided by observed non-missing months", included: ["TAX_PAYMENT", "SOCIAL_CONTRIBUTION"], aggregate: taxAndSocial }),
      taxToOperatingCashReceipts: ratioMetric("BSM-TAX-006", input, taxAndSocial, operating, "Tax and social payments divided by operating cash receipts", ["TAX_PAYMENT", "SOCIAL_CONTRIBUTION"]),
    },
    payroll: {
      payrollAmount: metric("BSM-PAY-001", input, { basis: "Payroll payments", included: ["PAYROLL"], aggregate: payroll }),
      payrollMonths: metric("BSM-PAY-002", input, { value: payrollMonths, unit: "MONTHS", basis: "Distinct observed months containing payroll payments", included: ["PAYROLL"], aggregate: payroll }),
      payrollToOperatingReceipts: ratioMetric("BSM-PAY-003", input, payroll, operating, "Payroll divided by operating cash receipts", ["PAYROLL"]),
    },
    individualAndCash: {
      individualBusinessAmount: metric("BSM-IND-001", input, { basis: "Business-purpose payments to individuals", included: ["INDIVIDUAL_BUSINESS_PAYMENT"], aggregate: individualBusiness }),
      unclearIndividualAmount: metric("BSM-IND-002", input, { basis: "Payments to individuals without sufficiently evidenced business purpose", included: ["INDIVIDUAL_UNCLEAR_PAYMENT"], aggregate: individualUnclear }),
      cashWithdrawalAmount: metric("BSM-IND-003", input, { basis: "Cash withdrawals", included: ["CASH_WITHDRAWAL"], aggregate: cashWithdrawal }),
      unclearIndividualAndCashShare: ratioMetric("BSM-IND-004", input, aggregateUnion(individualUnclear, cashWithdrawal), externalOut, "Unclear individual payments plus cash withdrawals divided by gross external cash outflow", ["INDIVIDUAL_UNCLEAR_PAYMENT", "CASH_WITHDRAWAL"]),
    },
    otherOutflows: {
      otherOutflowAmount: metric("BSM-OUT-001", input, { basis: "Other identified external outflows", included: ["OTHER_OUTFLOW"], aggregate: other("OTHER_OUTFLOW") }),
      unknownOutflowAmount: metric("BSM-OUT-002", input, { basis: "External outflows whose economic nature is not sufficiently evidenced", included: ["UNKNOWN_OUTFLOW", "UNKNOWN_DIRECTION"], aggregate: byCategory(["UNKNOWN_OUTFLOW", "UNKNOWN_DIRECTION"]) }),
      unknownOutflowShare: ratioMetric("BSM-OUT-003", input, byCategory(["UNKNOWN_OUTFLOW", "UNKNOWN_DIRECTION"]), externalOut, "Unknown external outflow divided by gross external cash outflow", ["UNKNOWN_OUTFLOW", "UNKNOWN_DIRECTION"]),
    },
    fees: {
      bankFeeAmount: metric("BSM-FEE-001", input, { basis: "Bank fees", included: ["BANK_FEE"], aggregate: other("BANK_FEE") }),
      acquiringFeeAmount: metric("BSM-FEE-002", input, { basis: "Acquiring fees", included: ["ACQUIRING_FEE"], aggregate: other("ACQUIRING_FEE") }),
    },
    ownerOutflows: {
      dividendAmount: metric("BSM-OWN-003", input, { basis: "Dividend payments", included: ["DIVIDEND"], aggregate: other("DIVIDEND") }),
      ownerWithdrawalAmount: metric("BSM-OWN-004", input, { basis: "Owner withdrawals", included: ["OWNER_WITHDRAWAL"], aggregate: other("OWNER_WITHDRAWAL") }),
    },
    investing: {
      assetPurchaseAmount: metric("BSM-INV-001", input, { basis: "Asset purchase cash outflows", included: ["ASSET_PURCHASE"], aggregate: other("ASSET_PURCHASE") }),
      assetSaleProceedsAmount: metric("BSM-INV-002", input, { basis: "Asset sale cash inflows", included: ["ASSET_SALE_PROCEEDS"], aggregate: other("ASSET_SALE_PROCEEDS") }),
    },
    lending: { loanIssuedAmount: metric("BSM-LEND-001", input, { basis: "Loans issued to third parties", included: ["LOAN_ISSUED"], aggregate: other("LOAN_ISSUED") }) },
    refunds: {
      refundReceivedAmount: metric("BSM-REF-001", input, { basis: "Refunds received without automatic operating netting", included: ["REFUND_RECEIVED"], aggregate: other("REFUND_RECEIVED") }),
      customerRefundAmount: metric("BSM-REF-002", input, { basis: "Refunds paid to customers without automatic operating netting", included: ["CUSTOMER_REFUND"], aggregate: other("CUSTOMER_REFUND") }),
    },
    customers,
    suppliers,
    liquidity,
    quality: {
      sourceIntegrityConfidence: input.integrity?.confidence ?? null,
      unknownInflowShare: externalIn.amount ? round(unknownInflow.amount / externalIn.amount, 4) : null,
      classificationAmounts: Object.fromEntries(Object.entries(lowAndUnknown).map(([key, value]) => [key, round(value, 2)])) as Record<ClassificationConfidence, number>,
      warnings: [...new Set(qualityWarnings)],
    },
    monthly,
  };
  applyConflictKnowledge(metricsV2, input.conflicts ?? []);
  return { metricsV2, metricsComparison: buildComparison(input.legacyMetrics, metricsV2, reasons) };
}
