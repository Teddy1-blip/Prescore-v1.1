import type { ReconciliationRule } from "../../contracts/reconciliation.ts";
import { finding, known, scopeReason } from "../common.ts";
import { alignBankMonths } from "../alignment.ts";
export const cashAccrualReasons = ["CASH_BASIS_VS_ACCRUAL_BASIS", "VAT_AND_ACCOUNTING_PRESENTATION_MAY_DIFFER", "CUSTOMER_ADVANCE_TIMING_MAY_DIFFER", "RECEIVABLE_COLLECTION_TIMING_MAY_DIFFER", "BANK_ACCOUNT_SET_NOT_PROVEN_COMPLETE"];
export const bankRevenueRule: ReconciliationRule = { code: "REC-REV", evaluate(data) {
  return data.facts.filter(f => f.semanticCode === "REVENUE").map(revenue => {
    const alignment = alignBankMonths(data, revenue.period.from, revenue.period.to), bank = alignment.fact;
    const scope = scopeReason(data.companyInn, [revenue, ...(bank ? [bank] : [])]);
    return finding("REC-REV", "CASH_VS_ACCRUAL", bank ? [bank] : [], [revenue], scope ? "NOT_COMPARABLE" : !bank || !known(revenue) ? "INSUFFICIENT_DATA" : "RELATIONSHIP_OBSERVED",
      bank && !scope ? "FULL_MONTH_ALIGNED" : "NONE", [...cashAccrualReasons, ...alignment.reasons, ...(scope ? [scope] : []), ...(!known(revenue) ? ["SOURCE_FIELD_UNKNOWN", "MISSING_NOT_ZERO"] : [])],
      "Exact FULL-month operating receipts / accounting revenue if revenue > 0; cash vs accrual is never a same-fact conflict");
  });
} };
