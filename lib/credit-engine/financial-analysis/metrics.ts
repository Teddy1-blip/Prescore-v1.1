import { FINANCIAL_ANALYSIS_VERSION, BALANCE_CODES, INCOME_CODES, type FinancialMetricResult, type FinancialPeriodAnalysis, type FinancialStatementSnapshot, type FinancialValueStatus } from "../contracts/financial-statements.ts";
import { financialIntegrity } from "./integrity.ts";
import { weakest } from "./normalizer.ts";
import { daysInPeriod } from "./periods.ts";

export function analyzeFinancialPeriod(s: FinancialStatementSnapshot, opening?: FinancialStatementSnapshot): FinancialPeriodAnalysis {
  const quality = financialIntegrity(s);
  const amounts: Record<string, FinancialMetricResult> = {};
  const groups: Record<string, FinancialMetricResult> = {};
  let index = 0;
  for (const [field, v] of Object.entries({ ...s.balance, ...s.income, REPORTED_NET_ASSETS: s.reportedNetAssets, EQUITY_NET_ASSETS_PROXY: s.equityNetAssetsProxy })) {
    const flow = field in INCOME_CODES;
    const periodConfidence = flow || field in BALANCE_CODES ? s.period.confidence : "HIGH";
    amounts[field] = {
      code: `FSM-AMT-${String(++index).padStart(3, "0")}`, version: FINANCIAL_ANALYSIS_VERSION, value: v.value,
      unit: "RUB", status: v.status, confidence: weakest(v.confidence, quality.confidence, periodConfidence), origin: v.origin,
      periodFrom: flow ? s.period.from : null, periodTo: flow ? s.period.to : null, asOf: flow ? null : s.period.asOf,
      calculationBasis: v.origin === "PROXY" ? "Equity proxy only; not reported net assets" : `Reported ${field} normalized to RUB; ${v.rawLabel ? `raw label ${v.rawLabel}` : `raw code ${v.rawCode ?? field}`}`,
      dependencies: [v.rawCode ?? v.rawLabel ?? field], sourceIds: [v.sourceId], warnings: [...new Set([...v.warnings, ...quality.warnings])],
    };
  }
  Object.assign(groups, amounts);
  function calculate(code: string, key: string, dependencies: string[], formula: (values: number[]) => number, basis: string, options: {
    unit?: FinancialMetricResult["unit"]; denominator?: number; nonPositiveEquity?: boolean; warning?: string;
    status?: FinancialValueStatus; unavailable?: string; extraWarnings?: string[];
  } = {}): FinancialMetricResult {
    const deps = dependencies.map(k => groups[k]);
    const missing = deps.some(v => !v || v.value === null || v.status === "UNKNOWN" || v.status === "NOT_APPLICABLE");
    let value: number | null = null, status: FinancialValueStatus = "KNOWN";
    const warnings = [...new Set([...deps.flatMap(v => v?.warnings ?? []), ...(options.extraWarnings ?? [])])];
    if (missing) { status = "UNKNOWN"; warnings.push("SOURCE_FIELD_MISSING", "MISSING_NOT_ZERO"); }
    else if (options.unavailable) { status = "NOT_APPLICABLE"; warnings.push(options.unavailable); }
    else if (options.denominator !== undefined && (deps[options.denominator].value === 0 || (options.nonPositiveEquity && deps[options.denominator].value! <= 0))) {
      status = "NOT_APPLICABLE"; warnings.push(options.nonPositiveEquity ? "NON_POSITIVE_EQUITY_DENOMINATOR" : options.warning ?? "ZERO_DENOMINATOR");
    } else {
      const result = formula(deps.map(v => v.value!));
      if (!Number.isFinite(result)) { status = "UNKNOWN"; warnings.push("NON_FINITE_RESULT"); }
      else { value = result; status = options.status ?? (deps.some(v => v.status === "PARTIAL") ? "PARTIAL" : "KNOWN"); }
    }
    const confidence = value === null ? "UNKNOWN" : weakest(quality.confidence, ...deps.map(v => v.confidence), status === "PARTIAL" ? "MEDIUM" : "HIGH");
    const result: FinancialMetricResult = {
      code, version: FINANCIAL_ANALYSIS_VERSION, value, unit: options.unit ?? "RATIO", status, confidence, origin: "DERIVED",
      periodFrom: s.period.from, periodTo: s.period.to, asOf: s.period.asOf,
      calculationBasis: `${basis}${warnings.includes("ENDING_BALANCE_DENOMINATOR") ? "; ending balance replaces the unavailable opening/closing average (PARTIAL)" : ""}`, dependencies, sourceIds: [...new Set(deps.flatMap(v => v?.sourceIds ?? [s.sourceId]))], warnings: [...new Set(warnings)],
    };
    groups[key] = result;
    return result;
  }
  const sum = (code: string, key: string, deps: string[]) => calculate(code, key, deps, v => v.reduce((a, b) => a + b, 0), `${deps.join(" + ")}; every component must be known`, { unit: "RUB" });
  const ratio = (code: string, key: string, a: string, b: string, extra: Parameters<typeof calculate>[5] = {}) => calculate(code, key, [a, b], ([n, d]) => n / d, `${a} / ${b}; no imputation or annualization`, { denominator: 1, ...extra });
  amounts.TOTAL_LIABILITIES = sum("FSM-AMT-040", "TOTAL_LIABILITIES", ["LONG_TERM_LIABILITIES", "SHORT_TERM_LIABILITIES"]);
  amounts.TOTAL_BORROWINGS = sum("FSM-AMT-041", "TOTAL_BORROWINGS", ["LONG_TERM_BORROWINGS", "SHORT_TERM_BORROWINGS"]);
  sum("FSM-INT-001", "QUICK_ASSETS", ["RECEIVABLES", "SHORT_TERM_FIN_INVESTMENTS", "CASH"]);
  sum("FSM-INT-002", "CASH_AND_INVESTMENTS", ["CASH", "SHORT_TERM_FIN_INVESTMENTS"]);
  const liquidity = {
    currentRatio: ratio("FSM-LIQ-001", "CURRENT_RATIO", "CURRENT_ASSETS", "SHORT_TERM_LIABILITIES"),
    quickRatio: ratio("FSM-LIQ-002", "QUICK_RATIO", "QUICK_ASSETS", "SHORT_TERM_LIABILITIES"),
    absoluteLiquidity: ratio("FSM-LIQ-003", "ABSOLUTE_LIQUIDITY", "CASH_AND_INVESTMENTS", "SHORT_TERM_LIABILITIES"),
    netWorkingCapital: calculate("FSM-LIQ-004", "NET_WORKING_CAPITAL", ["CURRENT_ASSETS", "SHORT_TERM_LIABILITIES"], ([a, b]) => a - b, "CURRENT_ASSETS - SHORT_TERM_LIABILITIES", { unit: "RUB" }),
  };
  const capitalStructure = {
    equityRatio: ratio("FSM-CAP-001", "EQUITY_RATIO", "EQUITY", "ASSETS_TOTAL"),
    liabilitiesToAssets: ratio("FSM-CAP-002", "LIABILITIES_TO_ASSETS", "TOTAL_LIABILITIES", "ASSETS_TOTAL"),
    borrowingsToAssets: ratio("FSM-CAP-003", "BORROWINGS_TO_ASSETS", "TOTAL_BORROWINGS", "ASSETS_TOTAL"),
    debtToEquity: ratio("FSM-CAP-004", "DEBT_TO_EQUITY", "TOTAL_BORROWINGS", "EQUITY", { nonPositiveEquity: true }),
    liabilitiesToEquity: ratio("FSM-CAP-005", "LIABILITIES_TO_EQUITY", "TOTAL_LIABILITIES", "EQUITY", { nonPositiveEquity: true }),
    netDebt: calculate("FSM-CAP-006", "NET_DEBT", ["TOTAL_BORROWINGS", "CASH", "SHORT_TERM_FIN_INVESTMENTS"], ([b, c, i]) => b - c - i, "TOTAL_BORROWINGS - CASH - SHORT_TERM_FIN_INVESTMENTS; all components required", { unit: "RUB" }),
    shortTermDebtShare: ratio("FSM-CAP-007", "SHORT_TERM_DEBT_SHARE", "SHORT_TERM_BORROWINGS", "TOTAL_BORROWINGS"),
  };
  // Average only the immediately preceding closing balance at the flow start.
  const openingValid = opening && opening.companyInn === s.companyInn && opening.accountingStandard === s.accountingStandard && opening.accountingStandard === "RAS" && opening.period.asOf && s.period.from && Date.parse(s.period.from) - Date.parse(opening.period.asOf) === 86_400_000;
  const openingQuality = openingValid ? financialIntegrity(opening) : null;
  for (const [n, field] of ["ASSETS_TOTAL", "EQUITY", "RECEIVABLES", "INVENTORIES"].entries()) {
    const prior = openingValid ? opening.balance[field as keyof typeof opening.balance] : undefined;
    if (prior?.status === "KNOWN" && prior.value !== null) {
      groups[`OPENING_${field}`] = { ...amounts[field], value: prior.value, status: prior.status, confidence: weakest(prior.confidence, openingQuality!.confidence, opening!.period.confidence), sourceIds: [opening!.sourceId], warnings: [...prior.warnings, ...openingQuality!.warnings], asOf: opening!.period.asOf };
      calculate(`FSM-AVG-00${n + 1}`, `AVERAGE_${field}`, [field, `OPENING_${field}`], ([a, b]) => (a + b) / 2, `Average of opening and closing ${field}`, { unit: "RUB", extraWarnings: ["AVERAGE_DENOMINATOR_USED"] });
    } else {
      calculate(`FSM-AVG-00${n + 1}`, `AVERAGE_${field}`, [field], ([a]) => a, `Ending ${field} used instead of unavailable opening/closing average`, { unit: "RUB", status: "PARTIAL", extraWarnings: ["ENDING_BALANCE_DENOMINATOR", "ENDING_DENOMINATOR_FALLBACK"] });
    }
  }
  const annualOnly = s.period.kind !== "ANNUAL" || s.period.flowPeriodType !== "FULL_YEAR" ? "INTERIM_PERIOD_NOT_ANNUALIZED" : undefined;
  const profitability = {
    grossMargin: ratio("FSM-PROF-001", "GROSS_MARGIN", "GROSS_PROFIT", "REVENUE"),
    operatingMargin: ratio("FSM-PROF-002", "OPERATING_MARGIN", "OPERATING_PROFIT", "REVENUE"),
    pretaxMargin: ratio("FSM-PROF-003", "PRETAX_MARGIN", "PROFIT_BEFORE_TAX", "REVENUE"),
    netMargin: ratio("FSM-PROF-004", "NET_MARGIN", "NET_PROFIT", "REVENUE"),
    roa: ratio("FSM-PROF-005", "ROA", "NET_PROFIT", "AVERAGE_ASSETS_TOTAL", { unavailable: annualOnly }),
    roe: ratio("FSM-PROF-006", "ROE", "NET_PROFIT", "AVERAGE_EQUITY", { unavailable: annualOnly, nonPositiveEquity: true }),
    interestCoverageOperatingProfit: ratio("FSM-PROF-007", "INTEREST_COVERAGE", "OPERATING_PROFIT", "INTEREST_EXPENSE", { warning: "NO_REPORTED_INTEREST_EXPENSE" }),
  };
  const days = daysInPeriod(s.period);
  const activity = {
    assetTurnover: ratio("FSM-ACT-001", "ASSET_TURNOVER", "REVENUE", "AVERAGE_ASSETS_TOTAL", { unavailable: annualOnly }),
    receivablesTurnover: ratio("FSM-ACT-002", "RECEIVABLES_TURNOVER", "REVENUE", "AVERAGE_RECEIVABLES", { unavailable: annualOnly }),
    dso: calculate("FSM-ACT-003", "DSO", ["AVERAGE_RECEIVABLES", "REVENUE"], ([a, r]) => a / r * days!, `Average receivables / period revenue * actual ${days ?? "unknown"} days; no annualization; see dependency warnings for ending-balance fallback`, { denominator: 1, unit: "DAYS", unavailable: days === null ? "PERIOD_BOUNDARIES_UNKNOWN" : undefined }),
    inventoryTurnover: ratio("FSM-ACT-004", "INVENTORY_TURNOVER", "COST_OF_SALES", "AVERAGE_INVENTORIES", { unavailable: annualOnly }),
    dio: calculate("FSM-ACT-005", "DIO", ["AVERAGE_INVENTORIES", "COST_OF_SALES"], ([a, c]) => a / c * days!, `Average inventory / cost of sales * actual ${days ?? "unknown"} days; no revenue proxy or annualization; see dependency warnings for ending-balance fallback`, { denominator: 1, unit: "DAYS", unavailable: days === null ? "PERIOD_BOUNDARIES_UNKNOWN" : undefined }),
  };
  const composition: Record<string, FinancialMetricResult> = {};
  for (const [n, field] of ["NON_CURRENT_ASSETS", "CURRENT_ASSETS", "RECEIVABLES", "INVENTORIES", "CASH", "FIXED_ASSETS", "INTANGIBLE_ASSETS"].entries()) composition[`${field}_TO_ASSETS`] = ratio(`FSM-COMP-00${n + 1}`, `${field}_TO_ASSETS`, field, "ASSETS_TOTAL");
  for (const [n, [a, b]] of [["PAYABLES", "SHORT_TERM_LIABILITIES"], ["SHORT_TERM_LIABILITIES", "TOTAL_LIABILITIES"], ["LONG_TERM_LIABILITIES", "TOTAL_LIABILITIES"], ["TOTAL_BORROWINGS", "TOTAL_LIABILITIES"], ["PAYABLES", "REVENUE"]].entries()) composition[`${a}_TO_${b}`] = ratio(`FSM-COMP-${String(n + 8).padStart(3, "0")}`, `${a}_TO_${b}`, a, b, a === "PAYABLES" && b === "REVENUE" ? { extraWarnings: [`DENOMINATOR_FLOW_PERIOD:${s.period.from ?? "UNKNOWN"}/${s.period.to ?? "UNKNOWN"}`, "CROSS_PERIOD_COMPARABILITY_REQUIRED"] } : {});
  const sign = (v: number | null) => v === null ? "UNKNOWN" as const : v > 0 ? "POSITIVE" as const : v < 0 ? "NEGATIVE" as const : "ZERO" as const;
  // Include intermediate amounts so every public dependency can be audited.
  for (const key of ["QUICK_ASSETS", "CASH_AND_INVESTMENTS", "AVERAGE_ASSETS_TOTAL", "AVERAGE_EQUITY", "AVERAGE_RECEIVABLES", "AVERAGE_INVENTORIES"]) amounts[key] = groups[key];
  for (const key of Object.keys(groups).filter(k => k.startsWith("OPENING_"))) amounts[key] = { ...groups[key], code: `FSM-OPEN-${key.slice(8)}` };
  const profit = sign(amounts.NET_PROFIT.value);
  return { snapshot: s, amounts, liquidity, capitalStructure, profitability, activity, composition, quality,
    observations: { equitySign: sign(amounts.EQUITY.value), netProfitSign: profit === "POSITIVE" ? "PROFIT" : profit === "NEGATIVE" ? "LOSS" : profit, workingCapitalSign: sign(liquidity.netWorkingCapital.value) } };
}
