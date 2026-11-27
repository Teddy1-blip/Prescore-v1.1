import { CREDIT_PORTFOLIO_VERSION, type PortfolioInput, type CreditPortfolioV1, type PortfolioObligation, type PortfolioObservation, type PortfolioExposureClass, type PortfolioObligationType, type ObligationMatch } from "../contracts/credit-portfolio.ts";
import { adequate, dedupe, evidence, id, known, reported, stable, unique, unknown, validDate, weakest } from "./common.ts";
import { creditHistoryObservations, documentObservations, companyScope, provisionalSchedule, PROVISIONAL_BKI_SCHEDULE } from "./observations.ts";
import { ObligationIndex, identityKeys, obligationId } from "./obligation-matcher.ts";
import { buildTerms, buildPosition, field, effectiveDates, termFields, positionFields } from "./terms.ts";
import { buildSchedule, applyScheduleMatches } from "./schedule.ts";
import { event } from "./events.ts";
import { matchPayments } from "./payment-matcher.ts";
import { availableLimit, expectedPrincipal, checkPosition } from "./position.ts";
import { summarizePortfolio } from "./summary.ts";

const exposures: Record<PortfolioObligationType, PortfolioExposureClass> = { TERM_LOAN: "FUNDED_DEBT", CREDIT_LINE: "CREDIT_LIMIT", OVERDRAFT: "CREDIT_LIMIT", LEASING: "LEASE", FACTORING: "FACTORING", BANK_GUARANTEE: "CONTINGENT", GUARANTORSHIP: "CONTINGENT", OTHER_DEBT: "OTHER", UNKNOWN: "UNKNOWN" };
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    if ("knowledge" in value) { const v = value as { value: unknown; knowledge: string; verification: string; effectiveFrom: string | null }; return [v.value, v.knowledge, v.verification, v.effectiveFrom]; }
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "evidence").map(([k, v]) => [k, shape(v)]));
  }
  return value;
}
function makeObligation(group: PortfolioObservation[], companyInn: string, oid: string, c: PortfolioObligation["identityConfidence"], asOf: string): PortfolioObligation {
  const h = group[0].obligationHints, type = h.productType ?? "UNKNOWN";
  const refs = evidence(group.flatMap(o => o.evidence)), date = group[0].observedAt;
  const identity = Object.fromEntries(["creditorName", "creditorInn", "contractNumber", "contractDate", "accountNumber"].map(k => [k, reported(h[k as keyof typeof h] as string ?? null, date, refs, c)])) as Omit<PortfolioObligation["identity"], "externalIds">;
  return { obligationId: oid, companyInn, type, exposureClass: exposures[type] ?? "UNKNOWN", identity: { ...identity, externalIds: (h.externalIds ?? []).map(e => ({ ...e, evidence: refs })) },
    status: reported("DETECTED", date, refs, c), currentTerms: buildTerms([], asOf), currentPosition: buildPosition([], asOf), termsHistory: [], positionHistory: [], schedule: [], events: [], sourceIds: [], identityConfidence: c,
    warnings: ["BANK_GUARANTEE", "GUARANTORSHIP"].includes(type) ? ["GUARANTEE_EXCLUDED_FROM_FUNDED_DEBT"] : type === "LEASING" ? ["LEASING_SEPARATE_FROM_FUNDED_PRINCIPAL"] : type === "FACTORING" ? ["FACTORING_RECOURSE_UNKNOWN"] : [], identityAliases: identityKeys(h) };
}
export function buildCreditPortfolio(input: PortfolioInput): CreditPortfolioV1 {
  if (!/^\d{10}(?:\d{2})?$/.test(input.companyInn) || !validDate(input.asOfDate)) throw Error("PORTFOLIO_SUBJECT_OR_DATE_INVALID");
  const previous = input.previousPortfolio;
  if (previous && previous.companyInn !== input.companyInn) throw Error("PORTFOLIO_COMPANY_MISMATCH");
  const snapshots = dedupe([...(previous?.creditHistorySnapshots ?? []), ...(input.creditHistorySnapshots ?? [])], s => s.snapshotId);
  const bureauObservations = snapshots.flatMap(creditHistoryObservations);
  const bureauIds = new Set(bureauObservations.map(o => o.observationId));
  const rawObservations = [...(previous?.observationHistory ?? []), ...bureauObservations, ...(input.observations ?? []), ...(input.documents ?? []).flatMap(documentObservations)];
  const observations = dedupe(rawObservations, o => o.observationId);
  if (observations.some(o => o.companyInn !== input.companyInn)) throw Error("OBSERVATION_COMPANY_MISMATCH");
  for (const o of observations) {
    if (o.knowledge === "KNOWN" && o.value !== null && ((["RUB", "PERCENT"].includes(o.unit) && (typeof o.value !== "number" || !Number.isFinite(o.value))) || o.unit === "DATE" && !validDate(o.value))) throw Error("INVALID_CANONICAL_OBSERVATION_VALUE");
  }
  const payments = dedupe([...(previous?.paymentObservations ?? []), ...(input.paymentObservations ?? [])], p => p.observationId).filter(p => p.date <= input.asOfDate);
  if (payments.some(p => p.companyInn !== input.companyInn)) throw Error("PAYMENT_COMPANY_MISMATCH");
  const groups = new Map<string, PortfolioObservation[]>();
  for (const o of observations) if (validDate(o.observedAt) && o.observedAt <= input.asOfDate) groups.set(o.observationGroupId, [...(groups.get(o.observationGroupId) ?? []), o]);
  const sorted = [...groups.values()].sort((a, b) => a[0].observedAt!.localeCompare(b[0].observedAt!) || a[0].observationGroupId.localeCompare(b[0].observationGroupId));
  const index = new ObligationIndex(), obligations = new Map<string, PortfolioObligation>(), resolved = new Map<string, PortfolioObservation[]>(), matches: ObligationMatch[] = [];
  for (const observations of sorted) {
    const match = index.match(observations);
    if (observations.some(x => x.warnings.includes("BKI_AMBIGUOUS_SOURCE_ROWS"))) { match.outcome = "AMBIGUOUS"; match.obligationId = null; match.confidence = "LOW"; match.reasonCodes.push("OBLIGATION_MATCH_AMBIGUOUS"); }
    matches.push(match);
    if (["AMBIGUOUS", "POSSIBLE_MATCH"].includes(match.outcome)) continue;
    const supported = observations.some(o => o.knowledge === "KNOWN" && adequate(o.confidence));
    const group = supported ? observations : provisionalSchedule(observations, bureauIds);
    if (!group.length) continue;
    const oid = match.obligationId ?? obligationId(input.companyInn, group[0].obligationHints, group[0].observationGroupId);
    let o = obligations.get(oid);
    if (o && !match.obligationId) { match.outcome = "AMBIGUOUS"; match.reasonCodes.push("OBLIGATION_MATCH_AMBIGUOUS"); continue; }
    if (!o) {
      o = makeObligation(group, input.companyInn, oid, identityKeys(group[0].obligationHints).length ? match.confidence : "LOW", input.asOfDate);
      if (!supported) o.warnings.push(PROVISIONAL_BKI_SCHEDULE);
      obligations.set(oid, o); match.obligationId = oid; match.outcome = "NEW_OBLIGATION";
      o.events.push(event(oid, "NEW_OBLIGATION_DETECTED", group[0].observedAt, group.flatMap(x => x.evidence), "NEW_OBLIGATION_DETECTED", o.identityConfidence));
      o.events.push(event(oid, "OBLIGATION_DETECTED", group[0].observedAt, group.flatMap(x => x.evidence), "OBLIGATION_DETECTED", o.identityConfidence));
    }
    if (supported && adequate(match.confidence) && o.warnings.includes(PROVISIONAL_BKI_SCHEDULE)) {
      o.identityConfidence = match.confidence;
      o.warnings = o.warnings.filter(w => w !== PROVISIONAL_BKI_SCHEDULE);
    }
    if (o.type === "UNKNOWN" && group[0].obligationHints.productType && group[0].obligationHints.productType !== "UNKNOWN") { o.type = group[0].obligationHints.productType; o.exposureClass = exposures[o.type]; }
    o.identityAliases = unique([...o.identityAliases, ...identityKeys(group[0].obligationHints)]);
    for (const k of ["creditorName", "creditorInn", "contractNumber", "contractDate", "accountNumber"] as const) {
      const value = group[0].obligationHints[k];
      if (value && !known(o.identity[k])) o.identity[k] = reported(value, group[0].observedAt, group.flatMap(x => x.evidence), match.confidence);
    }
    resolved.set(oid, [...(resolved.get(oid) ?? []), ...group]); index.add(o);
  }
  for (const [oid, o] of obligations) {
    const obs = resolved.get(oid)!, dates = effectiveDates(obs, input.asOfDate);
    for (const date of dates) {
      const terms = buildTerms(obs, date), position = buildPosition(obs, date);
      const refs = evidence(obs.filter(x => x.observedAt === date || x.effectiveFrom === date).flatMap(x => x.evidence));
      const old = o.termsHistory.at(-1)?.terms;
      if (!old || stable(shape(old)) !== stable(shape(terms))) {
        const codes: string[] = [];
        for (const [key, code, type] of [["annualRate", "TERMS_RATE_CHANGED", "RATE_CHANGED"], ["maturityDate", "TERMS_MATURITY_CHANGED", "MATURITY_CHANGED"], ["creditLimit", "TERMS_LIMIT_CHANGED", "LIMIT_CHANGED"]] as const) {
          if (old && known<unknown>(old[key]) && known<unknown>(terms[key]) && old[key].value !== terms[key].value) { codes.push(code); o.events.push(event(oid, type, date, terms[key].evidence, code, terms[key].confidence, terms[key].effectiveFrom)); }
        }
        if (old) o.events.push(event(oid, "TERMS_CHANGED", date, refs));
        o.termsHistory.push({ versionId: id("terms", oid, date, shape(terms)), obligationId: oid, observedAt: obs.filter(x => x.observedAt && x.observedAt <= date).map(x => x.observedAt!).sort().at(-1)!, effectiveFrom: refs.length ? obs.find(x => x.effectiveFrom === date)?.effectiveFrom ?? null : null,
          effectiveTo: null, terms, sourceIds: unique(refs.flatMap(e => e.sourceId ? [e.sourceId] : [])), changeCodes: codes, evidence: refs });
        const explicitStarts = termFields.filter(k => !old || stable(shape(old[k])) !== stable(shape(terms[k]))).map(k => terms[k].effectiveFrom).filter((v): v is string => validDate(v)).sort();
        o.termsHistory.at(-1)!.effectiveFrom = explicitStarts.at(-1) ?? null;
      }
      if (obs.some(x => x.observedAt === date && positionFields.includes(x.fieldCode as typeof positionFields[number]))) {
        o.positionHistory.push({ snapshotId: id("position", oid, date, position), obligationId: oid, asOf: date, position, sourceIds: unique(refs.flatMap(e => e.sourceId ? [e.sourceId] : [])), evidence: refs,
          confidence: weakest(...Object.values(position).map(v => v.confidence)), warnings: [] });
        o.events.push(event(oid, "POSITION_REPORTED", date, refs));
      }
    }
    o.currentTerms = buildTerms(obs, input.asOfDate); o.currentPosition = buildPosition(obs, input.asOfDate);
    const status = field<PortfolioObligation["status"]["value"]>(obs, "status", input.asOfDate, true);
    if (known(status) && status.value && ["ACTIVE", "CLOSED", "SUSPENDED", "DETECTED", "UNKNOWN"].includes(status.value)) {
      if (status.value !== "CLOSED" || adequate(o.identityConfidence) && adequate(status.confidence)) o.status = status as PortfolioObligation["status"];
    }
    if (o.status.value === "CLOSED") o.events.push(event(oid, "OBLIGATION_CLOSED_OBSERVED", o.status.observedAt, o.status.evidence, "OBLIGATION_CLOSED_REPORTED", o.status.confidence));
    for (const k of ["creditorName", "creditorInn", "contractNumber", "contractDate", "accountNumber"] as const) {
      const v = field<string>(obs, k, input.asOfDate, true); if (known(v)) o.identity[k] = v;
    }
    const currentValues = [...termFields.map(k => o.currentTerms[k]), ...Object.values(o.currentPosition), o.status];
    o.sourceIds = unique(currentValues.flatMap(v => v.evidence.flatMap(e => e.sourceId ? [e.sourceId] : [])));
    for (const v of currentValues) if (v.verification === "CONFLICTED") o.events.push(event(oid, "DATA_CONFLICT", v.observedAt, v.evidence, "DATA_CONFLICT", v.confidence));
    o.schedule = buildSchedule(o, obs, input.asOfDate);
    const latest = snapshots.filter(s => companyScope(s, input.companyInn) && s.asOf && s.asOf <= input.asOfDate).sort((a, b) => a.asOf!.localeCompare(b.asOf!) || a.snapshotId.localeCompare(b.snapshotId)).at(-1);
    if (latest && !obs.some(x => x.evidence.some(e => e.sourceId === latest.sourceId))) o.warnings.push("OBLIGATION_ABSENT_NOT_CLOSED");
  }
  const list = [...obligations.values()].sort((a, b) => a.obligationId.localeCompare(b.obligationId));
  const paymentMatches = matchPayments(payments, list), checks: CreditPortfolioV1["positionChecks"] = [];
  for (const o of list) {
    const reports = o.positionHistory.filter(p => known(p.position.principalOutstanding) && p.position.principalOutstanding.verification === "CONFIRMED");
    for (let i = 1; i < reports.length; i++) {
      const expected = expectedPrincipal(reports[i - 1].position.principalOutstanding, payments, paymentMatches, o.obligationId, reports[i].asOf);
      const check = checkPosition(o.obligationId, expected, reports[i].position.principalOutstanding, adequate(o.identityConfidence)); checks.push(check);
      o.events.push(event(o.obligationId, "PORTFOLIO_RECONCILED", check.asOf, check.evidence, check.reasonCodes[0], check.confidence));
    }
    const current = o.currentPosition.principalOutstanding;
    if (["FUNDED_DEBT", "CREDIT_LIMIT"].includes(o.exposureClass) && o.status.value !== "CLOSED" && current.verification !== "CONFLICTED" && (current.observedAt !== input.asOfDate || !known(current) || !adequate(current.confidence))) {
      const anchor = reports.at(-1)?.position.principalOutstanding;
      const laterConflict = anchor && o.positionHistory.some(p => p.asOf > anchor.observedAt! && p.position.principalOutstanding.verification === "CONFLICTED");
      o.currentPosition.principalOutstanding = anchor && !laterConflict ? expectedPrincipal(anchor, payments, paymentMatches, o.obligationId, input.asOfDate) : unknown();
    }
    if (["CREDIT_LINE", "OVERDRAFT"].includes(o.type) && !known(o.currentPosition.drawnAmount)) {
      const principal = o.currentPosition.principalOutstanding;
      // Current funded principal is utilization only for explicit credit-line/overdraft semantics.
      if (known(principal)) o.currentPosition.drawnAmount = { ...principal, origin: "DERIVED", warnings: [...principal.warnings, "LINE_PRINCIPAL_AS_UTILIZATION"] };
    }
    availableLimit(o, input.asOfDate);
    const resolvedValues = [...termFields.map(k => o.currentTerms[k]), ...Object.values(o.currentPosition), o.status];
    o.sourceIds = unique(resolvedValues.flatMap(v => v.evidence.flatMap(e => e.sourceId ? [e.sourceId] : [])));
    const free = o.currentPosition.availableLimit;
    if (free.verification === "CONFLICTED") o.events.push(event(o.obligationId, "DATA_CONFLICT", free.observedAt, free.evidence, "DATA_CONFLICT", free.confidence));
    for (const m of paymentMatches.filter(m => m.obligationId === o.obligationId)) {
      const p = payments.find(p => p.observationId === m.paymentObservationId)!;
      o.events.push(event(o.obligationId, "PAYMENT_MATCHED", p.date, m.evidence, "PAYMENT_MATCHED", m.confidence));
    }
  }
  // Retain prior derived observations as history when a later source replaces the current view.
  for (const o of list) {
    const prior = previous?.obligations.find(p => p.obligationId === o.obligationId);
    if (!prior) continue;
    const histories = [...prior.positionHistory, ...o.positionHistory];
    if (previous?.asOfDate && previous.asOfDate <= input.asOfDate && Object.values(prior.currentPosition).some(v => v.origin === "DERIVED")) {
      const refs = evidence(Object.values(prior.currentPosition).flatMap(v => v.evidence));
      histories.push({ snapshotId: id("derived-position-history", o.obligationId, previous.asOfDate, prior.currentPosition), obligationId: o.obligationId, asOf: previous.asOfDate,
        position: prior.currentPosition, sourceIds: unique(refs.flatMap(e => e.sourceId ? [e.sourceId] : [])), evidence: refs,
        confidence: weakest(...Object.values(prior.currentPosition).map(v => v.confidence)), warnings: ["HISTORICAL_DERIVED_POSITION"] });
    }
    o.positionHistory = [...new Map(histories.map(p => [p.snapshotId, p])).values()].sort((a, b) => a.asOf.localeCompare(b.asOf) || a.snapshotId.localeCompare(b.snapshotId));
    o.events = [...new Map([...prior.events, ...o.events].map(e => [e.eventId, e])).values()].sort((a, b) => a.eventId.localeCompare(b.eventId));
  }
  applyScheduleMatches(list, payments, paymentMatches);
  const allEvents = dedupe([...list.flatMap(o => o.events), ...payments.map(p => event(null, "PAYMENT_OBSERVED", p.date, p.evidence, "PAYMENT_OBSERVED", p.classificationConfidence))], e => e.eventId);
  const summary = summarizePortfolio(list, input.asOfDate);
  const unresolved = matches.filter(m => m.outcome === "AMBIGUOUS" || m.outcome === "POSSIBLE_MATCH");
  if (unresolved.length) {
    summary.confidence = weakest(summary.confidence, "LOW");
    summary.warnings.push("UNRESOLVED_OBLIGATION_OBSERVATIONS");
    for (const aggregate of [summary.fundedDebt, summary.creditLimits, summary.utilizedLimits, summary.availableLimits, summary.leaseExposure, summary.factoringExposure, summary.contingentGuaranteeExposure]) {
      aggregate.value = null; aggregate.coverage = null; aggregate.confidence = weakest(aggregate.confidence, "LOW"); aggregate.warnings.push("UNRESOLVED_OBLIGATION_OBSERVATIONS");
    }
  }
  return { version: CREDIT_PORTFOLIO_VERSION, mode: "SHADOW", portfolioId: `portfolio:${input.companyInn}`, companyInn: input.companyInn, asOfDate: input.asOfDate,
    creditHistorySnapshots: snapshots, obligations: list, paymentObservations: payments, paymentMatches, unmatchedPaymentObservationIds: paymentMatches.filter(m => m.outcome !== "MATCHED").map(m => m.paymentObservationId),
    events: allEvents, positionChecks: checks, summary, observationHistory: observations, obligationMatches: matches,
    warnings: unique([...(input.paymentObservations === undefined && !previous?.paymentObservations ? ["PAYMENT_OBSERVATIONS_UNAVAILABLE"] : []), ...snapshots.filter(s => !companyScope(s, input.companyInn)).map(() => "BKI_NOT_COMPANY_PORTFOLIO_SCOPE"), ...matches.flatMap(m => m.reasonCodes), ...list.flatMap(o => o.warnings)]) };
}
