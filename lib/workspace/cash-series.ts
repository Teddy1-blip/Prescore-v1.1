import type {CashSeries, MonthlyCashFlowV2} from '../credit-engine/contracts/metrics.ts';

export const cashLabels = {
  nonOperatingReceipts:'Внеоперационные поступления',
  unknownInflows:'Поступления без категории',
  principal:'Основной долг',
  interest:'Проценты',
  unsplit:'Долг без разбивки',
  leasing:'Лизинг',
  taxOnly:'Налоги',
  social:'Страховые взносы',
  netExternal:'Чистый внешний поток',
  individualBusiness:'Деловые платежи физлицам',

  externalInflows: 'Внешние поступления',
  externalOutflows: 'Внешние списания',
  operatingReceipts: 'Операционные поступления',
  otherReceipts: 'Прочие внешние поступления',
  debtService: 'Долг и лизинг',
  taxPayments: 'Налоги и взносы',
} as const satisfies Record<CashSeries, string>;

export type {CashSeries};
export const CASH_PAGE_SIZE = 50;
type MonthFacts = Pick<MonthlyCashFlowV2,'coverage'> & Partial<Record<CashSeries,number|null>>;

export function isCashSeries(value: string | null): value is CashSeries {
  return value !== null && Object.hasOwn(cashLabels, value);
}

export function cashValue(month: MonthFacts, series: CashSeries): number | null {
  if (month.coverage === 'MISSING') return null;
  if (series==="otherReceipts" && (month.externalInflows==null || month.operatingReceipts==null)) return null;
  const value=month[series];
  return typeof value==="number" && Number.isFinite(value) ? value : null;
}

export type CashEvidenceRow = {
  id: string;
  date: string;
  amount: number;
  postedAmount?: number;
  counterparty: string;
  purpose: string;
  category: string;
  confidence: string;
  source: string | null;
  row: number | null;
  documentNumber: string | null;
  parser: string | null;
  hash: string | null;
  hashOf: "file" | "text";
};

export type CashEvidencePage = {
  analysisId: string;
  month: string;
  series: CashSeries;
  rows: CashEvidenceRow[];
  count: number;
  total: number;
  offset: number;
  nextOffset: number | null;
};
