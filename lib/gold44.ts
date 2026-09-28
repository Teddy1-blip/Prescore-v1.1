import { strFromU8, unzipSync } from "fflate";

export type Gold44Status = "new" | "matched" | "contacted" | "added" | "rejected";

export type Gold44Record = {
  id: string;
  sourceFile: string;
  noticeNumber: string;
  protocolDate: string;
  contractDate: string;
  contractPrice: number;
  guaranteeAmount: number;
  warrantyAmount: number;
  advancePercent: number | null;
  smb: string;
  companyName: string;
  inn: string;
  emails: string[];
  phones: string[];
  mobilePhone: string;
  website: string;
  director: string;
  region: string;
  winsCount: number;
  securedTotal: number;
  winsToday: number;
  previousWin: string;
  plaintiffCases: number;
  defendantCases: number;
  revenue: number;
  profit: number;
  balance: number;
  address: string;
  registrationDate: string;
  businessAgeMonths: number | null;
  ogrn: string;
  okved: string;
  businessSize: string;
  tenderSubject: string;
  okpd: string;
  procedureType: string;
  platform: string;
  customer: string;
  customerInn: string;
  uniqueWinners: number;
  priceReductionPercent: number | null;
  deliveryTerm: string;
  contractTerm: string;
  bankSupport: string;
  supplierIssues: string;
  manager: string;
  lot: string;
  callScore: number;
  callPriority: "Высокий" | "Средний" | "Низкий";
  status?: Gold44Status;
  rejectReason?: string;
  leadId?: string;
  applicationId?: string;
};

export type Gold44ParseResult = {
  records: Gold44Record[];
  sourceFile: string;
  totalRows: number;
  validRows: number;
  skippedRows: number;
  warnings: string[];
};

const expectedHeaders = ["Номер извещения", "Победитель", "ИНН", "Обеспечение исполнения", "Предмет тендера"];

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function textNodes(xml: string) {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join("");
}

function sharedStrings(files: Record<string, Uint8Array>) {
  const bytes = files["xl/sharedStrings.xml"];
  if (!bytes) return [];
  const xml = strFromU8(bytes);
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) => textNodes(match[1]));
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/)?.[0] ?? "A";
  return [...letters].reduce((result, letter) => result * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function worksheetRows(xml: string, strings: string[]) {
  return [...xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const reference = attributes.match(/\br="([A-Z]+\d+)"/)?.[1] ?? `A${row.length + 1}`;
      const type = attributes.match(/\bt="([^"]+)"/)?.[1] ?? "";
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      const value = type === "s" ? strings[Number(raw)] ?? "" : type === "inlineStr" ? textNodes(body) : decodeXml(raw);
      row[columnIndex(reference)] = value.trim();
    }
    return row;
  });
}

function numberValue(value: string) {
  const normalized = value.replace(/\u00a0/g, " ").replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = numberValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanInn(value: string) {
  const inn = value.replace(/\D/g, "");
  return inn.length === 10 || inn.length === 12 ? inn : "";
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function emailValues(values: string[]) {
  return unique(values.flatMap((value) => value.split(/[;,\s]+/)).filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)));
}

function phoneValues(values: string[]) {
  return unique(values.flatMap((value) => value.split(/[;,]+/)).map((value) => value.replace(/[^\d+]/g, "")).filter((value) => value.replace(/\D/g, "").length >= 10));
}

function parseDate(value: string) {
  const match = value.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : value.trim();
}

function ageMonths(value: string, now = new Date()) {
  const iso = parseDate(value);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, (now.getUTCFullYear() - parsed.getUTCFullYear()) * 12 + now.getUTCMonth() - parsed.getUTCMonth());
}

function stableId(inn: string, noticeNumber: string, lot: string) {
  return `${inn}:${noticeNumber.replace(/\D/g, "") || "notice"}:${lot.replace(/[^a-zа-я0-9]/gi, "").slice(0, 24) || "0"}`;
}

function callQuality(record: Pick<Gold44Record, "mobilePhone" | "phones" | "emails" | "guaranteeAmount" | "revenue" | "profit" | "supplierIssues">) {
  let score = 0;
  if (record.mobilePhone) score += 30;
  else if (record.phones.length) score += 18;
  if (record.emails.length) score += 12;
  if (record.guaranteeAmount >= 500_000) score += 15;
  if (record.guaranteeAmount >= 3_000_000) score += 10;
  if (record.revenue >= 40_000_000 && record.revenue <= 500_000_000) score += 15;
  if (record.profit > 0) score += 8;
  if (!record.supplierIssues || /нет|не выяв/i.test(record.supplierIssues)) score += 10;
  return { score: Math.min(100, score), priority: score >= 70 ? "Высокий" as const : score >= 45 ? "Средний" as const : "Низкий" as const };
}

export function parseGold44Workbook(bytes: Uint8Array, sourceFile: string): Gold44ParseResult {
  const files = unzipSync(bytes);
  const sheet = files["xl/worksheets/sheet1.xml"];
  if (!sheet) throw new Error("В Excel не найден лист с заключёнными контрактами.");
  const rows = worksheetRows(strFromU8(sheet), sharedStrings(files));
  const headers = rows[0] ?? [];
  const indexes = new Map(headers.map((header, index) => [header.trim(), index]));
  const missing = expectedHeaders.filter((header) => !indexes.has(header));
  if (missing.length) throw new Error(`Формат Gold44 не распознан. Нет колонок: ${missing.join(", ")}.`);
  const get = (row: string[], header: string) => row[indexes.get(header) ?? -1] ?? "";
  const records: Gold44Record[] = [];
  let skippedRows = 0;
  for (const row of rows.slice(1)) {
    const inn = cleanInn(get(row, "ИНН"));
    const noticeNumber = get(row, "Номер извещения").replace(/^№/, "").trim();
    const companyName = get(row, "Победитель").trim();
    if (!inn || !noticeNumber || !companyName) { skippedRows += 1; continue; }
    const phones = phoneValues([get(row, "Телефон"), get(row, "Доп. телефон 1"), get(row, "Доп. телефон 2"), get(row, "Доп. телефон 3"), get(row, "Мобильный телефон")]);
    const emails = emailValues([get(row, "Email (госконтракты)"), get(row, "Email (дополнительный)")]);
    const registrationDate = parseDate(get(row, "Дата регистрации"));
    const base = {
      id: stableId(inn, noticeNumber, get(row, "Лот")), sourceFile, noticeNumber,
      protocolDate: parseDate(get(row, "Дата протокола")), contractDate: parseDate(get(row, "Дата заключения контракта")),
      contractPrice: numberValue(get(row, "Начальная цена контракта")), guaranteeAmount: numberValue(get(row, "Обеспечение исполнения")),
      warrantyAmount: numberValue(get(row, "Гарантийные обязательства")), advancePercent: optionalNumber(get(row, "Аванс")), smb: get(row, "СМП"),
      companyName, inn, emails, phones, mobilePhone: phoneValues([get(row, "Мобильный телефон")])[0] ?? "", website: get(row, "Возможный сайт"),
      director: get(row, "Директор"), region: get(row, "Регион").replace(/^\+\d+,\s*/, ""), winsCount: numberValue(get(row, "Побед")),
      securedTotal: numberValue(get(row, "Обеспечено")), winsToday: numberValue(get(row, "Побед за сегодня")), previousWin: get(row, "Предыдущая победа"),
      plaintiffCases: numberValue(get(row, "Истец")), defendantCases: numberValue(get(row, "Ответчик")), revenue: numberValue(get(row, "Выручка (т.р.)")) * 1_000,
      profit: numberValue(get(row, "Прибыль (т.р.)")) * 1_000, balance: numberValue(get(row, "Баланс (т.р.)")) * 1_000,
      address: get(row, "Адрес"), registrationDate, businessAgeMonths: ageMonths(registrationDate), ogrn: get(row, "ОГРН"), okved: get(row, "ОКВЭД"),
      businessSize: get(row, "Размер предприятия"), tenderSubject: get(row, "Предмет тендера"), okpd: get(row, "ОКПД"), procedureType: get(row, "Тип процедуры"),
      platform: get(row, "Торговая площадка"), customer: get(row, "Основной заказчик"), customerInn: cleanInn(get(row, "ИНН заказчика")),
      uniqueWinners: numberValue(get(row, "Уникальные победители")), priceReductionPercent: optionalNumber(get(row, "% снижения НМЦ")),
      deliveryTerm: get(row, "Срок поставки"), contractTerm: get(row, "Срок контракта"), bankSupport: get(row, "Требуется банковское сопровождение"),
      supplierIssues: get(row, "Возможные проблемы поставщика"), manager: get(row, "Менеджер"), lot: get(row, "Лот"),
    };
    const quality = callQuality(base);
    records.push({ ...base, callScore: quality.score, callPriority: quality.priority });
  }
  const deduplicated = [...new Map(records.map((record) => [record.id, record])).values()];
  return {
    records: deduplicated,
    sourceFile,
    totalRows: Math.max(0, rows.length - 1),
    validRows: deduplicated.length,
    skippedRows: skippedRows + records.length - deduplicated.length,
    warnings: skippedRows ? [`Пропущено строк без корректного ИНН, извещения или названия: ${skippedRows}.`] : [],
  };
}

export function matchesGold44Inn(records: Gold44Record[], inn: string) {
  const normalized = cleanInn(inn);
  return normalized ? records.filter((record) => record.inn === normalized) : [];
}
