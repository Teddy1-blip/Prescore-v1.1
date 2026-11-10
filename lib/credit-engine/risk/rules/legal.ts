import { numeric, rule } from "./factory.ts";
import { threshold as t, get, usable, missing, result } from "../common.ts";
export const legalRules = [
  ...[["ENTITY-TERMINATED", "TERMINATED", "ENTITY_TERMINATED_CONFIRMED"], ["LIQUIDATION-ACTIVE", "LIQUIDATION", "ENTITY_LIQUIDATION_ACTIVE"], ["BANKRUPTCY-ACTIVE", "BANKRUPTCY_ACTIVE", "BANKRUPTCY_ACTIVE_CONFIRMED"]].map(([code, state, reason]) => rule({ code: `RISK-LEGAL-${code}`, domain: "LEGAL", scope: "GLOBAL_STOP", calibrationClass: "FACTUAL", requiredFactCodes: ["LEGAL_LIFECYCLE"], thresholds: [t("EQ", state, "EXPLICIT_CURRENT_LEGAL_LIFECYCLE")] }, d => {
    const f = get(d, "LEGAL_LIFECYCLE"); if (!usable(f) || f.confidence !== "HIGH" || f.value === "UNKNOWN" || f.value === "OTHER") return missing([f], ["LEGAL_STATUS_UNKNOWN"]);
    return f.value === state ? { ...result("TRIGGERED", [f], [reason]), severity: "CRITICAL", threshold: t("EQ", state, "EXPLICIT_CURRENT_LEGAL_LIFECYCLE") } : result("NOT_TRIGGERED", [f]);
  })),
  rule({ code: "RISK-LEGAL-ADDRESS-UNRELIABLE", domain: "LEGAL", scope: "CREDIT_RISK", calibrationClass: "FACTUAL", requiredFactCodes: ["LEGAL_ADDRESS_UNRELIABLE"] }, d => { const f = get(d, "LEGAL_ADDRESS_UNRELIABLE"); if (!usable(f)) return missing([f]); return f.value === true ? { ...result("TRIGGERED", [f], ["ADDRESS_UNRELIABLE"]), severity: "MEDIUM" } : result("NOT_TRIGGERED", [f]); }),
  rule({ code: "RISK-LEGAL-ACTIVE-ENFORCEMENT", domain: "LEGAL", scope: "CREDIT_RISK", calibrationClass: "PRE_CREDIT_LAB", requiredFactCodes: ["LEGAL_ACTIVE_ENFORCEMENT_AMOUNT"], thresholds: [t("GTE", .05), t("GTE", .01)] }, d => { const amount = get(d, "LEGAL_ACTIVE_ENFORCEMENT_AMOUNT"), ratio = get(d, "LEGAL_ENFORCEMENT_REVENUE_RATIO");
    if (!usable(amount)) return missing([amount]); if (typeof amount.value !== "number") return missing([amount]); if (amount.value <= 0) return result("NOT_TRIGGERED", [amount]);
    if (!usable(ratio) || typeof ratio.value !== "number") return { ...result("TRIGGERED", [amount], ["ACTIVE_ENFORCEMENT_MATERIAL", "INSUFFICIENT_DATA"]), severity: "INFO", scope: "INFORMATION" };
    return { ...result("TRIGGERED", [amount, ratio], [ratio.value >= .05 ? "ACTIVE_ENFORCEMENT_RATIO_HIGH" : ratio.value >= .01 ? "ACTIVE_ENFORCEMENT_RATIO_MEDIUM" : "ACTIVE_ENFORCEMENT_MATERIAL"]), severity: ratio.value >= .05 ? "HIGH" : ratio.value >= .01 ? "MEDIUM" : "LOW", scope: ratio.value < .01 ? "INFORMATION" : "CREDIT_RISK", actualValue: ratio.value, unit: "RATIO", threshold: t("GTE", ratio.value >= .05 ? .05 : ratio.value >= .01 ? .01 : 0) };
  }),
  ...[["RISK-LEGAL-LITIGATION", "LEGAL_DEFENDANT_CASES", "INFORMATION", "LITIGATION_REQUIRES_REVIEW"], ["RISK-DATA-BANKRUPTCY-MESSAGES", "LEGAL_REGISTRY_REVIEW", "DATA_REVIEW", "BANKRUPTCY_STATUS_REQUIRES_REVIEW"], ["RISK-LEGAL-INSPECTION-OBSERVATION", "LEGAL_VIOLATIONS_REPORTED", "INFORMATION", "INSPECTION_VIOLATIONS_REPORTED"]].map(([code, fact, scope, reason]) => numeric({ code, domain: "LEGAL", scope: scope as "DATA_REVIEW" | "INFORMATION", calibrationClass: "FACTUAL", requiredFactCodes: [fact], thresholds: [t("GT", 0, "SOURCE_REPORTED_OBSERVATION")] }, n => n > 0 ? { severity: scope === "DATA_REVIEW" ? "MEDIUM" : "INFO", reason, threshold: t("GT", 0, "SOURCE_REPORTED_OBSERVATION") } : null)),
  rule({code: "RISK-LEGAL-RNP-ACTIVE", domain: "LEGAL", scope: "INFORMATION", calibrationClass: "FACTUAL",
    perObligation: true, optionalSourceFact: "LEGAL_RNP_CURRENT_RECORD", requiredFactCodes: ["LEGAL_RNP_CURRENT_RECORD"]}, d => {
    const f = get(d, "LEGAL_RNP_CURRENT_RECORD");
    if (!usable(f) || f.confidence !== "HIGH") return missing([f]);
    return f.value === true
      ? {...result("TRIGGERED", [f], ["CURRENT_RNP_RECORD_REQUIRES_PRODUCT_POLICY_REVIEW"]), severity: "INFO", scope: "INFORMATION"}
      : result("NOT_TRIGGERED", [f]);
  }),
];
