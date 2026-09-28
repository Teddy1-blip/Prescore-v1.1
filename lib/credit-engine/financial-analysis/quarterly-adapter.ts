import type { QuarterlyFinancialReport } from "../../quarterly-report.ts";
import type { SourceEnvelope } from "../contracts/sources.ts";
import { BALANCE_CODES, INCOME_CODES } from "../contracts/financial-statements.ts";
import { normalizeSnapshot } from "./normalizer.ts";
import { parseFinancialPeriod } from "./periods.ts";

export function adaptQuarterlyReport(report: QuarterlyFinancialReport, source: SourceEnvelope) {
  if (source.sourceType !== "QUARTERLY") throw new Error("QUARTERLY_SOURCE_REQUIRED");
  if (report.companyInn && report.companyInn !== source.companyInn) throw new Error("FINANCIAL_COMPANY_MISMATCH");
  const metadata = report.financialMetadataV2;
  const mapped: Record<string, number | null> = {
    "2110": report.values.revenue, "2400": report.values.netProfit, "1600": report.values.assets,
    "1100": report.values.nonCurrentAssets, "1200": report.values.currentAssets, "1230": report.values.receivables,
    "1250": report.values.cash, "1300": report.values.equity, "1400": report.values.longTermLiabilities,
    "1500": report.values.currentLiabilities, "1520": report.values.payables,
  };
  // Old serialized reports have no proof of scale/proxy provenance. Never infer it.
  const rawLines = { ...(metadata?.rawLines ?? mapped) };
  const labelValues = metadata?.labelValues ?? {};
  const usedLabels = new Set<string>();
  for (const [code, fact] of Object.entries(labelValues)) {
    if (rawLines[code] == null) { rawLines[code] = fact.rawValue; usedLabels.add(code); }
  }
  const snapshot = normalizeSnapshot({
    source,
    parserConfidence: report.parserConfidence,
    period: metadata?.period ?? parseFinancialPeriod(report.period),
    rawLines,
    scale: metadata?.scaleConfirmed ? metadata.rawScale : null,
    reportedNetAssets: metadata?.reportedNetAssets,
  });
  for (const [field, code] of Object.entries({ ...BALANCE_CODES, ...INCOME_CODES })) {
    if (!usedLabels.has(code)) continue;
    const value = { ...snapshot.balance, ...snapshot.income }[field as keyof typeof snapshot.balance];
    delete value.rawCode;
    value.rawLabel = labelValues[code].rawLabel;
    if (field === "EQUITY") {
      delete snapshot.equityNetAssetsProxy.rawCode;
      snapshot.equityNetAssetsProxy.rawLabel = value.rawLabel;
    }
  }
  if (metadata?.reportedNetAssetsLabel) {
    delete snapshot.reportedNetAssets.rawCode;
    snapshot.reportedNetAssets.rawLabel = metadata.reportedNetAssetsLabel;
  }
  if (!metadata) snapshot.quality.warnings.push("LEGACY_REPORT_PROVENANCE_UNAVAILABLE");
  if (!report.companyInn) {
    snapshot.quality.warnings.push("COMPANY_IDENTITY_NOT_REPORTED");
    for (const field of [...Object.values(snapshot.balance), ...Object.values(snapshot.income), snapshot.reportedNetAssets, snapshot.equityNetAssetsProxy]) {
      if (field.confidence === "HIGH") field.confidence = "MEDIUM";
    }
  }
  return snapshot;
}
