import { withinReportingTolerance } from '../credit-engine/financial-analysis/integrity.ts';
import { BALANCE_CODES, INCOME_CODES } from '../credit-engine/contracts/financial-statements.ts';
import { capture, date, field, issue, numeric, plain, type Field, type Input, type Line } from './fields.ts';
const codes = new Set<string>([...Object.values(BALANCE_CODES), ...Object.values(INCOME_CODES)]);
function unit(s: string) {
  if (/^(?:тыс\.?\s*(?:руб(?:лей|ля)?\.?|₽)|384)$/i.test(s)) return 'тыс. ₽';
  if (/^(?:млн\.?\s*(?:руб(?:лей|ля)?\.?|₽)|385)$/i.test(s)) return 'млн ₽';
  return /^(?:руб(?:лей|ля)?\.?|₽|383)$/i.test(s) ? '₽' : null;
}
function cell(input: Input, line: Line, s?: string) {
  if (s === undefined || !s.trim() || /^[-—–]$/.test(s.trim())) return field<number>(input.id);
  const n = numeric(s);
  if (n === null) issue(input, 'REVIEW', 'UNREADABLE_NUMBER', line.page);
  return field(input.id, line, n);
}
type FinancialRow = {
  line_code: Field<string>;
  current_period_value: Field<number>;
  previous_period_value: Field<number>;
  period: Field<string>;
  previous_period: Field<string>;
  unit: Field<string>;
};
export function financialStatement(input: Input) {
  const form = capture(input, /(бухгалтерский баланс|отч[её]т о финансовых результатах|balance sheet|income statement)/i, plain);
  const company = capture(input, /^(?:организация|наименование организации|компания|company)\s*[:|]\s*(.+)$/i, plain);
  const inn = capture(input, /ИНН\s*[:|]?\s*(\d+)\b/iu, s => /^\d{10}$|^\d{12}$/.test(s) ? s : null);
  const units = capture(input, /^(?:единица измерения|ед\.?\s*изм\.?|unit)\s*[:|]\s*(.+)$/i, unit);
  const asOf = capture(input, /^(?:отч[её]тная дата|на дату|reporting date|на)\s*[:|]?\s*([\d.-]+)\s*$/i, date);
  const period = capture(input, /^(?:отч[её]тный период|reporting period)\s*[:|]\s*(.+)$/i, plain);
  const prior = capture(input, /^(?:предыдущая дата|предыдущий период|previous date)\s*[:|]\s*(.+)$/i, date);
  const rows: FinancialRow[] = [],
    seen = new Set<string>();
  for (const line of input.lines) {
    // Require a column boundary before the row code. A blank current cell stays blank.
    const cols = line.text.includes('|') ? line.text.split('|') : line.text.split(/\t| {2,}/);
    const idx = cols.findIndex(col => /^\s*[12]\d{3}\s*$/.test(col));
    if (idx < 0 || idx >= cols.length - 1 || idx === 0 && /^20\d\d$/.test(cols[idx].trim())) continue;
    const code = cols[idx].trim();
    if (!codes.has(code)) issue(input, 'INVALID', 'UNKNOWN_LINE_CODE', line.page);
    if (seen.has(code)) issue(input, 'INVALID', 'DUPLICATE_LINE', line.page);
    seen.add(code);
    const ambiguous = !line.text.includes('|') && !line.text.includes('\t') && cols.length === idx + 2;
    if (ambiguous) issue(input, 'REVIEW', 'AMBIGUOUS_PERIOD_COLUMN', line.page);
    rows.push({
      line_code: field(input.id, line, code),
      current_period_value: ambiguous ? field<number>(input.id, line) : cell(input, line, cols[idx + 1]),
      previous_period_value: cell(input, line, cols[idx + 2]),
      period: asOf,
      previous_period: prior,
      unit: units
    });
  }
  if (!rows.length) issue(input, 'REVIEW', 'NO_FINANCIAL_ROWS');
  if (!asOf.value) issue(input, 'REVIEW', 'REPORTING_DATE_MISSING');
  if (!units.value) issue(input, 'REVIEW', 'UNIT_UNKNOWN');
  if (rows.some(r => r.current_period_value.value === null)) issue(input, 'REVIEW', 'INCOMPLETE_CURRENT_VALUES');
  if (rows.some(r => r.previous_period_value.value !== null) && !prior.value) issue(input, 'REVIEW', 'COMPARATIVE_DATE_MISSING');
  if (prior.value && asOf.value && prior.value >= asOf.value) issue(input, 'INVALID', 'PERIOD_ORDER');
  if (period.value && /^\d{4}$/.test(period.value) && asOf.value && !asOf.value.startsWith(period.value)) issue(input, 'INVALID', 'REPORTING_PERIOD_CONFLICT');
  for (const col of ['current_period_value', 'previous_period_value'] as const) {
    const get = (code: string) => rows.find(r => r.line_code.value === code)?.[col].value;
    function reconcile(codes: string[], residual: (v: number[]) => number, issueCode: string) {
      const values = codes.map(get);
      if (!units.value || !values.every((v): v is number => v != null)) return;
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
      company,
      inn,
      form,
      reporting_date: asOf,
      reporting_period: period,
      unit: units
    },
    rows
  };
}
export type FinancialStatementExtractionV1 = ReturnType<typeof financialStatement>;
