export const EXTRACTOR_VERSION = 'PRESCORE-DOCUMENT-EXTRACTION-0.2';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type Line = {
  text: string;
  confidence: Confidence;
  page: number;
  pdf?:boolean;
};
export type Field<T> = {
  value: T | null;
  status: 'READ' | 'MISSING' | 'REVIEW';
  confidence: Confidence | null;
  source_page: number | null;
  source_text: string | null;
  document_id: string;
  extractor_version: string;
};
export type Issue = {
  status: 'REVIEW' | 'INVALID';
  code: string;
  page?: number;
};
export type Input = {
  id: string;
  lines: Line[];
  issues: Issue[];
  financialTables?:import("./financial-layout.ts").PdfFinancialRow[];
};
export function field<T>(id: string, line?: Line, value?: T | null): Field<T> {
  const uncertain = line?.confidence === 'LOW' || value == null;
  return {
    value: uncertain ? null : value,
    status: !line ? 'MISSING' : uncertain ? 'REVIEW' : 'READ',
    confidence: line ? uncertain ? 'LOW' : line.confidence : null,
    source_page: line?.page ?? null,
    source_text: line?.text.slice(0, 220) ?? null,
    document_id: id,
    extractor_version: EXTRACTOR_VERSION
  };
}
export function capture<T>(input: Input, pattern: RegExp, parse: (s: string) => T | null): Field<T> {
  let found: Field<T> | undefined;
  for (const line of input.lines) {
    const match = line.text.match(pattern);
    if (!match) continue;
    const next = field(input.id, line, parse(match[1].trim()));
    if (found && next.value !== found.value) {
      input.issues.push({
        status: 'REVIEW',
        code: 'CONFLICTING_FIELD',
        page: line.page
      });
      return field(input.id, line);
    }
    found = next;
  }
  return found ?? field(input.id);
}
export const plain = (s: string) => s && !/[?�□]/.test(s) ? s : null;
export function numeric(s: string) {
  const v = s.trim();
  if (!/^(?:-?(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)?|\((?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)?\))$/.test(v)) return null;
  const n = Number(v.replace(/[ \u00a0\u202f]/g, '').replace(',', '.').replace(/^\((.*)\)$/, '-$1'));
  return Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER ? n : null;
}
export function date(s: string) {
  const iso = s.trim().replace(/^(\d\d)\.(\d\d)\.(\d{4})$/, '$3-$2-$1');
  if (!/^\d{4}-\d\d-\d\d$/.test(iso) || !Number.isFinite(Date.parse(iso))) return null;
  return new Date(iso).toISOString().slice(0, 10) === iso ? iso : null;
}
export function issue(input: Input, status: Issue['status'], code: string, page?: number) {
  input.issues.push({
    status,
    code,
    ...(page ? {
      page
    } : {})
  });
}
export function validation(issues: Issue[]) {
  return issues.some(i => i.status === 'INVALID') ? 'INVALID' : issues.length ? 'REVIEW' : 'PASS';
}
