import type { ReconciliationRule } from "../../contracts/reconciliation.ts";
import { finding, known, scopeReason } from "../common.ts";
import { gapDays } from "../periods.ts";
export const bankCashRule: ReconciliationRule = { code: "REC-CASH", evaluate(data) {
  const bank = data.facts.find(f => f.semanticCode === "BANK_ENDING_BALANCE");
  return data.facts.filter(f => f.semanticCode === "CASH").map(cash => {
    const gap = gapDays(bank?.period.asOf ?? null, cash.period.asOf), scope = cash.unit !== "RUB" || (bank && bank.unit !== "RUB") ? "MONETARY_UNIT_UNKNOWN" : scopeReason(data.companyInn, [cash, ...(bank ? [bank] : [])]);
    const incomplete = bank?.warnings.includes("INCOMPLETE_ACCOUNT_OR_BALANCE_COVERAGE");
    return finding("REC-CASH", "STOCK_VS_STOCK", bank ? [bank] : [], [cash], scope || (gap !== null && gap !== 0) ? "NOT_COMPARABLE" : gap === null || incomplete || !known(bank) || !known(cash) ? "INSUFFICIENT_DATA" : "RELATIONSHIP_OBSERVED",
      gap === 0 && !scope && !incomplete ? "EXACT_ASOF" : "NONE", ["BANK_ACCOUNT_SET_NOT_PROVEN_COMPLETE", "ACCOUNTING_CASH_MAY_INCLUDE_CASH_EQUIVALENTS", "ACCOUNTING_CASH_MAY_INCLUDE_NON_BANK_CASH", "SOURCE_SCOPE_DIFFERENCE_POSSIBLE", ...(gap !== 0 ? ["AS_OF_DATE_MISMATCH"] : []), ...(scope ? [scope] : []), ...(!known(bank) || !known(cash) ? ["SOURCE_FIELD_UNKNOWN"] : [])],
      "Provided bank ending balance vs RAS cash at identical asOf; scopes may differ", gap);
  });
} };
