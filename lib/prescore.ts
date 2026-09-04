import type { CreditHistoryInsight, CreditHistoryReport, CreditPortfolioComparison } from "./credit-history";
import type { QuarterlyFinancialReport } from "./quarterly-report";
import {
  INFRASTRUCTURE_VERSIONS,
  type AnalysisIntegritySummary,
  type AnalysisSourceManifest,
  type DeduplicationDiagnostic,
  type InfrastructureVersions,
  type StatementScreeningResult,
} from "./credit-engine/contracts/sources.ts";
import { buildAnalysisIntegrity, sourceReference } from "./credit-engine/source-foundation.ts";

export type TransactionDirection = "in" | "out" | "unknown";

export type TransactionCategory =
  | "revenue"
  | "loan_inflow"
  | "owner_funding"
  | "refund_in"
  | "tax"
  | "payroll"
  | "personal"
  | "cash"
  | "debt"
  | "leasing"
  | "supplier"
  | "refund_out"
  | "internal"
  | "other";

export type NormalizedTransaction = {
  id: string;
  date: string;
  amount: number;
  direction: TransactionDirection;
  counterparty: string;
  counterpartyInn: string;
  purpose: string;
  category: TransactionCategory;
  categoryConfidence?: "high" | "medium" | "low";
  classificationEvidence?: string;
  account: string;
  sourceId?: string;
  sourceFileId?: string;
  sourceFileName?: string;
  bank?: string;
  sourceRow?: number;
  rawReference?: string;
  parserVersion?: string;
  classifierVersion?: string;
};

export type StopFactor = {
  code?: string;
  severity: "critical" | "warning" | "info";
  decisionClass?: "stop" | "manual-review" | "risk" | "information";
  source?: "Выписки" | "БФО" | "Квартальная отчётность" | "Правовой контур" | "БКИ" | "Сверка источников";
  period?: string;
  evidence?: string;
  needsReview?: boolean;
  title: string;
  detail: string;
  impact?: string;
  action?: string;
};

export type Recommendation = {
  product: string;
  title: string;
  rationale: string;
  action: string;
  expectedEffect?: string;
  horizon?: string;
  priority: "high" | "medium" | "low";
  trigger?: string;
  evidence?: string;
  relatedMetric?: string;
  source?: string;
  period?: string;
};

export type AnalysisEvidence = {
  id: string;
  conclusion: string;
  metric: string;
  value: string;
  source: string;
  period: string;
};

export type RiskSummary = {
  title: string;
  detail: string;
  source: string;
  evidence: string;
};

export type ProductFit = {
  product: string;
  status: "recommended" | "conditional" | "not-now";
  statusLabel: string;
  amountMin: number;
  amountMax: number;
  why: string[];
  conditions: string[];
};

export type StatementInput = {
  text: string;
  fileName: string;
  sourceId?: string;
  contentHash?: string;
};

export type StatementInspection = {
  fileName: string;
  companyInn: string;
  companyName: string;
  bankName: string;
  accounts: string[];
  periodFrom: string;
  periodTo: string;
  coveragePeriodFrom?: string;
  coveragePeriodTo?: string;
  openingBalanceKnown?: boolean;
  endingBalanceKnown?: boolean;
};

export type AnalysisResult = {
  id: string;
  companyName: string;
  companyInn: string;
  fileName: string;
  sourceFiles: string[];
  bankNames: string[];
  periodFrom: string;
  periodTo: string;
  score: number;
  grade: string;
  readiness: string;
  createdAt: string;
  metrics: {
    months: number;
    statements: number;
    accounts: number;
    transactions: number;
    grossInflow: number;
    operatingInflow: number;
    nonOperatingInflow: number;
    unknownInflow: number;
    inflow: number;
    outflow: number;
    avgMonthlyInflow: number;
    monthlyTrend: number;
    volatility: number;
    topOneConcentration: number;
    topThreeConcentration: number;
    topFiveConcentration: number;
    largeIncomingShare: number;
    taxRegularity: number;
    riskyOutflowShare: number;
    debtServiceShare: number;
    endingBalance: number | null;
    liquidityDays: number | null;
    averageDailyBalance: number | null;
    minimumDailyBalance: number | null;
    cashGapDays: number | null;
    negativeBalanceDays: number | null;
    seasonality: number;
    supplierPaymentRegularity: number;
    dataQuality: number;
    estimatedLimitMin: number;
    estimatedLimitMax: number;
    stressLimitMax: number;
    currentMonthlyDebtPayment: number;
    baseMonthlyPaymentCapacity: number;
    stressMonthlyPaymentCapacity: number;
    stressMonthlyInflow: number;
    referenceTermMonths: number;
    referenceAnnualRate: number;
    limitConfidence: number;
  };
  monthly: Array<{ month: string; inflow: number; outflow: number }>;
  topCounterparties: Array<{ name: string; amount: number; share: number }>;
  factors: StopFactor[];
  topRisks: RiskSummary[];
  strengths: RiskSummary[];
  evidence: AnalysisEvidence[];
  recommendations: Recommendation[];
  productFits: ProductFit[];
  transactions: NormalizedTransaction[];
  warnings: string[];
  methodologyVersion?: string;
  creditHistory?: CreditHistoryReport;
  creditPortfolioComparison?: CreditPortfolioComparison;
  creditHistoryInsights?: CreditHistoryInsight[];
  quarterlyReport?: QuarterlyFinancialReport;
  sourceManifest?: AnalysisSourceManifest;
  integrity?: AnalysisIntegritySummary;
  screeningResults?: StatementScreeningResult[];
  deduplication?: DeduplicationDiagnostic;
  infrastructureVersions?: InfrastructureVersions;
  transactionsTruncated?: boolean;
  storedTransactionCount?: number;
  originalTransactionCount?: number;
};

type AccountBlock = {
  account: string;
  openingBalance: number | null;
  endingBalance: number | null;
  periodFrom: string;
  periodTo: string;
};

type ParsedDocument = Record<string, string> & { __account?: string };

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function annuityPrincipal(payment: number, annualRate: number, months: number) {
  if (payment <= 0 || months <= 0) return 0;
  const rate = annualRate / 12;
  if (!rate) return payment * months;
  return payment * (1 - Math.pow(1 + rate, -months)) / rate;
}

function cleanNumber(value?: string) {
  if (!value) return 0;
  const normalized = value.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value?: string) {
  if (!value) return "";
  const matched = value.trim().match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (!matched) return "";
  const [, day, month, year] = matched;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeAccount(value?: string) {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeInn(value?: string) {
  return (value ?? "").replace(/\D/g, "");
}

function field(record: Record<string, string>, ...names: string[]) {
  for (const name of names) if (record[name]) return record[name].trim();
  return "";
}

function companySideName(record: Record<string, string>, side: "payer" | "recipient") {
  return side === "payer"
    ? field(record, "Плательщик", "Плательщик1", "НаименованиеПлательщика", "ПлательщикНаименование")
    : field(record, "Получатель", "Получатель1", "НаименованиеПолучателя", "ПолучательНаименование");
}

function isBankInterfaceName(value: string) {
  const text = value.toLowerCase().replace(/ё/g, "е");
  return !value.trim() || /(psb\s*online|псб\s*онлайн|промсвязьбанк|client.?bank|клиент.?банк|банк.?клиент|internet.?bank|интернет.?банк|online.?bank|isimplebank|bankfaktura)/i.test(text);
}

function cleanCompanyName(value: string) {
  return value.replace(/\s+/g, " ").replace(/^[-–—\s]+|[-–—\s]+$/g, "").trim();
}

function bankNameFromHeader(header: Record<string, string>, fileName: string) {
  const source = `${field(header, "Отправитель", "Банк", "НаименованиеБанка")} ${fileName}`.toLowerCase().replace(/ё/g, "е");
  if (/(psb|псб|промсвяз)/.test(source)) return "ПСБ";
  if (/(alfa|альфа)/.test(source)) return "Альфа-Банк";
  if (/(tinkoff|тинькофф|t-bank|т-банк)/.test(source)) return "Т-Банк";
  if (/(sber|сбер)/.test(source)) return "СберБанк";
  if (/(vtb|втб)/.test(source)) return "ВТБ";
  if (/(modul|модуль)/.test(source)) return "Модульбанк";
  if (/(tochka|точка)/.test(source)) return "Банк Точка";
  if (/(ак\s*барс|ak\s*bars)/.test(source)) return "АК БАРС БАНК";
  if (/(совком)/.test(source)) return "Совкомбанк";
  if (/(урал.?фд)/.test(source)) return "Урал ФД";
  if (/(уралсиб)/.test(source)) return "Уралсиб";
  if (/(левобереж)/.test(source)) return "Банк «Левобережный»";
  if (/(райф)/.test(source)) return "Райффайзенбанк";
  if (/(ланта)/.test(source)) return "Ланта-Банк";
  if (/(новокиб)/.test(source)) return "НБК-Банк";
  if (/(углемет)/.test(source)) return "Углеметбанк";
  if (/(\bббр\b)/.test(source)) return "ББР Банк";
  if (/(\bсгб\b)/.test(source)) return "Банк СГБ";
  if (/(\bкхб\b)/.test(source)) return "КХБ";
  const sender = cleanCompanyName(field(header, "Отправитель", "Банк", "НаименованиеБанка"));
  return sender && !isBankInterfaceName(sender) ? sender : "Банк не определён";
}

function normalizedBankLabel(value: string) {
  const source = cleanCompanyName(value);
  const text = source.toLowerCase().replace(/ё/g, "е");
  if (!source || isBankInterfaceName(source) || /^(г\.|город\s)/.test(text)) return "";
  if (/(сбер)/.test(text)) return "СберБанк";
  if (/(альфа)/.test(text)) return "Альфа-Банк";
  if (/(тинькофф|т-банк)/.test(text)) return "Т-Банк";
  if (/(втб)/.test(text)) return "ВТБ";
  if (/(промсвяз|псб)/.test(text)) return "ПСБ";
  if (/(точка)/.test(text)) return "Банк Точка";
  if (/(модуль)/.test(text)) return "Модульбанк";
  if (/(уралсиб)/.test(text)) return "Уралсиб";
  if (/(фк\s*открытие|банк\s*[«\"]?открытие)/.test(text)) return "Банк «Открытие»";
  if (/(московский кредитный банк)/.test(text)) return "МКБ";
  if (/(газпромбанк|банк гпб)/.test(text)) return "Газпромбанк";
  if (/(локо.?банк)/.test(text)) return "ЛОКО-Банк";
  if (/(убрир)/.test(text)) return "УБРиР";
  if (/(совком)/.test(text)) return "Совкомбанк";
  if (/(райфф?айзен)/.test(text)) return "Райффайзенбанк";
  if (/(ак\s*барс)/.test(text)) return "АК БАРС БАНК";
  if (/(левобереж)/.test(text)) return "Банк «Левобережный»";
  if (/(ланта)/.test(text)) return "Ланта-Банк";
  if (/(углемет)/.test(text)) return "Углеметбанк";
  if (/(ббр)/.test(text)) return "ББР Банк";
  if (/(сгб)/.test(text)) return "Банк СГБ";
  if (/(агророс)/.test(text)) return "Банк Агророс";
  if (/(кузбасхимбанк)/.test(text)) return "Кузбассхимбанк";
  if (/(новокиб)/.test(text)) return "НОВОКИБ";
  if (/(урал\s*фд)/.test(text)) return "Урал ФД";
  return source;
}

function bankNameFromDocuments(documents: ParsedDocument[], accounts: AccountBlock[], header: Record<string, string>, fileName: string) {
  const accountSet = new Set(accounts.map((item) => item.account).filter(Boolean));
  const candidates = new Map<string, number>();
  const add = (value: string) => {
    const label = normalizedBankLabel(value);
    if (label) candidates.set(label, (candidates.get(label) ?? 0) + 1);
  };
  for (const doc of documents) {
    const payerAccount = normalizeAccount(field(doc, "ПлательщикСчет", "СчетПлательщика"));
    const recipientAccount = normalizeAccount(field(doc, "ПолучательСчет", "СчетПолучателя"));
    if (accountSet.has(payerAccount)) add(field(doc, "ПлательщикБанк1", "БанкПлательщика", "ПлательщикБанк", "НаименованиеБанкаПлательщика"));
    if (accountSet.has(recipientAccount)) add(field(doc, "ПолучательБанк1", "БанкПолучателя", "ПолучательБанк", "НаименованиеБанкаПолучателя"));
  }
  const detected = [...candidates.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return detected || bankNameFromHeader(header, fileName);
}

function getCategory(purpose: string, direction: TransactionDirection, internal: boolean): Pick<NormalizedTransaction, "category" | "categoryConfidence" | "classificationEvidence"> {
  const text = purpose.toLowerCase().replace(/ё/g, "е");
  const result = (category: TransactionCategory, classificationEvidence: string, categoryConfidence: "high" | "medium" | "low" = "high") => ({ category, classificationEvidence, categoryConfidence });
  if (internal) return result("internal", "ИНН плательщика и получателя совпадает с владельцем счёта");
  if (direction === "in") {
    if (/(выдач|предоставлен|зачислен|транш|кредитн.*средств|кредит по|договор.*кредит|займ от|договор.*займ|финансирован.*фактор)/.test(text)) return result("loan_inflow", "Назначение содержит признаки кредита, займа или финансирования");
    if (/(взнос.*устав|вклад.*имущество|финансов.*помощ|пополнен.*собствен|взнос.*учред|от учредител|добавочн.*капитал)/.test(text)) return result("owner_funding", "Назначение содержит признаки взноса собственника или финансовой помощи");
    if (/(возврат.*ошиб|возврат.*излиш|возврат.*аванс|возврат.*денеж|возврат платеж|сторно)/.test(text)) return result("refund_in", "Назначение содержит признаки возврата или сторно");
    if (/(оплат[аы]?\s|оплата по|за товар|за услуг|за работ|по счет|по договор|реализац|выручк|эквайринг|маркетплейс)/.test(text)) return result("revenue", "Назначение подтверждает оплату товаров, работ или услуг");
    return result("other", "Нет достаточных признаков операционной выручки", "low");
  }
  if (/(налог|ндс|ндфл|фнс|уфк|страхов.*взнос|единый налоговый)/.test(text)) return result("tax", "Налоговое назначение платежа");
  if (/(заработн|зарплат|оплат.*труд|реестр.*сотруд|аванс.*сотруд)/.test(text)) return result("payroll", "Заработная плата или выплаты сотрудникам");
  if (/(выдач.*налич|сняти.*налич|чеков.*книж|cash)/.test(text)) return result("cash", "Снятие или выдача наличных");
  if (/(погашен.*кредит|процент.*кредит|погашен.*займ|возврат.*займ|основн.*долг|кредитн.*договор)/.test(text)) return result("debt", "Погашение долга или процентов");
  if (/(лизинг|лизингов)/.test(text)) return result("leasing", "Лизинговый платёж");
  if (/(возврат.*покупател|возврат.*оплат|возврат.*аванс|сторно)/.test(text)) return result("refund_out", "Возврат покупателю или сторно");
  if (/(физическ.*лиц|перевод.*карт|материал.*помощ|подотчет)/.test(text)) return result("personal", "Перевод физическому лицу или подотчёт");
  if (/(оплат|счет|договор|товар|услуг|работ|аренд|постав)/.test(text)) return result("supplier", "Оплата поставщику или подрядчику");
  return result("other", "Назначение не классифицировано", "low");
}

function parseExchange(text: string) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.some((line) => line.toLowerCase().includes("1cclientbankexchange"))) {
    throw new Error("Файл не похож на 1CClientBankExchange TXT");
  }

  const header: Record<string, string> = {};
  const accounts: AccountBlock[] = [];
  const documents: ParsedDocument[] = [];
  let accountFields: Record<string, string> | null = null;
  let documentFields: ParsedDocument | null = null;
  let currentAccount = "";

  for (const line of lines) {
    if (line === "СекцияРасчСчет") {
      accountFields = {};
      continue;
    }
    if (line === "КонецРасчСчет") {
      if (accountFields) {
        currentAccount = normalizeAccount(field(accountFields, "РасчСчет")) || currentAccount;
        accounts.push({
          account: currentAccount,
          openingBalance: field(accountFields, "НачальныйОстаток") ? cleanNumber(accountFields.НачальныйОстаток) : null,
          endingBalance: field(accountFields, "КонечныйОстаток") ? cleanNumber(accountFields.КонечныйОстаток) : null,
          periodFrom: normalizeDate(field(accountFields, "ДатаНачала")),
          periodTo: normalizeDate(field(accountFields, "ДатаКонца")),
        });
      }
      accountFields = null;
      continue;
    }
    if (line.startsWith("СекцияДокумент=")) {
      documentFields = { ТипДокумента: line.slice(line.indexOf("=") + 1), __account: currentAccount };
      continue;
    }
    if (line === "КонецДокумента") {
      if (documentFields) documents.push(documentFields);
      documentFields = null;
      continue;
    }
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (documentFields) documentFields[key] = value;
    else if (accountFields) accountFields[key] = value;
    else header[key] = value;
  }

  if (!documents.length) throw new Error("В выписке не найдено ни одного документа");
  return { header, accounts, documents };
}

function deriveIdentity(documents: ParsedDocument[], accounts: AccountBlock[], header: Record<string, string> = {}) {
  const accountSet = new Set(accounts.map((item) => item.account).filter(Boolean));
  const candidates = new Map<string, { inn: string; names: Map<string, number>; hits: number }>();
  const addCandidate = (inn: string, name: string) => {
    if (!inn) return;
    const value = candidates.get(inn) ?? { inn, names: new Map<string, number>(), hits: 0 };
    value.hits += 1;
    const cleaned = cleanCompanyName(name);
    if (cleaned && !isBankInterfaceName(cleaned)) value.names.set(cleaned, (value.names.get(cleaned) ?? 0) + 1);
    candidates.set(inn, value);
  };
  for (const doc of documents) {
    const payerAccount = normalizeAccount(field(doc, "ПлательщикСчет", "СчетПлательщика"));
    const recipientAccount = normalizeAccount(field(doc, "ПолучательСчет", "СчетПолучателя"));
    const payerInn = normalizeInn(field(doc, "ПлательщикИНН", "ИННПлательщика"));
    const recipientInn = normalizeInn(field(doc, "ПолучательИНН", "ИННПолучателя"));
    if (accountSet.has(payerAccount) && payerInn) {
      addCandidate(payerInn, companySideName(doc, "payer"));
    }
    if (accountSet.has(recipientAccount) && recipientInn) {
      addCandidate(recipientInn, companySideName(doc, "recipient"));
    }
  }
  const selected = [...candidates.values()].sort((a, b) => b.hits - a.hits)[0];
  if (!selected) return { inn: "", name: "Компания", hits: 0 };
  const rankedNames = [...selected.names.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  const headerName = cleanCompanyName(field(header, "ВладелецСчета", "Организация", "Клиент", "Наименование"));
  const name = rankedNames[0]?.[0] || (!isBankInterfaceName(headerName) ? headerName : "") || `Компания ИНН ${selected.inn}`;
  return { inn: selected.inn, name, hits: selected.hits };
}

export function inspectBankStatement(text: string, fileName = "bank.txt"): StatementInspection {
  const { header, accounts, documents } = parseExchange(text);
  const identity = deriveIdentity(documents, accounts, header);
  const dates = documents.map((doc) => normalizeDate(field(doc, "Дата"))).filter(Boolean).sort();
  const declaredFrom = [...accounts.map((item) => item.periodFrom), normalizeDate(field(header, "ДатаНачала"))].filter(Boolean).sort()[0];
  const declaredTo = [...accounts.map((item) => item.periodTo), normalizeDate(field(header, "ДатаКонца"))].filter(Boolean).sort().at(-1);
  return {
    fileName,
    companyInn: identity.inn,
    companyName: identity.name,
    bankName: bankNameFromDocuments(documents, accounts, header, fileName),
    accounts: [...new Set(accounts.map((item) => item.account).filter(Boolean))],
    periodFrom: dates[0] || normalizeDate(field(header, "ДатаНачала")),
    periodTo: dates[dates.length - 1] || normalizeDate(field(header, "ДатаКонца")),
    coveragePeriodFrom: declaredFrom || dates[0] || undefined,
    coveragePeriodTo: declaredTo || dates[dates.length - 1] || undefined,
    openingBalanceKnown: accounts.length > 0 && accounts.every((item) => item.openingBalance !== null),
    endingBalanceKnown: accounts.length > 0 && accounts.every((item) => item.endingBalance !== null),
  };
}

export function screenBankStatements(inputs: StatementInput[], anchorInn = "") {
  const recognized: Array<StatementInput & { inspection: StatementInspection }> = [];
  const unrecognizedFiles: string[] = [];
  const provisional: Array<{ input: StatementInput; inspection?: StatementInspection; status?: StatementScreeningResult["status"]; reason?: string }> = [];
  for (const input of inputs) {
    try {
      if (!input.text.toLowerCase().includes("1cclientbankexchange")) {
        unrecognizedFiles.push(input.fileName);
        provisional.push({ input, status: "UNSUPPORTED", reason: "Файл не содержит заголовок 1CClientBankExchange." });
        continue;
      }
      const inspection = inspectBankStatement(input.text, input.fileName);
      if (!inspection.companyInn) {
        unrecognizedFiles.push(input.fileName);
        provisional.push({ input, inspection, status: "INVALID", reason: "Не удалось определить ИНН владельца счёта." });
        continue;
      }
      recognized.push({ ...input, inspection });
      provisional.push({ input, inspection });
    } catch (error) {
      unrecognizedFiles.push(input.fileName);
      provisional.push({ input, status: "UNRECOGNIZED", reason: error instanceof Error ? error.message : "Структура выписки не распознана." });
    }
  }
  const companyInn = anchorInn || recognized[0]?.inspection.companyInn || "";
  const accepted: StatementInput[] = [];
  const seenHashes = new Set<string>();
  const screeningResults: StatementScreeningResult[] = provisional.map((item) => {
    const inspection = item.inspection;
    let status = item.status;
    let reason = item.reason;
    if (!status && inspection) {
      if (inspection.companyInn !== companyInn) {
        status = "COMPANY_MISMATCH";
        reason = `ИНН файла ${inspection.companyInn} не совпадает с ИНН выбранной компании ${companyInn}.`;
      } else if (item.input.contentHash && seenHashes.has(item.input.contentHash)) {
        status = "DUPLICATE";
        reason = "Файл с таким SHA-256 уже присутствует в наборе.";
      } else {
        status = "ACCEPTED";
        if (item.input.contentHash) seenHashes.add(item.input.contentHash);
        accepted.push(item.input);
      }
    }
    return {
      fileName: item.input.fileName,
      status: status ?? "INVALID",
      detectedInn: inspection?.companyInn,
      expectedInn: companyInn || undefined,
      bankName: inspection?.bankName,
      periodFrom: inspection?.coveragePeriodFrom ?? inspection?.periodFrom,
      periodTo: inspection?.coveragePeriodTo ?? inspection?.periodTo,
      sourceId: item.input.sourceId,
      contentHash: item.input.contentHash,
      openingBalanceStatus: inspection ? (inspection.openingBalanceKnown ? "KNOWN" : "UNKNOWN") : undefined,
      endingBalanceStatus: inspection ? (inspection.endingBalanceKnown ? "KNOWN" : "UNKNOWN") : undefined,
      reason,
    };
  });
  return {
    companyInn,
    accepted: companyInn ? accepted : [],
    unrecognizedFiles,
    screeningResults,
  };
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const labels = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${labels[Number(month) - 1]} ${year.slice(2)}`;
}

function scoreLabel(score: number) {
  if (score >= 850) return "A";
  if (score >= 720) return "B+";
  if (score >= 620) return "B";
  if (score >= 520) return "C+";
  if (score >= 420) return "C";
  return "D";
}

type TransactionProvenance = Pick<NormalizedTransaction,
  "sourceId" | "sourceFileId" | "sourceFileName" | "bank" | "rawReference" | "parserVersion" | "classifierVersion">;

function mapDocumentToTransaction(
  doc: ParsedDocument,
  index: number,
  accountSet: Set<string>,
  identity: { inn: string },
): NormalizedTransaction {
  const payerAccount = normalizeAccount(field(doc, "ПлательщикСчет", "СчетПлательщика"));
  const recipientAccount = normalizeAccount(field(doc, "ПолучательСчет", "СчетПолучателя"));
  const payerInn = normalizeInn(field(doc, "ПлательщикИНН", "ИННПлательщика"));
  const recipientInn = normalizeInn(field(doc, "ПолучательИНН", "ИННПолучателя"));
  const matchedAccount = accountSet.has(payerAccount) ? payerAccount : accountSet.has(recipientAccount) ? recipientAccount : "";
  const statementAccount = matchedAccount || normalizeAccount(doc.__account) || [...accountSet][0] || "";
  let direction: TransactionDirection = "unknown";
  if (payerAccount && accountSet.has(payerAccount)) direction = "out";
  else if (recipientAccount && accountSet.has(recipientAccount)) direction = "in";
  else if (statementAccount && payerAccount === statementAccount) direction = "out";
  else if (statementAccount && recipientAccount === statementAccount) direction = "in";
  else if (identity.inn && payerInn === identity.inn) direction = "out";
  else if (identity.inn && recipientInn === identity.inn) direction = "in";
  const internal = Boolean(identity.inn && payerInn === identity.inn && recipientInn === identity.inn);
  const purpose = field(doc, "НазначениеПлатежа", "Назначение");
  const counterparty = direction === "out" ? companySideName(doc, "recipient") : companySideName(doc, "payer");
  const counterpartyInn = direction === "out" ? recipientInn : payerInn;
  const classification = getCategory(purpose, direction, internal);
  return {
    id: field(doc, "Номер") || `${index + 1}`,
    date: normalizeDate(field(doc, "Дата")),
    amount: Math.abs(cleanNumber(field(doc, "Сумма"))),
    direction,
    counterparty: counterparty || "Контрагент не указан",
    counterpartyInn,
    purpose,
    ...classification,
    account: statementAccount,
  };
}

function transactionDeduplicationKey(item: NormalizedTransaction) {
  return [item.account, item.id, item.date, item.amount, item.direction, item.counterpartyInn, item.purpose.toLowerCase().replace(/\s+/g, " ").trim()].join("|");
}

function buildTransactionProvenance(inputs: StatementInput[]) {
  const index = new Map<string, TransactionProvenance[]>();
  for (const input of inputs) {
    const { header, accounts, documents } = parseExchange(input.text);
    const identity = deriveIdentity(documents, accounts, header);
    const accountSet = new Set(accounts.map((item) => item.account).filter(Boolean));
    const bank = bankNameFromDocuments(documents, accounts, header, input.fileName);
    const sourceId = input.sourceId || `statement:${input.contentHash || input.fileName}`;
    documents.forEach((doc, documentIndex) => {
      const transaction = mapDocumentToTransaction(doc, documentIndex, accountSet, identity);
      const key = transactionDeduplicationKey(transaction);
      const candidates = index.get(key) ?? [];
      candidates.push({
        sourceId,
        sourceFileId: sourceId,
        sourceFileName: input.fileName,
        bank,
        rawReference: sourceReference(input.contentHash || ""),
        parserVersion: INFRASTRUCTURE_VERSIONS.statementParser,
        classifierVersion: INFRASTRUCTURE_VERSIONS.transactionClassifier,
      });
      index.set(key, candidates);
    });
  }
  return index;
}

function analyzeCombinedStatement(
  text: string,
  fileName: string,
  sourceFiles: string[],
  bankNames: string[],
  provenance?: Map<string, TransactionProvenance[]>,
): AnalysisResult {
  const { header, accounts, documents } = parseExchange(text);
  const identity = deriveIdentity(documents, accounts, header);
  const accountSet = new Set(accounts.map((item) => item.account).filter(Boolean));
  const warnings: string[] = [];

  const mappedTransactions = documents.map((doc, index): NormalizedTransaction => {
    const transaction = mapDocumentToTransaction(doc, index, accountSet, identity);
    const source = provenance?.get(transactionDeduplicationKey(transaction))?.shift();
    return { ...transaction, ...source };
  }).filter((item) => item.date && item.amount > 0);

  const seenTransactions = new Map<string, NormalizedTransaction>();
  const duplicateCandidates: NonNullable<DeduplicationDiagnostic["candidates"]> = [];
  let candidateOverflow = false;
  const transactions = mappedTransactions.filter((item) => {
    const key = transactionDeduplicationKey(item);
    const retained = seenTransactions.get(key);
    if (retained) {
      if (duplicateCandidates.length < 25) duplicateCandidates.push({
        retainedId: retained.id,
        duplicateId: item.id,
        rule: "account+documentId+date+amount+direction+counterpartyInn+normalizedPurpose",
        sourceRefs: [...new Set([retained.sourceFileName, item.sourceFileName].filter((value): value is string => Boolean(value)))],
      });
      else candidateOverflow = true;
      return false;
    }
    seenTransactions.set(key, item);
    return true;
  });

  if (!transactions.length) throw new Error("Документы найдены, но даты или суммы не удалось распознать");
  const unknownCount = transactions.filter((item) => item.direction === "unknown").length;
  if (unknownCount) warnings.push(`Не определено направление у ${unknownCount} операций`);

  const external = transactions.filter((item) => item.category !== "internal");
  const incoming = external.filter((item) => item.direction === "in");
  const outgoing = external.filter((item) => item.direction === "out");
  const operatingIncoming = incoming.filter((item) => item.category === "revenue");
  const grossInflow = incoming.reduce((sum, item) => sum + item.amount, 0);
  const inflow = operatingIncoming.reduce((sum, item) => sum + item.amount, 0);
  const unknownInflow = incoming.filter((item) => item.category === "other").reduce((sum, item) => sum + item.amount, 0);
  const nonOperatingInflow = Math.max(0, grossInflow - inflow - unknownInflow);
  const outflow = outgoing.reduce((sum, item) => sum + item.amount, 0);
  const dates = transactions.map((item) => item.date).sort();
  const periodFrom = dates[0];
  const periodTo = dates[dates.length - 1];
  const monthKeys = [...new Set(transactions.map((item) => item.date.slice(0, 7)))].sort();
  const months = monthKeys.length;
  const monthly = monthKeys.map((month) => ({
    month: monthLabel(month),
    inflow: operatingIncoming.filter((item) => item.date.startsWith(month)).reduce((sum, item) => sum + item.amount, 0),
    outflow: outgoing.filter((item) => item.date.startsWith(month)).reduce((sum, item) => sum + item.amount, 0),
  }));
  const avgMonthlyInflow = months ? inflow / months : 0;
  const mean = avgMonthlyInflow;
  const variance = months ? monthly.reduce((sum, item) => sum + (item.inflow - mean) ** 2, 0) / months : 0;
  const volatility = mean ? Math.sqrt(variance) / mean : 1;
  const split = Math.max(1, Math.floor(months / 2));
  const firstAverage = monthly.slice(0, split).reduce((sum, item) => sum + item.inflow, 0) / split;
  const lastRows = monthly.slice(-split);
  const lastAverage = lastRows.reduce((sum, item) => sum + item.inflow, 0) / Math.max(1, lastRows.length);
  const monthlyTrend = firstAverage ? (lastAverage / firstAverage - 1) * 100 : 0;

  const counterparties = new Map<string, number>();
  for (const item of operatingIncoming) {
    const key = item.counterpartyInn || item.counterparty;
    counterparties.set(key, (counterparties.get(key) ?? 0) + item.amount);
  }
  const ranked = [...counterparties.entries()].map(([key, amount]) => {
    const tx = operatingIncoming.find((item) => (item.counterpartyInn || item.counterparty) === key);
    return { name: tx?.counterparty ?? key, amount, share: inflow ? amount / inflow : 0 };
  }).sort((a, b) => b.amount - a.amount);
  const marketplaceFlow = [...ranked.map((item) => item.name), ...operatingIncoming.flatMap((item) => [item.counterparty, item.purpose])]
    .some((value) => /(wildberries|вайлдберриз|wb\b|ozon|озон|яндекс\s*маркет|мегамаркет|ламода|маркетплейс)/i.test(value));
  const equipmentPurpose = outgoing.some((item) => /(автомобил|автотранспорт|оборудован|станок|спецтехник|техник)/i.test(item.purpose));
  const topOneConcentration = ranked[0]?.share ?? 0;
  const topThreeConcentration = ranked.slice(0, 3).reduce((sum, item) => sum + item.share, 0);
  const topFiveConcentration = ranked.slice(0, 5).reduce((sum, item) => sum + item.share, 0);
  const largestIncoming = [...operatingIncoming].sort((a, b) => b.amount - a.amount).slice(0, 3).reduce((sum, item) => sum + item.amount, 0);
  const largeIncomingShare = inflow ? largestIncoming / inflow : 0;
  const taxMonths = new Set(outgoing.filter((item) => item.category === "tax").map((item) => item.date.slice(0, 7))).size;
  const taxRegularity = months ? taxMonths / months : 0;
  const supplierMonths = new Set(outgoing.filter((item) => item.category === "supplier").map((item) => item.date.slice(0, 7))).size;
  const supplierPaymentRegularity = months ? supplierMonths / months : 0;
  const riskyOutflow = outgoing.filter((item) => ["personal", "cash"].includes(item.category)).reduce((sum, item) => sum + item.amount, 0);
  const debtOutflow = outgoing.filter((item) => ["debt", "leasing"].includes(item.category)).reduce((sum, item) => sum + item.amount, 0);
  const riskyOutflowShare = outflow ? riskyOutflow / outflow : 0;
  const debtServiceShare = inflow ? debtOutflow / inflow : 0;
  const endingBalances = accounts.map((item) => item.endingBalance).filter((value): value is number => value !== null);
  const endingBalance = endingBalances.length ? endingBalances.reduce((sum, value) => sum + value, 0) : null;
  const avgDailyOutflow = outflow / Math.max(1, months * 30.4);
  const liquidityDays = endingBalance === null || !avgDailyOutflow ? null : endingBalance / avgDailyOutflow;

  const openingBalances = accounts.map((item) => item.openingBalance).filter((value): value is number => value !== null);
  let averageDailyBalance: number | null = null;
  let minimumDailyBalance: number | null = null;
  let cashGapDays: number | null = null;
  let negativeBalanceDays: number | null = null;
  if (openingBalances.length && periodFrom && periodTo) {
    let balance = openingBalances.reduce((sum, value) => sum + value, 0);
    const byDay = new Map<string, number>();
    for (const item of external) byDay.set(item.date, (byDay.get(item.date) ?? 0) + (item.direction === "in" ? item.amount : item.direction === "out" ? -item.amount : 0));
    const daily: number[] = [];
    const cursor = new Date(`${periodFrom}T00:00:00Z`);
    const end = new Date(`${periodTo}T00:00:00Z`);
    while (cursor <= end && daily.length < 740) {
      const key = cursor.toISOString().slice(0, 10);
      balance += byDay.get(key) ?? 0;
      daily.push(balance);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (daily.length) {
      averageDailyBalance = daily.reduce((sum, value) => sum + value, 0) / daily.length;
      minimumDailyBalance = Math.min(...daily);
      negativeBalanceDays = daily.filter((value) => value < 0).length;
      const gapThreshold = Math.max(0, avgDailyOutflow * 3);
      cashGapDays = daily.filter((value) => value < gapThreshold).length;
    }
  }
  const seasonality = monthly.length > 1 && mean ? Math.max(...monthly.map((item) => item.inflow)) / mean : 1;

  const requiredFields = transactions.length * 4;
  const actualFields = transactions.reduce((sum, item) => sum + Number(Boolean(item.date)) + Number(Boolean(item.amount)) + Number(item.direction !== "unknown") + Number(Boolean(item.counterparty)), 0);
  const historyQuality = clamp(months / 6);
  const dataQuality = clamp((actualFields / Math.max(1, requiredFields)) * 0.75 + historyQuality * 0.25);

  const stabilityPoints = 170 * clamp(1 - volatility / 0.8);
  const trendPoints = 100 * clamp((monthlyTrend + 30) / 60);
  const liquidityPoints = 150 * (liquidityDays === null ? 0.5 : clamp(liquidityDays / 45));
  const taxPoints = 100 * clamp(taxRegularity);
  const concentrationPoints = 150 * clamp((0.8 - topOneConcentration) / 0.5);
  const riskyPoints = 120 * clamp((0.3 - riskyOutflowShare) / 0.3);
  const debtPoints = 130 * clamp((0.45 - debtServiceShare) / 0.35);
  const qualityPoints = 80 * dataQuality;
  const score = Math.round(stabilityPoints + trendPoints + liquidityPoints + taxPoints + concentrationPoints + riskyPoints + debtPoints + qualityPoints);
  const grade = scoreLabel(score);

  const factors: StopFactor[] = [];
  if (months < 3) factors.push({ severity: "warning", title: "Недостаточная история", detail: `Распознано ${months} мес.; для устойчивой оценки требуется не менее 3–6 месяцев.`, impact: "Банк может запросить более длинный период или снизить расчётный лимит.", action: "Добавьте выписки по всем счетам за полный доступный период." });
  else if (months < 6) factors.push({ severity: "warning", title: "Короткая история", detail: `Распознано ${months} мес.; сезонность пока видна не полностью.`, impact: "Долговая ёмкость рассчитана консервативно.", action: "Добавьте ещё 3–6 месяцев истории." });
  if (!inflow) factors.push({ severity: "critical", title: "Нет внешних поступлений", detail: "Невозможно подтвердить обслуживаемый денежный поток.", impact: "Необеспеченное оборотное финансирование не рекомендуется.", action: "Проверьте полноту счетов и загрузите выписку с операционной выручкой." });
  if (unknownCount / transactions.length > 0.15) factors.push({ severity: "critical", title: "Низкая распознаваемость", detail: "Более 15% операций не удалось уверенно отнести к приходу или расходу.", impact: "Расчёт оборота и долговой нагрузки может быть искажён.", action: "Используйте оригинальный TXT 1CClientBankExchange без ручного редактирования." });
  if (monthlyTrend < -40) factors.push({ severity: "critical", title: "Резкое падение оборота", detail: `Средний входящий поток второй части периода ниже первой примерно на ${Math.abs(round(monthlyTrend))}%.`, impact: "Высокий риск отказа по необеспеченным продуктам.", action: "Подготовьте объяснение падения, договоры на будущую выручку и актуальный управленческий план." });
  else if (monthlyTrend < -20) factors.push({ severity: "warning", title: "Снижение оборота", detail: `Тренд поступлений составляет ${round(monthlyTrend)}%.`, impact: "Банк может уменьшить лимит или запросить подтверждение восстановления выручки.", action: "Подтвердите новые заказы и покажите помесячный прогноз поступлений." });
  if (volatility > 0.75) factors.push({ severity: "warning", title: "Высокая волатильность поступлений", detail: `Коэффициент изменчивости месячного потока ${round(volatility, 2)}.`, impact: "Регулярный платёж может не совпасть с денежным циклом.", action: "Постройте недельный прогноз-факт на 13 недель, выделите сезонные пики и установите минимальный запас ликвидности." });
  if (topOneConcentration > 0.8) factors.push({ severity: "warning", title: "Критическая концентрация", detail: `${round(topOneConcentration * 100)}% поступлений зависит от одного плательщика.`, impact: "Потеря или задержка одного покупателя резко ухудшит обслуживание долга.", action: "Подтвердите договор, акты, график оплат и качество дебиторской задолженности; подготовьте план снижения концентрации." });
  else if (topOneConcentration > 0.5) factors.push({ severity: "warning", title: "Повышенная концентрация выручки", detail: `${round(topOneConcentration * 100)}% поступлений формирует крупнейший плательщик.`, impact: "Возможен дополнительный запрос по контракту и дебитору.", action: "Добавьте договор, акты и реестр дебиторской задолженности." });
  if (riskyOutflowShare > 0.3) factors.push({ severity: "warning", title: "Высокая доля рискованных списаний", detail: `${round(riskyOutflowShare * 100)}% расходов похоже на наличные или переводы физлицам.`, impact: "Банк может запросить экономический смысл и первичные документы.", action: "Снизьте наличный контур и разметьте подтверждающие документы по крупным операциям." });
  if (debtServiceShare > 0.45) factors.push({ severity: "critical", title: "Высокая долговая нагрузка", detail: `${round(debtServiceShare * 100)}% входящего потока уходит на кредиты и лизинг.`, impact: "Новый необеспеченный долг сейчас может быть недоступен.", action: "Сформируйте полный реестр долгов, устраните двойной учёт закрытых обязательств и рассчитайте устойчивый график при стресс-потоке." });
  else if (debtServiceShare > 0.3) factors.push({ severity: "warning", title: "Повышенная долговая нагрузка", detail: `${round(debtServiceShare * 100)}% входящего потока уходит на кредиты и лизинг.`, impact: "Лимит может быть уменьшен относительно оборота.", action: "Подготовьте графики действующих договоров и расчёт DSCR после нового финансирования." });
  if (taxRegularity < 0.5) factors.push({ severity: "warning", title: "Нерегулярные налоговые платежи", detail: "Налоговые операции обнаружены менее чем в половине анализируемых месяцев.", impact: "Нужна проверка ЕНС и отсутствия просрочки, даже если налоги уплачены с другого счёта.", action: "Добавьте выписки других банков и справку о состоянии ЕНС." });
  if (liquidityDays !== null && liquidityDays < 5) factors.push({ severity: "warning", title: "Минимальный запас ликвидности", detail: `Конечный остаток покрывает около ${round(liquidityDays, 1)} дня среднего расхода.`, impact: "Даже небольшая задержка поступлений может создать кассовый разрыв.", action: "Сформируйте платёжный календарь и минимальный неснижаемый остаток." });
  if (nonOperatingInflow > 0) factors.push({ severity: "info", title: "Неоперационные поступления исключены", detail: `${round(nonOperatingInflow).toLocaleString("ru-RU")} ₽ кредитов, займов, возвратов или взносов собственника не включено в выручку.`, impact: "Эти суммы не увеличивают оборот, B‑Score и расчётный диапазон.", action: "Проверьте классификацию в детализации операций." });
  if (unknownInflow > 0) factors.push({ severity: unknownInflow / Math.max(1, grossInflow) > 0.2 ? "warning" : "info", title: "Поступления требуют подтверждения", detail: `${round(unknownInflow).toLocaleString("ru-RU")} ₽ входящих операций не имеют достаточных признаков оплаты товаров, работ или услуг.`, impact: "До подтверждения назначением и первичными документами сумма не считается операционной выручкой.", action: "Проверьте назначение крупных операций и приложите договоры или акты." });
  if (negativeBalanceDays && negativeBalanceDays > 0) factors.push({ severity: "critical", title: "Отрицательный расчётный остаток", detail: `На ${negativeBalanceDays} дн. восстановленный остаток опускался ниже нуля.`, impact: "Возможна неполнота выписок, овердрафт или ошибка начального остатка; расчёт требует ручной проверки.", action: "Добавьте все счета и сверку начальных/конечных остатков." });
  else if (cashGapDays !== null && cashGapDays > Math.max(5, Math.round((transactions.length ? 1 : 0) * 10))) factors.push({ severity: "warning", title: "Частые периоды низкой ликвидности", detail: `${cashGapDays} дн. расчётный остаток был ниже трёх дней среднего расхода.`, impact: "Фиксированный график платежей может усиливать кассовые разрывы.", action: "Постройте недельный платёжный календарь, согласуйте сроки дебиторки и кредиторки и установите минимальный остаток." });
  if (seasonality > 1.8) factors.push({ severity: "warning", title: "Выраженная сезонность", detail: `Пиковый месяц выше среднемесячной операционной выручки в ${round(seasonality, 1)} раза.`, impact: "Средний оборот может завышать платёжную ёмкость в слабые месяцы.", action: "Сопоставьте выборки и погашения с сезонным календарём продаж." });
  if (!factors.length) factors.push({ severity: "info", title: "Критических стоп-факторов нет", detail: "По объединённому банковскому потоку профиль пригоден для следующего этапа проверки.", impact: "Можно переходить к БФО, юридическому контуру и продуктовым фильтрам банков.", action: "Проверьте полноту счетов и откройте вкладку «Куда подаваться»." });

  const policyCodes: Record<string, string> = {
    "Недостаточная история": "DQ-003", "Короткая история": "DQ-004", "Нет внешних поступлений": "B-001",
    "Низкая распознаваемость": "DQ-008", "Резкое падение оборота": "B-002", "Снижение оборота": "B-003",
    "Высокая волатильность поступлений": "B-004", "Частые периоды низкой ликвидности": "B-005",
    "Минимальный запас ликвидности": "B-006", "Критическая концентрация": "B-008",
    "Повышенная концентрация выручки": "B-009", "Высокая долговая нагрузка": "B-022",
    "Повышенная долговая нагрузка": "B-023", "Отрицательный расчётный остаток": "DQ-007",
  };
  for (const factor of factors) factor.code ||= policyCodes[factor.title];

  const hasCritical = factors.some((item) => item.severity === "critical");
  const readiness = hasCritical ? "Нужна подготовка" : score >= 720 ? "Высокая готовность" : score >= 600 ? "Готовность с оговорками" : "Низкая готовность";
  const currentMonthlyDebtPayment = months ? debtOutflow / months : 0;
  const referenceAnnualRate = 0.26;
  const referenceTermMonths = 24;
  const concentrationStress = clamp((topOneConcentration - 0.25) * 0.35, 0, 0.22);
  const volatilityStress = clamp(volatility * 0.22, 0, 0.24);
  const trendStress = monthlyTrend < 0 ? clamp(Math.abs(monthlyTrend) / 250, 0, 0.2) : 0;
  const stressFactor = clamp(1 - concentrationStress - volatilityStress - trendStress, 0.55, 0.92);
  const stressMonthlyInflow = avgMonthlyInflow * stressFactor;
  const targetDebtShare = score >= 800 ? 0.28 : score >= 700 ? 0.25 : score >= 600 ? 0.22 : 0.18;
  const stressDebtShare = Math.max(0.14, targetDebtShare - 0.04);
  const baseMonthlyPaymentCapacity = Math.max(0, avgMonthlyInflow * targetDebtShare - currentMonthlyDebtPayment);
  const stressMonthlyPaymentCapacity = Math.max(0, stressMonthlyInflow * stressDebtShare - currentMonthlyDebtPayment);
  const scoreAdjustment = score >= 800 ? 1 : score >= 700 ? 0.9 : score >= 600 ? 0.78 : score >= 520 ? 0.58 : 0.35;
  const historyAdjustment = clamp(months / 6, 0.45, 1);
  const dataAdjustment = clamp(dataQuality, 0.55, 1);
  const turnoverCap = avgMonthlyInflow * (score >= 720 ? 2.5 : score >= 600 ? 1.8 : 1.1);
  const modeledMax = annuityPrincipal(baseMonthlyPaymentCapacity, referenceAnnualRate, referenceTermMonths) * scoreAdjustment * historyAdjustment * dataAdjustment;
  const modeledStress = annuityPrincipal(stressMonthlyPaymentCapacity, referenceAnnualRate, referenceTermMonths) * scoreAdjustment * historyAdjustment * dataAdjustment;
  const estimatedLimitMax = hasCritical ? Math.min(avgMonthlyInflow * 0.08, modeledMax) : Math.min(turnoverCap, modeledMax);
  const estimatedLimitMin = Math.min(estimatedLimitMax, Math.max(0, modeledStress));
  const stressLimitMax = Math.min(estimatedLimitMax, modeledStress);
  const limitConfidence = Math.round(clamp(dataQuality * 0.45 + historyQuality * 0.3 + (1 - clamp(volatility, 0, 1)) * 0.25) * 100);

  const productFits: ProductFit[] = [];
  const addProduct = (item: ProductFit) => productFits.push(item);
  const shortLimit = Math.min(estimatedLimitMax, avgMonthlyInflow * 0.4);
  if (!hasCritical && score >= 600 && volatility <= 0.6) addProduct({
    product: "Возобновляемая кредитная линия",
    status: "recommended", statusLabel: "Подходит по потоку",
    amountMin: estimatedLimitMin, amountMax: estimatedLimitMax,
    why: [`B-Score ${score}; поток позволяет оценить регулярный платёж`, `Волатильность ${round(volatility, 2)} не блокирует возобновляемый лимит`],
    conditions: ["Подтвердить БФО, текущие кредиты и цель финансирования", "Проверить продуктовые фильтры конкретного банка"],
  });
  else addProduct({
    product: "Возобновляемая кредитная линия",
    status: hasCritical || score < 520 ? "not-now" : "conditional", statusLabel: hasCritical || score < 520 ? "Не сейчас" : "После подготовки",
    amountMin: estimatedLimitMin, amountMax: estimatedLimitMax,
    why: [hasCritical ? "Есть критический стоп-фактор банковского потока" : `B-Score ${score} требует индивидуального рассмотрения`],
    conditions: ["Выполнить план подготовки и повторно рассчитать долговую ёмкость"],
  });
  addProduct({
    product: "Овердрафт",
    status: !hasCritical && liquidityDays != null && liquidityDays < 20 && score >= 580 ? "recommended" : "conditional",
    statusLabel: !hasCritical && liquidityDays != null && liquidityDays < 20 && score >= 580 ? "Подходит для короткого разрыва" : "Требует подтверждения разрывов",
    amountMin: shortLimit * 0.55, amountMax: shortLimit,
    why: [liquidityDays == null ? "Остатки распознаны не полностью" : `Остаток покрывает около ${round(liquidityDays, 1)} дня расходов`, "Продукт закрывает краткосрочный разрыв без длинного долга"],
    conditions: ["Построить платёжный календарь и подтвердить регулярность поступлений"],
  });
  addProduct({
    product: "Факторинг",
    status: topOneConcentration >= 0.3 ? "recommended" : "conditional",
    statusLabel: topOneConcentration >= 0.3 ? "Подходит при наличии отсрочки" : "Нужен реестр дебиторки",
    amountMin: avgMonthlyInflow * topOneConcentration * 0.45,
    amountMax: avgMonthlyInflow * topOneConcentration * 0.8,
    why: [`Крупнейший покупатель формирует ${round(topOneConcentration * 100)}% поступлений`, "Лимит может опираться на качество дебитора, а не только на баланс компании"],
    conditions: ["Предоставить договор, УПД, реестр поставок и срок отсрочки", "Проверить дебитора и отсутствие запрета уступки"],
  });
  addProduct({
    product: "Рефинансирование",
    status: debtServiceShare >= 0.2 ? "recommended" : "conditional",
    statusLabel: debtServiceShare >= 0.2 ? "Актуально для снижения платежа" : "Не первоочередной продукт",
    amountMin: 0, amountMax: estimatedLimitMax,
    why: [`Видимые долговые платежи занимают ${round(debtServiceShare * 100)}% входящего потока`, debtServiceShare >= 0.2 ? "Снижение платежа может освободить долговую ёмкость" : "Текущая нагрузка по выпискам не выглядит основной проблемой"],
    conditions: ["Нужны остатки долга, ставки, сроки и графики всех действующих договоров"],
  });
  addProduct({
    product: "Банковская гарантия / контрактное финансирование",
    status: score >= 600 && !hasCritical ? "conditional" : "not-now",
    statusLabel: score >= 600 && !hasCritical ? "После проверки контракта" : "Сначала усилить профиль",
    amountMin: 0, amountMax: estimatedLimitMax,
    why: ["По выписке оценивается финансовая нагрузка, но размер зависит от контракта", "Необходимы закупка, срок исполнения и обеспечение"],
    conditions: ["Загрузить контракт 44-ФЗ/223-ФЗ или коммерческий договор", "Проверить авансирование, этапы и штрафные условия"],
  });
  addProduct({
    product: "Финансирование селлеров",
    status: marketplaceFlow && !hasCritical ? "recommended" : marketplaceFlow ? "conditional" : "conditional",
    statusLabel: marketplaceFlow && !hasCritical ? "Обнаружен поток маркетплейса" : marketplaceFlow ? "После устранения стопов" : "При подтверждении продаж на площадке",
    amountMin: marketplaceFlow ? estimatedLimitMin : 0,
    amountMax: marketplaceFlow ? estimatedLimitMax : 0,
    why: [marketplaceFlow ? "В контрагентах или назначениях платежа обнаружен маркетплейс" : "Специальный лимит рассчитывается по продажам площадки", "Учитываются возвраты, комиссии, остатки и сезонность"],
    conditions: ["Загрузить отчёты маркетплейса по продажам, возвратам, комиссиям и остаткам", "Сверить чистые выплаты площадки с банковской выпиской"],
  });
  addProduct({
    product: "Лизинг",
    status: equipmentPurpose && !hasCritical ? "recommended" : "conditional",
    statusLabel: equipmentPurpose && !hasCritical ? "Есть платежи/цель по активу" : "Если нужен конкретный актив",
    amountMin: 0,
    amountMax: estimatedLimitMax,
    why: [equipmentPurpose ? "В назначениях обнаружена покупка или обслуживание техники/оборудования" : "Предмет финансирования может служить экономическим основанием сделки", "Лизинг не подменяет оценку аванса и долговой нагрузки"],
    conditions: ["Указать предмет, продавца, стоимость и первоначальный взнос", "Проверить ликвидность, срок эксплуатации и полную стоимость графика"],
  });
  addProduct({
    product: "МФО / краудлендинг",
    status: hasCritical || score < 600 ? "conditional" : "not-now",
    statusLabel: hasCritical || score < 600 ? "Резервный маршрут" : "Не первоочередной при доступном банке",
    amountMin: 0,
    amountMax: estimatedLimitMax,
    why: ["Рассмотрение может быть быстрее и гибче банка", "Стоимость часто выше банковского кредита и должна покрываться маржой сделки"],
    conditions: ["Сравнить полную стоимость, комиссии и риск пролонгации", "Не использовать длинный дорогой ресурс для постоянного кассового дефицита"],
  });

  const recommendations: Recommendation[] = [];
  if (debtServiceShare > 0.2) recommendations.push({ product: "Долговая нагрузка", title: "Снизить давление действующего долга", rationale: `Долговые платежи занимают ${round(debtServiceShare * 100)}% входящего потока.`, action: "Сверить договоры, остатки, ставки и графики с БКИ; построить единый платёжный календарь и определить обязательства с наибольшим влиянием на ежемесячный поток.", expectedEffect: "Подтверждённый график долга без скрытых платежей и двойного учёта.", horizon: "7–30 дней", priority: "high" });
  if (topOneConcentration > 0.35) recommendations.push({ product: "Концентрация покупателей", title: "Снизить зависимость от крупнейшего покупателя", rationale: `Крупнейший плательщик формирует ${round(topOneConcentration * 100)}% поступлений.`, action: "Собрать договор, УПД, акты, срок отсрочки и реестр неоплаченных поставок; зафиксировать план поступлений и долю новых покупателей на ближайшие 60 дней.", expectedEffect: "Качество дебиторки подтверждено, зависимость от одного источника последовательно снижается.", horizon: "7–60 дней", priority: topOneConcentration > 0.65 ? "high" : "medium" });
  if (marketplaceFlow) recommendations.push({ product: "Качество выручки", title: "Подтвердить чистую выручку маркетплейса", rationale: "В банковском потоке обнаружены поступления от маркетплейса или связанные назначения.", action: "Добавить отчёты площадки по продажам, возвратам, комиссиям, удержаниям, остаткам и сезонности; сверить итог с чистыми выплатами по выписке.", expectedEffect: "Выручка очищена от возвратов и комиссий, подтверждены маржа и повторяемость потока.", horizon: "7 дней", priority: "high" });
  if (equipmentPurpose) recommendations.push({ product: "Основные средства", title: "Подтвердить экономику приобретаемого актива", rationale: "В назначениях платежа обнаружена цель, связанная с авто, техникой или оборудованием.", action: "Зафиксировать предмет, стоимость, продавца, аванс, срок эксплуатации, ожидаемую загрузку и дополнительный денежный поток от использования актива.", expectedEffect: "Потребность в активе и его окупаемость подтверждены документами и расчётом.", horizon: "14–30 дней", priority: "medium" });
  if (volatility < 0.35 && score >= 600) recommendations.push({ product: "Денежный поток", title: "Закрепить стабильность поступлений", rationale: `Коэффициент волатильности ${round(volatility, 2)} указывает на предсказуемый поток.`, action: "Сохранить расшифровку регулярных покупателей, даты плановых поступлений и обязательных платежей; обновлять прогноз-факт ежемесячно.", expectedEffect: "Стабильность потока подтверждается повторяемой динамикой.", horizon: "30 дней", priority: "medium" });
  if (liquidityDays !== null && liquidityDays < 20) recommendations.push({ product: "Ликвидность", title: "Увеличить запас для коротких кассовых разрывов", rationale: `Остаток покрывает около ${round(liquidityDays)} дней среднего расхода.`, action: "Построить недельный платёжный календарь, разнести поступления, налоги, зарплату и поставщиков; определить минимальный неснижаемый остаток и контролировать его ежедневно.", expectedEffect: "Снижено число дней с критически низким остатком и риск технической просрочки.", horizon: "7–30 дней", priority: "medium" });
  if (monthlyTrend < 0) recommendations.push({ product: "Динамика оборота", title: "Подтвердить восстановление оборота", rationale: `Тренд входящего потока ${round(monthlyTrend)}%.`, action: "Собрать действующие договоры, заказы, акты и календарь ожидаемых оплат; еженедельно сопоставлять прогноз с фактическими поступлениями и объяснять отклонения документами.", expectedEffect: "Восстановление оборота подтверждается фактом, а не только прогнозом.", horizon: "14–60 дней", priority: monthlyTrend < -20 ? "high" : "medium" });
  if (taxRegularity < 0.7) recommendations.push({ product: "Налоговая дисциплина", title: "Уточнить налоговый контур до подачи", rationale: "По назначениям платежа налоги видны нерегулярно.", action: "Проверить сальдо ЕНС, требования и сроки уплаты; добавить справку и выписки счетов, с которых фактически перечислялись налоги.", expectedEffect: "Налоговая дисциплина подтверждена, возможная задолженность выявлена заранее.", horizon: "7 дней", priority: "high" });
  if (riskyOutflowShare > 0.12) recommendations.push({ product: "Комплаенс операций", title: "Обосновать наличные и переводы физическим лицам", rationale: `${round(riskyOutflowShare * 100)}% расходов попало в риск-категорию.`, action: "Для крупных операций собрать договоры, чеки, авансовые отчёты, реестр получателей и деловую цель; дальнейшие расчёты проводить в прозрачном безналичном контуре.", expectedEffect: "Экономический смысл существенных списаний подтверждён, доля необъяснённых операций снижается.", horizon: "30–60 дней", priority: "high" });
  if (volatility > 0.6) recommendations.push({ product: "Сезонность и разрывы", title: "Синхронизировать обязательства с сезонным циклом", rationale: `Волатильность потока ${round(volatility, 2)}: равномерные платежи могут не совпасть с поступлениями.`, action: "Построить недельный прогноз-факт на 13 недель, отметить сезонные пики, обязательные платежи и минимальный запас денежных средств.", expectedEffect: "Срок и размер потребности подтверждены денежным циклом, риск кассового разрыва измерен.", horizon: "30 дней", priority: "medium" });
  if (topFiveConcentration > .9) recommendations.push({ product: "Диверсификация потока", title: "Раскрыть качество пяти крупнейших покупателей", rationale: `TOP‑5 формирует ${round(topFiveConcentration * 100)}% внешних поступлений.`, action: "Подготовить договоры, сроки отношений, просрочку и долю будущих заказов по каждому ключевому покупателю.", expectedEffect: "Банк видит качество концентрации, а не только высокий процент.", horizon: "7–30 дней", priority: "medium" });
  if (sourceFiles.length === 1) recommendations.push({ product: "Полнота данных", title: "Добавить выписки остальных банков", rationale: "Сейчас анализ построен по одной выписке; налоги, кредиты или часть выручки могут проходить по другим счетам.", action: "Загрузить TXT по всем действующим расчётным счетам этой же компании.", expectedEffect: "Более точный оборот, долговая нагрузка и диапазон финансирования.", horizon: "Сейчас", priority: "high" });
  recommendations.push({ product: "Кредитное досье", title: "Завершить доказательную часть профиля", rationale: `Качество распознанных данных ${round(dataQuality * 100)}%; вывод необходимо подтвердить независимыми источниками.`, action: "Добавить квартальную отчётность, БКИ, реестр действующих обязательств, расшифровки существенных статей и документы по цели финансирования.", expectedEffect: "Финансовые, долговые и юридические выводы имеют проверяемое основание.", horizon: "7–14 дней", priority: "low" });

  const periodLabel = `${periodFrom} — ${periodTo}`;
  const structuredFactors = factors.map((item, index): StopFactor => ({
    ...item,
    code: item.code ?? `BANK-${String(index + 1).padStart(3, "0")}`,
    decisionClass: item.decisionClass ?? (item.severity === "critical" ? "stop" : item.severity === "warning" ? "manual-review" : "information"),
    source: item.source ?? "Выписки",
    period: item.period ?? periodLabel,
    evidence: item.evidence ?? item.detail,
    needsReview: item.needsReview ?? item.severity !== "info",
  }));
  const structuredRecommendations = recommendations.map((item): Recommendation => ({
    ...item,
    trigger: item.trigger ?? item.rationale,
    evidence: item.evidence ?? item.rationale,
    relatedMetric: item.relatedMetric ?? item.product,
    source: item.source ?? "Банковские выписки",
    period: item.period ?? periodLabel,
  }));
  const topRisks: RiskSummary[] = structuredFactors.filter((item) => item.severity !== "info").slice(0, 5).map((item) => ({
    title: item.title,
    detail: item.impact || item.detail,
    source: item.source || "Выписки",
    evidence: item.evidence || item.detail,
  }));
  const strengths: RiskSummary[] = [];
  if (monthlyTrend >= 0) strengths.push({ title: "Операционная выручка не снижается", detail: `Тренд ${round(monthlyTrend)}% по сопоставленным месяцам.`, source: "Выписки", evidence: periodLabel });
  if (taxRegularity >= 0.7) strengths.push({ title: "Налоговые платежи регулярны", detail: `Платежи обнаружены в ${round(taxRegularity * 100)}% месяцев.`, source: "Выписки", evidence: periodLabel });
  if (topOneConcentration <= 0.5 && inflow > 0) strengths.push({ title: "Нет критической зависимости от одного плательщика", detail: `Доля крупнейшего плательщика ${round(topOneConcentration * 100)}%.`, source: "Выписки", evidence: periodLabel });
  if (debtServiceShare <= 0.3 && inflow > 0) strengths.push({ title: "Умеренная видимая долговая нагрузка", detail: `Платежи по кредитам и лизингу составляют ${round(debtServiceShare * 100)}% операционной выручки.`, source: "Выписки", evidence: periodLabel });
  const evidence: AnalysisEvidence[] = [
    { id: "EV-BANK-REVENUE", conclusion: "Операционная выручка", metric: "operatingInflow", value: `${round(inflow).toLocaleString("ru-RU")} ₽`, source: sourceFiles.join(", "), period: periodLabel },
    { id: "EV-BANK-NONOP", conclusion: "Исключено из выручки", metric: "nonOperatingAndUnknownInflow", value: `${round(nonOperatingInflow + unknownInflow).toLocaleString("ru-RU")} ₽`, source: sourceFiles.join(", "), period: periodLabel },
    { id: "EV-BANK-DEBT", conclusion: "Видимый долговой платёж", metric: "currentMonthlyDebtPayment", value: `${round(currentMonthlyDebtPayment).toLocaleString("ru-RU")} ₽/мес.`, source: sourceFiles.join(", "), period: periodLabel },
    { id: "EV-BANK-LIMIT", conclusion: "Расчётный аналитический диапазон", metric: "estimatedLimit", value: `${round(estimatedLimitMin).toLocaleString("ru-RU")} — ${round(estimatedLimitMax).toLocaleString("ru-RU")} ₽`, source: "Детерминированная модель Прескор", period: periodLabel },
  ];

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `analysis-${Date.now()}`,
    companyName: identity.name || field(header, "Отправитель") || "Компания",
    companyInn: identity.inn,
    fileName,
    sourceFiles,
    bankNames,
    periodFrom,
    periodTo,
    score,
    grade,
    readiness,
    createdAt: new Date().toISOString(),
    metrics: {
      months,
      statements: sourceFiles.length,
      accounts: new Set(accounts.map((item) => item.account).filter(Boolean)).size,
      transactions: transactions.length,
      grossInflow: round(grossInflow, 2),
      operatingInflow: round(inflow, 2),
      nonOperatingInflow: round(nonOperatingInflow, 2),
      unknownInflow: round(unknownInflow, 2),
      inflow: round(inflow, 2),
      outflow: round(outflow, 2),
      avgMonthlyInflow: round(avgMonthlyInflow, 2),
      monthlyTrend: round(monthlyTrend, 1),
      volatility: round(volatility, 2),
      topOneConcentration: round(topOneConcentration, 4),
      topThreeConcentration: round(topThreeConcentration, 4),
      topFiveConcentration: round(topFiveConcentration, 4),
      largeIncomingShare: round(largeIncomingShare, 4),
      taxRegularity: round(taxRegularity, 4),
      riskyOutflowShare: round(riskyOutflowShare, 4),
      debtServiceShare: round(debtServiceShare, 4),
      endingBalance: endingBalance === null ? null : round(endingBalance, 2),
      liquidityDays: liquidityDays === null ? null : round(liquidityDays, 1),
      averageDailyBalance: averageDailyBalance === null ? null : round(averageDailyBalance, 2),
      minimumDailyBalance: minimumDailyBalance === null ? null : round(minimumDailyBalance, 2),
      cashGapDays,
      negativeBalanceDays,
      seasonality: round(seasonality, 2),
      supplierPaymentRegularity: round(supplierPaymentRegularity, 4),
      dataQuality: round(dataQuality * 100),
      estimatedLimitMin: round(estimatedLimitMin, -3),
      estimatedLimitMax: round(estimatedLimitMax, -3),
      stressLimitMax: round(stressLimitMax, -3),
      currentMonthlyDebtPayment: round(currentMonthlyDebtPayment, -3),
      baseMonthlyPaymentCapacity: round(baseMonthlyPaymentCapacity, -3),
      stressMonthlyPaymentCapacity: round(stressMonthlyPaymentCapacity, -3),
      stressMonthlyInflow: round(stressMonthlyInflow, -3),
      referenceTermMonths,
      referenceAnnualRate,
      limitConfidence,
    },
    monthly,
    topCounterparties: ranked.slice(0, 5).map((item) => ({ ...item, amount: round(item.amount, 2), share: round(item.share, 4) })),
    factors: structuredFactors,
    topRisks,
    strengths: strengths.slice(0, 5),
    evidence,
    recommendations: structuredRecommendations.slice(0, 16),
    productFits,
    transactions,
    deduplication: {
      originalCount: mappedTransactions.length,
      removedCount: mappedTransactions.length - transactions.length,
      retainedCount: transactions.length,
      sourceFiles,
      rule: "account+documentId+date+amount+direction+counterpartyInn+normalizedPurpose",
      candidates: duplicateCandidates.length ? duplicateCandidates : undefined,
      candidatesTruncated: candidateOverflow || undefined,
    },
    warnings,
    methodologyVersion: "PRESCORE-CORE-2026.08",
  };
}

export function analyzeBankStatement(text: string, fileName = "bank.txt"): AnalysisResult {
  const inspection = inspectBankStatement(text, fileName);
  if (!inspection.companyInn) throw new Error(`В выписке «${fileName}» не найден ИНН владельца счёта`);
  const input: StatementInput = { text, fileName, sourceId: `statement:${fileName}` };
  const result = analyzeCombinedStatement(text, fileName, [fileName], [inspection.bankName], buildTransactionProvenance([input]));
  return addSourceFoundation(result, [input], [inspection], [{
    fileName,
    status: "ACCEPTED",
    detectedInn: inspection.companyInn,
    expectedInn: inspection.companyInn,
    bankName: inspection.bankName,
    periodFrom: inspection.coveragePeriodFrom ?? inspection.periodFrom,
    periodTo: inspection.coveragePeriodTo ?? inspection.periodTo,
    sourceId: input.sourceId,
    openingBalanceStatus: inspection.openingBalanceKnown ? "KNOWN" : "UNKNOWN",
    endingBalanceStatus: inspection.endingBalanceKnown ? "KNOWN" : "UNKNOWN",
  }]);
}

export function analyzeBankStatements(inputs: StatementInput[], options: { screeningResults?: StatementScreeningResult[] } = {}): AnalysisResult {
  if (!inputs.length) throw new Error("Добавьте хотя бы одну банковскую выписку");
  const inspections = inputs.map((input) => inspectBankStatement(input.text, input.fileName));
  const owner = inspections.find((item) => item.companyInn);
  if (!owner) throw new Error("Не удалось определить ИНН владельца счетов");
  for (const item of inspections) {
    if (!item.companyInn) throw new Error(`В выписке «${item.fileName}» не найден ИНН владельца счёта`);
    if (item.companyInn !== owner.companyInn) {
      throw new Error(`Выписка «${item.fileName}» относится к ИНН ${item.companyInn}, а выбранная компания — ИНН ${owner.companyInn}. Объединение запрещено.`);
    }
  }
  const combined = inputs.map((input) => input.text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/^КонецФайла\s*$/gim, "")).join("\n");
  const sourceFiles = inputs.map((item) => item.fileName);
  const bankNames = [...new Set(inspections.map((item) => item.bankName))];
  const label = inputs.length === 1 ? inputs[0].fileName : `${inputs.length} выписки · ${bankNames.join(", ")}`;
  const result = analyzeCombinedStatement(combined, label, sourceFiles, bankNames, buildTransactionProvenance(inputs));
  const screeningResults = options.screeningResults ?? inspections.map((inspection, index): StatementScreeningResult => ({
    fileName: inspection.fileName,
    status: "ACCEPTED",
    detectedInn: inspection.companyInn,
    expectedInn: owner.companyInn,
    bankName: inspection.bankName,
    periodFrom: inspection.coveragePeriodFrom ?? inspection.periodFrom,
    periodTo: inspection.coveragePeriodTo ?? inspection.periodTo,
    sourceId: inputs[index].sourceId,
    contentHash: inputs[index].contentHash,
    openingBalanceStatus: inspection.openingBalanceKnown ? "KNOWN" : "UNKNOWN",
    endingBalanceStatus: inspection.endingBalanceKnown ? "KNOWN" : "UNKNOWN",
  }));
  return addSourceFoundation(result, inputs, inspections, screeningResults);
}

function addSourceFoundation(
  result: AnalysisResult,
  inputs: StatementInput[],
  inspections: StatementInspection[],
  screeningResults: StatementScreeningResult[],
): AnalysisResult {
  const bankStatements = inputs.map((input, index) => {
    const inspection = inspections[index];
    const warnings: string[] = [];
    if (!inspection.openingBalanceKnown) warnings.push("Начальный остаток не подтверждён для всех счетов источника.");
    if (!inspection.endingBalanceKnown) warnings.push("Конечный остаток не подтверждён для всех счетов источника.");
    return {
      sourceId: input.sourceId || `statement:${input.contentHash || `${index + 1}:${input.fileName}`}`,
      sourceType: "BANK_STATEMENT" as const,
      status: "READY" as const,
      companyInn: inspection.companyInn,
      fileName: input.fileName,
      sourceName: inspection.bankName,
      periodFrom: inspection.coveragePeriodFrom ?? inspection.periodFrom,
      periodTo: inspection.coveragePeriodTo ?? inspection.periodTo,
      receivedAt: result.createdAt,
      parserVersion: INFRASTRUCTURE_VERSIONS.statementParser,
      classifierVersion: INFRASTRUCTURE_VERSIONS.transactionClassifier,
      integrityVersion: INFRASTRUCTURE_VERSIONS.integrity,
      confidence: null,
      warnings,
      rawReference: sourceReference(input.contentHash || ""),
      contentHash: input.contentHash,
      fieldAvailability: {
        openingBalance: inspection.openingBalanceKnown ? "KNOWN" as const : "UNKNOWN" as const,
        endingBalance: inspection.endingBalanceKnown ? "KNOWN" as const : "UNKNOWN" as const,
      },
    };
  });
  const sourceManifest: AnalysisSourceManifest = { bankStatements };
  const integrityWarnings = screeningResults
    .filter((item) => item.status !== "ACCEPTED")
    .map((item) => `${item.fileName}: ${item.status}${item.reason ? ` — ${item.reason}` : ""}`);
  return {
    ...result,
    sourceManifest,
    screeningResults,
    infrastructureVersions: INFRASTRUCTURE_VERSIONS,
    integrity: buildAnalysisIntegrity(sourceManifest, result.transactions, integrityWarnings),
  };
}

export function analysisForStorage(result: AnalysisResult) {
  // A truncated normalized list is an audit/display projection only. It must never be
  // treated as the complete raw statement dataset for a future engine recalculation.
  const originalTransactionCount = result.originalTransactionCount ?? result.transactions?.length ?? 0;
  const transactions = (result.transactions ?? []).slice(0, 10_000).map((item) => ({
    ...item,
    account: item.account ? `••••${item.account.slice(-4)}` : "",
    purpose: item.purpose.slice(0, 500),
  }));
  return {
    ...result,
    transactions,
    transactionsTruncated: Boolean(result.transactionsTruncated || originalTransactionCount > transactions.length),
    storedTransactionCount: transactions.length,
    originalTransactionCount,
  };
}
