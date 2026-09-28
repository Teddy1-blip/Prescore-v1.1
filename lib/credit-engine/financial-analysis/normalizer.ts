import { BALANCE_CODES, INCOME_CODES, FS_NORMALIZATION_VERSION, type FinancialConfidence, type FinancialPeriod, type FinancialStatementSnapshot, type FinancialStatementValue } from "../contracts/financial-statements.ts";
import type { SourceEnvelope } from "../contracts/sources.ts";

export const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function nullableFinancialNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const token = raw.trim().replace(/[\s\u00a0]/g, "");
  if (!/^(?:-?\d+(?:[.,]\d+)?|\(\d+(?:[.,]\d+)?\))$/.test(token)) return null;
  const value = Number(token.replace(/[()]/g, "").replace(",", "."));
  return Number.isFinite(value) ? (token.startsWith("(") ? -value : value) : null;
}
export function weakest(...levels: FinancialConfidence[]): FinancialConfidence {
  const order: FinancialConfidence[] = ["UNKNOWN", "LOW", "MEDIUM", "HIGH"];
  return order[Math.min(...levels.map((level) => order.indexOf(level)))];
}
export function sourceConfidence(source: SourceEnvelope): FinancialConfidence {
  if (!["READY", "STALE"].includes(source.status)) return "UNKNOWN";
  if (source.status === "STALE") return "LOW";
  if (source.confidence === null || !Number.isFinite(source.confidence)) return "UNKNOWN";
  return source.confidence >= 85 ? "HIGH" : source.confidence >= 60 ? "MEDIUM" : "LOW";
}
const expenses = new Set(["2120", "2210", "2220", "2330", "2350", "2410"]);
export function normalizeSnapshot(input: {
  source: SourceEnvelope; period: FinancialPeriod; rawLines: Record<string, unknown>;
  scale: number | null; reportedNetAssets?: unknown; accountingStandard?: "RAS" | "UNKNOWN"; parserConfidence?: number | null;
}): FinancialStatementSnapshot {
  const { source, period } = input;
  if (source.sourceType !== "BFO" && source.sourceType !== "QUARTERLY") throw new Error("FINANCIAL_SOURCE_REQUIRED");
  const parserConfidence = input.parserConfidence === undefined ? source.confidence : input.parserConfidence;
  const confidence = weakest(sourceConfidence(source), sourceConfidence({ ...source, confidence: parserConfidence }));
  const scale = [1, 1000, 1_000_000].includes(input.scale ?? 0) ? input.scale : null;
  const available = ["READY", "STALE"].includes(source.status);
  const warnings = [...(scale === null ? ["SCALE_UNCONFIRMED"] : []), ...(!available ? ["SOURCE_NOT_READY"] : []), ...(source.status === "STALE" ? ["SOURCE_STALE"] : [])];
  const value = (code: string, raw: unknown): FinancialStatementValue => {
    const parsed = nullableFinancialNumber(raw);
    const scaled = parsed === null || scale === null || !available ? null : parsed * scale;
    const result = scaled !== null && Number.isFinite(scaled) ? (expenses.has(code) ? Math.abs(scaled) : scaled) : null;
    return {
      value: result, rawValue: parsed, rawCode: code, status: result === null ? "UNKNOWN" : "KNOWN",
      confidence: result === null ? "UNKNOWN" : confidence, origin: "REPORTED",
      sourceId: source.sourceId, sourceType: source.sourceType as "BFO" | "QUARTERLY",
      warnings: [...warnings, ...(parsed === null ? ["SOURCE_FIELD_MISSING"] : []), ...(scaled !== null && !Number.isFinite(scaled) ? ["NON_FINITE_RESULT"] : []), ...(parsed !== null && parsed < 0 && expenses.has(code) ? ["EXPENSE_SIGN_NORMALIZED"] : [])],
    };
  };
  const balance = Object.fromEntries(Object.entries(BALANCE_CODES).map(([field, code]) => [field, value(code, input.rawLines[code])])) as FinancialStatementSnapshot["balance"];
  const income = Object.fromEntries(Object.entries(INCOME_CODES).map(([field, code]) => [field, value(code, input.rawLines[code])])) as FinancialStatementSnapshot["income"];
  const all = [...Object.values(balance), ...Object.values(income)];
  return {
    snapshotId: `${source.sourceId}:${period.from ?? "unknown"}:${period.to ?? period.asOf ?? "unknown"}:${period.flowPeriodType}`,
    version: FS_NORMALIZATION_VERSION, sourceId: source.sourceId, sourceType: source.sourceType as "BFO" | "QUARTERLY",
    source: { ...source }, companyInn: source.companyInn, accountingStandard: input.accountingStandard ?? "RAS",
    currency: "RUB", confirmedScale: scale, period: { ...period }, balance, income,
    reportedNetAssets: value("REPORTED_NET_ASSETS", input.reportedNetAssets),
    equityNetAssetsProxy: { ...balance.EQUITY, origin: "PROXY", warnings: [...balance.EQUITY.warnings, "EQUITY_IS_NOT_REPORTED_NET_ASSETS"] },
    quality: { parserConfidence, completeness: all.filter((v) => v.status === "KNOWN").length / all.length, warnings },
  };
}
