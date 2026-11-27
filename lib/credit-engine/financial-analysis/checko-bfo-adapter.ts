import type { SourceEnvelope } from "../contracts/sources.ts";
import { annualPeriod } from "./periods.ts";
import { normalizeSnapshot, record } from "./normalizer.ts";

// Checko /finances documents RAS line amounts in RUB (scale 1).
// This provider contract belongs here; the generic normalizer remains strict.
export function adaptCheckoBfo(raw: unknown, source: SourceEnvelope, metadata?: { scale: number; currency: "RUB" }) {
  if (source.sourceType !== "BFO") throw new Error("BFO_SOURCE_REQUIRED");
  const response = record(raw), data = record(response.data), meta = record(response.meta);
  const inn = record(response.company)["ИНН"];
  if (inn != null && String(inn) !== source.companyInn) throw new Error("FINANCIAL_COMPANY_MISMATCH");
  const years = Object.keys(data).filter((key) => /^(19|20)\d{2}$/.test(key)).filter(key => Number(key) <= Number(source.receivedAt.slice(0, 4)) && Object.keys(record(data[key])).some(code => /^\d{4}$/.test(code))).sort();
  return years.map((year) => {
    const rows = record(data[year]);
    const yearMeta = record(rows.metadata);
    const explicit = (key: "currency" | "scale", fallback: unknown) => {
      for (const candidate of [yearMeta, meta, metadata ?? {}]) {
        if (Object.prototype.hasOwnProperty.call(candidate, key)) return record(candidate)[key];
      }
      return fallback;
    };
    const currency = explicit("currency", "RUB");
    const rawScale = explicit("scale", 1);
    const scale = currency === "RUB" && typeof rawScale === "number" ? rawScale : null;
    const snapshot = normalizeSnapshot({ source, period: annualPeriod(Number(year)), rawLines: Object.fromEntries(Object.entries(rows).map(([code, value]) => [code, value && typeof value === "object" ? record(value)["СумОтч"] : value])), scale, reportedNetAssets: rows["3600"] });
    if (Object.prototype.hasOwnProperty.call(rows, "3600")) snapshot.reportedNetAssets.rawCode = "3600";
    else delete snapshot.reportedNetAssets.rawCode;
    return snapshot;
  });
}
