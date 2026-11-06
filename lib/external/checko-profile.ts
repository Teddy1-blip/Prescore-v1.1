import { checkoFinancialShadow } from '../credit-engine/financial-analysis/integration.ts';
import { INFRASTRUCTURE_VERSIONS, type SourceEnvelope } from '../credit-engine/contracts/sources.ts';
import type { CompanyProfileData } from '../company-profile.ts';
import { checkoFacts, type Bodies, type Failures } from './checko.ts';
import { DIRECT_EIS, DAY, type ExternalFacts, type Receipt } from './records.ts';
import { activeLegalReceipt } from '../legal-registry.ts';
import type { AnalysisResult } from '../prescore.ts';
type JsonRecord = Record<string, unknown>;
type CheckoResponse = NonNullable<Bodies[string]>;
function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === 'string' ? value.slice(0, 1500) : typeof value === 'number' ? String(value) : '';
}

function number(value: unknown) {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(
          String(value ?? '')
            .replace(/\s/g, '')
            .replace(',', '.'),
        );
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function latestFinances(response?: CheckoResponse) {
  const data = record(response?.data);
  const years = Object.keys(data)
    .filter((key) => /^\d{4}$/.test(key))
    .sort((a, b) => Number(b) - Number(a));
  const latestYear = years[0] ?? '';
  const latest = record(data[latestYear]);
  const previous = record(data[years[1] ?? '']);
  const revenue = number(latest['2110']);
  const previousRevenue = number(previous['2110']);
  const profit = number(latest['2400']);
  const assets = number(latest['1600']);
  const currentAssets = number(latest['1200']);
  const equity = number(latest['1300']);
  const currentLiabilities = number(latest['1500']);
  const receivables = number(latest['1230']);
  const cash = number(latest['1250']);
  const payables = number(latest['1520']);
  const nonCurrentAssets = nullableNumber(latest['1100']);
  const inventories = nullableNumber(latest['1210']);
  const inputVat = nullableNumber(latest['1220']);
  const longTermLiabilities = nullableNumber(latest['1400']);
  const longTermBorrowings = nullableNumber(latest['1410']);
  const shortTermBorrowings = nullableNumber(latest['1510']);
  const costOfSales = nullableNumber(latest['2120']);
  const grossProfit = nullableNumber(latest['2100']);
  const operatingProfit = nullableNumber(latest['2200']);
  const interestExpense = nullableNumber(latest['2330']);
  const profitBeforeTax = nullableNumber(latest['2300']);
  const totalBorrowings = (longTermBorrowings ?? 0) + (shortTermBorrowings ?? 0);
  const fieldsPresent = Object.keys(latest).filter(
    (key) => /^\d{4}$/.test(key) && nullableNumber(latest[key]) !== null,
  );
  return {
    latestYear,
    years: years.slice(0, 6),
    revenue,
    revenueGrowth: previousRevenue ? Math.round((revenue / previousRevenue - 1) * 1000) / 10 : null,
    profit,
    assets,
    currentAssets,
    equity,
    currentLiabilities,
    receivables,
    cash,
    payables,
    currentLiquidity: currentLiabilities ? Math.round((currentAssets / currentLiabilities) * 100) / 100 : null,
    autonomy: assets ? Math.round((equity / assets) * 1000) / 10 : null,
    returnOnSales: revenue ? Math.round((profit / revenue) * 1000) / 10 : null,
    nonCurrentAssets,
    inventories,
    inputVat,
    longTermLiabilities,
    longTermBorrowings,
    shortTermBorrowings,
    costOfSales,
    grossProfit,
    operatingProfit,
    interestExpense,
    profitBeforeTax,
    workingCapital: latestYear ? currentAssets - currentLiabilities : null,
    debtToEquity:
      equity > 0 && (longTermBorrowings != null || shortTermBorrowings != null)
        ? Math.round((totalBorrowings / equity) * 100) / 100
        : null,
    interestCoverage:
      interestExpense && operatingProfit != null
        ? Math.round((operatingProfit / Math.abs(interestExpense)) * 100) / 100
        : null,
    fieldsPresent,
  };
}

function normalizeExternalBanks(company: JsonRecord, response?: CheckoResponse) {
  const candidates = [
    ...array(company.БанкРекв),
    ...array(company.Банки),
    ...array(company.РасчСчета),
    ...array(record(response?.data).Записи),
    ...array(record(response?.data).Банки),
  ].map(record);
  const seen = new Set<string>();
  return candidates.flatMap((row) => {
    const bank = record(row.Банк);
    const name = text(bank.Наим || bank.Наименование || row.БанкНаим || row.Наим || row.Наименование);
    const bik = text(bank.БИК || row.БИК).replace(/\D/g, '');
    const account = text(row.РасчСчет || row.Счет || row.НомерСчета).replace(/\D/g, '');
    const key = `${bik}:${account}:${name}`;
    if (!name && !bik) return [];
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        name: name || 'Банк не указан',
        bik,
        account: account ? `••••${account.slice(-4)}` : '',
        status: 'BANK_FOUND_IN_EXTERNAL_DATA' as const,
        evidence:
          'Реквизит найден во внешних данных; наличие действующего счёта подтверждается только банковской выпиской.',
      },
    ];
  });
}

function buildSignals(
  company: JsonRecord,
  finances: ReturnType<typeof latestFinances>,
  legal: { enforcementDebt: number; enforcements: number; bankruptcyMessages: number; legalCases: number },
) {
  const signals: Array<{ severity: 'critical' | 'warning' | 'info'; title: string; detail: string }> = [];
  const status = record(company.Статус);
  const address = record(company.ЮрАдрес);
  const managers = array(company.Руковод).map(record);
  if (text(status.Код) && !['001', '101'].includes(text(status.Код)))
    signals.push({
      severity: 'critical',
      title: 'Особый статус компании',
      detail: text(status.Наим) || 'Требуется проверка статуса в ЕГРЮЛ',
    });
  if (address.Недост === true)
    signals.push({
      severity: 'critical',
      title: 'Недостоверность юридического адреса',
      detail: text(address.НедостОпис) || 'В ЕГРЮЛ есть отметка о недостоверности',
    });
  if (array(address.МассАдрес).length > 20)
    signals.push({
      severity: 'warning',
      title: 'Признаки массового адреса',
      detail: `По адресу зарегистрировано не менее ${array(address.МассАдрес).length} организаций`,
    });
  if (managers.some((manager) => manager.Недост === true || manager.ДисквЛицо === true))
    signals.push({
      severity: 'critical',
      title: 'Риск по руководителю',
      detail: 'Найдена недостоверность или дисквалификация руководителя',
    });
  if (managers.some((manager) => manager.МассРуковод === true))
    signals.push({
      severity: 'warning',
      title: 'Массовый руководитель',
      detail: 'Сигнал требует ручной проверки связанных организаций',
    });
  if (finances.latestYear && finances.equity < 0)
    signals.push({
      severity: 'critical',
      title: 'Отрицательный капитал',
      detail: `По БФО за ${finances.latestYear} год собственный капитал отрицательный`,
    });
  if (finances.currentLiquidity != null && finances.currentLiquidity < 1)
    signals.push({
      severity: 'warning',
      title: 'Недостаточная текущая ликвидность',
      detail: `Коэффициент ${finances.currentLiquidity}; ориентир Прескор — не ниже 1,0`,
    });
  if (legal.enforcementDebt > 0)
    signals.push({
      severity: legal.enforcementDebt >= 1_000_000 ? 'critical' : 'warning',
      title: 'Исполнительные производства',
      detail: `Найдено ${legal.enforcements}, видимый остаток задолженности ${Math.round(legal.enforcementDebt).toLocaleString('ru-RU')} ₽`,
    });
  if (legal.bankruptcyMessages > 0)
    signals.push({
      severity: 'warning',
      title: 'Сообщения ЕФРСБ',
      detail: `Найдено ${legal.bankruptcyMessages}. Сам факт сообщения не означает банкротство — требуется проверка содержания.`,
    });
  if (legal.legalCases > 0)
    signals.push({
      severity: 'info',
      title: 'Арбитражные дела',
      detail: `Найдено ${legal.legalCases}; роль и суммы нужно оценивать отдельно`,
    });

  return signals;
}

function envelope(r: Receipt, inn: string): SourceEnvelope {
  const isBfo = r.method === 'finances';
  return {
    sourceId: isBfo ? `bfo:${inn}:${r.retrievedAt}` : r.id,
    sourceType: isBfo ? 'BFO' : 'CHECKO',
    companyInn: inn,
    status: r.status,
    provider: r.provider,
    upstream: r.authority,
    direct: false,
    informationDate: r.informationDate,
    sourceName: 'Checko /' + r.method,
    receivedAt: r.retrievedAt!,
    parserVersion: r.version,
    integrityVersion: INFRASTRUCTURE_VERSIONS.integrity,
    confidence: r.status === 'READY' ? 85 : null,
    warnings: r.warnings,
    rawReference: 'external:/' + r.method + ':' + r.retrievedAt,
  };
}
export function normalizeProfile(inn: string, bodies: Bodies, failures: Failures, at: string): CompanyProfileData {
  const facts = checkoFacts(inn, bodies, failures, at),
    i = facts.identity,
    company = record((bodies.company ?? bodies.entrepreneur)?.data);
  const by = (method: string) => facts.receipts.find((r) => r.method === method)!;
  const finances = latestFinances(bodies.finances),
    financeFields = new Set(finances.fieldsPresent);
  const codes: Record<string, string> = {
    revenue: '2110',
    profit: '2400',
    assets: '1600',
    currentAssets: '1200',
    equity: '1300',
    currentLiabilities: '1500',
    receivables: '1230',
    cash: '1250',
    payables: '1520',
    interestExpense: '2330',
  };
  const bfo =
    inn.length === 10
      ? {
          ...envelope(by('finances'), inn),
          periodFrom: finances.latestYear ? finances.latestYear + '-01-01' : undefined,
          periodTo: finances.latestYear ? finances.latestYear + '-12-31' : undefined,
          fieldAvailability: Object.fromEntries(
            Object.entries(codes).map(([name, code]) => [
              name,
              financeFields.has(code) ? ('KNOWN' as const) : ('UNKNOWN' as const),
            ]),
          ),
        }
      : undefined;
  const external = facts.receipts
    .filter((r) => r.method !== 'finances' && r.retrievedAt)
    .map((r) => envelope(r, inn));
  // These compatibility counters are consumed by the existing policy engine. Detailed
  // source views use nullable values and explicit coverage from externalFacts.
  const legal = {
    enforcements: by('enforcements').total ?? 0,
    enforcementDebt: facts.activeEnforcementRub ?? 0,
    legalCases: by('legal-cases').total ?? 0,
    inspections: by('inspections').total ?? 0,
    bankruptcyMessages: by('bankruptcy-messages').total ?? 0,
  };
  const managers = array(company.Руковод)
    .map(record)
    .slice(0, 4)
    .map((m) => ({ name: text(m.ФИО), position: text(m.НаимДолжн), inn: text(m.ИНН) }));
  const profile: CompanyProfileData = {
    inn,
    source: 'Checko',
    fetchedAt: at,
    cached: false,
    failedMethods: Object.keys(failures),
    externalFacts: facts,
    company: {
      name: i.name ?? '',
      fullName: i.fullName ?? '',
      ogrn: i.ogrn ?? '',
      kpp: i.kpp ?? '',
      status: i.status ?? '',
      registrationDate: i.registered ?? '',
      region: i.region ?? '',
      address: i.address ?? '',
      addressUnreliable: i.unreliable === true,
      okvedCode: text(record(company.ОКВЭД ?? company.ЭконДеят).Код),
      okved: i.okved ?? '',
      capital: i.capital ?? 0,
      managers,
      foundersCount: i.founders ?? 0,
    },
    finances,
    legal,
    ...checkoFinancialShadow(bodies.finances, bfo, finances),
    sourceManifest: { bfo, external },
    sourceStatus: facts.receipts
      .filter((r) => r.retrievedAt)
      .map((r) => ({
        endpoint: '/' + r.method,
        status: r.status === 'FAILED' ? 'unavailable' : r.warnings.length ? 'partial' : 'available',
        retrievedAt: r.retrievedAt!,
      })),
    enforcementItems: facts.enforcements.map((v) => ({
      number: v.reference ?? '',
      date: v.date ?? '',
      state: v.status ?? '',
      active: v.state === 'ACTIVE',
      amount: v.remaining ?? null,
      subject: v.title ?? '',
      source: 'Checko · ФССП',
    })),
    legalCaseItems: facts.cases.map((v) => ({
      number: v.reference ?? '',
      date: v.date ?? '',
      role: v.role === 'DEFENDANT' ? 'DEFENDANT' : v.role === 'PLAINTIFF' ? 'PLAINTIFF' : 'OTHER',
      amount: v.amount ?? null,
      status: v.status ?? '',
      court: v.authority ?? '',
      source: 'Checko · КАД',
    })),
    registryMessages: facts.messages.map((v) => ({
      sourceId: v.reference ?? '',
      date: v.date ?? '',
      title: v.title ?? '',
      messageType: v.category ?? '',
      classification: v.classification ?? 'INFORMATIONAL',
      source: 'Checko · Федресурс',
    })),
    inspectionItems: facts.inspections.map((v) => ({
      date: v.date ?? '',
      authority: v.authority ?? '',
      type: v.title ?? '',
      result: v.status ?? '',
      violations: v.violations ?? '',
      status: v.status ?? '',
      source: 'Checko · проверки',
    })),
    timeline: facts.changes.map((v) => ({
      date: v.date,
      eventDate: v.date ?? '',
      eventType: 'REGISTRY_EVENT',
      entityType: 'COMPANY',
      description: v.title ?? '',
      source: 'Checko · история',
      severityCandidate: 'information',
    })),
    externalBanks: normalizeExternalBanks(company),
    signals: buildSignals(company, finances, legal),
  };
  return profile;
}
export function cachedProfile(payload: string, inn: string): CompanyProfileData | undefined {
  try {
    const p = JSON.parse(payload) as CompanyProfileData;
    // Earlier dossiers can have a verified legal profile without annual statements.
    // Only the Stage 4 projection requires the normalized finance container.
    if (p.inn !== inn || !p.company || !p.legal || !p.fetchedAt || (p.externalFacts && !p.finances)) return;
    // Correct the known transport error in historical profile caches at read time.
    for (const s of p.sourceManifest?.external ?? [])
      if (
        s.sourceType === 'EIS' &&
        (s.sourceId.startsWith('external:contracts:') || s.rawReference?.startsWith('external:/contracts:'))
      ) {
        Object.assign(s, {
          sourceType: 'CHECKO',
          sourceName: 'Checko · госзакупки / ЕИС',
          provider: 'CHECKO',
          upstream: 'EIS',
          direct: false,
        });
      }
    return p;
  } catch {
    return;
  }
}
export function lifecycleComparison(facts: ExternalFacts, analysis: AnalysisResult | undefined) {
  const fns = analysis ? activeLegalReceipt(analysis) : null,
    id = facts.identity;
  const comparable =
    !!fns?.informationDate &&
    fns.informationDate === id.informationDate &&
    !!fns.lifecycle &&
    !['UNKNOWN', 'OTHER'].includes(id.lifecycle);
  return {
    status: comparable ? (fns!.lifecycle === id.lifecycle ? 'AGREES' : 'CONFLICT') : 'NOT_COMPARABLE',
    fns: fns
      ? {
          provider: 'FNS_DIRECT',
          authority: 'FNS',
          direct: true,
          lifecycle: fns.lifecycle,
          date: fns.informationDate,
          retrievedAt: fns.receivedAt,
        }
      : null,
  };
}
export function profileView(p: CompanyProfileData, tier: 'FREE' | 'FULL', analysis?: AnalysisResult) {
  const stale = Date.now() - Date.parse(p.fetchedAt) >= DAY;
  const f = p.externalFacts
    ? {
        ...p.externalFacts,
        receipts: p.externalFacts.receipts.map((r) => ({
          ...r,
          freshness: !r.retrievedAt
            ? ('UNKNOWN' as const)
            : Date.now() - Date.parse(r.retrievedAt) >= DAY
              ? ('STALE' as const)
              : ('FRESH' as const),
        })),
      }
    : undefined;
  const basics = {
    inn: p.inn,
    fetchedAt: p.fetchedAt,
    source: 'Checko',
    cached: p.cached,
    stale,
    directEis: DIRECT_EIS,
  };
  const presence = (method: string) => {
    const r = f?.receipts.find((x) => x.method === method);
    return !r ? null : r.visible > 0 ? true : r.status === 'EMPTY' ? false : null;
  };
  const legal = p.legal,
    publicRisks = { enforcementDetected: presence('enforcements'), legalEventsDetected: presence('legal-cases') };
  if (tier === 'FREE')
    return {
      ...basics,
      freeView: true,
      company: {
        name: p.company.name,
        ogrn: p.company.ogrn,
        status: p.company.status,
        region: p.company.region,
        registrationDate: p.company.registrationDate,
        okved: p.company.okved,
      },
      publicRisks: { ...publicRisks, attentionCount: Object.values(publicRisks).filter(Boolean).length },
      contracts: { totalCount: f?.procurement.totalCount ?? p.contracts?.totalCount ?? null },
      locked: { legalProfile: true, finances: true, expertInterpretation: true },
    };
  const requires: Record<string, string[]> = {
    revenueGrowth: ['2110'],
    workingCapital: ['1200', '1500'],
    currentLiquidity: ['1200', '1500'],
    autonomy: ['1300', '1600'],
    returnOnSales: ['2400', '2110'],
    debtToEquity: ['1410', '1510', '1300'],
    interestCoverage: ['2330', '2200'],
  };
  return {
    ...basics,
    company: f
      ? {
          ...p.company,
          capital: f.identity.capital,
          foundersCount: f.identity.founders,
          addressUnreliable: f.identity.unreliable,
        }
      : p.company,
    externalFacts: f,
    registryComparison: f ? lifecycleComparison(f, analysis) : null,
    financialAnalysisV2: p.financialAnalysisV2,
    financialStatementsV2: p.financialStatementsV2,
    financialMetricsComparison: p.financialMetricsComparison,
    sourceManifest: p.sourceManifest,
    sourceStatus: p.sourceStatus,
    failedMethods: p.failedMethods,
    finances: f
      ? Object.fromEntries(
          Object.entries(p.finances).map(([k, v]) => [
            k,
            p.sourceManifest?.bfo?.fieldAvailability?.[k] === 'UNKNOWN' ||
            requires[k]?.some((code) => !p.finances.fieldsPresent?.includes(code))
              ? null
              : v,
          ]),
        )
      : p.finances,
    legal: f
      ? {
          enforcements: f.receipts.find((r) => r.method === 'enforcements')?.total ?? null,
          enforcementDebt: f.activeEnforcementRub,
          legalCases: f.receipts.find((r) => r.method === 'legal-cases')?.total ?? null,
          inspections: f.receipts.find((r) => r.method === 'inspections')?.total ?? null,
          bankruptcyMessages: f.receipts.find((r) => r.method === 'bankruptcy-messages')?.total ?? null,
        }
      : legal,
    contracts: f?.procurement ?? p.contracts,
    signals: p.signals,
    externalBanks: p.externalBanks,
    legacyReceipts: !f,
  };
}
