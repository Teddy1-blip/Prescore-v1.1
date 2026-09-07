import type { AnalysisResult } from "../../prescore.ts";
import type { CompanyProfileData } from "../../company-profile.ts";
import type { ReconciliationInput, ReconciliationShadowFields, ReconciliationRule } from "../contracts/reconciliation.ts";
import { buildReconciliation } from "./engine.ts";
import { compareLegacyReconciliation, type LegacyReconciliationInputs } from "./legacy-comparison.ts";

export function buildReconciliationShadow(input: ReconciliationInput, legacy: LegacyReconciliationInputs = {}, rules?: readonly ReconciliationRule[]): ReconciliationShadowFields {
  try {
    const reconciliationV1 = buildReconciliation(input, rules);
    return { reconciliationV1, reconciliationComparison: compareLegacyReconciliation(reconciliationV1, legacy), reconciliationWarnings: [] };
  } catch {
    return { reconciliationV1: undefined, reconciliationComparison: undefined, reconciliationWarnings: ["RECONCILIATION_SHADOW_UNAVAILABLE"] };
  }
}
// Rebuild from current content-backed sources. Never reuse a prior reconciliation result.
// Profile BFO is combined in memory only; no raw Checko payload or new persistence path.
export function reconciliationForAnalysis(analysis: Omit<AnalysisResult, "transactions">, profile?: CompanyProfileData | null): ReconciliationShadowFields {
  try {
    const manifest = { ...(analysis.sourceManifest ?? { bankStatements: [] }), ...(profile?.sourceManifest?.bfo ? { bfo: profile.sourceManifest.bfo } : {}) };
    const current = [...(analysis.financialStatementsV2 ?? analysis.financialAnalysisV2?.history.map(p => p.snapshot) ?? []),
      ...(profile?.financialStatementsV2 ?? profile?.financialAnalysisV2?.history.map(p => p.snapshot) ?? [])];
    const snapshots = current.filter(s => {
      const active = s.sourceType === "QUARTERLY" ? manifest.quarterly : manifest.bfo;
      return active?.sourceId === s.sourceId && (!active.contentHash || active.contentHash === s.source.contentHash);
    }).map(s => ({ ...s, source: s.sourceType === "QUARTERLY" ? manifest.quarterly! : manifest.bfo! }));
    const analyses = [analysis.financialAnalysisV2, profile?.financialAnalysisV2].filter(a => a !== undefined);
    const financialAnalysis = analyses.length ? { ...analyses[0],
      history: analyses.flatMap(a => a.history).filter(p => snapshots.some(s => s.snapshotId === p.snapshot.snapshotId)),
      sources: snapshots.map(s => s.source),
    } : undefined;
    return buildReconciliationShadow({ companyInn: analysis.companyInn, bank: analysis.metricsV2, manifest, integrity: analysis.integrity, snapshots, financialAnalysis, bki: analysis.creditHistory },
      { avgMonthlyInflow: analysis.metrics.avgMonthlyInflow, statementMonthlyDebtPayment: analysis.creditPortfolioComparison?.statementMonthlyDebtPayment ?? analysis.metrics.currentMonthlyDebtPayment, bfoRevenue: profile?.finances.revenue });
  } catch {
    return { reconciliationV1: undefined, reconciliationComparison: undefined, reconciliationWarnings: ["RECONCILIATION_SHADOW_UNAVAILABLE"] };
  }
}
