import type { PortfolioTerms, PortfolioPosition, PortfolioObservation, PortfolioValue } from "../contracts/credit-portfolio.ts";
import { evidence, resolveValue, unknown, validDate } from "./common.ts";
export const termFields = ["originalAmount", "creditLimit", "annualRate", "rateType", "nextRateReviewDate", "openedAt", "maturityDate", "scheduledPaymentAmount", "scheduledPaymentFrequency", "collateralDescription", "guaranteeAmount", "recourseType", "beneficiary", "guaranteeExpiry", "assetDescription", "remainingLeasePayments"] as const;
export const positionFields = ["principalOutstanding", "totalOutstanding", "drawnAmount", "availableLimit", "overdueAmount", "contingentExposure", "nextPaymentAmount", "nextPaymentDate"] as const;
export function field<T>(observations: PortfolioObservation[], key: string, date: string, retainKnown = false): PortfolioValue<T> {
  const all = observations.filter(o => o.fieldCode === key);
  const supported = all.filter(o => o.knowledge === "KNOWN" && o.observedAt && o.observedAt <= date);
  return resolveValue<T>(retainKnown && supported.length ? supported : all, date);
}
export function buildTerms(obs: PortfolioObservation[], date: string): PortfolioTerms {
  const terms = Object.fromEntries(termFields.map(key => [key, field(obs, key, date, true)])) as Omit<PortfolioTerms, "fees" | "covenants" | "insuranceRequirements" | "reportingRequirements">;
  const ids = (prefix: string) => [...new Set(obs.filter(o => o.fieldCode.startsWith(prefix + ".") && o.observedAt && o.observedAt <= date && (!o.effectiveFrom || o.effectiveFrom <= date)).map(o => o.fieldCode.split(".")[1]))].sort();
  const value = <T>(prefix: string, key: string, suffix: string) => field<T>(obs, `${prefix}.${key}.${suffix}`, date, true);
  const refs = (prefix: string, key: string) => evidence(obs.filter(o => o.fieldCode.startsWith(`${prefix}.${key}.`) && o.observedAt && o.observedAt <= date).flatMap(o => o.evidence));
  return { ...terms,
    fees: ids("fee").map(key => ({ feeId: key, description: value<string>("fee", key, "description").value ?? "", amount: value<number>("fee", key, "amount"), evidence: refs("fee", key) })),
    covenants: ids("covenant").map(key => ({ covenantId: key, type: "OTHER", title: value<string>("covenant", key, "title").value ?? "", description: value<string>("covenant", key, "description").value ?? "",
      thresholdValue: value<number>("covenant", key, "thresholdValue").value, thresholdUnit: value<string>("covenant", key, "thresholdUnit").value, testDate: value<string>("covenant", key, "testDate").value,
      frequency: value<string>("covenant", key, "frequency").value, evidence: refs("covenant", key), confidence: value<string>("covenant", key, "title").confidence })),
    insuranceRequirements: ids("insurance").map(key => ({ requirementId: key, policy: value<string>("insurance", key, "policy").value, insurer: value<string>("insurance", key, "insurer").value,
      insuredSubject: value<string>("insurance", key, "insuredSubject").value, expiryDate: value<string>("insurance", key, "expiryDate").value, evidence: refs("insurance", key) })),
    reportingRequirements: ids("reporting").map(key => ({ requirementId: key, title: value<string>("reporting", key, "title").value ?? "", dueDate: value<string>("reporting", key, "dueDate").value,
      frequency: value<string>("reporting", key, "frequency").value, evidence: refs("reporting", key) })),
  };
}
export const buildPosition = (obs: PortfolioObservation[], date: string): PortfolioPosition => Object.fromEntries(positionFields.map(key => [key, field(obs, key, date)])) as PortfolioPosition;
export const emptyPosition = (): PortfolioPosition => Object.fromEntries(positionFields.map(key => [key, unknown()])) as PortfolioPosition;
export const effectiveDates = (obs: PortfolioObservation[], asOf: string) => [...new Set(obs.flatMap(o => [o.observedAt, o.effectiveFrom]).filter((d): d is string => validDate(d) && d <= asOf))].sort();
