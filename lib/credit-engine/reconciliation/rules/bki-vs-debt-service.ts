import type { ReconciliationRule, ReconciliationFact as Fact } from "../../contracts/reconciliation.ts";
import { finding, finite, known, scopeReason, stableId, unique, weakest } from "../common.ts";
import { calendarMonths, gapDays, MAX_NEAR_STOCK_GAP_DAYS } from "../periods.ts";
import { alignBankMonths } from "../alignment.ts";
export const bkiDebtServiceRule: ReconciliationRule = { code: "REC-BKI-2", evaluate(data) {
  const bki = data.facts.find(f => f.semanticCode === "BKI_MONTHLY_PAYMENT");
  if (!bki) return [];
  const period = data.bankPeriod, from = period?.from ?? null, to = period?.to ?? null;
  const months = calendarMonths(from, to), gap = gapDays(to, bki.period.asOf);
  const components = ["BANK_LOAN_PRINCIPAL_PAID", "BANK_INTEREST_PAID", "BANK_UNSPLIT_DEBT_SERVICE"].map(code => data.facts.find(f => f.semanticCode === code));
  const scope = scopeReason(data.companyInn, [bki, ...components.filter((f): f is Fact => Boolean(f))]);
  const coverage = alignBankMonths(data, from, to, false);
  const reasons = ["BANK_ACCOUNT_SET_NOT_PROVEN_COMPLETE", "LEASING_EXCLUDED_FROM_BKI_COMPARISON"];
  if (scope) reasons.push(scope);
  if (!months || months.length < 3) reasons.push("INSUFFICIENT_FULL_BANK_MONTHS");
  if (months && months.length > 6) reasons.push("CURRENT_SCHEDULE_VS_LONG_HISTORICAL_PERIOD");
  if (period?.partialMonths) reasons.push("PARTIAL_BANK_MONTH");
  if (period?.missingMonths) reasons.push("MISSING_BANK_MONTH");
  if (period?.overlapMonths) reasons.push("OVERLAP_BANK_MONTH");
  if (gap === null || gap > MAX_NEAR_STOCK_GAP_DAYS) reasons.push("BKI_BANK_PERIOD_DATE_GAP");
  const allKnown = known(bki) && components.every(known);
  if (!allKnown) reasons.push("SOURCE_FIELD_UNKNOWN", "MISSING_NOT_ZERO");
  if (components.some(f => f && (f.period.from !== from || f.period.to !== to))) reasons.push("PERIOD_NOT_ALIGNED");
  const unsplit = components[2];
  if (known(unsplit) && unsplit.value > 0) reasons.push("UNSPLIT_DEBT_SERVICE_PRESENT");
  const eligible = !scope && months && months.length >= 3 && months.length <= 6 && period?.fullMonths === months.length && !period.partialMonths && !period.missingMonths && !period.overlapMonths && gap !== null && gap <= MAX_NEAR_STOCK_GAP_DAYS && !coverage.reasons.length && !reasons.includes("PERIOD_NOT_ALIGNED");
  let observed: Fact | undefined;
  if (eligible && allKnown) {
    const value = components.reduce((n, f) => n + (f!.value as number), 0) / months.length;
    if (finite(value)) observed = { ...components[0]!, factId: stableId("OBSERVED_MONTHLY_LOAN_DEBT_SERVICE", components.map(f => f!.factId), months),
      semanticCode: "OBSERVED_MONTHLY_LOAN_DEBT_SERVICE", value, confidence: weakest(...components.map(f => f!.confidence), unsplit && (unsplit.value as number) > 0 ? "MEDIUM" : "HIGH"),
      origin: "DERIVED", sourceMetricCode: undefined, dependencyFactIds: components.map(f => f!.factId),
      calculationBasis: "(loanPrincipalPaid + interestPaid + unsplitDebtService) / exact FULL months; leasing and factoring fees excluded",
      warnings: unique(components.flatMap(f => f!.warnings)) };
    else reasons.push("NON_FINITE_RESULT");
  }
  if (observed && known(bki)) reasons.push(bki.value === observed.value ? "VALUES_EQUAL" : bki.value > (observed.value as number) ? observed.value === 0 ? "BKI_PAYMENT_NOT_VISIBLE_IN_PROVIDED_STATEMENTS" : "BKI_SCHEDULE_ABOVE_OBSERVED" : "OBSERVED_ABOVE_BKI_SCHEDULE");
  return [finding("REC-BKI-2", "SCHEDULED_VS_OBSERVED", [bki], observed ? [observed] : components.filter((f): f is Fact => Boolean(f)),
    observed ? "RELATIONSHIP_OBSERVED" : scope || (months && months.length > 6) || (gap !== null && gap > MAX_NEAR_STOCK_GAP_DAYS) ? "NOT_COMPARABLE" : "INSUFFICIENT_DATA",
    observed ? "FULL_MONTH_ALIGNED" : "NONE", [...reasons, ...coverage.reasons], "Current BKI schedule vs observed loan-only monthly service over 3–6 FULL months; no invented recent slice", gap)];
} };
