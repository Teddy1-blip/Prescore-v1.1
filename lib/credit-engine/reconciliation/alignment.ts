import type { ReconciliationDataset as Data, ReconciliationFact as Fact } from "../contracts/reconciliation.ts";
import { calendarMonths } from "./periods.ts";
import { finite, known, stableId, unique, weakest } from "./common.ts";

export function alignBankMonths(data: Data, from: string | null, to: string | null, requireValues = true): { fact?: Fact; reasons: string[] } {
  const expected = calendarMonths(from, to);
  if (!expected) return { reasons: ["PERIOD_NOT_ALIGNED"] };
  const all = data.facts.filter(f => f.semanticCode === "BANK_MONTHLY_OPERATING_RECEIPTS");
  const selected: Fact[] = [], reasons: string[] = [];
  for (const month of expected) {
    const matches = all.filter(f => f.period.from?.slice(0, 7) === month);
    if (!matches.length) { reasons.push("MISSING_BANK_MONTH"); continue; }
    if (matches.length !== 1) { reasons.push("OVERLAP_BANK_MONTH"); continue; }
    const f = matches[0];
    if (f.coverage !== "FULL") reasons.push(f.coverage === "OVERLAP" ? "OVERLAP_BANK_MONTH" : f.coverage === "MISSING" ? "MISSING_BANK_MONTH" : "PARTIAL_BANK_MONTH");
    if (requireValues && !known(f)) reasons.push("SOURCE_FIELD_UNKNOWN", "MISSING_NOT_ZERO");
    selected.push(f);
  }
  if (reasons.length) return { reasons: unique(reasons) };
  if (!requireValues) return { reasons: [] };
  const value = selected.reduce((n, f) => n + (f.value as number), 0);
  if (!finite(value)) return { reasons: ["NON_FINITE_RESULT"] };
  return { reasons: [], fact: { ...selected[0], factId: stableId("BANK_ALIGNED_OPERATING_RECEIPTS", selected.map(f => f.factId), from, to),
    semanticCode: "BANK_ALIGNED_OPERATING_RECEIPTS", value, status: "KNOWN", period: { kind: "FLOW", from, to, asOf: null },
    origin: "DERIVED", dependencyFactIds: selected.map(f => f.factId),
    sourceIds: unique(selected.flatMap(f => f.sourceIds)), confidence: weakest(...selected.map(f => f.confidence)),
    calculationBasis: `Sum of Block 4 monthly.operatingReceipts for exactly ${expected.join(", ")}; all FULL; no extrapolation`,
    warnings: unique(selected.flatMap(f => f.warnings)) } };
}
