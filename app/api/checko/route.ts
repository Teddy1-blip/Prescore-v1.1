import { readableAnalysis, requireApiUser, unauthorized } from "../api-auth";
import { resolveAnalysisTier, type AnalysisTier } from "../../../lib/entitlements";
import { INFRASTRUCTURE_VERSIONS, type SourceEnvelope } from "../../../lib/credit-engine/contracts/sources";
import { checkoFinancialShadow } from "../../../lib/credit-engine/financial-analysis/integration";

type PreparedStatement = {
  bind: (...values: unknown[]) => PreparedStatement;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

type RuntimeDatabase = {
  prepare: (query: string) => PreparedStatement;
};

type JsonRecord = Record<string, unknown>;

type CheckoResponse = {
  company?: JsonRecord;
  entrepreneur?: JsonRecord;
  data?: unknown;
  meta?: { status?: string; today_request_count?: number; balance?: number; message?: string };
};

const CACHE_MS = 24 * 60 * 60 * 1000;
const ENDPOINT = "https://api.checko.ru/v2";

async function runtime() {
  const { env } = await import("cloudflare:workers");
  return {
    db: env.DB as unknown as RuntimeDatabase,
    apiKey: String((env as unknown as Record<string, unknown>).CHECKO_API_KEY ?? ""),
  };
}

async function ensureSchema(db: RuntimeDatabase) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS checko_profiles (
    inn TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    raw_payload TEXT,
    fetched_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  try { await db.prepare("ALTER TABLE checko_profiles ADD COLUMN raw_payload TEXT").run(); } catch { /* already migrated */ }
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function validInn(value: string) {
  if (!/^\d{10}$|^\d{12}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const checksum = (weights: number[]) => weights.reduce((sum, weight, index) => sum + weight * digits[index], 0) % 11 % 10;
  if (digits.length === 10) return checksum([2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[9];
  return checksum([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[10]
    && checksum([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[11];
}

async function callChecko(apiKey: string, method: string, inn: string, params: JsonRecord = {}) {
  try {
    const response = await fetch(`${ENDPOINT}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ key: apiKey, inn, ...params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { ok: false as const, error: `Внешний источник вернул HTTP ${response.status}` };
    const body = await response.json() as CheckoResponse;
    if (body.meta?.status === "error") return { ok: false as const, error: body.meta.message || `Ошибка метода ${method}`, meta: body.meta };
    return { ok: true as const, body, meta: body.meta };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : `Метод ${method} недоступен` };
  }
}

function countRecords(response?: CheckoResponse) {
  const data = record(response?.data);
  return number(data.ЗапВсего) || array(data.Записи).length;
}

function latestFinances(response?: CheckoResponse) {
  const data = record(response?.data);
  const years = Object.keys(data).filter((key) => /^\d{4}$/.test(key)).sort((a, b) => Number(b) - Number(a));
  const latestYear = years[0] ?? "";
  const latest = record(data[latestYear]);
  const previous = record(data[years[1] ?? ""]);
  const revenue = number(latest["2110"]);
  const previousRevenue = number(previous["2110"]);
  const profit = number(latest["2400"]);
  const assets = number(latest["1600"]);
  const currentAssets = number(latest["1200"]);
  const equity = number(latest["1300"]);
  const currentLiabilities = number(latest["1500"]);
  const receivables = number(latest["1230"]);
  const cash = number(latest["1250"]);
  const payables = number(latest["1520"]);
  const nonCurrentAssets = nullableNumber(latest["1100"]);
  const inventories = nullableNumber(latest["1210"]);
  const inputVat = nullableNumber(latest["1220"]);
  const longTermLiabilities = nullableNumber(latest["1400"]);
  const longTermBorrowings = nullableNumber(latest["1410"]);
  const shortTermBorrowings = nullableNumber(latest["1510"]);
  const costOfSales = nullableNumber(latest["2120"]);
  const grossProfit = nullableNumber(latest["2100"]);
  const operatingProfit = nullableNumber(latest["2200"]);
  const interestExpense = nullableNumber(latest["2330"]);
  const profitBeforeTax = nullableNumber(latest["2300"]);
  const totalBorrowings = (longTermBorrowings ?? 0) + (shortTermBorrowings ?? 0);
  const fieldsPresent = Object.keys(latest).filter((key) => /^\d{4}$/.test(key));
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
    currentLiquidity: currentLiabilities ? Math.round(currentAssets / currentLiabilities * 100) / 100 : null,
    autonomy: assets ? Math.round(equity / assets * 1000) / 10 : null,
    returnOnSales: revenue ? Math.round(profit / revenue * 1000) / 10 : null,
    nonCurrentAssets, inventories, inputVat, longTermLiabilities, longTermBorrowings, shortTermBorrowings,
    costOfSales, grossProfit, operatingProfit, interestExpense, profitBeforeTax,
    workingCapital: latestYear ? currentAssets - currentLiabilities : null,
    debtToEquity: equity > 0 && (longTermBorrowings != null || shortTermBorrowings != null) ? Math.round(totalBorrowings / equity * 100) / 100 : null,
    interestCoverage: interestExpense && operatingProfit != null ? Math.round(operatingProfit / Math.abs(interestExpense) * 100) / 100 : null,
    fieldsPresent,
  };
}

function normalizeContracts(response?: CheckoResponse) {
  const data = record(response?.data);
  const rows = array(data.Записи).map(record);
  const normalized = rows.map((row) => {
    const statusObject = record(row.Статус);
    const customerObject = record(row.Заказчик);
    const amount = number(row.Цена || row.Сумма || row.ЦенаКонтракта || row.СумКонтракта);
    const status = text(statusObject.Наим || row.СтатусНаим || row.Статус || "Статус не указан");
    const closed = /(исполнен|заверш|расторг|прекращ)/i.test(status);
    return {
      number: text(row.РегНомер || row.Номер || row.НомерКонтракта),
      subject: text(row.Предмет || row.Наим || row.ОбъектЗакупки || row.ПредметКонтракта),
      customer: text(customerObject.НаимСокр || customerObject.НаимПолн || customerObject.Наим || row.ЗаказчикНаим || "Заказчик не указан"),
      law: text(row.ФЗ || row.Закон || row.Тип || "Госзакупка"),
      amount,
      signedAt: text(row.ДатаЗакл || row.ДатаЗаключ || row.Дата || row.ДатаПодписания),
      executionAt: text(row.ДатаИсп || row.ДатаИсполнения || row.СрокИсполнения),
      status,
      active: !closed,
    };
  });
  const totalAmount = normalized.reduce((sum, item) => sum + item.amount, 0);
  const active = normalized.filter((item) => item.active);
  const byCustomer = new Map<string, number>();
  for (const item of normalized) byCustomer.set(item.customer, (byCustomer.get(item.customer) ?? 0) + item.amount);
  const topCustomerAmount = Math.max(0, ...byCustomer.values());
  return {
    totalCount: number(data.ЗапВсего) || normalized.length,
    activeCount: active.length,
    completedCount: normalized.filter((item) => !item.active).length,
    totalAmount,
    activeAmount: active.reduce((sum, item) => sum + item.amount, 0),
    topCustomerShare: totalAmount > 0 ? Math.round(topCustomerAmount / totalAmount * 1000) / 10 : null,
    items: normalized.slice(0, 8).map((item) => ({
      number: item.number, subject: item.subject, customer: item.customer, law: item.law,
      amount: item.amount, signedAt: item.signedAt, executionAt: item.executionAt, status: item.status,
    })),
  };
}

function responseRows(response?: CheckoResponse) {
  const data = record(response?.data);
  return array(data.Записи || data.События || data.Данные).map(record);
}

function normalizeExternalBanks(company: JsonRecord, response?: CheckoResponse) {
  const candidates = [
    ...array(company.БанкРекв), ...array(company.Банки), ...array(company.РасчСчета),
    ...responseRows(response), ...array(record(response?.data).Банки),
  ].map(record);
  const seen = new Set<string>();
  return candidates.flatMap((row) => {
    const bank = record(row.Банк);
    const name = text(bank.Наим || bank.Наименование || row.БанкНаим || row.Наим || row.Наименование);
    const bik = text(bank.БИК || row.БИК).replace(/\D/g, "");
    const account = text(row.РасчСчет || row.Счет || row.НомерСчета).replace(/\D/g, "");
    const key = `${bik}:${account}:${name}`;
    if (!name && !bik) return [];
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ name: name || "Банк не указан", bik, account: account ? `••••${account.slice(-4)}` : "", status: "BANK_FOUND_IN_EXTERNAL_DATA" as const, evidence: "Реквизит найден во внешних данных; наличие действующего счёта подтверждается только банковской выпиской." }];
  });
}

function normalizeTimeline(response?: CheckoResponse) {
  return responseRows(response).slice(0, 50).map((row) => {
    const description = text(row.Опис || row.Описание || row.Наим || row.Событие || row.Тип);
    const review = /(руковод|директор|учред|адрес|реорган|ликвид|статус)/i.test(description);
    return {
      eventType: text(row.Код || row.Тип || row.Вид) || "REGISTRY_EVENT",
      eventDate: text(row.Дата || row.ДатаСобытия || row.ДатаЗаписи),
      entityType: text(row.Субъект || row.Объект || row.Раздел) || "COMPANY",
      description: description || "Регистрационное изменение",
      source: "Официальный реестр · история изменений",
      severityCandidate: review ? "review" as const : "information" as const,
    };
  });
}

function normalizeEnforcements(response?: CheckoResponse) {
  return responseRows(response).slice(0, 50).map((row) => {
    const state = text(row.Статус || row.Состояние || row.СтатусИП);
    return {
      number: text(row.Номер || row.НомерИП || row.ИПНомер),
      date: text(row.Дата || row.ДатаВозб || row.ДатаИП),
      amount: nullableNumber(row.ОстЗадолж || row.СумДолг || row.Сумма),
      state,
      subject: text(row.Предмет || row.ПредметИсп || row.Основание),
      active: !/(окончен|прекращ|заверш)/i.test(state),
      source: "Официальный реестр · исполнительные производства",
    };
  });
}

function normalizeLegalCases(response?: CheckoResponse) {
  return responseRows(response).slice(0, 50).map((row) => {
    const roleText = text(row.Роль || row.ТипСтороны || row.Сторона);
    const role = /(истец|заявител)/i.test(roleText) ? "PLAINTIFF" as const : /(ответчик|должник)/i.test(roleText) ? "DEFENDANT" as const : "OTHER" as const;
    return {
      number: text(row.Номер || row.НомерДела),
      date: text(row.Дата || row.ДатаДела),
      amount: nullableNumber(row.Сумма || row.СумИск),
      role,
      status: text(row.Статус || row.Состояние),
      court: text(row.Суд || row.НаимСуда),
      source: "Официальные и открытые источники · арбитраж",
    };
  });
}

function normalizeInspections(response?: CheckoResponse) {
  return responseRows(response).slice(0, 50).map((row) => ({
    date: text(row.Дата || row.ДатаНач || row.ДатаПроверки),
    authority: text(row.Орган || row.НаимОргана || row.КонтролОрган),
    type: text(row.Тип || row.Вид || row.Форма),
    result: text(row.Результат || row.Итог),
    violations: text(row.Нарушения || row.Выявлено),
    status: text(row.Статус || row.Состояние),
    source: "Официальный реестр · проверки",
  }));
}

function normalizeRegistryMessages(...responses: Array<CheckoResponse | undefined>) {
  return responses.flatMap((response) => responseRows(response)).slice(0, 80).map((row) => {
    const title = text(row.Заголовок || row.Наим || row.Тип || row.ВидСообщения);
    const combined = `${title} ${text(row.Текст || row.Опис || row.Содержание)}`;
    const classification = /(намерен.*банкрот|признан.*банкрот|конкурсн.*производ)/i.test(combined)
      ? "CRITICAL_CANDIDATE" as const
      : /(ликвидац|реорган|залог|недостаточн.*имуществ)/i.test(combined)
        ? "HIGH_RISK_CANDIDATE" as const
        : /(требует|кредитор|существен)/i.test(combined) ? "REVIEW" as const : "INFORMATIONAL" as const;
    return {
      messageType: text(row.Тип || row.Вид || row.Категория),
      date: text(row.Дата || row.ДатаПубл),
      title: title || "Сообщение реестра",
      sourceId: text(row.Ид || row.ID || row.Номер || row.НомерСообщ),
      classification,
      source: "Официальный реестр сообщений",
    };
  });
}

function buildSignals(company: JsonRecord, finances: ReturnType<typeof latestFinances>, legal: { enforcementDebt: number; enforcements: number; bankruptcyMessages: number; legalCases: number }) {
  const signals: Array<{ severity: "critical" | "warning" | "info"; title: string; detail: string }> = [];
  const status = record(company.Статус);
  const address = record(company.ЮрАдрес);
  const managers = array(company.Руковод).map(record);
  if (text(status.Код) && !["001", "101"].includes(text(status.Код))) signals.push({ severity: "critical", title: "Особый статус компании", detail: text(status.Наим) || "Требуется проверка статуса в ЕГРЮЛ" });
  if (address.Недост === true) signals.push({ severity: "critical", title: "Недостоверность юридического адреса", detail: text(address.НедостОпис) || "В ЕГРЮЛ есть отметка о недостоверности" });
  if (array(address.МассАдрес).length > 20) signals.push({ severity: "warning", title: "Признаки массового адреса", detail: `По адресу зарегистрировано не менее ${array(address.МассАдрес).length} организаций` });
  if (managers.some((manager) => manager.Недост === true || manager.ДисквЛицо === true)) signals.push({ severity: "critical", title: "Риск по руководителю", detail: "Найдена недостоверность или дисквалификация руководителя" });
  if (managers.some((manager) => manager.МассРуковод === true)) signals.push({ severity: "warning", title: "Массовый руководитель", detail: "Сигнал требует ручной проверки связанных организаций" });
  if (finances.latestYear && finances.equity < 0) signals.push({ severity: "critical", title: "Отрицательный капитал", detail: `По БФО за ${finances.latestYear} год собственный капитал отрицательный` });
  if (finances.currentLiquidity != null && finances.currentLiquidity < 1) signals.push({ severity: "warning", title: "Недостаточная текущая ликвидность", detail: `Коэффициент ${finances.currentLiquidity}; ориентир Прескор — не ниже 1,0` });
  if (legal.enforcementDebt > 0) signals.push({ severity: legal.enforcementDebt >= 1_000_000 ? "critical" : "warning", title: "Исполнительные производства", detail: `Найдено ${legal.enforcements}, видимый остаток задолженности ${Math.round(legal.enforcementDebt).toLocaleString("ru-RU")} ₽` });
  if (legal.bankruptcyMessages > 0) signals.push({ severity: "warning", title: "Сообщения ЕФРСБ", detail: `Найдено ${legal.bankruptcyMessages}. Сам факт сообщения не означает банкротство — требуется проверка содержания.` });
  if (legal.legalCases > 0) signals.push({ severity: "info", title: "Арбитражные дела", detail: `Найдено ${legal.legalCases}; роль и суммы нужно оценивать отдельно` });
  if (!signals.length) signals.push({ severity: "info", title: "Критические сигналы не обнаружены", detail: "По доступным официальным данным явных стоп-факторов не найдено" });
  return signals;
}

function normalizeProfile(inn: string, responses: Record<string, CheckoResponse | undefined>, failedMethods: string[]) {
  const company = record(responses.company?.data);
  const finances = latestFinances(responses.finances);
  const enforcementData = record(responses.enforcements?.data);
  const enforcementRows = array(enforcementData.Записи).map(record);
  const legal = {
    legalCases: countRecords(responses["legal-cases"]),
    enforcements: countRecords(responses.enforcements),
    enforcementDebt: enforcementRows.reduce((sum, row) => sum + number(row.ОстЗадолж || row.СумДолг), 0),
    inspections: countRecords(responses.inspections),
    bankruptcyMessages: countRecords(responses["bankruptcy-messages"]),
  };
  const address = record(company.ЮрАдрес);
  const okved = record(company.ОКВЭД);
  const status = record(company.Статус);
  const capital = record(company.УстКап);
  const managers = array(company.Руковод).map(record).slice(0, 4).map((item) => ({ name: text(item.ФИО), position: text(item.НаимДолжн), inn: text(item.ИНН) }));
  const founders = record(company.Учред);
  const foundersCount = array(founders.ФЛ).length + array(founders.РосОрг).length + array(founders.ИнОрг).length + array(founders.ПИФ).length + array(founders.РФ).length;
  const retrievedAt = new Date().toISOString();
  const endpoints = inn.length === 12
    ? ["entrepreneur", "legal-cases", "bankruptcy-messages", "contracts", "timeline", "fedresurs"]
    : ["company", "finances", "legal-cases", "enforcements", "inspections", "bankruptcy-messages", "contracts", "timeline", "fedresurs", "bank"];
  const normalizedFieldCodes: Record<string, string> = {
    revenue: "2110", profit: "2400", assets: "1600", currentAssets: "1200", equity: "1300",
    currentLiabilities: "1500", receivables: "1230", cash: "1250", payables: "1520",
    nonCurrentAssets: "1100", inventories: "1210", inputVat: "1220", longTermLiabilities: "1400",
    longTermBorrowings: "1410", shortTermBorrowings: "1510", costOfSales: "2120", grossProfit: "2100",
    operatingProfit: "2200", interestExpense: "2330", profitBeforeTax: "2300",
  };
  const financeFields = new Set(finances.fieldsPresent);
  const bfoStatus = failedMethods.includes("finances") ? "FAILED" as const : finances.latestYear ? "READY" as const : "EMPTY" as const;
  const bfo: SourceEnvelope | undefined = inn.length === 12 ? undefined : {
    sourceId: `bfo:${inn}:${retrievedAt}`,
    sourceType: "BFO",
    status: bfoStatus,
    companyInn: inn,
    sourceName: "Официальная бухгалтерская отчётность",
    periodFrom: finances.latestYear ? `${finances.latestYear}-01-01` : undefined,
    periodTo: finances.latestYear ? `${finances.latestYear}-12-31` : undefined,
    receivedAt: retrievedAt,
    parserVersion: "PRESCORE-BFO-NORMALIZER-1",
    integrityVersion: INFRASTRUCTURE_VERSIONS.integrity,
    confidence: bfoStatus === "READY" ? Math.round(Math.min(100, financeFields.size / Object.keys(normalizedFieldCodes).length * 100)) : null,
    warnings: bfoStatus === "FAILED" ? ["Источник БФО недоступен."] : bfoStatus === "EMPTY" ? ["В источнике нет бухгалтерской отчётности."] : [],
    rawReference: `external:/finances:${retrievedAt}`,
    fieldAvailability: Object.fromEntries(Object.entries(normalizedFieldCodes).map(([field, code]) => [field, financeFields.has(code) ? "KNOWN" : "UNKNOWN"])),
  };
  const external: SourceEnvelope[] = endpoints.filter((endpoint) => endpoint !== "finances").map((endpoint) => {
    const response = responses[endpoint] || (endpoint === "company" ? responses.company : endpoint === "entrepreneur" ? responses.entrepreneur : undefined);
    const status = failedMethods.includes(endpoint) ? "FAILED" as const : response ? "READY" as const : "EMPTY" as const;
    const knownField = endpoint === "legal-cases" ? "legalCases"
      : endpoint === "enforcements" ? "enforcements"
        : endpoint === "inspections" ? "inspections"
          : endpoint === "bankruptcy-messages" ? "bankruptcyMessages"
            : undefined;
    return {
      sourceId: `external:${endpoint}:${inn}:${retrievedAt}`,
      sourceType: endpoint === "contracts" ? "EIS" as const : "CHECKO" as const,
      status,
      companyInn: inn,
      sourceName: endpoint === "contracts" ? "Открытый реестр закупок" : `Официальные и открытые источники /${endpoint}`,
      receivedAt: retrievedAt,
      parserVersion: "PRESCORE-EXTERNAL-NORMALIZER-1",
      integrityVersion: INFRASTRUCTURE_VERSIONS.integrity,
      confidence: null,
      warnings: status === "FAILED" ? [`Источник /${endpoint} недоступен.`] : [],
      rawReference: `external:/${endpoint}:${retrievedAt}`,
      fieldAvailability: knownField ? { [knownField]: status === "READY" ? "KNOWN" : "UNKNOWN" } : undefined,
    };
  });
  const profile = {
    inn,
    source: "Официальные и открытые источники",
    fetchedAt: retrievedAt,
    failedMethods,
    company: {
      name: text(company.НаимСокр || company.НаимПолн),
      fullName: text(company.НаимПолн),
      ogrn: text(company.ОГРН),
      kpp: text(company.КПП),
      status: text(status.Наим) || "Статус не указан",
      registrationDate: text(company.ДатаРег),
      region: text(record(company.Регион).Наим),
      address: text(address.АдресРФ),
      addressUnreliable: address.Недост === true,
      okvedCode: text(okved.Код),
      okved: text(okved.Наим),
      capital: number(capital.Сумма),
      managers,
      foundersCount,
    },
    finances,
    legal,
    ...checkoFinancialShadow(responses.finances, bfo, finances),
    sourceManifest: { bfo, external },
    sourceStatus: endpoints.map((endpoint) => ({
      endpoint: `/${endpoint}`,
      status: failedMethods.includes(endpoint)
        ? "unavailable" as const
        : (responses[endpoint] || (endpoint === "company" && responses.company)) ? "available" as const : "partial" as const,
      retrievedAt,
    })),
    externalBanks: normalizeExternalBanks(company, responses.bank),
    timeline: normalizeTimeline(responses.timeline),
    enforcementItems: normalizeEnforcements(responses.enforcements),
    legalCaseItems: normalizeLegalCases(responses["legal-cases"]),
    inspectionItems: normalizeInspections(responses.inspections),
    registryMessages: normalizeRegistryMessages(responses.fedresurs, responses["bankruptcy-messages"]),
    contracts: normalizeContracts(responses.contracts),
    signals: [] as ReturnType<typeof buildSignals>,
  };
  profile.signals = buildSignals(company, finances, legal);
  return profile;
}

function neutralizePublicProfile(profile: JsonRecord) {
  const signals = Array.isArray(profile.signals)
    ? profile.signals.map((signal) => {
      if (!signal || typeof signal !== "object") return signal;
      const item = signal as JsonRecord;
      return {
        ...item,
        detail: String(item.detail ?? "").replace(/по доступным данным checko/gi, "по доступным официальным данным"),
      };
    })
    : profile.signals;
  return { ...profile, source: "Официальные и открытые источники", signals };
}

function publicCompanyView(profile: JsonRecord) {
  const company = record(profile.company);
  const legal = record(profile.legal);
  const contracts = record(profile.contracts);
  const items = array(contracts.items).map(record);
  const status = text(company.status);
  const risks = {
    criticalStatus: Boolean(status && !/действ/i.test(status)),
    enforcementDetected: number(legal.enforcements) > 0,
    legalEventsDetected: number(legal.legalCases) > 0,
    bankruptcyEventsDetected: number(legal.bankruptcyMessages) > 0,
  };
  return {
    freeView: true,
    inn: text(profile.inn), fetchedAt: text(profile.fetchedAt), cached: Boolean(profile.cached),
    company: {
      name: text(company.name), ogrn: text(company.ogrn), status,
      registrationDate: text(company.registrationDate), okvedCode: text(company.okvedCode),
      okved: text(company.okved), region: text(company.region),
      managers: array(company.managers).slice(0, 1), smb: text(company.smb ?? company.sme ?? ""),
    },
    publicRisks: { ...risks, attentionCount: Object.values(risks).filter(Boolean).length },
    contracts: {
      totalCount: number(contracts.totalCount), activeCount: number(contracts.activeCount),
      activeAmount: number(contracts.activeAmount),
      items: items.filter((item) => !/(исполнен|заверш|расторг|прекращ)/i.test(text(item.status))).slice(0, 3),
    },
    locked: { legalProfile: true, finances: true, expertInterpretation: true },
    source: "Официальные и открытые источники",
  };
}

function profileView(profile: JsonRecord, tier: AnalysisTier) {
  const neutral = neutralizePublicProfile(profile);
  return tier === "FULL" ? neutral : publicCompanyView(neutral);
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const url = new URL(request.url);
  const inn = (url.searchParams.get("inn") ?? "").replace(/\D/g, "");
  const analysisId = url.searchParams.get("analysisId") || "";
  const refresh = url.searchParams.get("refresh") === "1";
  if (!validInn(inn)) return Response.json({ error: "Укажите корректный ИНН организации или ИП" }, { status: 400 });

  try {
    const { db, apiKey } = await runtime();
    await ensureSchema(db);
    const access = analysisId ? await readableAnalysis<{ payload: string; companyInn: string; ownerEmail: string }>(db, analysisId, user) : null;
    if (!access || access.row.companyInn !== inn) return Response.json({ error: "Профиль должен быть запрошен в контексте доступного анализа" }, { status: 403 });
    const tier = await resolveAnalysisTier(db, { analysisId, userEmail: access.row.ownerEmail, companyInn: inn, privileged: user.isAdmin || access.access === "agent" });
    if (!refresh) {
      const cached = await db.prepare("SELECT payload, fetched_at AS fetchedAt FROM checko_profiles WHERE inn = ?").bind(inn).first<{ payload: string; fetchedAt: string }>();
      if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_MS) return Response.json({ ...profileView({ ...JSON.parse(cached.payload) as JsonRecord, cached: true }, tier), tier });
    }
    if (!apiKey) return Response.json({ error: "Внешний источник данных ещё не подключён к серверу Прескор" }, { status: 503 });

    const companyResult = await callChecko(apiKey, inn.length === 12 ? "entrepreneur" : "company", inn);
    if (!companyResult.ok) return Response.json({ error: companyResult.error }, { status: 502 });

    const methods = inn.length === 12
      ? ["legal-cases", "bankruptcy-messages", "contracts", "timeline", "fedresurs"]
      : ["finances", "legal-cases", "enforcements", "inspections", "bankruptcy-messages", "contracts", "timeline", "fedresurs", "bank"];
    const results = await Promise.all(methods.map(async (method) => [method, await callChecko(apiKey, method, inn, { limit: 100, sort: "-date" })] as const));
    const responses: Record<string, CheckoResponse | undefined> = {
      company: companyResult.body,
      [inn.length === 12 ? "entrepreneur" : "company"]: companyResult.body,
    };
    const failedMethods: string[] = [];
    for (const [method, result] of results) {
      if (result.ok) responses[method] = result.body;
      else failedMethods.push(method);
    }
    const profile = normalizeProfile(inn, responses, failedMethods);
    const rawSnapshot = JSON.stringify({ retrievedAt: profile.fetchedAt, responses });
    await db.prepare(`INSERT INTO checko_profiles (inn, payload, raw_payload, fetched_at, updated_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(inn) DO UPDATE SET payload = excluded.payload, raw_payload = excluded.raw_payload, fetched_at = excluded.fetched_at, updated_at = excluded.updated_at`)
      .bind(inn, JSON.stringify(profile), rawSnapshot, profile.fetchedAt, new Date().toISOString()).run();
    return Response.json({ ...profileView({ ...profile, cached: false }, tier), tier });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось получить данные из внешнего источника" }, { status: 500 });
  }
}
