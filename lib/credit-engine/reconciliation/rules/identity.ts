import type { ReconciliationRule, ReconciliationFact } from "../../contracts/reconciliation.ts";
import { finding, scopeReason, stableId } from "../common.ts";

export const identityRule: ReconciliationRule = { code: "REC-ID", evaluate(data) {
  const expected: ReconciliationFact = { factId: stableId("ANALYSIS_COMPANY", data.companyInn), semanticCode: "ANALYSIS_COMPANY_INN", sourceType: "OTHER", sourceIds: [],
    companyInn: data.companyInn, subjectInn: data.companyInn || null, entityScope: "COMPANY", affectsCompanyDebt: null,
    value: data.companyInn || null, unit: "TEXT", status: data.companyInn ? "KNOWN" : "UNKNOWN", confidence: data.companyInn ? "HIGH" : "UNKNOWN",
    period: { kind: "IDENTITY", from: null, to: null, asOf: null }, calculationBasis: "Analysis dossier company INN", warnings: [] };
  const identities = data.facts.filter(f => ["COMPANY_INN", "SUBJECT_INN"].includes(f.semanticCode));
  // Snapshot identity may disagree with its envelope. Preserve that conflict too.
  const seen = new Set(identities.map(f => stableId(f.sourceIds, f.companyInn)));
  for (const f of data.facts) {
    if (f.semanticCode === "BANK_CUSTOMER_ADVANCES" || f.sourceType === "BKI" || !f.companyInn || seen.has(stableId(f.sourceIds, f.companyInn))) continue;
    seen.add(stableId(f.sourceIds, f.companyInn));
    identities.push({ ...f, factId: stableId(f.sourceIds, "SNAPSHOT_COMPANY_INN", f.companyInn), semanticCode: "COMPANY_INN", value: f.companyInn, unit: "TEXT" });
  }
  return identities.map(f => {
    const reason = scopeReason(data.companyInn, [f]);
    const unavailable = f.status !== "KNOWN" || !data.companyInn || !f.value;
    const conflict = !unavailable && (reason === "COMPANY_IDENTITY_CONFLICT" || (f.sourceType !== "BKI" && f.value !== data.companyInn));
    return finding("REC-ID", "IDENTITY", [f], [expected], conflict ? "CONFLICT" : unavailable ? "INSUFFICIENT_DATA" : reason ? "NOT_COMPARABLE" : "AGREES", "NONE",
      [conflict ? "COMPANY_IDENTITY_CONFLICT" : unavailable ? "SOURCE_FIELD_UNKNOWN" : reason ?? "EXACT_VALUE_AGREEMENT"], "Company identity from source; BKI subject relationship and debt scope evaluated explicitly");
  });
} };
