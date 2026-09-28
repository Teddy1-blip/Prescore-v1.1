import type { ReconciliationRule, ReconciliationFact as Fact, ReconciliationFinding as Finding } from "../../contracts/reconciliation.ts";
import { finding, known, scopeReason } from "../common.ts";
import { validDate } from "../periods.ts";

export const financialSameFactRule: ReconciliationRule = { code: "REC-FIN", evaluate(data) {
  const groups = new Map<string, Fact[]>();
  for (const f of data.facts) if (f.groupId && ["BFO", "QUARTERLY"].includes(f.sourceType) && f.origin === "REPORTED") groups.set(f.groupId, [...(groups.get(f.groupId) ?? []), f]);
  const bfo = [...groups.values()].filter(g => g[0].sourceType === "BFO"), quarterly = [...groups.values()].filter(g => g[0].sourceType === "QUARTERLY");
  const output: Finding[] = [];
  for (const a of bfo) for (const b of quarterly) {
    const scope = scopeReason(data.companyInn, [a[0], b[0]]);
    if (scope) { output.push(finding("REC-FIN-PERIOD", "SAME_FACT", [a[0]], [b[0]], "NOT_COMPARABLE", "NONE", [scope], "Same company required")); continue; }
    let mismatch: [Fact, Fact] | undefined;
    for (const left of a) {
      const right = b.find(f => f.semanticCode === left.semanticCode);
      if (!right) continue;
      const flow = left.period.kind === "FLOW";
      const aligned = flow ? validDate(left.period.from) && validDate(left.period.to) && left.period.from! <= left.period.to! && left.period.from === right.period.from && left.period.to === right.period.to
        : validDate(left.period.asOf) && left.period.asOf === right.period.asOf;
      if (!aligned) { mismatch ??= [left, right]; continue; }
      if (left.accountingStandard !== "RAS" || right.accountingStandard !== "RAS") { mismatch ??= [left, right]; continue; }
      // Two missing fields are not a useful field-level finding.
      if (!known(left) && !known(right)) continue;
      const complete = known(left) && known(right), difference = complete ? Math.abs((left.value as number) - (right.value as number)) : null;
      const tolerance = complete ? Math.max(2 * Math.max(left.sourceScale ?? 1, right.sourceScale ?? 1, 1), 0.001 * Math.max(Math.abs(left.value as number), Math.abs(right.value as number), 1)) : 0;
      const outcome = difference === null ? "INSUFFICIENT_DATA" : difference === 0 ? "AGREES" : difference <= tolerance ? "WITHIN_TOLERANCE" : "CONFLICT";
      output.push(finding(`REC-FIN-${left.semanticCode}`, "SAME_FACT", [left], [right], outcome, flow ? "EXACT_PERIOD" : "EXACT_ASOF",
        [difference === null ? "MISSING_NOT_ZERO" : difference === 0 ? "EXACT_VALUE_AGREEMENT" : difference <= tolerance ? "ROUNDING_TOLERANCE" : "SAME_FACT_OUTSIDE_TOLERANCE"],
        "Same RAS fact and exact period/date; tolerance max(2 × max(source scales, 1), 0.001 × max(abs(values), 1))"));
    }
    if (mismatch) output.push(finding("REC-FIN-PERIOD", "SAME_FACT", [mismatch[0]], [mismatch[1]], "NOT_COMPARABLE", "NONE", ["PERIOD_NOT_ALIGNED"], "Unaligned fields omitted; balance and flow dates evaluated independently"));
  }
  return output;
} };
