import type { PortfolioObligation, PortfolioValue, DebtPaymentObservation, PaymentMatch, PortfolioPositionCheck } from "../contracts/credit-portfolio.ts";
import { adequate, derived, evidence, finite, id, known, unknown, weakest } from "./common.ts";
export function availableLimit(o: PortfolioObligation, date: string) {
  if (!["CREDIT_LINE", "OVERDRAFT"].includes(o.type)) return;
  const limit = o.currentTerms.creditLimit, drawn = o.currentPosition.drawnAmount, reportedAvailable = o.currentPosition.availableLimit;
  const compatible = known(limit) && known(drawn) && Boolean(drawn.observedAt && (limit.effectiveFrom ? limit.effectiveFrom <= drawn.observedAt : limit.observedAt === drawn.observedAt));
  if (!compatible) { o.currentPosition.availableLimit = known(reportedAvailable) ? reportedAvailable : unknown(); return; }
  const value = limit.value! - drawn.value!;
  const d = derived(value, [limit, drawn], date, ["AVAILABLE_LIMIT_DERIVED", ...(value < 0 ? ["DRAWN_AMOUNT_EXCEEDS_LIMIT"] : [])]);
  if (known(reportedAvailable) && reportedAvailable.observedAt === drawn.observedAt) {
    d.evidence = evidence([...d.evidence, ...reportedAvailable.evidence]);
    const independent = reportedAvailable.evidence.some(e => e.sourceId && ![...limit.evidence, ...drawn.evidence].some(other => other.sourceId === e.sourceId));
    if (reportedAvailable.value === value && independent) d.verification = "CONFIRMED";
    if (reportedAvailable.value !== value) { d.verification = "CONFLICTED"; d.warnings.push("DATA_CONFLICT"); }
  }
  o.currentPosition.availableLimit = d;
}
export function expectedPrincipal(anchor: PortfolioValue<number>, payments: DebtPaymentObservation[], matches: PaymentMatch[], obligationId: string, asOf: string): PortfolioValue<number> {
  if (!known(anchor) || anchor.verification !== "CONFIRMED" || !adequate(anchor.confidence) || !anchor.observedAt) return unknown();
  const matched = new Map(matches.filter(m => m.outcome === "MATCHED" && m.obligationId === obligationId).map(m => [m.paymentObservationId, m]));
  const after = payments.filter(p => p.date > anchor.observedAt! && p.date <= asOf && matched.has(p.observationId));
  const uncertain = after.filter(p => p.paymentKind === "UNSPLIT_DEBT_SERVICE" || p.paymentKind === "PRINCIPAL" && (!finite(p.principalAmount) || !adequate(p.classificationConfidence) || !adequate(matched.get(p.observationId)!.confidence)));
  if (uncertain.length) return { ...unknown<number>(["UNSPLIT_PAYMENT_PRINCIPAL_UNKNOWN"]), evidence: evidence([ ...anchor.evidence, ...uncertain.flatMap(p => p.evidence)]), observedAt: asOf };
  const principal = after.filter(p => p.paymentKind === "PRINCIPAL" && finite(p.principalAmount));
  if (!principal.length) return anchor.observedAt === asOf ? anchor : { ...unknown<number>(["CURRENT_PRINCIPAL_NOT_CONFIRMED"]), evidence: anchor.evidence, observedAt: asOf };
  const value = anchor.value - principal.reduce((n, p) => n + p.principalAmount!, 0);
  const deps = principal.map(p => ({ ...anchor, confidence: weakest(p.classificationConfidence, matched.get(p.observationId)!.confidence), evidence: p.evidence }));
  const result = derived(value, [anchor, ...deps], asOf, ["DERIVED_PRINCIPAL_FROM_CONFIRMED_ANCHOR", ...(value < 0 ? ["DERIVED_PRINCIPAL_BELOW_ZERO"] : [])]);
  if (value < 0) result.confidence = "LOW";
  return result;
}
export function checkPosition(obligationId: string, expected: PortfolioValue<number>, reportedValue: PortfolioValue<number>, strongIdentity: boolean): PortfolioPositionCheck {
  const comparable = strongIdentity && expected.observedAt !== null && expected.observedAt === reportedValue.observedAt && expected.origin === "DERIVED" && expected.warnings.includes("DERIVED_PRINCIPAL_FROM_CONFIRMED_ANCHOR");
  const complete = known(expected) && known(reportedValue);
  const delta = complete ? Math.abs(expected.value! - reportedValue.value!) : null;
  const c = weakest(expected.confidence, reportedValue.confidence);
  const tolerance = complete ? Math.max(1000, .01 * Math.max(Math.abs(expected.value!), Math.abs(reportedValue.value!), 1)) : 0;
  const outcome = !complete ? "INSUFFICIENT_DATA" : !comparable ? "NOT_COMPARABLE" : c !== "HIGH" ? "DIFFERENCE_OBSERVED" : delta === 0 ? "EXACT_MATCH" : delta! <= tolerance ? "WITHIN_TOLERANCE" : "DIFFERENCE_OBSERVED";
  return { checkId: id("position-check", obligationId, expected, reportedValue), obligationId, asOf: reportedValue.observedAt,
    expectedValue: expected.value, reportedValue: reportedValue.value, absoluteDifference: finite(delta) ? delta : null, relativeDifference: complete && reportedValue.value !== 0 && finite(delta! / Math.abs(reportedValue.value!)) ? delta! / Math.abs(reportedValue.value!) : null,
    outcome, confidence: c, reasonCodes: [outcome === "EXACT_MATCH" ? "POSITION_EXACT_MATCH" : outcome === "WITHIN_TOLERANCE" ? "POSITION_WITHIN_TOLERANCE" : "POSITION_DIFFERENCE_OBSERVED"], evidence: evidence([...expected.evidence, ...reportedValue.evidence]) };
}
