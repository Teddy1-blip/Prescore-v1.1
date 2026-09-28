import { RECONCILIATION_VERSION, type CrossSourceReconciliationV1, type ReconciliationComparisonSummary } from "../contracts/reconciliation.ts";
import { finite } from "./common.ts";
export type LegacyReconciliationInputs = { avgMonthlyInflow?: number; statementMonthlyDebtPayment?: number; bfoRevenue?: number };
export function compareLegacyReconciliation(result: CrossSourceReconciliationV1, legacy: LegacyReconciliationInputs): ReconciliationComparisonSummary {
  const comparisons: ReconciliationComparisonSummary["comparisons"] = [];
  const add = (metric: string, legacyValue: number | null, reconciliationValue: number | null, findingId: string | null, reasonCodes: string[]) => {
    const delta = finite(legacyValue) && finite(reconciliationValue) ? Math.abs(legacyValue - reconciliationValue) : null;
    comparisons.push({ metric, legacyValue: finite(legacyValue) ? legacyValue : null, reconciliationValue: finite(reconciliationValue) ? reconciliationValue : null, absoluteDifference: finite(delta) ? delta : null, findingId, reasonCodes });
  };
  const rev = result.findings.filter(f => f.code === "REC-REV" && f.rightFacts[0]?.sourceType === "BFO");
  const annual = finite(legacy.avgMonthlyInflow) ? legacy.avgMonthlyInflow * 12 : null;
  const reasons = ["LEGACY_ANNUALIZATION_REMOVED", "OPERATING_RECEIPTS_DEFINITION_USED", "PERIOD_ALIGNMENT_REQUIRED", "PARTIAL_COVERAGE_NOT_ASSUMED_COMPLETE", "CASH_ACCRUAL_NOT_TREATED_AS_CONFLICT"];
  for (const f of rev) {
    add("bankFlowAmount", annual, f.outcome === "RELATIONSHIP_OBSERVED" && finite(f.leftFacts[0]?.value) ? f.leftFacts[0].value : null, f.findingId, reasons);
    add("bankFlowToRevenue", finite(annual) && finite(legacy.bfoRevenue) && legacy.bfoRevenue > 0 ? annual / legacy.bfoRevenue : null, f.ratio, f.findingId, reasons);
  }
  const debt = result.findings.find(f => f.code === "REC-BKI-2");
  if (finite(legacy.statementMonthlyDebtPayment)) add("statementMonthlyDebtPayment", legacy.statementMonthlyDebtPayment,
    debt?.outcome === "RELATIONSHIP_OBSERVED" && finite(debt.rightFacts[0]?.value) ? debt.rightFacts[0].value : null, debt?.findingId ?? null,
    ["CURRENT_SCHEDULE_PERIOD_ALIGNMENT_REQUIRED", "LEASING_EXCLUDED", "UNSPLIT_DEBT_SERVICE_IDENTIFIED", "ACCOUNT_SCOPE_NOT_ASSUMED_COMPLETE"]);
  return { version: RECONCILIATION_VERSION, comparisons };
}
