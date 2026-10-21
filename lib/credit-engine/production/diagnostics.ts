import {randomUUID} from 'node:crypto';
import {validDate} from '../credit-portfolio/common.ts';
export const DIAGNOSTIC_VERSION = 'PRESCORE-CANONICAL-DIAGNOSTICS-1.0.2';
// Exact matches only. Never publish a thrown message, even a validator's dynamic suffix.
const capacityReasons = ['BANK_VERSION_OR_SHAPE','BANK_PERIOD_ORDER','MONTH_SHAPE','FUTURE_BANK_MONTH','MONTH_OUTSIDE_BANK_PERIOD','FULL_MONTH_OUTSIDE_BANK_PERIOD','NEGATIVE_OR_MISSING_MONTH_AMOUNT','BANK_MONTH_COUNTS','BANK_METRIC_STATE','BANK_METRIC_CONCEPT','CANONICAL_AVERAGE_MONTH_LINEAGE','BANK_QUALITY','FUTURE_OR_INVALID_AVAILABILITY','PORTFOLIO_IDENTITY'] as const;
const inputReasons = ['FINANCIAL_COMPANY_MISMATCH','DUPLICATE_FINANCIAL_SNAPSHOT','DUPLICATE_ID_CONFLICT','INVALID_RISK_SUBJECT_OR_DATE','INVALID_RISK_FACT','RISK_FACT_ID_CONFLICT','CONTEXT_RISK_INPUT_UNAVAILABLE','CONTEXT_INPUT_MISMATCH'] as const;
export function safeReason(error: unknown): string {
 const message = error instanceof Error ? error.message : '';
 for (const code of capacityReasons) if (message === 'DEBT_CAPACITY_INPUT_INVALID:' + code) return code;
 for (const code of inputReasons) if (message === code) return code;
 return 'UNEXPECTED_FAILURE';
}
const stages = ['ENTITLEMENT_READ','BASIC_PROJECTION','PUBLIC_MODEL','SOURCES','SOURCE_DATES','BANK_METRICS_REQUIRED','SAVED_IDENTITY','SAVED_INPUT','PROFILE_READ','FINANCIAL_ANALYSIS','CREDIT_PORTFOLIO','RECONCILIATION','RISK','CONTEXT','INDEX','READINESS','ASSESSMENT','CAPACITY','PRODUCTS','RECOMMENDATIONS','ACTION_PLAN','EXPLAINABILITY','CLIENT_REPORT'];
const reasons = ['INVALID_SAVED_SHAPE','UNEXPECTED_FAILURE','INVALID_SOURCE_DATES','SOURCE_IDENTITY_MISMATCH','BANK_METRICS_MISSING','SAVED_IDENTITY_MISMATCH','INVALID_SAVED_JSON',...capacityReasons,...inputReasons];
export function diagnostic(stage: string, reason: string) {
 const code = reasons.includes(reason) ? reason : 'UNEXPECTED_FAILURE';
 return {id: randomUUID(), version: DIAGNOSTIC_VERSION, stage: stages.includes(stage) ? stage : 'SAVED_INPUT', reason: code,
  category: code === 'UNEXPECTED_FAILURE' ? 'PROGRAMMING_OR_RUNTIME_ERROR' : code === 'BANK_METRICS_MISSING' ? 'MISSING_REQUIRED_INPUT' : 'INCOMPATIBLE_INPUT'};
}
export type CanonicalDiagnosticV1 = ReturnType<typeof diagnostic>;
type RecordValue = Record<string, unknown>;
const record = (v: unknown): RecordValue => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as RecordValue : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const date = (v: unknown) => typeof v === 'string' && validDate(v.slice(0,10)) ? v.slice(0,10) : null;
const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
const source = (v: unknown) => {const s=record(v); return {present: v != null, sourceType: ['BANK_STATEMENT','BFO','QUARTERLY','BKI','CHECKO','EIS','OTHER'].includes(String(s.sourceType)) ? s.sourceType : 'UNKNOWN', status: ['NOT_REQUESTED','PROCESSING','READY','EMPTY','FAILED','STALE'].includes(String(s.status)) ? s.status : 'UNKNOWN', from: date(s.periodFrom), to: date(s.periodTo)};};
// Only structural facts; no amounts, filenames, source identifiers, documents or arbitrary text.
export function inputSummary(value: unknown, profile: unknown) {
 const a=record(value), p=record(profile), m=record(a.metricsV2), period=record(m.period), manifest=record(a.sourceManifest), pm=record(p.sourceManifest);
 const monthly=array(m.monthly).map(record);
 return {profilePresent: profile != null, metricsPresent: a.metricsV2 != null,
  metricsVersionSupported: m.version === 'PRESCORE-BANK-METRICS-2.0.0-SHADOW',
  analysisPeriod: {from:date(a.periodFrom),to:date(a.periodTo)}, metricsPeriod:{from:date(period.from),to:date(period.to)},
  coverage: Object.fromEntries(['FULL','PARTIAL','MISSING','OVERLAP'].map(k=>[k,monthly.filter(r=>r.coverage===k).length])),
  declaredCoverage: {full:count(period.fullMonths),partial:count(period.partialMonths),missing:count(period.missingMonths),overlap:count(period.overlapMonths)},
  months: monthly.slice(0,120).map(r=>({month:typeof r.month==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)?r.month:null,coverage:['FULL','PARTIAL','MISSING','OVERLAP'].includes(String(r.coverage))?r.coverage:'INVALID'})),
  bankSources: array(manifest.bankStatements).slice(0,40).map(source), bfo:source(manifest.bfo), profileBfo:source(pm.bfo), quarterly:source(manifest.quarterly), bki:source(manifest.bki),
  creditHistoryPresent:a.creditHistory!=null, financialSnapshots:array(a.financialStatementsV2).length, profileFinancialSnapshots:array(p.financialStatementsV2).length,
  financialHistory:array(record(a.financialAnalysisV2).history).length, profileFinancialHistory:array(record(p.financialAnalysisV2).history).length,
  analysisExternalSources:array(manifest.external).slice(0,40).map(source), profileExternalSources:array(pm.external).slice(0,40).map(source),
  originalTransactionCount:count(a.originalTransactionCount), displayTransactions:array(a.transactions).length, displayTransactionsTruncated:a.transactionsTruncated===true};
}

export function diagnosticMessage(reason: string): string | null {
 if (reason === 'MONTH_OUTSIDE_BANK_PERIOD') return 'В сохранённых банковских метриках есть календарный месяц за пределами их периода. Для восстановления нужен полный исходник выписки; изменение одной даты не исправит ранее рассчитанные показатели.';
 if (reason === 'FULL_MONTH_OUTSIDE_BANK_PERIOD') return 'Месяц отмечен как полный, но сохранённый период метрик покрывает его не целиком. Требуется восстановление метрик из полного исходника.';
 return null;
}
