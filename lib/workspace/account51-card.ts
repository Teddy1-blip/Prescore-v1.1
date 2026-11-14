/** Read-only adapter for a structured 1C account 51 card. Not a bank statement. */
export type Account51Entry = {
  row: number;
  date: string;
  document: string;
  direction: 'INFLOW' | 'OUTFLOW';
  amount: number;
  correspondingAccount: string;
  analytic: string;
  balanceAfter: number | null;
};
export type Account51Card = {
  format: '1C_ACCOUNT51_CARD';
  periodFrom: string;
  periodTo: string;
  openingBalance: number | null;
  closingBalance: number | null;
  operations: Account51Entry[];
  warnings: string[];
  reconciled: boolean;
};

type Cell = string | number | boolean | null | undefined;
const value = (row: readonly Cell[], index: number) => String(row[index] ?? '').trim();
function decimal(v: Cell): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const text = String(v).replace(/[\u00a0\u202f\s]/g, '').replace(',', '.');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw Error('ACCOUNT51_BAD_AMOUNT');
  const n = Number(text);
  if (!Number.isFinite(n) || !Number.isSafeInteger(Math.round(n * 100))) throw Error('ACCOUNT51_BAD_AMOUNT');
  return n;
}
function date(text: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  const iso = m ? m[3] + '-' + m[2] + '-' + m[1] : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}
const is51 = (code: string) => /^51(?:\.\d+)*$/.test(code);
function signed(row: readonly Cell[], marker: number): number | null {
  const n = decimal(row[marker + 1]);
  if (n === null) return null;
  const side = value(row, marker).toUpperCase();
  if (side !== 'Д' && side !== 'К') throw Error('ACCOUNT51_BALANCE_SIDE_MISSING');
  if (n < 0) throw Error('ACCOUNT51_BALANCE_SIGN_CONFLICT');
  return side === 'К' ? -n : n;
}
function cents(n: number): number { return Math.round(n * 100); }

/**
 * Preserves each 1C accounting posting, even when its documentary description
 * contains newlines. Rows must be supplied as cells, never split on text newlines.
 * No mutation of canonical bank metrics or credit portfolio is performed here.
 */
export function parseAccount51Card(rows: readonly (readonly Cell[])[]): Account51Card {
  if (!rows.length || rows.length > 100_000) throw Error('ACCOUNT51_ROW_LIMIT');
  const title = rows.slice(0, 12).flatMap(row => row.map(c => String(c ?? '')))
    .find(text => /Карточка\s+сч[её]та\s+51\b/i.test(text));
  if (!title) throw Error('ACCOUNT51_HEADER_MISSING');
  const period = /за\s+(\d{2}\.\d{2}\.\d{4})\s*[-–—]\s*(\d{2}\.\d{2}\.\d{4})/i.exec(title);
  const periodFrom = period && date(period[1]), periodTo = period && date(period[2]);
  if (!periodFrom || !periodTo || periodTo < periodFrom) throw Error('ACCOUNT51_PERIOD_INVALID');
  const headerIndex = rows.findIndex(row =>
    /^Период$/i.test(value(row, 0)) && row.some(c => String(c ?? '').trim() === 'Дебет')
    && row.some(c => String(c ?? '').trim() === 'Кредит')
    && row.some(c => /Текущее\s+сальдо/i.test(String(c ?? ''))));
  if (headerIndex < 0 || headerIndex > 25) throw Error('ACCOUNT51_COLUMNS_MISSING');
  const header = rows[headerIndex];
  const debit = header.findIndex(c => String(c ?? '').trim() === 'Дебет');
  const credit = header.findIndex(c => String(c ?? '').trim() === 'Кредит');
  const balance = header.findIndex(c => /Текущее\s+сальдо/i.test(String(c ?? '')));
  if (!(0 < debit && debit + 1 < credit && credit + 1 < balance && balance + 1 <= 16))
    throw Error('ACCOUNT51_COLUMNS_INVALID');
  const warnings: string[] = [];
  const operations: Account51Entry[] = [];
  let openingBalance: number | null = null, closingBalance: number | null = null;
  let previous: number | null = null;
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(c => c == null || String(c).trim() === '')) continue;
    const first = value(row, 0);
    if (/^Сальдо\s+на\s+начало/i.test(first)) {
      if (openingBalance !== null || operations.length) throw Error('ACCOUNT51_OPENING_POSITION_INVALID');
      openingBalance = signed(row, balance);
      previous = openingBalance === null ? null : cents(openingBalance);
      continue;
    }
    if (/^Сальдо\s+на\s+конец/i.test(first)) {
      closingBalance = signed(row, balance);
      continue;
    }
    if (/^Оборот(?:ы)?\b|^Итого\b|^Всего\b/i.test(first)) continue;
    const occurred = date(first);
    if (!occurred) {
      if (/^(?:\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})$/.test(first)) throw Error('ACCOUNT51_BAD_DATE');
      if (i <= headerIndex + 2 && /^Сч[её]т$/i.test(value(row, debit))) continue;
      warnings.push('ACCOUNT51_UNRECOGNIZED_ROW:' + (i + 1));
      continue;
    }
    if (occurred < periodFrom || occurred > periodTo) throw Error('ACCOUNT51_DATE_OUTSIDE_PERIOD');
    const dr = value(row, debit), cr = value(row, credit);
    const isDr = is51(dr), isCr = is51(cr);
    if (isDr === isCr) throw Error('ACCOUNT51_AMBIGUOUS_POSTING');
    const direction = isDr ? 'INFLOW' : 'OUTFLOW';
    const amount = decimal(row[isDr ? debit + 1 : credit + 1]);
    if (amount === null || amount <= 0) throw Error('ACCOUNT51_AMOUNT_MISSING');
    if (decimal(row[isDr ? credit + 1 : debit + 1]) !== null)
      throw Error('ACCOUNT51_TWO_AMOUNT_COLUMNS');
    const balanceAfter = signed(row, balance);
    const current = balanceAfter === null ? null : cents(balanceAfter);
    if (previous !== null && current !== null) {
      const expected = previous + (isDr ? 1 : -1) * cents(amount);
      if (Math.abs(current - expected) > 1) warnings.push('ACCOUNT51_RUNNING_BALANCE_MISMATCH:' + (i + 1));
    }
    previous = current;
    operations.push({row:i + 1,date:occurred,document:value(row, 1),direction,amount,
      correspondingAccount:isDr ? cr : dr,analytic:value(row, isDr ? 3 : 2),balanceAfter});
  }
  if (!operations.length) throw Error('ACCOUNT51_NO_TRANSACTIONS');
  if (closingBalance !== null && previous !== null && cents(closingBalance) !== previous)
    warnings.push('ACCOUNT51_CLOSING_BALANCE_MISMATCH');
  if (openingBalance === null) warnings.push('ACCOUNT51_OPENING_BALANCE_MISSING');
  if (operations.some(entry => entry.balanceAfter === null)) warnings.push('ACCOUNT51_RUNNING_BALANCE_MISSING');
  return {format:'1C_ACCOUNT51_CARD',periodFrom,periodTo,openingBalance,closingBalance,
    operations,warnings,reconciled:warnings.length === 0};
}
