import type { RiskFact, RiskShadowInput } from "../../contracts/risk.ts";
import type { FinancialMetricResult, FinancialPeriodAnalysis } from "../../contracts/financial-statements.ts";
import { fact, freshness, weakest, usable, RISK_SOURCE_FRESHNESS_DAYS as age } from "../common.ts";
export function financialFacts(input: Pick<RiskShadowInput,'asOfDate'|'companyProfile'> & {analysis:Pick<RiskShadowInput['analysis'],'companyInn'|'financialAnalysisV2'>}): RiskFact[] {
  const { analysis: a, companyProfile: p, asOfDate } = input;
  const analyses = [a.financialAnalysisV2, p?.financialAnalysisV2].filter(x => !!x);
  const history = [...new Map(analyses.flatMap(x => x!.history).map(x => [x.snapshot.snapshotId, x])).values()].filter(x => x.snapshot.companyInn === a.companyInn && x.snapshot.period.asOf && x.snapshot.period.asOf <= asOfDate);
  const eligible = (x: FinancialPeriodAnalysis) => x.snapshot.source.status === "READY" && freshness(x.snapshot.period.asOf, asOfDate, x.snapshot.period.kind === "ANNUAL" ? age.annual : age.interim);
  const ordered = [...history].sort((x, y) => x.snapshot.period.asOf!.localeCompare(y.snapshot.period.asOf!) || x.snapshot.snapshotId.localeCompare(y.snapshot.snapshotId));
  const latest = ordered.at(-1), annual = ordered.filter(x => x.snapshot.period.kind === "ANNUAL"), lastAnnual = annual.at(-1);
  const read = (code: string, metric: FinancialMetricResult | undefined, row: FinancialPeriodAnalysis | undefined, historical = false): RiskFact => {
    const f = fact(a.companyInn, code, "FINANCIAL", metric?.value ?? null, { unit: metric?.unit ?? "RUB", status: metric && row && (historical ? row.snapshot.source.status === "READY" : eligible(row)) ? metric.status : "UNKNOWN", confidence: metric?.confidence ?? "UNKNOWN", origin: metric?.origin ?? "REPORTED",
    period: { from: metric?.periodFrom ?? null, to: metric?.periodTo ?? null, asOf: metric?.asOf ?? null }, sourceTypes: row ? [row.snapshot.sourceType] : [], sourceIds: metric?.sourceIds ?? [], sourceMetricCode: metric?.code,
    calculationBasis: metric?.calculationBasis ?? "Financial Analysis v2 required; no legacy finance substitution", warnings: [...(metric?.warnings ?? []), ...(row && !historical && !eligible(row) ? ["SOURCE_STALE_OR_UNAVAILABLE"] : [])] });
    if (row && metric) {
      const peers = history.filter(x => x.snapshot.snapshotId !== row.snapshot.snapshotId && x.snapshot.period.kind === row.snapshot.period.kind && x.snapshot.period.from === row.snapshot.period.from && x.snapshot.period.to === row.snapshot.period.to && x.snapshot.source.status === "READY");
      const conflicts = peers.flatMap(x => Object.values(x).flatMap(group => group && typeof group === "object" ? Object.values(group) : []).filter((m): m is FinancialMetricResult => !!m && typeof m === "object" && "code" in m && m.code === metric.code && "status" in m && m.status === "KNOWN" && "value" in m && m.value !== metric.value));
      if (metric.status === "KNOWN" && conflicts.length) {
        for (const m of conflicts) f.evidence.push(...fact(a.companyInn, code, "FINANCIAL", m.value, { unit: m.unit, confidence: m.confidence, sourceIds: m.sourceIds, period: { from: m.periodFrom, to: m.periodTo, asOf: m.asOf }, calculationBasis: m.calculationBasis }).evidence);
        f.status = "UNKNOWN"; f.value = null; f.warnings.push("DATA_CONFLICT");
      }
    }
    return f;
  };
  const out = [read("FIN_EQUITY", latest?.amounts.EQUITY, latest), read("FIN_REPORTED_NET_ASSETS", latest?.amounts.REPORTED_NET_ASSETS, latest), read("FIN_NET_ASSETS_PROXY", latest?.amounts.EQUITY_NET_ASSETS_PROXY, latest),
    read("FIN_CURRENT_ASSETS", latest?.amounts.CURRENT_ASSETS, latest), read("FIN_CURRENT_RATIO", latest?.liquidity.currentRatio, latest), read("FIN_WORKING_CAPITAL", latest?.liquidity.netWorkingCapital, latest), read("FIN_INTEREST_COVERAGE", latest?.profitability.interestCoverageOperatingProfit, latest),
    read("FIN_ANNUAL_NET_PROFIT", lastAnnual?.amounts.NET_PROFIT, lastAnnual), read("FIN_ANNUAL_REVENUE", lastAnnual?.amounts.REVENUE, lastAnnual)];
  const trends = analyses.flatMap(x => x!.trends).filter(t => t.currentSnapshotId === lastAnnual?.snapshot.snapshotId && t.comparability === "COMPARABLE_ANNUAL_YOY");
  const revenue = trends.find(t => t.metric === "REVENUE"), profit = trends.find(t => t.metric === "NET_PROFIT");
  out.push(read("FIN_ANNUAL_REVENUE_CHANGE", revenue?.relativeChange, lastAnnual));
  const previous = annual.find(x => x.snapshot.snapshotId === profit?.previousSnapshotId), currentProfit = out.find(f => f.semanticCode === "FIN_ANNUAL_NET_PROFIT")!, priorProfit = read("FIN_PRIOR_ANNUAL_NET_PROFIT", previous?.amounts.NET_PROFIT, previous, true);
  out.push(priorProfit);
  out.push(fact(a.companyInn, "FIN_CONSECUTIVE_ANNUAL_LOSSES", "FINANCIAL", profit && usable(currentProfit) && usable(priorProfit) ? Number(Number(currentProfit.value) < 0) + Number(Number(priorProfit.value) < 0) : null,
    { origin: "DERIVED", confidence: weakest(currentProfit.confidence, priorProfit.confidence), period: currentProfit.period, sourceTypes: [...currentProfit.sourceTypes, ...priorProfit.sourceTypes], sourceIds: [...currentProfit.sourceIds, ...priorProfit.sourceIds], evidence: [...currentProfit.evidence, ...priorProfit.evidence], calculationBasis: "Two consecutive COMPARABLE_ANNUAL_YOY net-profit facts; no interim annualization" }));
  return out;
}
