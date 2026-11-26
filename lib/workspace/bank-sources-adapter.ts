import type { BankStatementMetricsV2 } from '../credit-engine/contracts/metrics.ts';
import type { StatementInput } from '../prescore.ts';
import type { Account51Card, Account51Entry } from './account51-card.ts';
import type { BankXlsxBookPreview, BankXlsxOperation } from './bank-xlsx-intake.ts';
import type { Account51Summary } from './dossier-sources.ts';

export type StoredBankXlsxSheet = {
  name: string;
  account: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  operations: number;
  inMinor: number;
  outMinor: number;
  entries?: BankXlsxOperation[];
};

export type StoredAccount51Data = Account51Summary & {
  operations?: Account51Entry[];
};

export type Account51ReconciliationItem = {
  card: number | null;
  bank: number | null;
  diff: number | null;
};

export type Account51ReconciliationV1 = {
  version: 'PRESCORE-ACCOUNT51-RECONCILIATION-1.0';
  comparable: boolean;
  status: 'AGREES' | 'DIFFERS' | 'PERIOD_MISMATCH' | 'BANK_MISSING';
  period: {
    bankFrom: string | null;
    bankTo: string | null;
    cardFrom: string;
    cardTo: string;
  };
  inflow: Account51ReconciliationItem;
  outflow: Account51ReconciliationItem;
  closingBalance: Account51ReconciliationItem;
  warnings: string[];
};

export const BANK_XLSX_ADAPTER_WARNING = 'BANK_XLSX_ADAPTED_TO_CANONICAL_METRICS';
export const ACCOUNT_51_FALLBACK_WARNING = 'METRICS_DERIVED_FROM_ACCOUNT_51_FALLBACK';

function toRuDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.slice(0, 10));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function cleanLine(text: string | null | undefined, maxLen = 500): string {
  return String(text ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, maxLen);
}

function validCorporateRubleAccount(account: string | null | undefined): string | null {
  if (!account) return null;
  const digits = account.replace(/\D/g, '');
  if (!/^(?:40[5-8]|42[0-3])\d{17}$/.test(digits)) return null;
  if (digits.startsWith('40817')) return null;
  if (!['643', '810'].includes(digits.slice(5, 8))) return null;
  return digits;
}

function syntheticCorporateAccount(companyInn: string, suffix: string): string {
  const digits = companyInn.replace(/\D/g, '');
  const tail = (suffix + digits).replace(/\D/g, '').padEnd(12, '0').slice(0, 12);
  return `40702810${tail}`;
}

export function extractCounterpartyFromCell(raw: string | null | undefined, ownAccount: string): {
  name: string;
  inn: string;
  account: string;
} {
  const text = String(raw ?? '');
  if (!text.trim()) return { name: 'Контрагент не указан', inn: '', account: '' };
  const accounts = Array.from(text.matchAll(/\b((?:40[1-8]|42[0-3]|30[1-2])\d{17})\b/g), m => m[1])
    .filter(a => a !== ownAccount);
  const account = accounts[0] ?? '';
  const explicitInn = /ИНН\s*[:№]?\s*(\d{10,12})\b/iu.exec(text)?.[1] ?? '';
  let inn = explicitInn;
  if (!inn) {
    const strippedAcc = text.replace(/\b\d{20}\b/g, ' ');
    inn = /\b(\d{10}|\d{12})\b/.exec(strippedAcc)?.[1] ?? '';
  }
  const cleaned = cleanLine(
    text
      .replace(/\b\d{20}\b/g, ' ')
      .replace(/ИНН\s*[:№]?\s*\d{10,12}\b/giu, ' ')
      .replace(/КПП\s*[:№]?\s*\d{9}\b/giu, ' ')
      .replace(/БИК\s*[:№]?\s*\d{9}\b/giu, ' ')
      .replace(/р\/сч?\.?\s*[:№]?/giu, ' '),
    180,
  );
  return {
    name: cleaned || (inn ? `Контрагент ИНН ${inn}` : 'Контрагент не указан'),
    inn,
    account,
  };
}

function formatMoney(rubles: number): string {
  return (Math.round(rubles * 100) / 100).toFixed(2);
}

/**
 * Converts parsed SberBusiness XLSX workbook sheets into 1CClientBankExchange
 * StatementInput records so they run through the canonical analyzeBankStatements -> metricsV2 pipeline.
 */
export function bankXlsxToStatementInputs(input: {
  sheets: readonly StoredBankXlsxSheet[];
  companyInn: string;
  companyName: string;
  fileName: string;
  sourceId: string;
  contentHash?: string;
}): StatementInput[] {
  const results: StatementInput[] = [];
  const companyLabel = cleanLine(input.companyName, 160) || `Компания ИНН ${input.companyInn}`;

  for (const [sheetIndex, sheet] of input.sheets.entries()) {
    const ops = sheet.entries ?? [];
    if (!ops.length) continue;
    const dates = ops.map(o => o.postedAt).filter(Boolean).sort();
    const periodFrom = sheet.periodFrom ?? dates[0];
    const periodTo = sheet.periodTo ?? dates.at(-1);
    if (!periodFrom || !periodTo) continue;

    const ownAccount = validCorporateRubleAccount(sheet.account)
      ?? syntheticCorporateAccount(input.companyInn, String(sheetIndex + 1).padStart(2, '0'));
    const totalIn = ops.filter(o => o.direction === 'IN').reduce((s, o) => s + o.amountMinor, 0) / 100;
    const totalOut = ops.filter(o => o.direction === 'OUT').reduce((s, o) => s + o.amountMinor, 0) / 100;

    const lines: string[] = [
      '1CClientBankExchange',
      'ВерсияФормата=1.03',
      'Кодировка=UTF-8',
      'Отправитель=СберБизнес (XLSX)',
      `ДатаНачала=${toRuDate(periodFrom)}`,
      `ДатаКонца=${toRuDate(periodTo)}`,
      `РасчСчет=${ownAccount}`,
      'СекцияРасчСчет',
      `ДатаНачала=${toRuDate(periodFrom)}`,
      `ДатаКонца=${toRuDate(periodTo)}`,
      `РасчСчет=${ownAccount}`,
      `ВсегоПоступило=${formatMoney(totalIn)}`,
      `ВсегоСписано=${formatMoney(totalOut)}`,
      'КонецРасчСчет',
    ];

    for (const [opIndex, op] of ops.entries()) {
      const ruDate = toRuDate(op.postedAt);
      const amount = formatMoney(op.amountMinor / 100);
      const docNum = cleanLine(op.documentNumber || `${sheetIndex + 1}-${opIndex + 1}`, 40);
      const purpose = cleanLine(op.purpose, 500) || 'Операция по выписке СберБизнес XLSX';
      const counterpartyCell = op.direction === 'IN' ? op.debitAccountText : op.creditAccountText;
      const party = extractCounterpartyFromCell(counterpartyCell, ownAccount);

      lines.push('СекцияДокумент=Платежное поручение');
      lines.push(`Номер=${docNum}`);
      lines.push(`Дата=${ruDate}`);
      lines.push(`Сумма=${amount}`);
      if (op.direction === 'IN') {
        lines.push(`ДатаПоступило=${ruDate}`);
        lines.push(`ПлательщикСчет=${party.account}`);
        lines.push(`ПлательщикИНН=${party.inn}`);
        lines.push(`Плательщик=${party.name}`);
        lines.push(`ПолучательСчет=${ownAccount}`);
        lines.push(`ПолучательИНН=${input.companyInn}`);
        lines.push(`Получатель=${companyLabel}`);
      } else {
        lines.push(`ДатаСписано=${ruDate}`);
        lines.push(`ПлательщикСчет=${ownAccount}`);
        lines.push(`ПлательщикИНН=${input.companyInn}`);
        lines.push(`Плательщик=${companyLabel}`);
        lines.push(`ПолучательСчет=${party.account}`);
        lines.push(`ПолучательИНН=${party.inn}`);
        lines.push(`Получатель=${party.name}`);
      }
      lines.push(`НазначениеПлатежа=${purpose}`);
      lines.push('КонецДокумента');
    }

    lines.push('КонецФайла');
    results.push({
      fileName: input.sheets.length > 1 ? `${input.fileName} · ${sheet.name}` : input.fileName,
      text: lines.join('\n'),
      sourceId: input.sheets.length > 1 ? `${input.sourceId}:sheet:${sheetIndex}` : input.sourceId,
      contentHash: input.contentHash,
      parserVersion: 'PRESCORE-BANK-XLSX-ADAPTER-1.0',
    });
  }

  return results;
}

/**
 * Converts a parsed 1C Account 51 card into a fallback StatementInput for metricsV2
 * when no real bank statements (1C TXT or Bank XLSX) are present.
 */
export function account51ToStatementInput(input: {
  card: Pick<Account51Card, 'periodFrom' | 'periodTo' | 'openingBalance' | 'closingBalance' | 'operations'>;
  companyInn: string;
  companyName: string;
  fileName: string;
  sourceId: string;
  contentHash?: string;
}): StatementInput | null {
  const externalOps = input.card.operations.filter(op => op.direction !== 'INTERNAL_TRANSFER');
  if (!externalOps.length || !input.card.periodFrom || !input.card.periodTo) return null;

  const ownAccount = syntheticCorporateAccount(input.companyInn, '51');
  const companyLabel = cleanLine(input.companyName, 160) || `Компания ИНН ${input.companyInn}`;
  const totalIn = externalOps.filter(o => o.direction === 'INFLOW').reduce((s, o) => s + Math.round(o.amount * 100), 0) / 100;
  const totalOut = externalOps.filter(o => o.direction === 'OUTFLOW').reduce((s, o) => s + Math.round(o.amount * 100), 0) / 100;

  const lines: string[] = [
    '1CClientBankExchange',
    'ВерсияФормата=1.03',
    'Кодировка=UTF-8',
    'Отправитель=1С Карточка счёта 51 (fallback)',
    `ДатаНачала=${toRuDate(input.card.periodFrom)}`,
    `ДатаКонца=${toRuDate(input.card.periodTo)}`,
    `РасчСчет=${ownAccount}`,
    'СекцияРасчСчет',
    `ДатаНачала=${toRuDate(input.card.periodFrom)}`,
    `ДатаКонца=${toRuDate(input.card.periodTo)}`,
    `РасчСчет=${ownAccount}`,
    ...(input.card.openingBalance !== null ? [`НачальныйОстаток=${formatMoney(input.card.openingBalance)}`] : []),
    `ВсегоПоступило=${formatMoney(totalIn)}`,
    `ВсегоСписано=${formatMoney(totalOut)}`,
    ...(input.card.closingBalance !== null ? [`КонечныйОстаток=${formatMoney(input.card.closingBalance)}`] : []),
    'КонецРасчСчет',
  ];

  for (const [index, op] of externalOps.entries()) {
    const ruDate = toRuDate(op.date);
    const amount = formatMoney(op.amount);
    const partyName = cleanLine(op.analytic, 160) || (op.correspondingAccount ? `Корр. счёт ${op.correspondingAccount}` : 'Контрагент по карточке 51');
    const purpose = cleanLine(
      [op.document, op.correspondingAccount ? `Корр. счёт ${op.correspondingAccount}` : '', op.analytic].filter(Boolean).join(' · '),
      500,
    ) || 'Проводка карточки счёта 51';

    lines.push('СекцияДокумент=Платежное поручение');
    lines.push(`Номер=A51-${op.row || index + 1}`);
    lines.push(`Дата=${ruDate}`);
    lines.push(`Сумма=${amount}`);
    if (op.direction === 'INFLOW') {
      lines.push(`ДатаПоступило=${ruDate}`);
      lines.push('ПлательщикСчет=');
      lines.push('ПлательщикИНН=');
      lines.push(`Плательщик=${partyName}`);
      lines.push(`ПолучательСчет=${ownAccount}`);
      lines.push(`ПолучательИНН=${input.companyInn}`);
      lines.push(`Получатель=${companyLabel}`);
    } else {
      lines.push(`ДатаСписано=${ruDate}`);
      lines.push(`ПлательщикСчет=${ownAccount}`);
      lines.push(`ПлательщикИНН=${input.companyInn}`);
      lines.push(`Плательщик=${companyLabel}`);
      lines.push('ПолучательСчет=');
      lines.push('ПолучательИНН=');
      lines.push(`Получатель=${partyName}`);
    }
    lines.push(`НазначениеПлатежа=${purpose}`);
    lines.push('КонецДокумента');
  }

  lines.push('КонецФайла');
  return {
    fileName: input.fileName,
    text: lines.join('\n'),
    sourceId: input.sourceId,
    contentHash: input.contentHash,
    parserVersion: '1C-ACCOUNT-51-FALLBACK-ADAPTER-1.0',
  };
}

/**
 * Server-side reconciliation between canonical bank metrics (metricsV2) and a 1C Account 51 card.
 */
export function reconcileBankWithAccount51(
  metrics: BankStatementMetricsV2 | undefined,
  card: Account51Summary,
): Account51ReconciliationV1 {
  const warnings: string[] = [];
  if (card.requiresReview) warnings.push('ACCOUNT51_INTERNAL_RECONCILIATION_REVIEW_REQUIRED');

  const bankFrom = metrics?.period.from ?? null;
  const bankTo = metrics?.period.to ?? null;
  if (!metrics || !bankFrom || !bankTo) {
    warnings.push('ACCOUNT51_BANK_METRICS_MISSING');
    return {
      version: 'PRESCORE-ACCOUNT51-RECONCILIATION-1.0',
      comparable: false,
      status: 'BANK_MISSING',
      period: { bankFrom, bankTo, cardFrom: card.from, cardTo: card.to },
      inflow: { card: card.inflow, bank: null, diff: null },
      outflow: { card: card.outflow, bank: null, diff: null },
      closingBalance: { card: card.closing, bank: null, diff: null },
      warnings,
    };
  }

  const comparable = bankFrom === card.from && bankTo === card.to;
  if (!comparable) {
    warnings.push('ACCOUNT51_PERIOD_MISMATCH');
    return {
      version: 'PRESCORE-ACCOUNT51-RECONCILIATION-1.0',
      comparable: false,
      status: 'PERIOD_MISMATCH',
      period: { bankFrom, bankTo, cardFrom: card.from, cardTo: card.to },
      inflow: { card: card.inflow, bank: null, diff: null },
      outflow: { card: card.outflow, bank: null, diff: null },
      closingBalance: { card: card.closing, bank: null, diff: null },
      warnings,
    };
  }

  const knownValue = (m: { status: string; value: number | null } | undefined): number | null =>
    m && (m.status === 'KNOWN' || m.status === 'PARTIAL') && typeof m.value === 'number' && Number.isFinite(m.value) ? m.value : null;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const pair = (cardVal: number | null, bankVal: number | null): Account51ReconciliationItem => ({
    card: cardVal,
    bank: bankVal,
    diff: cardVal !== null && bankVal !== null ? round2(cardVal - bankVal) : null,
  });

  const inflow = pair(card.inflow, knownValue(metrics.cashFlow.grossExternalCashInflow));
  const outflow = pair(card.outflow, knownValue(metrics.cashFlow.grossExternalCashOutflow));
  const closingBalance = pair(card.closing, knownValue(metrics.liquidity.endingBalance));

  const tolerance = 1;
  if (inflow.diff !== null && Math.abs(inflow.diff) > tolerance) warnings.push('ACCOUNT51_INFLOW_DIFFERS_FROM_BANK');
  if (outflow.diff !== null && Math.abs(outflow.diff) > tolerance) warnings.push('ACCOUNT51_OUTFLOW_DIFFERS_FROM_BANK');
  if (closingBalance.diff !== null && Math.abs(closingBalance.diff) > tolerance) warnings.push('ACCOUNT51_CLOSING_BALANCE_DIFFERS_FROM_BANK');

  const differs = [inflow.diff, outflow.diff, closingBalance.diff].some(d => d !== null && Math.abs(d) > tolerance);
  return {
    version: 'PRESCORE-ACCOUNT51-RECONCILIATION-1.0',
    comparable: true,
    status: differs ? 'DIFFERS' : 'AGREES',
    period: { bankFrom, bankTo, cardFrom: card.from, cardTo: card.to },
    inflow,
    outflow,
    closingBalance,
    warnings,
  };
}

export function compactBankXlsxSheets(review: BankXlsxBookPreview): StoredBankXlsxSheet[] {
  return review.sheets
    .filter(s => s.preview.format !== 'UNSUPPORTED')
    .map(s => ({
      name: s.name,
      account: s.preview.account,
      periodFrom: s.preview.periodFrom,
      periodTo: s.preview.periodTo,
      operations: s.preview.operations.length,
      inMinor: s.preview.totalInMinor,
      outMinor: s.preview.totalOutMinor,
      entries: s.preview.operations,
    }));
}
