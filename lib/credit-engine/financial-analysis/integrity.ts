import type { BalanceField, FinancialPeriodQuality, FinancialStatementSnapshot, FinancialStatementValue, IncomeField } from "../contracts/financial-statements.ts";
import { sourceConfidence, weakest } from "./normalizer.ts";

const coreBalance: BalanceField[] = ["ASSETS_TOTAL", "CURRENT_ASSETS", "NON_CURRENT_ASSETS", "EQUITY", "LONG_TERM_LIABILITIES", "SHORT_TERM_LIABILITIES"];
const coreIncome: IncomeField[] = ["REVENUE", "COST_OF_SALES", "GROSS_PROFIT", "OPERATING_PROFIT", "NET_PROFIT"];
/** Values and rounding scale must be expressed in the same unit. */
export function withinReportingTolerance(values:number[],residual:number,scale:number){
  return Math.abs(residual)<=Math.max(2*scale,Math.max(...values.map(Math.abs))*0.001);
}
export function financialIntegrity(s: FinancialStatementSnapshot): FinancialPeriodQuality {
  const b = s.balance, i = s.income;
  const test = (values: FinancialStatementValue[], calculate: (numbers: number[]) => number): boolean | null => {
    if (values.some((v) => v.value === null || v.status !== "KNOWN")) return null;
    const n = values.map(v => v.value!);
    // Two source units allow reporting-rounding differences; 0.1% relative tolerance.
    return withinReportingTolerance(n,calculate(n),s.confirmedScale ?? 1);
  };
  const checks = [
    test([b.NON_CURRENT_ASSETS, b.CURRENT_ASSETS, b.ASSETS_TOTAL], ([a, c, t]) => a + c - t),
    test([b.EQUITY, b.LONG_TERM_LIABILITIES, b.SHORT_TERM_LIABILITIES, b.ASSETS_TOTAL], ([e, l, c, t]) => e + l + c - t),
    test([b.ASSETS_TOTAL, b.BALANCE_TOTAL], ([a, t]) => a - t),
  ];
  const balanceReconciled = checks.includes(false) ? false : checks.every(v => v === null) ? null : true;
  const incomeReconciled = test([i.REVENUE, i.COST_OF_SALES, i.GROSS_PROFIT], ([r, c, g]) => r - c - g);
  const coreBalanceFieldCoverage = coreBalance.filter(f => b[f].status === "KNOWN").length / coreBalance.length;
  const coreIncomeFieldCoverage = coreIncome.filter(f => i[f].status === "KNOWN").length / coreIncome.length;
  const warnings = [...s.quality.warnings,
    ...(balanceReconciled === false ? ["BALANCE_RECONCILIATION_MISMATCH"] : []),
    ...(incomeReconciled === false ? ["INCOME_STATEMENT_RECONCILIATION_MISMATCH"] : []),
    ...(checks.includes(null) ? ["BALANCE_RECONCILIATION_INCOMPLETE"] : []),
    ...(incomeReconciled === null ? ["INCOME_RECONCILIATION_INCOMPLETE"] : []),
    ...(s.period.flowPeriodType === "UNKNOWN" ? ["FLOW_PERIOD_UNKNOWN"] : []),
  ];
  const confidence = weakest(sourceConfidence(s.source), sourceConfidence({ ...s.source, confidence: s.quality.parserConfidence }), balanceReconciled === false || incomeReconciled === false ? "LOW" : coreBalanceFieldCoverage < 0.5 || coreIncomeFieldCoverage < 0.5 ? "MEDIUM" : "HIGH");
  return { coreBalanceFieldCoverage, coreIncomeFieldCoverage, balanceReconciled, incomeReconciled, periodConfidence: s.period.confidence, confidence, warnings: [...new Set(warnings)] };
}
