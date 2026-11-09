import { withinReportingTolerance } from '../credit-engine/financial-analysis/integrity.ts';
import { BALANCE_CODES, INCOME_CODES } from '../credit-engine/contracts/financial-statements.ts';
import { financialMetadata, columnPeriod } from './financial-metadata.ts';
import type { PdfCell } from './financial-layout.ts';
import { capture, field, issue, numeric, plain, type Input, type Line } from './fields.ts';
// Additional printed RAS line codes supported only by the extraction contract.
const codes = new Set<string>([...Object.values(BALANCE_CODES), ...Object.values(INCOME_CODES), '1120', '1130', '1140', '1160', '1170', '1180', '1190', '1220', '1310', '1320', '1340', '1350', '1360', '1420', '1430', '1450', '1530', '1540', '2310', '2411', '2412', '2421', '2430', '2450', '2460', '2500', '2510', '2520', '2530']);
function cell(input: Input, line: Line, c: PdfCell | undefined) {
  if (!c || !c.uncertain && (!c.raw.trim() || /^[-—–]$/.test(c.raw.trim()) || /^\(\s*[-—–]?\s*\)$/.test(c.raw.trim()))) return {
    ...field<number>(input.id),
    source_page: line.page,
    source_text: line.text.slice(0, 220)
  };
  const n = c.uncertain ? null : numeric(c.raw.replace(/−/g, '-'));
  if (n === null) issue(input, 'REVIEW', 'UNREADABLE_NUMBER', line.page);
  const confidence = n === null ? 'LOW' : line.confidence === 'HIGH' && (!line.pdf || c.assembled || /^\d$/.test(c.raw)) ? 'MEDIUM' : line.confidence;
  return field(input.id, {
    ...line,
    confidence
  }, n);
}
export function financialStatement(input: Input) {
  const metadata = financialMetadata(input),
    {
      unit,
      reporting_date: asOf
    } = metadata;
  const company = capture(input, /^(?:организация|наименование организации|компания|company)\s*[:|]\s*(.+)$/i, plain);
  const inn = capture(input, /ИНН\s*[:|]?\s*(\d+)\b/iu, s => /^\d{10}$|^\d{12}$/.test(s) ? s : null);
  const entries = [...(input.financialTables ?? [])];
  // A transcript must delimit actual cells. Whitespace alone cannot prove column identity.
  for (const line of input.lines) {
    const delimiter = line.text.includes('|') ? '|' : line.text.includes('\t') ? '\t' : null;
    if (!delimiter) {
      if (!line.pdf && /(?:^|\s)[12]\d{3}(?:\s|$)/.test(line.text) && /\s{2,}\d/.test(line.text)) issue(input, 'REVIEW', 'UNBOUND_ROW_COLUMNS', line.page);
      continue;
    }
    const cols = line.text.split(delimiter).map(s => s.trim());
    const idx = cols.findIndex(s => /^[12]\d{3}$/.test(s));
    if (idx < 0 || idx > 2 || idx === cols.length - 1) continue;
    const heading=cols.slice(0,idx).some(s=>/^(?:код(?: строки)?|line code|страница|номер формы|page|form number)$/i.test(s));
    if (heading || /^20[0-9]{2}$/.test(cols[idx])) continue;
    const values = cols.slice(idx + 1);
    entries.push({
      line,
      code: cols[idx],
      headings: [],
      cells: values.map(raw => ({
        raw,
        uncertain: values.length < 2 || values.length > 3,
        assembled: false
      }))
    });
  }
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const rows = entries.flatMap(({
    line,
    code,
    cells,
    headings
  }) => {
    // Per-share supplementary disclosures do not have the form's monetary scale.
    if (['2900', '2910'].includes(code)) return [];
    if (!codes.has(code)) issue(input, 'INVALID', 'UNKNOWN_LINE_CODE', line.page);
    if (seen.has(code)) {
      duplicates.add(code);
      issue(input, 'INVALID', 'DUPLICATE_LINE', line.page);
    }
    seen.add(code);
    const periodFields = headings.slice(0, 2).map(heading => {
      const span = columnPeriod(heading, asOf.value);
      return {
        source: {
          ...line,
          text: heading
        },
        span
      };
    });
    const current = periodFields[0],
      previous = periodFields[1];
    const period = current ? field(input.id, current.source, current.span?.end) : asOf;
    const prior = previous ? field(input.id, previous.source, previous.span?.end) : metadata.previous_period;
    if (period.value && asOf.value && period.value !== asOf.value) issue(input, 'INVALID', 'REPORTING_PERIOD_CONFLICT', line.page);
    if (prior.value && period.value && prior.value >= period.value) issue(input, 'INVALID', 'PERIOD_ORDER', line.page);
    if (!period.value) issue(input, 'REVIEW', 'ROW_PERIOD_MISSING', line.page);
    const disordered = prior.value && period.value && prior.value >= period.value;
    const mismatched = period.value && asOf.value && period.value !== asOf.value;
    const metadataConflict = asOf.status === 'REVIEW' || unit.status === 'REVIEW';
    const trustedLine = metadataConflict || headings.length && (!period.value || disordered || mismatched) || !codes.has(code) ? {
      ...line,
      confidence: 'LOW' as const
    } : line;
    const amount = cell(input, trustedLine, cells[0]),
      comparative = cell(input, headings.length && !prior.value ? {
        ...trustedLine,
        confidence: 'LOW'
      } : trustedLine, cells[1]);
    if (comparative.value !== null && !prior.value) issue(input, 'REVIEW', 'COMPARATIVE_DATE_MISSING', line.page);
    const unresolved = amount.status === 'REVIEW' || comparative.status === 'REVIEW' || !period.value || !unit.value || comparative.value !== null && !prior.value;
    const confidence = unresolved ? 'LOW' : amount.value === null ? comparative.confidence : amount.confidence;
    return [{
      line_code: field(input.id, line, code),
      current_period_value: amount,
      previous_period_value: comparative,
      raw_current: cells[0]?.source ?? cells[0]?.raw ?? null,
      raw_previous: cells[1]?.source ?? cells[1]?.raw ?? null,
      period,
      previous_period: prior,
      period_start: current ? current.span?.start ? field(input.id, current.source, current.span.start) : field<string>(input.id) : metadata.period_start,
      previous_period_start: previous?.span?.start ? field(input.id, previous.source, previous.span.start) : field<string>(input.id),
      unit,
      source_page: line.page,
      confidence,
      status: unresolved ? 'REVIEW' : amount.value === null && comparative.value === null ? 'MISSING' : 'READ',
      document_id: input.id,
      extractor_version: amount.extractor_version
    }];
  });
  for (const row of rows) {
    if (duplicates.has(row.line_code.value ?? '')) {
      for (const value of [row.current_period_value, row.previous_period_value]) {
        value.value = null;
        value.status = 'REVIEW';
        value.confidence = 'LOW';
      }
      row.status = 'REVIEW';
      row.confidence = 'LOW';
    }
  }
  if (!rows.length || !rows.some(r => r.current_period_value.value !== null)) issue(input, 'REVIEW', 'NO_FINANCIAL_ROWS');
  if (metadata.forms.some(f => f.value === 'Бухгалтерский баланс') && ['1600', '1700'].some(code => !rows.some(r => r.line_code.value === code && r.current_period_value.value !== null))) issue(input, 'REVIEW', 'BALANCE_TOTAL_MISSING');
  for (const col of ['current_period_value', 'previous_period_value'] as const) {
    const get = (code: string) => rows.find(r => r.line_code.value === code)?.[col].value;
    function reconcile(codes: string[], residual: (v: number[]) => number, issueCode: string) {
      const values = codes.map(get);
      if (!unit.value || !values.every((v): v is number => v != null)) return;
      if (!withinReportingTolerance(values, residual(values), 1)) issue(input, 'INVALID', issueCode);
    }
    reconcile(['1600', '1700'], ([a, b]) => a - b, 'BALANCE_RECONCILIATION_MISMATCH');
    reconcile(['1100', '1200', '1600'], ([a, b, t]) => a + b - t, 'BALANCE_RECONCILIATION_MISMATCH');
    reconcile(['1300', '1400', '1500', '1600'], ([a, b, c, t]) => a + b + c - t, 'BALANCE_RECONCILIATION_MISMATCH');
    reconcile(['2110', '2120', '2100'], ([r, c, g]) => r - Math.abs(c) - g, 'INCOME_STATEMENT_RECONCILIATION_MISMATCH');
  }
  return {
    type: 'FinancialStatementExtractionV1' as const,
    metadata: {
      ...metadata,
      company,
      inn
    },
    rows
  };
}
export type FinancialStatementExtractionV1 = ReturnType<typeof financialStatement>;
