import {oneCPeriod} from './one-c-period.ts';
/** Read-only adapter for a structured 1C account 51 card. Not a bank statement. */
export type Account51Entry = {
  row: number;
  date: string;
  document: string;
  direction: 'INFLOW' | 'OUTFLOW' | 'INTERNAL_TRANSFER';
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
  // Some 1C exports show negative running debit balances. Keep the source sign
  // and flag it for reconciliation instead of discarding the entire card.
  return side === 'К' ? -Math.abs(n) : n;
}
function cents(n: number): number { return Math.round(n * 100); }

/**
 * Preserves each 1C accounting posting, even when its documentary description
 * contains newlines. Rows must be supplied as cells, never split on text newlines.
 * No mutation of canonical bank metrics or credit portfolio is performed here.
 */
export function parseAccount51Card(rows: readonly (readonly Cell[])[], sourceRows?: readonly number[]): Account51Card {
  if (!rows.length || rows.length > 100_000) throw Error('ACCOUNT51_ROW_LIMIT');
  // XLSX extraction skips empty physical rows. Keep source line evidence stable.
  if (sourceRows && (sourceRows.length !== rows.length ||
    sourceRows.some((value,index)=>!Number.isSafeInteger(value)||value<1||(index>0&&value<=sourceRows[index-1]))))
    throw Error('ACCOUNT51_SOURCE_ROWS_INVALID');
  const sourceRow=(index:number)=>sourceRows?.[index]??index+1;
  const title = rows.slice(0, 12).flatMap(row => row.map(c => String(c ?? '')))
    .find(text => /Карточка\s+сч[её]та\s+51\b/i.test(text));
  if (!title) throw Error('ACCOUNT51_HEADER_MISSING');
  const period=oneCPeriod(title);
  const periodFrom=period?.from,periodTo=period?.to;
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
  const analyticDr=header.findIndex(c=>/^Аналитика\s+Дт$/i.test(String(c??'').trim()));
  const analyticCr=header.findIndex(c=>/^Аналитика\s+Кт$/i.test(String(c??'').trim()));
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
      if (value(row, balance) === 'Д' && openingBalance !== null && openingBalance < 0)
        warnings.push('ACCOUNT51_NEGATIVE_DEBIT_BALANCE:' + (sourceRow(i)));
      previous = openingBalance === null ? null : cents(openingBalance);
      continue;
    }
    if (/^(?:Обороты\s+за\s+период\s+и\s+)?Сальдо\s+на\s+конец/i.test(first)) {
      closingBalance = signed(row, balance);
      if (value(row, balance) === 'Д' && closingBalance !== null && closingBalance < 0)
        warnings.push('ACCOUNT51_NEGATIVE_DEBIT_BALANCE:' + (sourceRow(i)));
      continue;
    }
    if (/^Оборот(?:ы)?\b|^Итого\b|^Всего\b/i.test(first)) continue;
    const occurred = date(first);
    if (!occurred) {
      if (/^(?:\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})$/.test(first)) throw Error('ACCOUNT51_BAD_DATE');
      if (i <= headerIndex + 2 && /^Сч[её]т$/i.test(value(row, debit))) continue;
      warnings.push('ACCOUNT51_UNRECOGNIZED_ROW:' + (sourceRow(i)));
      continue;
    }
    if (occurred < periodFrom || occurred > periodTo) throw Error('ACCOUNT51_DATE_OUTSIDE_PERIOD');
    const dr = value(row, debit), cr = value(row, credit);
    const isDr = is51(dr), isCr = is51(cr);
    if (!isDr && !isCr) throw Error('ACCOUNT51_AMBIGUOUS_POSTING');
    const drAmount = decimal(row[debit + 1]), crAmount = decimal(row[credit + 1]);
    // Dr 51 / Cr 51 is an internal transfer. Never count it as two external
    // cash movements, and reject an unbalanced transfer rather than netting it.
    if (isDr && isCr && (drAmount === null || crAmount === null ||
        cents(drAmount) !== cents(crAmount)))
      throw Error('ACCOUNT51_INTERNAL_TRANSFER_UNBALANCED');
    const direction = isDr && isCr ? 'INTERNAL_TRANSFER' : isDr ? 'INFLOW' : 'OUTFLOW';
    const amount = isDr ? drAmount : crAmount;
    if (amount === null || amount <= 0) throw Error('ACCOUNT51_AMOUNT_MISSING');
    if (!(isDr && isCr) && (isDr ? crAmount : drAmount) !== null)
      throw Error('ACCOUNT51_TWO_AMOUNT_COLUMNS');
    const balanceAfter = signed(row, balance);
    if (value(row, balance) === 'Д' && balanceAfter !== null && balanceAfter < 0)
      warnings.push('ACCOUNT51_NEGATIVE_DEBIT_BALANCE:' + (sourceRow(i)));
    const current = balanceAfter === null ? null : cents(balanceAfter);
    if (previous !== null && current !== null) {
      const expected = previous + (direction === 'INTERNAL_TRANSFER' ? 0 : isDr ? 1 : -1) * cents(amount);
      if (Math.abs(current - expected) > 1) warnings.push('ACCOUNT51_RUNNING_BALANCE_MISMATCH:' + (sourceRow(i)));
    }
    previous = current;
    operations.push({row:sourceRow(i),date:occurred,document:value(row, 1),direction,amount,
      correspondingAccount:isDr ? cr : dr,analytic:direction === 'INTERNAL_TRANSFER' ? [value(row,analyticDr>=0?analyticDr:2),value(row,analyticCr>=0?analyticCr:3)].join(' / ') : value(row,isDr?(analyticCr>=0?analyticCr:3):(analyticDr>=0?analyticDr:2)),balanceAfter});
  }
  if (!operations.length) throw Error('ACCOUNT51_NO_TRANSACTIONS');
  if (closingBalance !== null && previous !== null && cents(closingBalance) !== previous)
    warnings.push('ACCOUNT51_CLOSING_BALANCE_MISMATCH');
  // Reconciliation here describes the postings. The dossier separately requires a dated closing balance.
  if (openingBalance === null) warnings.push('ACCOUNT51_OPENING_BALANCE_MISSING');
  if (operations.some(entry => entry.balanceAfter === null)) warnings.push('ACCOUNT51_RUNNING_BALANCE_MISSING');
  return {format:'1C_ACCOUNT51_CARD',periodFrom,periodTo,openingBalance,closingBalance,
    operations,warnings,reconciled:warnings.length === 0};
}
