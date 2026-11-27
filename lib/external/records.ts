import type { SourceStatus } from '../credit-engine/contracts/sources.ts';

export type Provider = 'CHECKO' | 'EIS_DIRECT' | 'FNS_DIRECT';
export type Authority = 'FNS' | 'FSSP' | 'KAD' | 'INSPECTIONS' | 'FEDRESURS' | 'EIS' | 'FAS' | 'UNKNOWN';
export type Receipt = {
  id: string;
  method: string;
  provider: Provider;
  authority: Authority;
  direct: boolean;
  status: SourceStatus;
  retrievedAt: string | null;
  informationDate: string | null;
  freshness?: 'FRESH' | 'STALE' | 'UNKNOWN';
  total: number | null;
  visible: number;
  warnings: string[];
  version: 'PRESCORE-EXTERNAL-2';
};
export type Party = { inn: string | null; name: string | null };
export type ProcurementRecord = {
  number: string;
  law: '44-ФЗ' | '223-ФЗ';
  role: 'SUPPLIER' | 'CUSTOMER' | 'OTHER' | 'UNKNOWN';
  customer: Party;
  suppliers: Party[];
  subject: string | null;
  amount: number | null;
  signedAt: string | null;
  executionAt: string | null;
  state: 'ACTIVE' | 'COMPLETED' | 'TERMINATED' | 'UNKNOWN';
  status: string | null;
  url: string | null;
  receiptId: string;
};
export type RnpRecord = {
  number: string;
  law: '44-ФЗ' | '223-ФЗ' | 'ПП 615' | 'UNKNOWN';
  included: string | null;
  ended: string | null;
  published?: string | null;
  plannedEnd?: string | null;
  state: 'ACTIVE' | 'HISTORICAL' | 'UNKNOWN';
  basis: string | null;
  related: string | null;
  url: string | null;
  receiptId: string;
};
export type ExternalRow = {
  reference: string | null;
  date: string | null;
  title: string | null;
  status: string | null;
  receiptId: string;
  amount?: number | null;
  remaining?: number | null;
  state?: 'ACTIVE' | 'CLOSED' | 'UNKNOWN';
  role?: string;
  authority?: string | null;
  violations?: string | null;
  url?: string | null;
  classification?: 'REVIEW' | 'INFORMATIONAL';
  category?: string | null;
};
export type ExternalFacts = {
  version: 2;
  inn: string;
  fetchedAt: string;
  receipts: Receipt[];
  identity: {
    name: string | null;
    fullName: string | null;
    ogrn: string | null;
    kpp: string | null;
    registered: string | null;
    lifecycle: string;
    status: string | null;
    informationDate: string | null;
    region: string | null;
    address: string | null;
    unreliable: boolean | null;
    okved: string | null;
    capital: number | null;
    managerNames: string[];
    founders: number | null;
    sme: string | null;
  };
  enforcements: ExternalRow[];
  activeEnforcementRub: number | null;
  cases: ExternalRow[];
  inspections: ExternalRow[];
  messages: ExternalRow[];
  changes: ExternalRow[];
  reportedRnp: boolean | null;
  procurement: ReturnType<typeof procurementSummary>;
  rnp: RnpRecord[];
};

export const DAY = 86_400_000;
export const DIRECT_EIS = {
  provider: 'EIS_DIRECT',
  authority: 'EIS',
  status: 'NOT_CONFIGURED',
  retrievedAt: null,
} as const;
export const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export function stringValue(v: unknown) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 1500) : null;
}
export function money(v: unknown) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== 'string' || !/^\d+(?:[ \u00a0]\d{3})*(?:[.,]\d+)?$/.test(v.trim())) return null;
  const n = Number(v.trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
export function day(v: unknown) {
  const s = stringValue(v),
    d = s?.match(
      /^(\d{4}-\d{2}-\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?|[+-]\d\d:\d\d)?$/,
    )?.[1];
  return d && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().startsWith(d) ? d : null;
}
export function officialLink(raw: unknown, hosts: readonly string[]) {
  try {
    const u = new URL(String(raw));
    return u.protocol === 'https:' &&
      !u.port &&
      !u.username &&
      !u.password &&
      hosts.includes(u.hostname) &&
      ![...u.searchParams.keys()].some((k) => /token|key|pass|secret/i.test(k))
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function party(v: unknown): Party {
  const p = record(v);
  return { inn: stringValue(p.ИНН), name: stringValue(p.НаимСокр ?? p.НаимПолн ?? p.Наим ?? p.ФИО) };
}
export function procurementSummary(input: ProcurementRecord[], receipts: Receipt[], now: string) {
  const seen = new Set<string>();
  const rows = input
    .filter((r) => {
      const key = r.law + ':' + r.number;
      if (seen.has(key)) return false;
      seen.add(key);
      return r.role !== 'OTHER';
    })
    .sort((a, b) => (b.signedAt ?? '').localeCompare(a.signedAt ?? ''));
  const ready = receipts.length > 0 && receipts.every((r) => r.status === 'READY' || r.status === 'EMPTY');
  const knownTotals = ready && receipts.every((r) => r.total !== null);
  const totalCount = knownTotals ? receipts.reduce((sum, r) => sum + r.total!, 0) : null;
  const complete =
    ready &&
    receipts.every((r) => r.total === r.visible) &&
    totalCount === rows.length &&
    input.length === rows.length;
  const sum = (items: ProcurementRecord[]) =>
    items.every((r) => r.amount !== null) ? items.reduce((s, r) => s + r.amount!, 0) : null;
  const active = rows.filter((r) => r.state === 'ACTIVE'),
    statuses = rows.every((r) => r.state !== 'UNKNOWN');
  const suppliers = rows.filter((r) => r.role === 'SUPPLIER');
  const customerTotals = new Map<string, number>();
  for (const r of suppliers)
    if (r.customer.inn && r.amount !== null)
      customerTotals.set(r.customer.inn, (customerTotals.get(r.customer.inn) ?? 0) + r.amount);
  const supplyAmount = sum(suppliers);
  return {
    items: rows,
    visibleCount: rows.length,
    totalCount,
    complete,
    totalAmount: complete ? sum(rows) : null,
    activeCount: complete && statuses ? active.length : null,
    completedCount: complete && statuses ? rows.filter((r) => r.state === 'COMPLETED').length : null,
    activeAmount: complete && statuses ? sum(active) : null,
    visibleActiveAmount: sum(active),
    topCustomerShare:
      complete && supplyAmount && suppliers.every((r) => r.customer.inn) && rows.every((r) => r.role !== 'UNKNOWN')
        ? (100 * Math.max(...customerTotals.values())) / supplyAmount
        : null,
    recentCount:
      complete && rows.every((r) => r.signedAt)
        ? rows.filter(
            (r) =>
              Date.parse(r.signedAt!) <= Date.parse(now) && Date.parse(now) - Date.parse(r.signedAt!) <= 365 * DAY,
          ).length
        : null,
    lawSplit: receipts.map((r) => ({
      law: r.method.slice(-3).replace(/^:/, '') + '-ФЗ',
      total: r.total,
      visible: r.visible,
      status: r.status,
    })),
  };
}
