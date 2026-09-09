import { numeric, rule } from "./factory.ts";
import { threshold as t, get, missing, result, adequate } from "../common.ts";
const spec = (code: string, facts: string[], data = false) => ({ code, domain: data ? "DATA_QUALITY" as const : "CASH_FLOW" as const, scope: data ? "DATA_REVIEW" as const : "CREDIT_RISK" as const, calibrationClass: "PRE_CREDIT_LAB" as const, requiredFactCodes: facts });
export const cashFlowRules = [
  numeric({ ...spec("RISK-CF-DEBT-SERVICE-BURDEN", ["BANK_DEBT_SERVICE_RATIO", "BANK_COVERAGE_ADEQUATE"]), thresholds: [t("GT", .4), t("GT", .25)] }, (n, d) => get(d, "BANK_COVERAGE_ADEQUATE")?.value === true && n > .25 ? { severity: n > .4 ? "HIGH" : "MEDIUM", reason: n > .4 ? "DEBT_SERVICE_BURDEN_HIGH" : "DEBT_SERVICE_BURDEN_MEDIUM", threshold: t("GT", n > .4 ? .4 : .25) } : null),
  numeric({ ...spec("RISK-CF-OPERATING-RECEIPTS-DECLINE", ["BANK_OPERATING_TREND", "BANK_COVERAGE_ADEQUATE"]), thresholds: [t("LTE", -25), t("LTE", -10)] }, n => n <= -10 ? { severity: n <= -25 ? "HIGH" : "MEDIUM", reason: "OPERATING_RECEIPTS_DECLINE", threshold: t("LTE", n <= -25 ? -25 : -10) } : null),
  rule({ ...spec("RISK-CF-CUSTOMER-CONCENTRATION", ["BANK_TOP1", "BANK_CONCENTRATION_COVERAGE", "BANK_IDENTITY_COVERAGE", "BANK_INTERMEDIATED_SHARE"]), thresholds: [t("GTE", .8, "DIRECT_CUSTOMER_EVIDENCE_COVERAGE"), t("GTE", .5), t("GTE", .35)] }, d => {
    const fs = ["BANK_TOP1", "BANK_CONCENTRATION_COVERAGE", "BANK_IDENTITY_COVERAGE", "BANK_INTERMEDIATED_SHARE"].map(c => get(d, c));
    // Coverage is itself a measured proportion even when the underlying identity set is partial.
    if (fs.some(f => !f || !["KNOWN", "PARTIAL"].includes(f.status) || typeof f.value !== "number" || !adequate(f.confidence) || f.warnings.includes("DATA_CONFLICT"))) return missing(fs, ["CONCENTRATION_COVERAGE_INSUFFICIENT"]);
    const [top, coverage, identity, intermediary] = fs.map(f => f!.value as number);
    if (coverage < .8 || identity < .8 || intermediary > .5) return missing(fs, [intermediary > .5 ? "INTERMEDIATED_CUSTOMER_BASE" : "CONCENTRATION_COVERAGE_INSUFFICIENT"]);
    if (top < .35 && fs[0]?.status === "PARTIAL") return missing(fs, ["CONCENTRATION_PARTIAL_NOT_CLEAR"]);
    return top >= .35 ? { ...result("TRIGGERED", fs, [top >= .5 ? "CUSTOMER_CONCENTRATION_HIGH" : "CUSTOMER_CONCENTRATION_MEDIUM"]), severity: top >= .5 ? "HIGH" : "MEDIUM", threshold: t("GTE", top >= .5 ? .5 : .35) } : result("NOT_TRIGGERED", fs);
  }),
  ...[["RISK-DATA-UNKNOWN-INFLOW-SHARE", "BANK_UNKNOWN_INFLOW_SHARE", "UNKNOWN_INFLOW_SHARE"], ["RISK-DATA-CASH-INDIVIDUAL-TRACEABILITY", "BANK_UNCLEAR_CASH_SHARE", "CASH_INDIVIDUAL_TRACEABILITY"]].map(([code, fact, reason]) => numeric({ ...spec(code, [fact], true), thresholds: [t("GTE", .2), t("GTE", .1)] }, n => n >= .1 ? { severity: n >= .2 ? "HIGH" : "MEDIUM", reason: `${reason}_${n >= .2 ? "HIGH" : "MEDIUM"}`, threshold: t("GTE", n >= .2 ? .2 : .1) } : null)),
  numeric({ ...spec("RISK-DATA-BALANCE-RECONSTRUCTION", ["BANK_NEGATIVE_RECONSTRUCTED_DAYS"], true), calibrationClass: "DATA_QUALITY", thresholds: [t("GT", 0, "RECONSTRUCTED_NOT_REPORTED_BALANCE")] }, n => n > 0 ? { severity: "HIGH", reason: "BALANCE_RECONSTRUCTION_REQUIRES_REVIEW", threshold: t("GT", 0, "RECONSTRUCTED_NOT_REPORTED_BALANCE") } : null),
  numeric({ ...spec("RISK-CF-LIQUIDITY-STRESS", ["BANK_LOW_LIQUIDITY_SHARE", "BANK_COVERAGE_ADEQUATE"]), thresholds: [t("GTE", .2), t("GTE", .1)] }, n => n >= .1 ? { severity: n >= .2 ? "HIGH" : "MEDIUM", reason: n >= .2 ? "LIQUIDITY_STRESS_HIGH" : "LIQUIDITY_STRESS_MEDIUM", threshold: t("GTE", n >= .2 ? .2 : .1) } : null),
];
