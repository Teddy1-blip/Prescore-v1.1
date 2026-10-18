import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { activeFinancialSnapshots } from "../lib/credit-engine/financial-analysis/source-selection.ts";

function snapshot(sourceId, receivedAt) {
  const source = {
    sourceId,
    sourceType: "BFO",
    status: "READY",
    companyInn: "5032333146",
    receivedAt,
    confidence: 100,
    warnings: [],
  };
  return {
    snapshotId: `snapshot:${sourceId}`,
    companyInn: "5032333146",
    sourceId,
    sourceType: "BFO",
    source,
    accountingStandard: "RAS",
    currency: "RUB",
    confirmedScale: 1,
    period: {
      kind: "ANNUAL",
      from: "2025-01-01",
      to: "2025-12-31",
      asOf: "2025-12-31",
      year: 2025,
      monthsCovered: 12,
      flowPeriodType: "FULL_YEAR",
      confidence: "HIGH",
    },
    balance: {},
    income: {},
    reportedNetAssets: {},
    equityNetAssetsProxy: {},
    quality: { parserConfidence: 100, completeness: 1, warnings: [] },
  };
}

test("client-uploaded BFO is authoritative over external BFO for the same economic period", () => {
  const client = snapshot("bfo:client-upload", "2026-08-01T00:00:00.000Z");
  const external = snapshot("bfo:checko-profile", "2026-08-03T00:00:00.000Z");
  const selected = activeFinancialSnapshots([external, client], [
    { bankStatements: [], bfo: client.source, financialUploads: [client.source] },
    { bankStatements: [], bfo: external.source },
  ]);
  assert.deepEqual(selected.map((item) => item.sourceId), [client.sourceId]);
  assert.deepEqual(activeFinancialSnapshots([external], [{ bankStatements: [] }, { bankStatements: [], bfo: external.source }]).map((item) => item.sourceId), [external.sourceId]);
});

test("canonical manifest keeps a ready saved-analysis BFO and uses profile BFO only as fallback", () => {
  const source = fs.readFileSync("lib/credit-engine/production/orchestrator.ts", "utf8");
  assert.match(source, /const analysisBfo = a\.sourceManifest\.bfo;/);
  assert.match(source, /const profileBfo = p\?\.sourceManifest\?\.bfo;/);
  assert.match(source, /analysisBfo\?\.status === 'READY' \? analysisBfo : profileBfo \?\? analysisBfo/);
  assert.doesNotMatch(source, /p\?\.sourceManifest\?\.bfo \? \{bfo: p\.sourceManifest\.bfo\}/);
});
