import { rule } from "./factory.ts";
import { get, usable, result, missing, threshold as t } from "../common.ts";
export const creditHistoryRules = [
  rule({ code: "RISK-BKI-CURRENT-OVERDUE", domain: "CREDIT_HISTORY", scope: "CREDIT_RISK", calibrationClass: "PRE_CREDIT_LAB", perObligation: true, requiredFactCodes: ["BKI_OVERDUE"], thresholds: [t("GT", 0), t("GTE", 60), t("GTE", 30)] }, d => {
    const amount = get(d, "BKI_OVERDUE"), days = get(d, "BKI_HISTORY_DAYS"); if (!usable(amount) || typeof amount.value !== "number") return missing([amount]); if (amount.value <= 0) return result("NOT_TRIGGERED", [amount]);
    const n = usable(days) && typeof days.value === "number" ? days.value : null;
    return { ...result("TRIGGERED", n == null ? [amount] : [amount, days], ["CURRENT_OVERDUE", ...(n == null ? [] : [n >= 60 ? "DELINQUENCY_60_PLUS" : n >= 30 ? "DELINQUENCY_30_59" : "DELINQUENCY_1_29"])]), severity: n != null && n >= 60 ? "CRITICAL" : n != null && n >= 30 ? "HIGH" : "MEDIUM", threshold: t("GT", 0) };
  }),
  rule({ code: "RISK-BKI-HISTORICAL-DELINQUENCY", domain: "CREDIT_HISTORY", scope: "CREDIT_RISK", calibrationClass: "PRE_CREDIT_LAB", perObligation: true, requiredFactCodes: ["BKI_HISTORY_DAYS"], thresholds: [t("GTE", 60), t("GTE", 30), t("GTE", 1)] }, d => { const f = get(d, "BKI_HISTORY_DAYS"); if (!usable(f) || typeof f.value !== "number") return missing([f]); if (f.value < 1) return result("NOT_TRIGGERED", [f]);
    return { ...result("TRIGGERED", [f], [f.value >= 60 ? "DELINQUENCY_60_PLUS" : f.value >= 30 ? "DELINQUENCY_30_59" : "DELINQUENCY_1_29"]), severity: f.value >= 60 ? "HIGH" : f.value >= 30 ? "MEDIUM" : "LOW", scope: f.value < 30 ? "INFORMATION" : "CREDIT_RISK", threshold: t("GTE", f.value >= 60 ? 60 : f.value >= 30 ? 30 : 1) };
  }),
];
