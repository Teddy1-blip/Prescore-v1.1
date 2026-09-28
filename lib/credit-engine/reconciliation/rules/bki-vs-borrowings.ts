import type { ReconciliationRule } from "../../contracts/reconciliation.ts";
import { finding, known, scopeReason } from "../common.ts";
import { gapDays, MAX_NEAR_STOCK_GAP_DAYS } from "../periods.ts";
export const bkiBorrowingsRule: ReconciliationRule = { code: "REC-BKI-1", evaluate(data) {
  const bki = data.facts.find(f => f.semanticCode === "BKI_OUTSTANDING_PRINCIPAL");
  if (!bki) return [];
  const candidates = data.facts.filter(f => f.semanticCode === "TOTAL_BORROWINGS" && !scopeReason(data.companyInn, [f]))
    .map(f => ({ fact: f, gap: gapDays(f.period.asOf, bki.period.asOf) })).filter(p => p.gap !== null)
    .sort((a, b) => a.gap! - b.gap! || a.fact.factId.localeCompare(b.fact.factId));
  const financial = candidates[0]?.fact, gap = candidates[0]?.gap ?? null;
  const scope = scopeReason(data.companyInn, [bki, ...(financial ? [financial] : [])]);
  return [finding("REC-BKI-1", "STOCK_VS_STOCK", [bki], financial ? [financial] : [], scope || (gap !== null && gap > MAX_NEAR_STOCK_GAP_DAYS) ? "NOT_COMPARABLE" : !known(bki) || !known(financial) || gap === null ? "INSUFFICIENT_DATA" : "RELATIONSHIP_OBSERVED",
    scope || gap === null || gap > MAX_NEAR_STOCK_GAP_DAYS ? "NONE" : gap === 0 ? "EXACT_ASOF" : "NEAR_ASOF",
    ["BKI_MAY_EXCLUDE_NON_BUREAU_BORROWINGS", "ACCOUNTING_BORROWINGS_MAY_INCLUDE_NON_BANK_LOANS", "ACCOUNTING_AND_BKI_DEFINITIONS_DIFFER",
      ...(scope ? [scope] : []), ...(gap === null || gap > MAX_NEAR_STOCK_GAP_DAYS ? ["BKI_FINANCIAL_POSITION_DATE_GAP"] : []), ...(!known(bki) || !known(financial) ? ["SOURCE_FIELD_UNKNOWN", "MISSING_NOT_ZERO"] : [])],
    "BKI outstanding principal / nearest canonical accounting total borrowings; max 45-day technical date gap; guarantees excluded", gap)];
} };
