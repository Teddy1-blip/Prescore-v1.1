import type { RiskFact, RiskShadowInput } from "../../contracts/risk.ts";
import type { MetricResult } from "../../contracts/metrics.ts";
import { fact, freshness, RISK_SOURCE_FRESHNESS_DAYS as age, weakest, finite, adequate, validDate } from "../common.ts";
export function bankFacts({ analysis: a, asOfDate }: RiskShadowInput): RiskFact[] {
  const bank = a.metricsV2; if (!bank) return [];
  const sources = a.sourceManifest?.bankStatements ?? [], current = freshness(bank.period.to, asOfDate, age.bank) && sources.length > 0 && sources.every(s => s.companyInn === a.companyInn && s.status === "READY");
  const full = current && bank.period.fullMonths > 0 && !bank.period.partialMonths && !bank.period.missingMonths && !bank.period.overlapMonths;
  const period = { from: bank.period.from, to: bank.period.to, asOf: bank.period.to }, base = { period, sourceIds: sources.map(s => s.sourceId), sourceTypes: ["BANK_STATEMENT"] };
  const read = (code: string, metric: MetricResult | undefined, expectedUnit: MetricResult["unit"], requiresFull = false) => fact(a.companyInn, code, "CASH_FLOW", metric?.value ?? null, { ...base, unit: expectedUnit,
    status: metric && current && (!requiresFull || full) && metric.unit === expectedUnit ? metric.status : "UNKNOWN", confidence: metric?.confidence ?? "UNKNOWN", origin: "DERIVED", sourceMetricCode: metric?.code,
    calculationBasis: metric?.calculationBasis ?? "Canonical bank metric unavailable", warnings: [...(metric?.warnings ?? []), ...(!current ? ["SOURCE_STALE_OR_UNAVAILABLE"] : []), ...(requiresFull && !full ? ["BANK_COVERAGE_INSUFFICIENT"] : [])] });
  const out = [read("BANK_DEBT_SERVICE_RATIO", bank.debtService.debtServiceToOperatingReceipts, "RATIO", true), read("BANK_TOP1", bank.customers.directCustomerTop1, "RATIO"),
    read("BANK_CONCENTRATION_COVERAGE", bank.customers.directCustomerConcentrationCoverage, "RATIO"), read("BANK_IDENTITY_COVERAGE", bank.customers.directCustomerIdentityCoverage, "RATIO"), read("BANK_INTERMEDIATED_SHARE", bank.customers.intermediatedOperatingShare, "RATIO"),
    read("BANK_UNCLEAR_CASH_SHARE", bank.individualAndCash.unclearIndividualAndCashShare, "RATIO"), read("BANK_NEGATIVE_RECONSTRUCTED_DAYS", bank.liquidity.negativeReconstructedBalanceDays, "DAYS")];
  const trend = read("BANK_OPERATING_TREND", bank.operating.operatingReceiptsTrend, "PERCENT", true);
  if (bank.operating.operatingReceiptsTrend.unit !== "PERCENT") { trend.status = "NOT_APPLICABLE"; trend.value = null; trend.warnings.push("OPERATING_TREND_UNIT_NOT_PERCENT"); }
  out.push(trend);
  out.push(fact(a.companyInn, "BANK_COVERAGE_ADEQUATE", "DATA_QUALITY", full, { ...base, status: current ? "KNOWN" : "UNKNOWN", calculationBasis: "Supplied bank period: full months only, no missing/partial/unresolved overlap; not proof of all company accounts" }));
  const unknown = bank.quality.unknownInflowShare;
  out.push(fact(a.companyInn, "BANK_UNKNOWN_INFLOW_SHARE", "DATA_QUALITY", finite(unknown) ? unknown : null, { ...base, unit: "RATIO", status: current && finite(unknown) ? "KNOWN" : "UNKNOWN", confidence: bank.cashFlow.grossExternalCashInflow.confidence, calculationBasis: "Block 4 quality.unknownInflowShare; no transaction rescan", origin: "DERIVED" }));
  const low = bank.liquidity.lowLiquidityDays, near = bank.liquidity.nearZeroBalanceDays;
  const days = validDate(bank.period.from) && validDate(bank.period.to) ? (Date.parse(bank.period.to) - Date.parse(bank.period.from)) / 86400000 + 1 : null;
  const usable = full && days !== null && days > 0 && days <= 740 && low.status === "KNOWN" && near.status === "KNOWN" && finite(low.value) && finite(near.value) && low.value >= 0 && near.value >= 0 && Math.max(low.value, near.value) <= days && adequate(low.confidence) && adequate(near.confidence)
    && ![...low.warnings, ...near.warnings].some(w => /MISMATCH|INCOMPLETE/.test(w));
  out.push(fact(a.companyInn, "BANK_LOW_LIQUIDITY_SHARE", "CASH_FLOW", usable ? Math.max(low.value!, near.value!) / days! : null, { ...base, unit: "RATIO", confidence: weakest(low.confidence, near.confidence), origin: "DERIVED", calculationBasis: "max(lowLiquidityDays, nearZeroBalanceDays) / inclusive reconstructed period days; nested day sets; <=740-day Block 4 cap; full supplied period only", warnings: [...low.warnings, ...near.warnings] }));
  return out;
}
