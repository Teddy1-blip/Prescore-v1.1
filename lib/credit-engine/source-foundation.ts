import { parseCreditHistoryText, type CreditHistoryReport, type CreditSubjectRelationship } from "../credit-history.ts";
import type { AnalysisResult, NormalizedTransaction } from "../prescore";
import { parseQuarterlyReportText, type QuarterlyFinancialReport } from "../quarterly-report.ts";
import {
  INFRASTRUCTURE_VERSIONS,
  type AnalysisIntegritySummary,
  type AnalysisSourceManifest,
  type DataIntegritySummary,
  type KnownValue,
  type MonthCoverage,
  type SourceEnvelope,
} from "./contracts/sources.ts";

export * from "./contracts/sources.ts";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const normalizedInn = (value?: string | null) => (value ?? "").replace(/\D/g, "");

export function knownValue<T>(value: T): KnownValue<T> {
  return { status: "KNOWN", value };
}

export function unknownValue<T>(): KnownValue<T> {
  return { status: "UNKNOWN", value: null };
}

export async function sha256Hex(input: string | ArrayBuffer | Uint8Array) {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : input instanceof Uint8Array
      ? input
      : new Uint8Array(input);
  const stableBytes = new Uint8Array(bytes.byteLength);
  stableBytes.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", stableBytes.buffer);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function validIsoDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)));
}

function monthStart(month: string) {
  return new Date(`${month}-01T00:00:00Z`);
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(month: string) {
  const start = monthStart(month);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
}

function nextMonth(month: string) {
  const date = monthStart(month);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 7);
}

function sourceCalendarCoverage(
  sources: Array<Pick<SourceEnvelope, "sourceId" | "periodFrom" | "periodTo">>,
): MonthCoverage[] {
  const valid = sources.filter((item) => validIsoDate(item.periodFrom) && validIsoDate(item.periodTo) && item.periodFrom! <= item.periodTo!);
  if (!valid.length) return [];
  const firstMonth = valid.map((item) => item.periodFrom!.slice(0, 7)).sort()[0];
  const lastMonth = valid.map((item) => item.periodTo!.slice(0, 7)).sort().at(-1)!;
  const result: MonthCoverage[] = [];

  for (let month = firstMonth; month <= lastMonth; month = nextMonth(month)) {
    const calendarDays = daysInMonth(month);
    const start = `${month}-01`;
    const end = `${month}-${String(calendarDays).padStart(2, "0")}`;
    const daySources = new Map<string, Set<string>>();
    for (const source of valid) {
      const from = source.periodFrom! > start ? source.periodFrom! : start;
      const to = source.periodTo! < end ? source.periodTo! : end;
      if (from > to) continue;
      const cursor = new Date(`${from}T00:00:00Z`);
      const finish = new Date(`${to}T00:00:00Z`);
      while (cursor <= finish) {
        const day = iso(cursor);
        const refs = daySources.get(day) ?? new Set<string>();
        refs.add(source.sourceId);
        daySources.set(day, refs);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    const sourceIds = [...new Set([...daySources.values()].flatMap((set) => [...set]))];
    const hasOverlap = [...daySources.values()].some((set) => set.size > 1);
    const daysCovered = daySources.size;
    const status = hasOverlap ? "OVERLAP" : daysCovered === 0 ? "MISSING" : daysCovered === calendarDays ? "FULL" : "PARTIAL";
    const warnings = status === "OVERLAP"
      ? ["Периоды нескольких файлов перекрываются; операции должны пройти дедупликацию."]
      : status === "MISSING"
        ? ["За календарный месяц не получено ни одного банковского источника."]
        : status === "PARTIAL"
          ? ["Календарный месяц покрыт не полностью."]
          : [];
    const coveredDays = [...daySources.keys()].sort();
    result.push({
      month,
      status,
      daysCovered,
      calendarDays,
      sourceIds,
      from: coveredDays[0],
      to: coveredDays.at(-1),
      warnings,
    });
  }
  return result;
}

// Company FULL requires all supplied accounts, not merely any account, on every day.
// Same-account overlaps remain unresolved; distinct accounts are not duplicate sources.
export function analyzeCalendarCoverage(sources: Array<Pick<SourceEnvelope, "sourceId" | "periodFrom" | "periodTo" | "accountCoverage">>): MonthCoverage[] {
  if (!sources.length || sources.some(s => !s.accountCoverage?.length)) return sourceCalendarCoverage(sources);
  const accounts = new Map<string, Array<Pick<SourceEnvelope, "sourceId" | "periodFrom" | "periodTo">>>();
  for (const s of sources) for (const a of s.accountCoverage!) {
    const rows = accounts.get(a.account) ?? [];
    rows.push({sourceId:s.sourceId, periodFrom:a.periodFrom, periodTo:a.periodTo}); accounts.set(a.account, rows);
  }
  const window = sourceCalendarCoverage(sources);
  const calendars = [...accounts.values()].map(rows => new Map(sourceCalendarCoverage(rows).map(m => [m.month,m])));
  return window.map(m => {
    const rows = calendars.map(c => c.get(m.month));
    const commonDays = Array.from({length:m.calendarDays},(_,i)=>`${m.month}-${String(i+1).padStart(2,'0')}`).filter(day=>[...accounts.values()].every(sources=>sources.some(s=>s.periodFrom&&s.periodTo&&s.periodFrom<=day&&day<=s.periodTo))).length;
    const status = rows.some(r => r?.status === 'OVERLAP') ? 'OVERLAP' : rows.every(r => r?.status === 'FULL') ? 'FULL' : rows.every(r => !r || r.status === 'MISSING') ? 'MISSING' : 'PARTIAL';
    return {...m, status, daysCovered: commonDays, warnings: [...(accounts.size>1 && rows.some(r=>!r||r.status==='MISSING') && rows.some(r=>r&&r.status!=='MISSING') ? ['UNOBSERVED_ACCOUNT_PERIOD'] : []), ...(status === 'FULL' ? [] : status === 'OVERLAP' ? ['Перекрытие выгрузок одного счёта; требуется проверка.'] : ['Покрытие одного или нескольких представленных счетов неполное.'])]};
  });
}

export function buildDataIntegritySummary(
  transactions: NormalizedTransaction[],
  coverage: MonthCoverage[],
  sourceCount: number,
  sourceWarnings: string[] = [],
  sourceConfidences: Array<number | null> = [],
): DataIntegritySummary {
  const fieldKnownCounts = transactions.reduce((counts, item) => ({
    direction: counts.direction + Number(item.direction !== "unknown"),
    counterparty: counts.counterparty + Number(Boolean(item.counterparty && item.counterparty !== "Контрагент не указан")),
    counterpartyInn: counts.counterpartyInn + Number(Boolean(item.counterpartyInn)),
    purpose: counts.purpose + Number(Boolean(item.purpose.trim())),
    account: counts.account + Number(Boolean(item.account)),
    source: counts.source + Number(Boolean(item.sourceId || item.sourceFileName)),
  }), { direction: 0, counterparty: 0, counterpartyInn: 0, purpose: 0, account: 0, source: 0 });
  const fieldCount = Object.keys(fieldKnownCounts).length;
  const knownFields = Object.values(fieldKnownCounts).reduce((sum, value) => sum + value, 0);
  const knownFieldsRate = transactions.length ? knownFields / (transactions.length * fieldCount) : null;
  const fieldKnownRates = Object.fromEntries(Object.entries(fieldKnownCounts).map(([field, count]) => [
    field,
    transactions.length ? Math.round(count / transactions.length * 10_000) / 10_000 : null,
  ])) as DataIntegritySummary["fieldKnownRates"];
  const measuredConfidences = sourceConfidences.filter((value): value is number => value !== null && Number.isFinite(value));
  const parserConfidence = measuredConfidences.length
    ? Math.round(measuredConfidences.reduce((sum, value) => sum + value, 0) / measuredConfidences.length)
    : null;
  const unknownClassificationRate = transactions.length
    ? transactions.filter((item) => item.category === "other" || item.direction === "unknown").length / transactions.length
    : null;
  const fullMonths = coverage.filter((item) => item.status === "FULL").length;
  const partialMonths = coverage.filter((item) => item.status === "PARTIAL").length;
  const missingMonths = coverage.filter((item) => item.status === "MISSING").length;
  const overlapMonths = coverage.filter((item) => item.status === "OVERLAP").length;
  const coveredDays = coverage.reduce((sum, item) => sum + item.daysCovered, 0);
  const calendarDays = coverage.reduce((sum, item) => sum + item.calendarDays, 0);
  const coverageRate = calendarDays ? coveredDays / calendarDays : null;
  const completeness = knownFieldsRate === null && coverageRate === null
    ? null
    : clamp((((knownFieldsRate ?? 0) * 0.65) + ((coverageRate ?? 0) * 0.35)) * 100);
  const confidence = completeness === null
    ? null
    : clamp(completeness * (1 - (unknownClassificationRate ?? 0) * 0.35));
  const warnings = [...sourceWarnings];
  if (partialMonths) warnings.push(`Неполных календарных месяцев: ${partialMonths}.`);
  if (missingMonths) warnings.push(`Полностью отсутствующих месяцев: ${missingMonths}.`);
  if (overlapMonths) warnings.push(`Месяцев с перекрытием источников: ${overlapMonths}.`);
  if (knownFieldsRate !== null && knownFieldsRate < 0.8) warnings.push("Часть обязательных полей операций не подтверждена исходными данными.");
  if (unknownClassificationRate !== null && unknownClassificationRate > 0.15) warnings.push("Высока доля операций с неизвестной классификацией или направлением.");
  return {
    confidence: confidence === null ? null : Math.round(confidence),
    completeness: completeness === null ? null : Math.round(completeness),
    fullMonths,
    partialMonths,
    missingMonths,
    overlapMonths,
    sourceCount,
    knownFieldsRate: knownFieldsRate === null ? null : Math.round(knownFieldsRate * 10_000) / 10_000,
    fieldKnownRates,
    parserConfidence,
    unknownClassificationRate: unknownClassificationRate === null ? null : Math.round(unknownClassificationRate * 10_000) / 10_000,
    warnings: [...new Set(warnings)],
  };
}

function allSources(manifest: AnalysisSourceManifest) {
  return [
    ...manifest.bankStatements,
    ...(manifest.bfo ? [manifest.bfo] : []),
    ...(manifest.quarterly ? [manifest.quarterly] : []),
    ...(manifest.bki ? [manifest.bki] : []),
    ...(manifest.external ?? []),
  ];
}

export function buildAnalysisIntegrity(
  manifest: AnalysisSourceManifest,
  transactions: NormalizedTransaction[],
  existingWarnings: string[] = [],
): AnalysisIntegritySummary {
  const coverage = analyzeCalendarCoverage(manifest.bankStatements);
  const sources = allSources(manifest);
  const dataQuality = buildDataIntegritySummary(
    transactions,
    coverage,
    manifest.bankStatements.length,
    sources.flatMap((item) => item.warnings),
    manifest.bankStatements.map((item) => item.confidence),
  );
  const missingSources = [
    ...(manifest.bankStatements.length ? [] : ["BANK_STATEMENT"]),
    ...(manifest.bfo ? [] : ["BFO"]),
    ...(manifest.quarterly ? [] : ["QUARTERLY"]),
    ...(manifest.bki ? [] : ["BKI"]),
  ];
  const failedSources = sources.filter((item) => item.status === "FAILED").map((item) => item.sourceId);
  const staleSources = sources.filter((item) => item.status === "STALE").map((item) => item.sourceId);
  const warnings = [...new Set([...existingWarnings, ...dataQuality.warnings])];
  return {
    confidence: dataQuality.confidence,
    completeness: dataQuality.completeness,
    missingSources,
    failedSources,
    staleSources,
    calendarCoverage: coverage,
    dataQuality,
    warnings,
    integrityVersion: INFRASTRUCTURE_VERSIONS.integrity,
  };
}

export function withRefreshedIntegrity<T extends AnalysisResult>(analysis: T): T {
  if (!analysis.sourceManifest) return analysis;
  return {
    ...analysis,
    integrity: buildAnalysisIntegrity(analysis.sourceManifest, analysis.transactions ?? [], analysis.integrity?.warnings ?? []),
    infrastructureVersions: analysis.infrastructureVersions ?? INFRASTRUCTURE_VERSIONS,
  };
}

export function structuredAttachmentIsUntrusted(input: unknown) {
  if (!input || typeof input !== "object") return false;
  const body = input as { type?: string; creditHistory?: unknown; quarterlyReport?: unknown };
  return (body.type === "credit-history" && Boolean(body.creditHistory))
    || (body.type === "quarterly-report" && Boolean(body.quarterlyReport));
}

export function parseAuthoritativeCreditHistoryText(input: {
  text: string;
  fileName: string;
  analysisInn: string;
  relationship: CreditSubjectRelationship;
}): CreditHistoryReport {
  const report = parseCreditHistoryText(input.text, input.fileName);
  const analysisInn = normalizedInn(input.analysisInn);
  const subjectInn = normalizedInn(report.subjectInn);
  if (report.subjectType === "Юридическое лицо" && subjectInn && subjectInn !== analysisInn) {
    throw new Error("ИНН корпоративного БКИ не совпадает с компанией");
  }
  if (report.subjectType === "Физическое лицо" && (!input.relationship || input.relationship === "Не указано")) {
    throw new Error("Укажите роль субъекта БКИ");
  }
  const relationshipToCompany = report.subjectType === "Юридическое лицо" ? "Компания-заёмщик" : input.relationship;
  const affectsCompanyDebt = report.subjectType === "Юридическое лицо"
    || (relationshipToCompany === "ИП-заёмщик" && analysisInn.length === 12 && subjectInn === analysisInn);
  return { ...report, relationshipToCompany, affectsCompanyDebt };
}

export function parseAuthoritativeQuarterlyText(input: {
  text: string;
  fileName: string;
  analysisInn: string;
}): QuarterlyFinancialReport {
  const report = parseQuarterlyReportText(input.text, input.fileName);
  const analysisInn = normalizedInn(input.analysisInn);
  const reportInn = normalizedInn(report.companyInn);
  if (reportInn && reportInn !== analysisInn) throw new Error("ИНН квартальной отчётности не совпадает с компанией");
  return report;
}

export function sourceReference(hash: string) {
  return hash ? `sha256:${hash}` : undefined;
}
