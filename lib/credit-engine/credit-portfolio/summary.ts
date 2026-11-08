import type { PortfolioAggregate, PortfolioObligation, PortfolioValue, CreditPortfolioSummary } from "../contracts/credit-portfolio.ts";
import { PROVISIONAL_BKI_SCHEDULE } from "./observations.ts";
import { finite, known, unknown, weakest, validDate } from "./common.ts";
export function aggregate(rows: Array<{ o: PortfolioObligation; v: PortfolioValue<number> }>, basis: string): PortfolioAggregate {
  const good = rows.filter(r => !r.o.warnings.includes(PROVISIONAL_BKI_SCHEDULE) && known(r.v) && finite(r.v.value)), sum = good.reduce((n, r) => n + r.v.value!, 0), missing = rows.length - good.length;
  return { value: rows.length && !missing && finite(sum) ? sum : null, knownAmount: finite(sum) ? sum : 0, knownObligationCount: good.length, unknownObligationCount: missing,
    coverage: rows.length ? good.length / rows.length : null, confidence: weakest(...rows.map(r => weakest(r.o.identityConfidence, r.v.confidence))), calculationBasis: basis,
    obligationIds: rows.map(r => r.o.obligationId).sort(), warnings: [...(missing ? ["OUTSTANDING_COVERAGE_PARTIAL"] : []), ...(!finite(sum) ? ["NON_FINITE_RESULT"] : [])] };
}
export function summarizePortfolio(obligations: PortfolioObligation[], asOf: string): CreditPortfolioSummary {
  const active = obligations.filter(o => o.status.value !== "CLOSED" || o.status.verification !== "CONFIRMED");
  const funded = active.filter(o => ["FUNDED_DEBT", "CREDIT_LIMIT"].includes(o.exposureClass));
  const limits = active.filter(o => o.exposureClass === "CREDIT_LIMIT");
  const agg = (items: PortfolioObligation[], read: (o: PortfolioObligation) => PortfolioValue<number>, basis: string) => aggregate(items.map(o => ({ o, v: read(o) })), basis);
  const window = (days: number) => {
    const end = new Date(Date.parse(asOf) + days * 86400000).toISOString().slice(0, 10);
    const rows = active.map(o => {
      const due = o.schedule.filter(s => s.type === "PAYMENT_DUE" && validDate(s.dueDate) && s.dueDate >= asOf && s.dueDate <= end && s.status !== "MATCHED");
      if (!due.length || due.some(s => !known(s.amount))) return { o, v: unknown<number>(["SCHEDULE_INCOMPLETE"]) };
      return { o, v: { ...due[0].amount, value: due.reduce((n, s) => n + s.amount.value!, 0), confidence: weakest(...due.map(s => s.amount.confidence)) } };
    });
    const a = aggregate(rows, `Known reported payment events within inclusive ${days}-day window; no recurring schedule extrapolation`);
    a.warnings.push("SCHEDULE_INCOMPLETE"); return a;
  };
  const weights = funded.filter(o => known(o.currentPosition.principalOutstanding) && o.currentPosition.principalOutstanding.value > 0);
  const rates = weights.filter(o => known(o.currentTerms.annualRate));
  const totalWeight = weights.reduce((n, o) => n + o.currentPosition.principalOutstanding.value!, 0), ratedWeight = rates.reduce((n, o) => n + o.currentPosition.principalOutstanding.value!, 0);
  const weighted = ratedWeight > 0 ? rates.reduce((n, o) => n + o.currentTerms.annualRate.value! * o.currentPosition.principalOutstanding.value!, 0) / ratedWeight : null;
  const high = [...active].filter(o => known(o.currentTerms.annualRate)).sort((a, b) => b.currentTerms.annualRate.value! - a.currentTerms.annualRate.value! || a.obligationId.localeCompare(b.obligationId));
  const maturity = active.filter(o => !["BANK_GUARANTEE", "GUARANTORSHIP"].includes(o.type) && known(o.currentTerms.maturityDate) && validDate(o.currentTerms.maturityDate.value) && o.currentTerms.maturityDate.value >= asOf)
    .sort((a, b) => a.currentTerms.maturityDate.value!.localeCompare(b.currentTerms.maturityDate.value!) || a.obligationId.localeCompare(b.obligationId));
  const unknownOutstanding = funded.filter(o => !known(o.currentPosition.principalOutstanding)).length;
  const rateCoverage = totalWeight > 0 && !unknownOutstanding ? ratedWeight / totalWeight : null;
  return { obligationCount: obligations.length, activeObligationCount: active.filter(o => o.status.value === "ACTIVE").length,
    fundedDebt: agg(funded, o => o.currentPosition.principalOutstanding, "Supported funded principal only; no guarantees, lease or factoring"),
    creditLimits: agg(limits, o => o.currentTerms.creditLimit, "Line/overdraft contractual limits"), utilizedLimits: agg(limits, o => o.currentPosition.drawnAmount, "Line/overdraft utilization only"), availableLimits: agg(limits, o => o.currentPosition.availableLimit, "Known compatible limit minus utilization or independent reported availability"),
    leaseExposure: agg(active.filter(o => o.exposureClass === "LEASE"), o => known(o.currentTerms.remainingLeasePayments) ? o.currentTerms.remainingLeasePayments : o.currentPosition.totalOutstanding, "Separate reported lease exposure, not loan principal"),
    factoringExposure: agg(active.filter(o => o.exposureClass === "FACTORING"), o => o.currentPosition.totalOutstanding, "Separate factoring exposure; no automatic recourse inference"),
    contingentGuaranteeExposure: agg(active.filter(o => o.exposureClass === "CONTINGENT"), o => known(o.currentPosition.contingentExposure) ? o.currentPosition.contingentExposure : o.currentTerms.guaranteeAmount, "Contingent guarantees only, excluded from funded debt"),
    scheduledPayments7d: window(7), scheduledPayments30d: window(30), scheduledPayments60d: window(60), weightedAverageKnownAnnualRate: finite(weighted) ? weighted : null,
    annualRateCoverage: rateCoverage, highestKnownAnnualRateObligationId: high[0]?.obligationId ?? null, nearestMaturityObligationId: maturity[0]?.obligationId ?? null, nearestMaturityDate: maturity[0]?.currentTerms.maturityDate.value ?? null,
    unknownOutstandingObligationCount: unknownOutstanding, unknownRateObligationCount: active.filter(o => !known(o.currentTerms.annualRate)).length,
    confidence: weakest(...active.map(o => weakest(o.identityConfidence, o.currentPosition.principalOutstanding.confidence, o.currentTerms.annualRate.confidence, o.schedule.length ? "HIGH" : "LOW"))),
    warnings: ["SCHEDULE_INCOMPLETE", "BANK_ACCOUNT_SET_NOT_PROVEN_COMPLETE", ...(rateCoverage !== 1 ? ["RATE_COVERAGE_PARTIAL"] : []), ...(unknownOutstanding ? ["OUTSTANDING_COVERAGE_PARTIAL"] : [])] };
}
