import type { PortfolioObligation, PortfolioObservation, PortfolioScheduledEvent, PaymentMatch, DebtPaymentObservation } from "../contracts/credit-portfolio.ts";
import { field } from "./terms.ts";
import { evidence, id, known, unknown, validDate } from "./common.ts";
export function buildSchedule(o: PortfolioObligation, obs: PortfolioObservation[], date: string): PortfolioScheduledEvent[] {
  const out: PortfolioScheduledEvent[] = [];
  const add = (key: string, type: PortfolioScheduledEvent["type"], due: string | null, amount = unknown<number>(), principal = unknown<number>(), interest = unknown<number>()) => {
    if (!validDate(due)) return;
    out.push({ scheduledEventId: id("schedule", o.obligationId, key, due), obligationId: o.obligationId, type, dueDate: due, amount, principalDue: principal, interestDue: interest,
      status: "SCHEDULED", evidence: evidence([...amount.evidence, ...principal.evidence, ...interest.evidence]), warnings: [] });
  };
  // One event for each explicitly observed next-payment date, never monthly extrapolation.
  const reportDates = [...new Set(obs.filter(x => x.fieldCode === "nextPaymentDate" && x.observedAt && x.observedAt <= date).map(x => x.observedAt!))].sort();
  for (const observed of reportDates) {
    const due = field<string>(obs, "nextPaymentDate", observed), amount = field<number>(obs, "nextPaymentAmount", observed);
    if (known(due) && known(amount)) add("reported-next-payment", "PAYMENT_DUE", due.value, { ...amount, evidence: evidence([...amount.evidence, ...due.evidence]) });
  }
  const keys = [...new Set(obs.filter(x => x.fieldCode.startsWith("schedule.")).map(x => x.fieldCode.split(".")[1]))].sort();
  const types: PortfolioScheduledEvent["type"][] = ["PAYMENT_DUE", "MATURITY", "LIMIT_EXPIRY", "RATE_REVIEW", "REPORTING_DUE", "COVENANT_CHECK", "INSURANCE_EXPIRY", "GUARANTEE_EXPIRY", "OTHER"];
  for (const key of keys) {
    const t = field<PortfolioScheduledEvent["type"]>(obs, `schedule.${key}.type`, date), due = field<string>(obs, `schedule.${key}.dueDate`, date);
    add(key, known(t) && types.includes(t.value) ? t.value : "OTHER", due.value, field(obs, `schedule.${key}.amount`, date), field(obs, `schedule.${key}.principalDue`, date), field(obs, `schedule.${key}.interestDue`, date));
  }
  const terms = o.currentTerms;
  for (const [key, type, v] of [["maturity", "MATURITY", terms.maturityDate], ["rate-review", "RATE_REVIEW", terms.nextRateReviewDate], ["guarantee-expiry", "GUARANTEE_EXPIRY", terms.guaranteeExpiry]] as const) {
    if (key === "maturity" && ["BANK_GUARANTEE", "GUARANTORSHIP"].includes(o.type)) continue;
    if (known(v)) add(key, type, v.value, { ...unknown<number>(), evidence: v.evidence });
  }
  for (const r of terms.reportingRequirements) add(`reporting-${r.requirementId}`, "REPORTING_DUE", r.dueDate, { ...unknown<number>(), evidence: r.evidence });
  for (const r of terms.insuranceRequirements) add(`insurance-${r.requirementId}`, "INSURANCE_EXPIRY", r.expiryDate, { ...unknown<number>(), evidence: r.evidence });
  const map = new Map<string, PortfolioScheduledEvent>();
  for (const e of out) map.set(e.scheduledEventId, e);
  return [...map.values()].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.scheduledEventId.localeCompare(b.scheduledEventId));
}
export function applyScheduleMatches(obligations: PortfolioObligation[], payments: DebtPaymentObservation[], matches: PaymentMatch[]) {
  for (const o of obligations) for (const s of o.schedule) {
    const relevant = matches.filter(m => m.outcome === "MATCHED" && m.matchedScheduleEventId === s.scheduledEventId);
    const ids = new Set(relevant.map(m => m.paymentObservationId));
    const paid = payments.filter(p => ids.has(p.observationId)).reduce((n, p) => n + p.amount, 0);
    if (relevant.length) s.status = known(s.amount) && paid < s.amount.value ? "PARTIALLY_MATCHED" : "MATCHED";
  }
}
