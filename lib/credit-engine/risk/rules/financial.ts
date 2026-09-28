import { numeric, rule } from "./factory.ts";
import { threshold as t, get, usable, missing, result } from "../common.ts";
const spec = (code: string, facts: string[], factual = false) => ({ code: `RISK-FIN-${code}`, domain: "FINANCIAL" as const, scope: "CREDIT_RISK" as const, calibrationClass: factual ? "FACTUAL" as const : "PRE_CREDIT_LAB" as const, requiredFactCodes: facts });
export const financialRules = [
  numeric({ ...spec("EQUITY-NON-POSITIVE", ["FIN_EQUITY"], true), thresholds: [t("LTE", 0, "FACTUAL_SIGN")] }, n => n <= 0 ? { severity: n < 0 ? "CRITICAL" : "HIGH", reason: n < 0 ? "EQUITY_NEGATIVE" : "EQUITY_ZERO", threshold: t(n < 0 ? "LT" : "EQ", 0, "FACTUAL_SIGN") } : null),
  numeric({ ...spec("NET-ASSETS-NEGATIVE", ["FIN_REPORTED_NET_ASSETS"], true), thresholds: [t("LT", 0, "FACTUAL_SIGN")] }, n => n < 0 ? { severity: "CRITICAL", reason: "REPORTED_NET_ASSETS_NEGATIVE", threshold: t("LT", 0, "FACTUAL_SIGN") } : null),
  rule({ ...spec("NET-ASSETS-PROXY-NEGATIVE", ["FIN_NET_ASSETS_PROXY"], true), thresholds: [t("LT", 0, "PROXY_SIGN")] }, d => {
    const reported = get(d, "FIN_REPORTED_NET_ASSETS"), proxy = get(d, "FIN_NET_ASSETS_PROXY");
    if (usable(reported)) return result("NOT_APPLICABLE", [reported, proxy], ["REPORTED_NET_ASSETS_AVAILABLE"]);
    if (!usable(proxy) || proxy.origin !== "PROXY" || typeof proxy.value !== "number") return missing([proxy]);
    return proxy.value < 0 ? { ...result("TRIGGERED", [proxy], ["NET_ASSETS_PROXY_NEGATIVE"]), severity: "HIGH", threshold: t("LT", 0, "PROXY_SIGN") } : result("NOT_TRIGGERED", [proxy]);
  }),
  numeric({ ...spec("CURRENT-LIQUIDITY", ["FIN_CURRENT_RATIO"]), thresholds: [t("LT", .8), t("LT", 1)] }, n => n < 1 ? { severity: n < .8 ? "HIGH" : "MEDIUM", reason: "CURRENT_LIQUIDITY_LOW", threshold: t("LT", n < .8 ? .8 : 1) } : null),
  rule({ ...spec("WORKING-CAPITAL", ["FIN_WORKING_CAPITAL"]), thresholds: [t("LT", 0), t("GTE", .2)] }, d => { const wc = get(d, "FIN_WORKING_CAPITAL"), assets = get(d, "FIN_CURRENT_ASSETS"); if (!usable(wc) || typeof wc.value !== "number") return missing([wc]);
    if (wc.value >= 0) return result("NOT_TRIGGERED", [wc]); const ratio = usable(assets) && typeof assets.value === "number" && assets.value > 0 ? Math.abs(wc.value) / assets.value : null;
    return { ...result("TRIGGERED", ratio == null ? [wc] : [wc, assets], [ratio != null && ratio >= .2 ? "WORKING_CAPITAL_DEFICIT_MATERIAL" : "WORKING_CAPITAL_NEGATIVE"]), severity: ratio != null && ratio >= .2 ? "HIGH" : "MEDIUM", actualValue: ratio != null && ratio >= .2 ? ratio : wc.value, unit: ratio != null && ratio >= .2 ? "RATIO" : "RUB", threshold: ratio != null && ratio >= .2 ? t("GTE", .2) : t("LT", 0) }; }),
  numeric({ ...spec("NET-LOSS-CURRENT", ["FIN_ANNUAL_NET_PROFIT"], true), thresholds: [t("LT", 0, "FACTUAL_SIGN")] }, n => n < 0 ? { severity: "HIGH", reason: "NET_LOSS_CURRENT", threshold: t("LT", 0, "FACTUAL_SIGN") } : null),
  numeric({ ...spec("NET-LOSS-REPEATED", ["FIN_CONSECUTIVE_ANNUAL_LOSSES"], true), thresholds: [t("GTE", 2, "CONSECUTIVE_COMPARABLE_ANNUAL_LOSSES")] }, n => n >= 2 ? { severity: "CRITICAL", reason: "NET_LOSS_REPEATED", threshold: t("GTE", 2, "CONSECUTIVE_COMPARABLE_ANNUAL_LOSSES") } : null),
  numeric({ ...spec("REVENUE-DECLINE", ["FIN_ANNUAL_REVENUE_CHANGE"]), thresholds: [t("LTE", -25), t("LTE", -10)] }, n => n <= -10 ? { severity: n <= -25 ? "HIGH" : "MEDIUM", reason: n <= -25 ? "REVENUE_DECLINE_HIGH" : "REVENUE_DECLINE_MEDIUM", threshold: t("LTE", n <= -25 ? -25 : -10) } : null),
  numeric({ ...spec("INTEREST-COVERAGE", ["FIN_INTEREST_COVERAGE"]), thresholds: [t("LT", 1), t("LT", 1.5)] }, n => n < 1.5 ? { severity: n < 1 ? "HIGH" : "MEDIUM", reason: "INTEREST_COVERAGE_LOW", threshold: t("LT", n < 1 ? 1 : 1.5) } : null),
];
