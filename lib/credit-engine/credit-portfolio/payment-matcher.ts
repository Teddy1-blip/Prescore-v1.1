import type { PortfolioObligation, DebtPaymentObservation, PaymentMatch } from "../contracts/credit-portfolio.ts";
import { adequate, dayGap, id, known, normalize, unique, validDate, weakest } from "./common.ts";
export function compatiblePayment(payment: DebtPaymentObservation, o: PortfolioObligation) {
  return payment.paymentKind === "LEASING" ? o.type === "LEASING" : payment.paymentKind === "FACTORING_FEE" ? o.type === "FACTORING" : ["TERM_LOAN", "CREDIT_LINE", "OVERDRAFT", "OTHER_DEBT"].includes(o.type);
}
export function matchPayments(payments: DebtPaymentObservation[], obligations: PortfolioObligation[]): PaymentMatch[] {
  const byCreditor = new Map<string, Set<PortfolioObligation>>();
  for (const o of obligations) for (const raw of [o.identity.creditorInn.value, o.identity.creditorName.value]) if (raw) { const key = normalize(raw); byCreditor.set(key, new Set([...(byCreditor.get(key) ?? []), o])); }
  return payments.map(p => {
    const candidates = [...new Set([p.creditorInn, p.creditorName].flatMap(v => v ? [...(byCreditor.get(normalize(v)) ?? [])] : []))].filter(o => o.companyInn === p.companyInn && compatiblePayment(p, o)
      && !(p.creditorInn && o.identity.creditorInn.value && p.creditorInn !== o.identity.creditorInn.value));
    const scored = candidates.map(o => {
      const creditorInn = Boolean(p.creditorInn && p.creditorInn === o.identity.creditorInn.value);
      const creditorName = Boolean(p.creditorName && normalize(p.creditorName) === normalize(o.identity.creditorName.value));
      const reference = o.identity.contractNumber.value, account = o.identity.accountNumber.value;
      const exact = Boolean(reference && p.contractReferences.includes(normalize(reference))) || Boolean(account && normalize(p.purpose).split(/[\s,;:()№]+/).includes(normalize(account)));
      const wrongContract = p.contractReferences.length > 0 && !exact;
      const schedules = o.schedule.filter(s => s.type === "PAYMENT_DUE" && validDate(s.dueDate) && validDate(p.date) && dayGap(s.dueDate, p.date) <= 3);
      const aligned = schedules.filter(s => known(s.amount) && Math.abs(s.amount.value - p.amount) <= Math.max(1, s.amount.value * .01));
      const schedule = aligned.length === 1 ? aligned[0] : exact && schedules.length === 1 ? schedules[0] : undefined;
      const strong = !wrongContract && adequate(o.identityConfidence) && (exact && (creditorInn || creditorName) || creditorInn && candidates.length === 1 && aligned.length === 1);
      return { o, exact, strong, wrongContract, schedule, reasons: [...(exact ? ["PAYMENT_CONTRACT_REFERENCE_MATCH"] : []), ...(creditorInn ? ["PAYMENT_CREDITOR_INN_MATCH"] : creditorName ? ["PAYMENT_CREDITOR_NAME_MATCH"] : []), ...(schedule ? ["PAYMENT_SCHEDULE_DATE_MATCH"] : []), ...(aligned.length === 1 ? ["PAYMENT_SCHEDULE_AMOUNT_MATCH"] : [])] };
    }).filter(x => !x.wrongContract);
    const strong = scored.filter(s => s.strong), possible = strong.length ? strong : scored;
    const selected = possible.length === 1 ? possible[0] : undefined;
    const linked = selected?.strong && adequate(p.classificationConfidence);
    const outcome = possible.length > 1 ? "AMBIGUOUS" : linked ? "MATCHED" : selected ? "POSSIBLE_MATCH" : "UNMATCHED";
    return { matchId: id("payment-match", p.observationId, possible.map(s => s.o.obligationId).sort(), outcome), paymentObservationId: p.observationId,
      obligationId: linked ? selected!.o.obligationId : null, outcome, confidence: linked ? weakest(p.classificationConfidence, selected!.o.identityConfidence) : selected ? "LOW" : "UNKNOWN",
      matchedScheduleEventId: linked ? selected!.schedule?.scheduledEventId ?? null : null, reasonCodes: unique([...(selected?.reasons ?? []), ...(outcome === "AMBIGUOUS" ? ["PAYMENT_MULTIPLE_CANDIDATES"] : outcome === "UNMATCHED" ? ["PAYMENT_UNMATCHED"] : [])]),
      evidence: [...p.evidence, ...(selected?.o.identity.contractNumber.evidence ?? [])], candidateObligationIds: possible.map(s => s.o.obligationId).sort() };
  });
}
