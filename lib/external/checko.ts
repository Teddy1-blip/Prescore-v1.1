import { normalizeLifecycle } from '../credit-engine/risk/adapters/legal.ts';
import {
  day,
  list,
  money,
  officialLink,
  party,
  procurementSummary,
  record,
  stringValue as str,
  type Authority,
  type ExternalFacts,
  type ExternalRow,
  type ProcurementRecord,
  type Receipt,
} from './records.ts';

export const AUTHORITIES: Record<string, Authority> = {
  company: 'FNS',
  entrepreneur: 'FNS',
  finances: 'FNS',
  'legal-cases': 'KAD',
  enforcements: 'FSSP',
  inspections: 'INSPECTIONS',
  'bankruptcy-messages': 'FEDRESURS',
  fedresurs: 'FEDRESURS',
  timeline: 'UNKNOWN',
  'contracts:44': 'EIS',
  'contracts:223': 'EIS',
  bank: 'UNKNOWN',
  rnp: 'UNKNOWN',
};
export function checkoMethods(inn: string) {
  return [
    ...(inn.length === 12 ? ['entrepreneur'] : ['company', 'finances', 'enforcements']),
    'inspections',
    'legal-cases',
    'bankruptcy-messages',
    'fedresurs',
    'timeline',
    'contracts:44',
    'contracts:223',
  ];
}
export type Bodies = Record<
  string,
  { data?: unknown; company?: unknown; entrepreneur?: unknown; meta?: Record<string, unknown> } | undefined
>;
export type Failures = Record<string, string>;
export function checkedBody(method: string, body: NonNullable<Bodies[string]>, inn: string) {
  const identity = method === 'company' || method === 'entrepreneur';
  const subject = record(identity ? body.data : inn.length === 12 ? body.entrepreneur : body.company);
  if (!str(subject.ИНН)) throw Error('SOURCE_IDENTITY_UNKNOWN');
  if (subject.ИНН !== inn) throw Error('SOURCE_IDENTITY_MISMATCH');
  for (const header of [body.company, body.entrepreneur])
    if (str(record(header).ИНН) && record(header).ИНН !== inn) throw Error('SOURCE_IDENTITY_MISMATCH');
  if (identity) return;
  const data = record(body.data);
  if (method === 'finances') {
    if (
      !body.data ||
      typeof body.data !== 'object' ||
      Array.isArray(body.data) ||
      Object.entries(data).some(([k, v]) => !/^\d{4}$/.test(k) || !v || typeof v !== 'object' || Array.isArray(v))
    )
      throw Error('SOURCE_SHAPE_UNSUPPORTED');
  } else if (
    !(method === 'timeline' && Array.isArray(body.data)) &&
    !Array.isArray(data.Записи) &&
    !Array.isArray(data.События) &&
    !Array.isArray(data.Данные)
  )
    throw Error('SOURCE_SHAPE_UNSUPPORTED');
}
function rows(b: Bodies[string]) {
  const d = record(b?.data);
  return list(Array.isArray(b?.data) ? b.data : (d.Записи ?? d.События ?? d.Данные)).map(record);
}
function count(v: unknown) {
  const n = money(v);
  return n !== null && Number.isSafeInteger(n) ? n : null;
}
function methodReceipt(
  method: string,
  inn: string,
  b: Bodies[string],
  failure: string | undefined,
  at: string,
): Receipt {
  const d = record(b?.data),
    identity = ['company', 'entrepreneur'].includes(method);
  const visible = !b ? 0 : identity ? 1 : method === 'finances' ? Object.keys(d).length : rows(b).length;
  const pages = count(d.СтрВсего);
  const declared = count(d.ЗапВсего);
  const total = !b
    ? null
    : (declared ??
      (identity || method === 'finances' || Array.isArray(b.data) || pages === 1 || pages === 0 ? visible : null));
  const empty = !!b && visible === 0 && (total === 0 || method === 'finances');
  return {
    id: `external:${method}:${inn}:${at}`,
    method,
    provider: 'CHECKO',
    authority: AUTHORITIES[method],
    direct: false,
    status: failure ? 'FAILED' : !b ? 'NOT_REQUESTED' : empty ? 'EMPTY' : 'READY',
    retrievedAt: b || failure ? at : null,
    informationDate: day(d.ДатаСвед ?? d.ДатаВыписки),
    visible,
    total,
    warnings: failure
      ? [failure]
      : !b
        ? ['METHOD_NOT_REQUESTED']
        : !identity && method !== 'finances' && total !== visible
          ? ['PARTIAL_COVERAGE']
          : [],
    version: 'PRESCORE-EXTERNAL-2',
  };
}
function contractState(status: string | null): ProcurementRecord['state'] {
  if (!status) return 'UNKNOWN';
  const s = status.toLowerCase().trim();
  if (
    ['исполнение', 'на исполнении', 'исполняется', 'исполнение контракта', 'действующий', 'действует'].includes(s)
  )
    return 'ACTIVE';
  if (['исполнен', 'исполненный', 'исполнено', 'исполнение завершено', 'завершен', 'завершён'].includes(s))
    return 'COMPLETED';
  return /^(?:расторгнут|исполнение прекращено|прекращено)$/.test(s) ? 'TERMINATED' : 'UNKNOWN';
}
function procurement(row: Record<string, unknown>, r: Receipt, inn: string): ProcurementRecord | null {
  const number = str(row.РегНомер ?? row.Номер);
  if (!number) return null;
  const customer = party(row.Заказ ?? row.Заказчик),
    supplierValue = row.Постав ?? row.Поставщики ?? row.Поставщик;
  const suppliers = (Array.isArray(supplierValue) ? supplierValue : supplierValue ? [supplierValue] : []).map(
    party,
  );
  const role =
    customer.inn === inn
      ? 'CUSTOMER'
      : suppliers.some((s) => s.inn === inn)
        ? 'SUPPLIER'
        : customer.inn && suppliers.length && suppliers.every((s) => s.inn)
          ? 'OTHER'
          : 'UNKNOWN';
  const status = str(record(row.Статус).Наим ?? row.Статус);
  return {
    number,
    law: r.method === 'contracts:44' ? '44-ФЗ' : '223-ФЗ',
    role,
    customer,
    suppliers,
    subject:
      str(row.Предмет ?? row.ПредметКонтракта ?? row.Наим) ??
      (list(row.Объекты)
        .map((item) => str(record(item).Наим))
        .filter(Boolean)
        .join(', ')
        .slice(0, 1500) ||
        null),
    amount: money(row.Цена ?? row.Сумма),
    signedAt: day(row.ДатаЗакл ?? row.Дата),
    executionAt: day(row.ДатаИсп),
    state: contractState(status),
    status,
    url: officialLink(row.СтрЕИС, ['zakupki.gov.ru', 'www.zakupki.gov.ru']),
    receiptId: r.id,
  };
}
function enforcementState(status: string | null): ExternalRow['state'] {
  if (/^(возбуждено|возбужден|активно|на исполнении|в производстве)$/i.test(status ?? '')) return 'ACTIVE';
  if (/^(окончено|окончено по|прекращено|завершено)(?:$|\s)/i.test(status ?? '')) return 'CLOSED';
  return 'UNKNOWN';
}
export function checkoFacts(inn: string, bodies: Bodies, failures: Failures, at: string): ExternalFacts {
  const base = inn.length === 12 ? 'entrepreneur' : 'company';
  for (const [method, body] of Object.entries(bodies)) if (body) checkedBody(method, body, inn);
  const receipts = Object.keys(AUTHORITIES)
    .filter((m) => m === base || !['company', 'entrepreneur'].includes(m))
    .map((m) => methodReceipt(m, inn, bodies[m], failures[m], at));
  const byMethod = new Map(receipts.map((r) => [r.method, r]));
  const company = record(bodies[base]?.data),
    address = record(company.ЮрАдрес),
    okved = record(company.ОКВЭД ?? company.ЭконДеят);
  const founders = record(company.Учред);
  const status = str(record(company.Статус).Наим ?? company.Статус);
  const identity = {
    name: str(company.НаимСокр ?? company.НаимПолн ?? company.ФИО),
    fullName: str(company.НаимПолн ?? company.ФИО),
    ogrn: str(company.ОГРН ?? company.ОГРНИП),
    kpp: str(company.КПП),
    registered: day(company.ДатаРег),
    status,
    lifecycle: status === 'Действующий' ? 'ACTIVE' : normalizeLifecycle(status ?? ''),
    informationDate: byMethod.get(base)!.informationDate,
    region: str(record(company.Регион).Наим ?? company.РегионКод),
    address: str(address.АдресРФ),
    unreliable: typeof address.Недост === 'boolean' ? address.Недост : null,
    okved: [str(okved.Код), str(okved.Наим)].filter(Boolean).join(' ') || null,
    capital: money(record(company.УстКап).Сумма),
    managerNames: list(company.Руковод)
      .map((v) => str(record(v).ФИО))
      .filter((s): s is string => !!s)
      .slice(0, 8),
    founders:
      company.Учред && typeof company.Учред === 'object'
        ? Object.values(founders).reduce<number>((n, v) => n + list(v).length, 0)
        : null,
    sme: str(record(company.МСП).Категория ?? record(company.МСП).НаимКат ?? company.МСП),
  };
  const legalRows = (method: string, fn: (v: Record<string, unknown>) => Partial<ExternalRow>) =>
    rows(bodies[method]).map((v) => ({
      reference: str(v.Номер ?? v.GUID ?? v.ID),
      date: day(v.Дата),
      title: str(v.ТипНаим ?? v.Наим),
      status: str(record(v.Статус).Наим ?? v.Статус),
      receiptId: byMethod.get(method)!.id,
      ...fn(v),
    }));
  const enforcements = legalRows('enforcements', (v) => {
    const s = str(v.Статус ?? v.Состояние);
    return {
      reference: str(v.ИспПрНомер ?? v.НомерИП ?? v.Номер),
      date: day(v.ИспПрДата ?? v.Дата),
      state: enforcementState(s),
      status: s,
      title: str(v.ПредмИсп ?? v.Предмет ?? v.Основание),
      amount: money(v.СумДолг ?? v.Сумма),
      remaining: money(v.ОстЗадолж),
    };
  });
  const er = byMethod.get('enforcements')!,
    active = enforcements.filter((v) => v.state === 'ACTIVE');
  const activeEnforcementRub =
    (er.status === 'READY' || er.status === 'EMPTY') &&
    er.total === er.visible &&
    enforcements.every((v) => v.state !== 'UNKNOWN') &&
    active.every((v) => v.remaining != null)
      ? active.reduce((n, v) => n + v.remaining!, 0)
      : null;
  const cases = legalRows('legal-cases', (v) => ({
    title: str(v.Предмет ?? v.Категория),
    authority: str(v.Суд),
    amount: money(v.СуммИск ?? v.СумИск ?? v.Сумма),
    role: list(v.Ответ).some((p) => party(p).inn === inn)
      ? 'DEFENDANT'
      : list(v.Ист).some((p) => party(p).inn === inn)
        ? 'PLAINTIFF'
        : (str(v.Роль) ?? 'UNKNOWN'),
    url: officialLink(v.СтрКАД, ['kad.arbitr.ru']),
  }));
  const inspections = legalRows('inspections', (v) => ({
    date: day(v.ДатаНач ?? v.Дата),
    authority: str(v.Орган ?? record(v.ОргКонтр).Наим),
    title: str(v.ТипПров ?? v.ВидПроверки ?? v.Тип ?? v.Вид),
    status: str(v.Результат ?? v.Статус),
    violations:
      str(v.Нарушения ?? v.Выявлено) ??
      (list(v.Объекты)
        .flatMap((item) => list(record(record(item).Результ).Наруш))
        .map((item) => str(record(item).Текст))
        .filter(Boolean)
        .join(' · ')
        .slice(0, 1500) ||
        (v.Наруш === true ? 'Выявлены нарушения' : v.Наруш === false ? 'Не выявлено' : null)),
  }));
  const messages = ['fedresurs', 'bankruptcy-messages'].flatMap((m) =>
    legalRows(m, (v) => ({
      reference: str(v.GUID ?? v.Ид ?? v.ID ?? v.Номер ?? v.НомерСообщ),
      date: day(v.Дата ?? v.ДатаПубл),
      classification: /намерен|ликвидац|реорган|банкрот|creditorintention/i.test(
        [v.Тип, v.ТипНаим, v.Заголовок].filter((x) => typeof x === 'string').join(' '),
      )
        ? 'REVIEW'
        : 'INFORMATIONAL',
      category: str(v.Тип ?? v.Вид ?? v.Категория),
      title: str(v.ТипНаим ?? v.Заголовок ?? v.Наим ?? v.Тип ?? v.ВидСообщения),
      url: officialLink(v.URL, ['fedresurs.ru', 'bankrot.fedresurs.ru']),
    })),
  );
  const changes = legalRows('timeline', (v) => ({
    date: day(v.Дата ?? v.ДатаСобытия ?? v.ДатаЗаписи),
    title: str(v.Событие ?? v.Опис ?? v.Описание ?? v.Наим ?? v.Тип),
  }));
  const contractReceipts = receipts.filter((r) => r.method.startsWith('contracts:'));
  const contracts = contractReceipts.flatMap((r) =>
    rows(bodies[r.method])
      .map((v) => procurement(v, r, inn))
      .filter((v): v is ProcurementRecord => v !== null),
  );
  return {
    version: 2,
    inn,
    fetchedAt: at,
    identity,
    reportedRnp: typeof company.НедобПост === 'boolean' ? company.НедобПост : null,
    receipts,
    enforcements,
    activeEnforcementRub,
    cases,
    inspections,
    messages,
    changes,
    procurement: procurementSummary(contracts, contractReceipts, at),
    rnp: [],
  };
}
