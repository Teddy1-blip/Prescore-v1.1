import type { ReconciliationRule } from "../../contracts/reconciliation.ts";
import { finding, known, scopeReason } from "../common.ts";
import { alignBankMonths } from "../alignment.ts";
export const cashAccrualReasons = ["CASH_BASIS_VS_ACCRUAL_BASIS", "BANK_ACCOUNT_SET_NOT_PROVEN_COMPLETE"];
export const bankRevenueRule: ReconciliationRule = { code: "REC-REV", evaluate(data) {
  return data.facts.filter(f => f.semanticCode === "REVENUE").map(revenue => {
    const alignment = alignBankMonths(data, revenue.period.from, revenue.period.to), bank = alignment.fact;
    const scope = revenue.unit !== "RUB" ? "MONETARY_UNIT_UNKNOWN" : scopeReason(data.companyInn, [revenue, ...(bank ? [bank] : [])]);
    const result = finding("REC-REV", "CASH_VS_ACCRUAL", bank ? [bank] : [], [revenue], scope ? "NOT_COMPARABLE" : !bank || !known(revenue) ? "INSUFFICIENT_DATA" : "RELATIONSHIP_OBSERVED",
      bank && !scope ? "FULL_MONTH_ALIGNED" : "NONE", [...cashAccrualReasons, ...alignment.reasons, ...(scope ? [scope] : []), ...(!known(revenue) ? ["SOURCE_FIELD_UNKNOWN", "MISSING_NOT_ZERO"] : [])],
      "Exact FULL-month operating receipts / accounting revenue if revenue > 0; cash vs accrual is never a same-fact conflict");
    if (result.outcome === "RELATIONSHIP_OBSERVED" && result.absoluteDifference !== null && result.absoluteDifference > 0) {
      result.contextFacts = data.facts.filter(f => {
        if (!known(f) || f.value <= 0 || f.unit !== "RUB" || f.companyInn !== data.companyInn || !f.sourceIds.length) return false;
        if (f.semanticCode === "RECEIVABLES") return Boolean(revenue.groupId && f.groupId === revenue.groupId &&
          f.sourceType === revenue.sourceType && f.sourceIds.some(id => revenue.sourceIds.includes(id)) && f.period.asOf === revenue.period.to);
        return f.semanticCode === "BANK_CUSTOMER_ADVANCES" && f.sourceType === "BANK_STATEMENT" &&
          f.period.from === revenue.period.from && f.period.to === revenue.period.to && f.sourceIds.every(id => bank?.sourceIds.includes(id));
      });
    }
    return result;
  });
} };
