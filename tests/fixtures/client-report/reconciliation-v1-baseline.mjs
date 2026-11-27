import assert from "node:assert/strict";

// Reconstruct only the v1.0 evidence format for its existing byte-for-byte goldens.
// Never replace numeric values, source references, economic decisions or plan items.
export function beforeBankBfoEvidence(result) {
  const value = structuredClone(result);
  const r = value.reconciliation;
  assert.equal(r.version, "PRESCORE-CROSS-SOURCE-RECONCILIATION-1.1.0-SHADOW");
  const original = "PRESCORE-CROSS-SOURCE-RECONCILIATION-1.0.0-SHADOW";
  for (const f of r.findings) {
    assert.equal(f.version, r.version);
    f.version = original;
    if (f.code !== "REC-REV") continue;
    if (f.contextFacts) {
      assert.equal(f.outcome, "RELATIONSHIP_OBSERVED");
      assert.ok(f.absoluteDifference > 0);
      for (const fact of f.contextFacts) {
        assert.ok(["RECEIVABLES","BANK_CUSTOMER_ADVANCES"].includes(fact.semanticCode));
        assert.ok(fact.sourceIds.length && fact.companyInn === r.companyInn && fact.value > 0);
      }
      delete f.contextFacts;
    }
    f.reasonCodes = [...f.reasonCodes, "CUSTOMER_ADVANCE_TIMING_MAY_DIFFER",
      "RECEIVABLE_COLLECTION_TIMING_MAY_DIFFER", "VAT_AND_ACCOUNTING_PRESENTATION_MAY_DIFFER"].sort();
  }
  r.version = original;
  return value;
}
