import type { PortfolioValue, PortfolioConfidence, PortfolioEvidenceRef, PortfolioObservation } from "../contracts/credit-portfolio.ts";
export const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const validDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
export const dayGap = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
export const normalize = (s: string | null | undefined) => (s ?? "").normalize("NFKC").toLowerCase().replace(/[«»"']/g, "").replace(/\s+/g, " ").trim();
export function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`; return JSON.stringify(value) ?? "null"; }
// Stable non-secret identifiers, not cryptographic authentication tokens.
export function id(prefix: string, ...parts: unknown[]) { const text = stable(parts), states = [2166136261, 2246822519, 3266489917, 668265263]; for (let i = 0; i < text.length; i++) for (let j = 0; j < states.length; j++) states[j] = Math.imul(states[j] ^ (text.charCodeAt(i) + j), 16777619); return `${prefix}:${states.map(n => (n >>> 0).toString(16).padStart(8, "0")).join("")}`; }
const levels: PortfolioConfidence[] = ["UNKNOWN", "LOW", "MEDIUM", "HIGH"];
export const weakest = (...c: PortfolioConfidence[]): PortfolioConfidence => c.length ? levels[Math.min(...c.map(v => Math.max(0, levels.indexOf(v))))] : "UNKNOWN";
export const confidence = (v: number | null | undefined): PortfolioConfidence => !finite(v) ? "UNKNOWN" : v >= 85 ? "HIGH" : v >= 60 ? "MEDIUM" : "LOW";
export const adequate = (v: PortfolioConfidence) => v === "HIGH" || v === "MEDIUM";
export const unique = (v: string[]) => [...new Set(v)].sort();
export function dedupe<T>(items: T[], key: (v: T) => string): T[] { const map = new Map<string, T>(); for (const item of items) { const k = key(item); if (map.has(k) && stable(map.get(k)) !== stable(item)) throw Error("DUPLICATE_ID_CONFLICT"); map.set(k, item); } return [...map].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v); }
export const evidence = (refs: PortfolioEvidenceRef[]) => [...new Map(refs.map(e => [e.evidenceId, e])).values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
export function unknown<T>(warnings = ["SOURCE_FIELD_UNKNOWN", "MISSING_NOT_ZERO"]): PortfolioValue<T> { return { value: null, knowledge: "UNKNOWN", origin: "REPORTED", verification: "UNCONFIRMED", confidence: "UNKNOWN", observedAt: null, effectiveFrom: null, effectiveTo: null, evidence: [], warnings }; }
export function reported<T>(v: T | null, date: string | null, refs: PortfolioEvidenceRef[], c: PortfolioConfidence = "HIGH"): PortfolioValue<T> {
  if (v === null || v === undefined || (typeof v === "number" && !finite(v)) || v === "") return { ...unknown<T>(), evidence: refs, observedAt: date };
  return { value: v, knowledge: "KNOWN", origin: "REPORTED", verification: adequate(c) ? "CONFIRMED" : "UNCONFIRMED", confidence: c, observedAt: date, effectiveFrom: null, effectiveTo: null, evidence: refs, warnings: [] };
}
export const known = <T>(v: PortfolioValue<T>): v is PortfolioValue<T> & { value: T } => v.knowledge === "KNOWN" && v.value !== null && v.verification !== "CONFLICTED";
export function derived(v: number, deps: PortfolioValue<unknown>[], date: string, warnings: string[] = []): PortfolioValue<number> {
  const c = weakest(...deps.map(v => v.confidence));
  return { ...reported(finite(v) ? v : null, date, evidence(deps.flatMap(v => v.evidence)), c), origin: "DERIVED", verification: "UNCONFIRMED", warnings: unique([...warnings, ...(!finite(v) ? ["NON_FINITE_RESULT"] : [])]) };
}
// Resolve one field only. Observed dates and explicit effective dates are distinct.
export function resolveValue<T>(observations: PortfolioObservation[], asOf: string): PortfolioValue<T> {
  const eligible = observations.filter(o => validDate(o.observedAt) && o.observedAt <= asOf && (!o.effectiveFrom || (validDate(o.effectiveFrom) && o.effectiveFrom <= asOf)) && (!o.effectiveTo || (validDate(o.effectiveTo) && o.effectiveTo >= asOf)));
  if (!eligible.length) return unknown<T>();
  eligible.sort((a, b) => (a.effectiveFrom ?? a.observedAt!).localeCompare(b.effectiveFrom ?? b.observedAt!) || a.observedAt!.localeCompare(b.observedAt!) || a.observationId.localeCompare(b.observationId));
  const latest = eligible.at(-1)!;
  const current = eligible.filter(o => (o.effectiveFrom ?? o.observedAt) === (latest.effectiveFrom ?? latest.observedAt));
  const supported = current.filter(o => o.knowledge === "KNOWN" && o.value !== null && !(typeof o.value === "number" && !finite(o.value)));
  const high = supported.filter(o => adequate(o.confidence));
  const competing = high.length ? high : supported;
  const conflict = new Set(competing.map(o => stable(o.value))).size > 1;
  const selected = competing.at(-1) ?? latest;
  const refs = evidence(current.flatMap(o => o.evidence));
  if (conflict) return { ...unknown<T>(["DATA_CONFLICT"]), knowledge: "PARTIAL", verification: "CONFLICTED", observedAt: latest.observedAt, evidence: refs, confidence: weakest(...competing.map(o => o.confidence)) };
  const result = reported(selected.knowledge === "KNOWN" ? selected.value as T : null, selected.observedAt, refs, selected.confidence);
  return { ...result, effectiveFrom: selected.effectiveFrom, effectiveTo: selected.effectiveTo, warnings: unique([...result.warnings, ...current.flatMap(o => o.warnings)]) };
}
