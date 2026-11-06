export type CreditBureau = "СБ БКИ" | "НБКИ" | "БКИ";
export type CreditSubjectType = "Физическое лицо" | "Юридическое лицо" | "Не определён";
export type CreditSubjectRelationship = "Компания-заёмщик" | "ИП-заёмщик" | "Собственник" | "Поручитель" | "Руководитель" | "Не указано";
export type DebtServiceQuality =
  | "Без просрочек"
  | "Есть краткая просрочка"
  | "Есть существенная просрочка"
  | "Негативное обслуживание"
  | "Недостаточно данных";

export type CreditObligation = {
  id: string;
  creditor: string;
  product: string;
  status: string;
  role: string;
  openedAt: string;
  scheduledCloseAt: string;
  updatedAt: string;
  originalAmount: number | null;
  creditLimit: number | null;
  outstandingPrincipal: number | null;
  totalOutstanding: number | null;
  monthlyPayment: number | null;
  contractualPayment?: number;
  paymentFrequency?: string;
  nextPaymentAmount: number | null;
  nextPaymentDate: string;
  annualRate: number | null;
  rateLabel: string;
  overdueAmount: number | null;
  maxDelinquencyDays: number | null;
  fieldProvenance?: Record<string, { origin: "REPORTED" | "PARSER_DEFAULT" | "ESTIMATED" | "CONFLICTED"; value: number | null; reference: string }>;
  paymentQuality: DebtServiceQuality;
  collateral: string;
  guaranteeAmount: number | null;
  accountNumber: string;
  sourcePageHint: string;
};

export type CreditHistorySummary = {
  reportedOpenCount: number | null;
  reportedClosedCount: number | null;
  negativeAccounts: number | null;
  inquiries30Days: number | null;
  inquiries12Months: number | null;
  inquiries24Months: number | null;
  originalAmount: number;
  outstandingPrincipal: number;
  totalOutstanding: number;
  monthlyPayment: number;
  overdueAmount: number;
  guaranteeExposure: number;
  knownRatesCount: number;
  weightedAnnualRate: number | null;
  debtServiceQuality: DebtServiceQuality;
  knownValues?: {
    originalAmount: boolean;
    outstandingPrincipal: boolean;
    totalOutstanding: boolean;
    monthlyPayment: boolean;
    overdueAmount: boolean;
    guaranteeExposure: boolean;
  };
};

export type CreditHistoryReport = {
  source: CreditBureau;
  subjectType: CreditSubjectType;
  subjectName: string;
  subjectInn: string;
  relationshipToCompany: CreditSubjectRelationship;
  affectsCompanyDebt: boolean;
  reportDate: string;
  bureauScore: number | null;
  bureauScoreMax: number | null;
  selfBanActive: boolean;
  parserConfidence: number;
  fileName: string;
  obligations: CreditObligation[];
  summary: CreditHistorySummary;
  warnings: string[];
};

export type CreditPortfolioComparison = {
  statementMonthlyDebtPayment: number;
  bureauMonthlyDebtPayment: number;
  bureauMonthlyPaymentKnown: boolean;
  bureauOutstandingKnown: boolean;
  confirmedMonthlyDebtPayment: number;
  paymentNotVisibleInStatements: number;
  debtPaymentToMonthlyInflow: number | null;
  outstandingToAnnualInflow: number | null;
  adjustedMonthlyPaymentCapacity: number;
  adjustedLimitMax: number;
  confidence: number;
};

export type CreditHistoryInsight = {
  tone: "positive" | "warning" | "critical" | "neutral";
  title: string;
  facts: string;
  impact: string;
  action: string;
};

const MONTHS: Record<string, string> = {
  января: "01", февраля: "02", марта: "03", апреля: "04", мая: "05", июня: "06",
  июля: "07", августа: "08", сентября: "09", октября: "10", ноября: "11", декабря: "12",
};

function normalizedText(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "");
}

function numberValue(value?: string | null): number | null {
  if (!value) return null;
  const source = value.trim().toLowerCase();
  if (!source || source === "-" || source.includes("нет данных") || source.includes("отсутствует")) return null;
  const cleaned = source.replace(/^(?:rub|₽|руб\.?)\s*/i, "").replace(/\s*(?:rub|₽|руб\.?|%)\s*$/i, "").trim();
  if (!/^-?(?:\d+|\d{1,3}(?:[ \u00a0\u2009\u202f]\d{3})+)(?:[,.]\d+)?$/.test(cleaned)) return null;
  if (!cleaned || cleaned === "-") return null;
  const parsed = Number(cleaned.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function intValue(value?: string | null): number | null {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.round(parsed);
}

function dateValue(value?: string | null) {
  if (!value) return "";
  const exact = value.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  const words = value.toLowerCase().match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  const iso = exact ? [exact[3],exact[2].padStart(2,"0"),exact[1].padStart(2,"0")].join("-")
    : words && MONTHS[words[2]] ? [words[3],MONTHS[words[2]],words[1].padStart(2,"0")].join("-") : "";
  return iso && Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0,10) === iso ? iso : "";
}

// NBKI can place labelled fields on one row or separate PDF text lines.
function nbkiField(block: string, label: string) {
  const labels = "Финальн\\.платеж(?: %%)?|Вид|Размер/лимит|Открыт|Всего выплачено|Полная стоимость|Статус|Задолж-сть|Просрочено|След\\.платеж|Дата след\\.платежа|Плановый плат[её]ж|Периодичность платежей|Кредитор|Счет|Отношение";
  return block.match(new RegExp(`(?:^|\\n|[ \\t]+)${label}[ \\t]*([^\\n]*?)(?=[ \\t]+(?:${labels}):|\\n|$)`, "i"))?.[1]?.trim() ?? "";
}

function moneyTokens(value: string) {
  return [...value.matchAll(/(-|[\d][\d\s]*(?:[.,]\d{1,2})?)\s*₽/g)].map((match) => numberValue(match[1]));
}

// Keep each labelled SB servicing field separate. A missing value in one
// field must never borrow the amount, date or "нет данных" from its neighbour.
function sbServicingField(block: string, label: string) {
  const start = block.match(new RegExp(`(?:^|\\n)[ \\t]*(?:${label})[ \\t]*:?[ \\t]*`, "i"));
  if (!start) return "";
  const value = block.slice((start.index ?? 0) + start[0].length);
  return value.split(/\n[ \t]*(?:Текущая просрочка|(?:Следующий|Ближайший) плат[её]ж|Дата (?:следующего|ближайшего) платежа|Своевременность платежей|Уникальный идентификатор договора|Сведения об изменениях|Обеспечение|Закрытые кредиты|Отч[её]т от|ИНН)(?=[\s:]|$)/i)[0].trim();
}

function sbServicingAmount(value: string, absenceMeansZero = false): number | null {
  const firstLine = value.split("\n")[0].trim();
  if (absenceMeansZero && /^(?:нет|отсутствует|отсутствуют)[.!]?$/i.test(firstLine)) return 0;
  // Only the first value line is authoritative. Unknown text, a dash, a date,
  // a following heading or another field's number must remain unknown.
  const amount = firstLine.match(/^(\d[\d \u00a0\u202f\u2009]*(?:[.,]\d{1,2})?)\s*(?:₽|руб\.?|RUB)\s*$/i)?.[1];
  return amount === undefined ? null : numberValue(amount);
}

function delinquencyQuality(days: number | null, overdue: number | null): DebtServiceQuality {
  if ((overdue ?? 0) > 0 || (days ?? 0) >= 60) return "Негативное обслуживание";
  if ((days ?? 0) >= 30) return "Есть существенная просрочка";
  if ((days ?? 0) > 0) return "Есть краткая просрочка";
  if (days === 0 && overdue === 0) return "Без просрочек";
  return "Недостаточно данных";
}

// Some SB reports print the arrears and next instalment side by side.
function sbServicingColumns(block: string) {
  const row = block.match(/^[ \t]*Текущая просрочка[ \t]+(?:Ближайший|Следующий) плат[её]ж[ \t]*\n(?:[ \t]*\n)*([^\n]+)/im)?.[1];
  if (!row) return null;
  const cells = row.trim().split(/[ \t]{2,}/);
  const last = cells.at(-1) ?? "";
  const nextDate = /^\d{2}\.\d{2}\.\d{4}$/.test(last) ? dateValue(last) : "";
  return {overdue:sbServicingAmount(cells[0],true), nextDate,
    nextPayment:nextDate && cells.length >= 3 ? sbServicingAmount(cells[cells.length-2]) : null};
}

function maxDelinquencyFromSbBlock(block: string) {
  const history = block.split("Своевременность платежей по договору")[1]?.split(/Уникальный идентификатор договора|Сведения об изменениях|Обеспечение/)[0] ?? "";
  const rows = [...history.matchAll(/^\s*20\d{2}\s+(.+)$/gm)].map((match) => match[1]);
  const codes = rows.flatMap((row) => row.trim().split(/\s+/)).filter(Boolean);
  const mapping: Record<string, number> = { "1": 5, "2": 29, "3": 59, "4": 89, "5": 119, "6": 149, "7": 179, "8": 209, "9": 239, A: 240, B: 240, W: 240, T: 240 };
  const known = codes.some((code) => code === "0" || code === "C" || mapping[code] !== undefined);
  if (!known) return null;
  return Math.max(0, ...codes.map((code) => mapping[code] ?? 0));
}

function extractSbBlocks(activeSection: string) {
  const numbered = [...activeSection.matchAll(/(?:^|\n)\s*(\d{1,2})\s*\n\s*(?:Банк|Оператор сервиса рассрочки|МФО):/g)];
  const matches = numbered.length
    ? numbered
    : [...activeSection.matchAll(/(?:^|\n)\s*(?:Банк|Оператор сервиса рассрочки|МФО):/g)];
  return matches.map((match, index) => activeSection.slice(match.index, matches[index + 1]?.index ?? activeSection.length));
}

function parseSbObligation(block: string, index: number): CreditObligation | null {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  const bankIndex = lines.findIndex((line) => /^(?:Банк|Оператор сервиса рассрочки|МФО):/i.test(line));
  if (bankIndex < 0) return null;
  const bankLine = lines[bankIndex];
  const followingStatus = lines[bankIndex + 1]?.match(/^(Действующий|Закрыт[^\s]*)$/i)?.[1] ?? "";
  const bureauStatus = bankLine.match(/\s{2,}(Действующий|Закрыт[^\s]*)\s*$/i)?.[1]
    ?? (followingStatus || (bankLine.includes("Действующий") ? "Действующий" : "Статус не определён"));
  const creditor = bankLine.replace(/^(?:Банк|Оператор сервиса рассрочки|МФО):\s*/i, "").replace(/\s{2,}(Действующий|Закрыт[^\s]*)\s*$/i, "").trim();
  const productLine = followingStatus ? lines[bankIndex + 2] : lines[bankIndex + 1];
  const product = productLine?.replace(/^\d{1,2}\s+/, "") && !productLine.startsWith("Данные обновлены") ? productLine.replace(/^\d{1,2}\s+/, "") : "Кредит";
  const conditions = block.match(/Взяли на таких условиях[\s\S]{0,500}?([\d][\d\s]*(?:[.,]\d{1,2})?)\s*₽\s+с\s+(\d{2}\.\d{2}\.\d{4})\s+по\s+(\d{2}\.\d{2}\.\d{4}|31\.12\.9999)/i);
  const payoutSection = block.match(/Выплатили[\s\S]*?Полная стоимость кредита/i)?.[0] ?? "";
  const payouts = moneyTokens(payoutSection);
  const totalOutstanding = payouts.length >= 2 ? payouts[1] : null;
  const outstandingPrincipal = totalOutstanding === null ? null : payouts.length >= 3 ? payouts[payouts.length - 1] : null;
  const costSection = block.match(/Полная стоимость кредита[\s\S]*?Текущая просрочка/i)?.[0] ?? "";
  const rate = numberValue(costSection.match(/([\d]+[.,]\d+)\s*%\s*годовых/i)?.[1]);
  const costAmounts = moneyTokens(costSection);
  const monthlyPayment = /Среднемесячный платёж|Минимальный платеж/i.test(costSection) && costAmounts.length >= 2 ? costAmounts[costAmounts.length - 1] : null;
  const overdueField = sbServicingField(block, "Текущая просрочка");
  const nextField = sbServicingField(block, "(?:Следующий|Ближайший) плат[её]ж");
  const nextDateField = sbServicingField(block, "Дата (?:следующего|ближайшего) платежа");
  const columns = sbServicingColumns(block);
  const overdue = columns ? columns.overdue : sbServicingAmount(overdueField, true);
  const nextPayment = columns ? columns.nextPayment : sbServicingAmount(nextField);
  const nextDate = nextDateField.match(/^(\d{2}\.\d{2}\.\d{4})(?:\s|$)/)?.[1]
    ?? nextField.match(/(?:^|\n)\s*(?:до\s+)?(\d{2}\.\d{2}\.\d{4})(?:\s|$)/i)?.[1] ?? "";
  const maxDays = maxDelinquencyFromSbBlock(block);
  const originalAmount = numberValue(conditions?.[1]);
  const isLine = /линия|карта|овердрафт/i.test(product);
  const collateralBlock = block.match(/Обеспечение[\s\S]*?(?=Уникальный идентификатор договора|$)/i)?.[0] ?? "";
  const collateral = collateralBlock ? collateralBlock.split("\n").map((line) => line.trim()).filter((line) => /Залог|Предмет залога|Стоимость по договору/i.test(line)).slice(0, 3).join(" · ") : "";
  return {
    id: `sb-${index + 1}`,
    creditor: creditor || "Кредитор не определён",
    product: product || "Кредит",
    status: bureauStatus,
    role: "Заёмщик",
    openedAt: dateValue(conditions?.[2]),
    scheduledCloseAt: conditions?.[3] === "31.12.9999" ? "" : dateValue(conditions?.[3]),
    updatedAt: dateValue(block.match(/Данные обновлены\s+(\d{2}\.\d{2}\.\d{4})/i)?.[1]),
    originalAmount,
    creditLimit: isLine ? originalAmount : null,
    outstandingPrincipal,
    totalOutstanding,
    monthlyPayment,
    nextPaymentAmount: nextPayment,
    nextPaymentDate: columns?.nextDate || dateValue(nextDate),
    annualRate: rate,
    rateLabel: rate === null ? "Ставка не указана" : "Полная стоимость кредита",
    overdueAmount: overdue,
    maxDelinquencyDays: maxDays,
    fieldProvenance: {
      ...(maxDays === 0 ? {maxDelinquencyDays:{origin:"REPORTED" as const,value:0,reference:"Explicit bureau payment-history codes/count"}} : {}),
      ...(overdue === 0 ? {overdueAmount:{origin:"REPORTED" as const,value:0,reference:"SB Текущая просрочка: explicit absence or zero"}} : {}),
      ...(nextPayment === 0 ? {nextPaymentAmount:{origin:"REPORTED" as const,value:0,reference:"SB next-payment field: explicit zero"}} : {}),
    },
    paymentQuality: delinquencyQuality(maxDays, overdue),
    collateral,
    guaranteeAmount: null,
    accountNumber: "",
    sourcePageHint: `Действующее обязательство ${index + 1}`,
  };
}

function parseSbReport(source: string, fileName: string): CreditHistoryReport {
  const text = normalizedText(source);
  const firstDetailedObligation = text.match(/(?:^|\n)\s*(?:1\s*\n\s*)?(?:Банк|Оператор сервиса рассрочки|МФО):\s*[^\n]+/m);
  const activeStart = firstDetailedObligation?.index ?? text.indexOf("Действующие кредиты, займы, карты");
  const closedStart = text.indexOf("Закрытые кредиты, займы, карты", Math.max(0, activeStart));
  const active = activeStart >= 0 ? text.slice(activeStart, closedStart > activeStart ? closedStart : undefined) : text;
  const activeObligations = extractSbBlocks(active).map(parseSbObligation).filter((item): item is CreditObligation => Boolean(item));
  const closedEndCandidates = [text.indexOf("Запросы кредиторов", Math.max(0, closedStart)), text.indexOf("Сведения о самозапрете", Math.max(0, closedStart))].filter((value) => value > closedStart);
  const closedEnd = closedEndCandidates.length ? Math.min(...closedEndCandidates) : text.length;
  const closed = closedStart >= 0 ? text.slice(closedStart, closedEnd) : "";
  const closedObligations = extractSbBlocks(closed).map((block, index) => parseSbObligation(block, activeObligations.length + index)).filter((item): item is CreditObligation => Boolean(item)).map((item) => ({ ...item, status: /закрыт/i.test(item.status) ? item.status : "Закрыт", sourcePageHint: item.sourcePageHint.replace("Действующее", "Закрытое") }));
  const obligations = [...activeObligations, ...closedObligations];
  const selfBanHeading = text.lastIndexOf("Сведения о самозапрете", Math.max(0, activeStart));
  const summaryHeading = text.lastIndexOf("Главное о кредитной истории", Math.max(0, selfBanHeading));
  const summaryBlock = summaryHeading >= 0 && selfBanHeading > summaryHeading ? text.slice(summaryHeading, selfBanHeading) : "";
  const score = intValue(text.match(/Ваш рейтинг\s*[—-]\s*(\d{1,3})/i)?.[1]);
  const reportedOpenCount = intValue(summaryBlock.match(/(\d+)\s+открытых кредитов\s*\/\s*займов/i)?.[1]);
  const reportedClosedCount = intValue(summaryBlock.match(/(\d+)\s+закрытых кредитов\s*\/\s*займов/i)?.[1]);
  const summaryMoney = moneyTokens(summaryBlock);
  const summaryOutstanding = summaryMoney[0] ?? obligations.reduce((sum, item) => sum + (item.outstandingPrincipal ?? 0), 0);
  const summaryPayment = summaryMoney[1] ?? obligations.reduce((sum, item) => sum + (item.monthlyPayment ?? 0), 0);
  const inquiries12 = intValue(summaryBlock.match(/Интересовались вашей кредитной историей\s+(\d+)\s+раз\s+\d+\s+раз\s+\d+\s+раз/i)?.[1]);
  const selfBanSection = text.match(/Действующие запреты на заключение договоров[\s\S]*?(?:Снятые|Ранее действовавшие)/i)?.[0] ?? "";
  const selfBanActive = Boolean(selfBanSection && !/Отсутствуют/i.test(selfBanSection));
  const warnings: string[] = [];
  if (selfBanActive) warnings.push("В отчёте указан действующий самозапрет на заключение потребительских кредитов и займов.");
  if (!obligations.length) warnings.push("Детальные действующие обязательства не распознаны; проверьте формат отчёта.");
  return finishReport({
    source: "СБ БКИ",
    subjectType: "Физическое лицо",
    subjectName: text.match(/Кредитный отчёт\s*\n\s*(?!от\s)([^\n]+)/i)?.[1]?.trim()
      ?? text.match(/^\s*([^\n]+)\s*\n\s*Содержание/im)?.[1]?.trim()
      ?? "Субъект не определён",
    subjectInn: text.match(/ИНН\s+(\d{10,12})/i)?.[1] ?? "",
    relationshipToCompany: "Не указано",
    affectsCompanyDebt: false,
    reportDate: dateValue(text.match(/Отчёт от\s+([^\n]+)/i)?.[1] ?? text.match(/от\s+(\d{1,2}\s+[а-яё]+\s+\d{4})/i)?.[1]),
    bureauScore: score,
    bureauScoreMax: score === null ? null : 999,
    selfBanActive,
    parserConfidence: obligations.length ? 94 : 55,
    fileName,
    obligations,
    summaryOverrides: { reportedOpenCount, reportedClosedCount, inquiries12Months: inquiries12, outstandingPrincipal: summaryOutstanding, monthlyPayment: summaryPayment },
    warnings,
  });
}

function maxDelinquencyFromNbki(block: string) {
  const total = intValue(block.match(/Просрочки \((\d+)\s+просроч\.платежей\)/i)?.[1]);
  const bands: Array<[RegExp, number]> = [
    [/Просрочек более, чем на 90 дн\.:\s*(\d+)/i, 120],
    [/Просрочек от 60 до 89 дн\.:\s*(\d+)/i, 89],
    [/Просрочек от 30 до 59 дн\.:\s*(\d+)/i, 59],
    [/Просрочк[аи] от 8 до 29/i, 29],
    [/Просрочк[аи] от 1 до 7/i, 7],
  ];
  for (const [pattern, days] of bands) {
    const count = intValue(block.match(pattern)?.[1]);
    if ((count ?? 0) > 0) return days;
  }
  return total === 0 ? 0 : null;
}

function parseNbkiObligation(block: string, index: number): CreditObligation | null {
  const creditor = nbkiField(block, "Кредитор:") || "Кредитор не определён";
  const account = nbkiField(block, "Счет:") || "";
  if (!creditor && !account) return null;
  const kind = nbkiField(block, "Вид:");
  const role = nbkiField(block, "Отношение:") || "Не указано";
  const limit = numberValue(nbkiField(block, "Размер\\/лимит:"));
  const rate = numberValue(nbkiField(block, "Полная стоимость:"));
  const opened = nbkiField(block, "Открыт:");
  const status = nbkiField(block, "Статус:") || "Нет данных";
  const debt = numberValue(nbkiField(block, "Задолж-сть:"));
  const overdue = numberValue(nbkiField(block, "Просрочено:"));
  const nextPayment = numberValue(nbkiField(block, "След\\.платеж:"));
  const nextPaymentDate = dateValue(nbkiField(block, "Дата след\\.платежа:"));
  const maturity = dateValue(nbkiField(block, "Финальн\\.платеж:"));
  const guaranteeSection = block.match(/Банковские гарантии[\s\S]*?(?=Задолженность на дату|Просрочки \()/i)?.[0] ?? "";
  const guaranteeAmount = numberValue(guaranteeSection.match(/Сумма:\s*([^\n]+)/i)?.[1]);
  const guaranteeUntil = guaranteeSection.match(/Действ\.до:\s*([^\n]+)/i)?.[1] ?? "";
  const suretySection = block.match(/Поручительства[\s\S]*?(?=Банковские гарантии)/i)?.[0] ?? "";
  const suretyAmount = numberValue(suretySection.match(/Сумма:\s*([^\n]+)/i)?.[1]);
  const product = guaranteeAmount !== null ? "Банковская гарантия" : suretyAmount !== null ? "Поручительство" : kind || "Кредитное обязательство";
  const maxDays = maxDelinquencyFromNbki(block);
  const regular = numberValue(nbkiField(block, "Плановый плат[её]ж:"));
  const frequency = nbkiField(block,"Периодичность платежей:").match(/^(ежемесячно|ежеквартально|еженедельно|ежегодно)$/i)?.[1];
  const contingent = guaranteeAmount !== null || suretyAmount !== null || /поручител|гаранти/i.test(product);
  return {
    id: `nbki-${account || index + 1}`,
    creditor: creditor.replace(/\s{2,}.*$/, "").trim(),
    product,
    status,
    role,
    openedAt: dateValue(opened),
    scheduledCloseAt: dateValue(guaranteeUntil) || maturity,
    updatedAt: dateValue(block.match(/Последн\.обновление:\s*([^\n]+)/i)?.[1]),
    originalAmount: limit ?? guaranteeAmount ?? suretyAmount,
    creditLimit: limit,
    outstandingPrincipal: contingent ? null : debt,
    totalOutstanding: contingent ? null : debt,
    monthlyPayment: !contingent && frequency?.toLowerCase() === "ежемесячно" ? regular : null,
    ...(!contingent && regular !== null ? {contractualPayment:regular} : {}),
    ...(frequency ? {paymentFrequency:frequency} : {}),
    nextPaymentAmount: nextPayment,
    nextPaymentDate,
    annualRate: rate,
    rateLabel: rate === null ? "Ставка не указана" : "Полная стоимость",
    overdueAmount: overdue,
    maxDelinquencyDays: maxDays,
    fieldProvenance: {
      ...(maxDays === 0 ? {maxDelinquencyDays:{origin:"REPORTED" as const,value:0,reference:"Explicit bureau payment-history codes/count"}} : {}),
      ...(overdue === 0 ? {overdueAmount:{origin:"REPORTED" as const,value:0,reference:"NBKI Просрочено: 0"}} : {}),
      ...(debt === 0 ? {principalOutstanding:{origin:"REPORTED" as const,value:0,reference:"NBKI Задолж-сть: 0"},totalOutstanding:{origin:"REPORTED" as const,value:0,reference:"NBKI Задолж-сть: 0"}} : {}),
    },
    paymentQuality: delinquencyQuality(maxDays, overdue),
    collateral: "",
    guaranteeAmount,
    accountNumber: account,
    sourcePageHint: `Счёт ${account || index + 1}`,
  };
}

function parseNbkiReport(source: string, fileName: string): CreditHistoryReport {
  const text = normalizedText(source);
  const tableHeaders = [...text.matchAll(/(?:^|\n)\s*Счет\s+Договор\s+Состояние\s+Баланс\s*\n/g)];
  const simpleHeaders = [...text.matchAll(/(?:^|\n)\s*(?:Счет\s*\n\s*)?Вид:/g)];
  const headers = tableHeaders.length > 1 ? tableHeaders : simpleHeaders;
  const parsed = headers.map((match, index) => parseNbkiObligation(text.slice(match.index, headers[index + 1]?.index ?? text.length), index)).filter((item): item is CreditObligation => Boolean(item));
  const obligations = [...new Map(parsed.map((item) => [item.accountNumber || item.id, item])).values()];
  const summary = text.match(/Сводка\s+Счета[\s\S]*?(?=Субъект:\s*Кредитная история)/i)?.[0] ?? "";
  const warnings: string[] = [];
  if (obligations.some((item) => item.totalOutstanding === null || item.monthlyPayment === null || item.annualRate === null)) warnings.push("В части старых записей НБКИ отсутствуют остаток, платёж или ставка; Прескор показывает «нет данных» и ничего не рассчитывает вместо бюро.");
  if (!obligations.length) warnings.push("Счета из корпоративного отчёта НБКИ не распознаны; нужна ручная проверка формата.");
  return finishReport({
    source: "НБКИ",
    subjectType: "Юридическое лицо",
    subjectName: (text.match(/Наименование организации\s*\n\s*(?:Субъект\s*\n\s*)?([^\n]+)/i)?.[1]?.split(/\s{2,}/)[0]?.trim() || text.match(/Сокращ\. наименование:\s*([^\n]+)/i)?.[1]?.trim() || "Субъект не определён"),
    subjectInn: text.match(/ИНН\s*\n\s*Номер\s*\n\s*(\d{10,12})/i)?.[1] ?? "",
    relationshipToCompany: "Компания-заёмщик",
    affectsCompanyDebt: true,
    reportDate: dateValue(text.match(/Предоставлен[\s\S]{0,300}?(\d{2}-\d{2}-\d{4})/i)?.[1]),
    bureauScore: null,
    bureauScoreMax: null,
    selfBanActive: false,
    parserConfidence: obligations.length ? 88 : 48,
    fileName,
    obligations,
    summaryOverrides: {
      reportedOpenCount: intValue(summary.match(/Открытых:\s*(\d+)/i)?.[1]),
      negativeAccounts: intValue(summary.match(/Негативных:\s*(\d+)/i)?.[1]),
      inquiries30Days: intValue(summary.match(/Все запросы\s+(?:Всего:\s*)?\d+\s+(\d+)/i)?.[1]),
      inquiries24Months: intValue(summary.match(/Все запросы\s+(?:Всего:\s*)?\d+\s+\d+\s+(\d+)/i)?.[1]),
    },
    warnings,
  });
}

type FinishInput = Omit<CreditHistoryReport, "summary"> & {
  summaryOverrides?: Partial<CreditHistorySummary>;
};

function finishReport(input: FinishInput): CreditHistoryReport {
  const active = input.obligations.filter((item) => !/закрыт|погашен|прекращ/i.test(item.status));
  const loans = active.filter(o => !/гаранти|поручительств/i.test(o.product) && !/поручител|гарант/i.test(o.role));
  const originalAmount = loans.reduce((sum, item) => sum + (item.originalAmount ?? 0), 0);
  const outstandingPrincipal = loans.reduce((sum, item) => sum + (item.outstandingPrincipal ?? 0), 0);
  const totalOutstanding = loans.reduce((sum, item) => sum + (item.totalOutstanding ?? item.outstandingPrincipal ?? 0), 0);
  const monthlyPayment = loans.reduce((sum, item) => sum + (item.monthlyPayment ?? 0), 0);
  const overdueAmount = loans.reduce((sum, item) => sum + (item.overdueAmount ?? 0), 0);
  const guaranteeExposure = active.reduce((sum, item) => sum + (item.guaranteeAmount ?? 0), 0);
  const rated = active.filter((item) => item.annualRate !== null && (item.outstandingPrincipal ?? item.originalAmount ?? 0) > 0);
  const rateWeight = rated.reduce((sum, item) => sum + (item.outstandingPrincipal ?? item.originalAmount ?? 0), 0);
  const weightedAnnualRate = rateWeight ? rated.reduce((sum, item) => sum + (item.annualRate ?? 0) * (item.outstandingPrincipal ?? item.originalAmount ?? 0), 0) / rateWeight : null;
  const qualities = input.obligations.map((item) => item.paymentQuality);
  const debtServiceQuality: DebtServiceQuality = qualities.includes("Негативное обслуживание")
    ? "Негативное обслуживание"
    : qualities.includes("Есть существенная просрочка")
      ? "Есть существенная просрочка"
      : qualities.includes("Есть краткая просрочка")
        ? "Есть краткая просрочка"
        : qualities.length > 0 && qualities.every((quality) => quality === "Без просрочек")
          ? "Без просрочек"
          : "Недостаточно данных";
  const base: CreditHistorySummary = {
    reportedOpenCount: null,
    reportedClosedCount: null,
    negativeAccounts: null,
    inquiries30Days: null,
    inquiries12Months: null,
    inquiries24Months: null,
    originalAmount,
    outstandingPrincipal,
    totalOutstanding,
    monthlyPayment,
    overdueAmount,
    guaranteeExposure,
    knownRatesCount: rated.length,
    weightedAnnualRate,
    debtServiceQuality,
    knownValues: {
      originalAmount: (loans.length > 0 && loans.every((item) => item.originalAmount !== null)) || input.summaryOverrides?.originalAmount !== undefined,
      outstandingPrincipal: (loans.length > 0 && loans.every((item) => item.outstandingPrincipal !== null)) || input.summaryOverrides?.outstandingPrincipal !== undefined,
      totalOutstanding: (loans.length > 0 && loans.every((item) => item.totalOutstanding !== null || item.outstandingPrincipal !== null)) || input.summaryOverrides?.totalOutstanding !== undefined,
      monthlyPayment: (loans.length > 0 && loans.every((item) => item.monthlyPayment !== null)) || input.summaryOverrides?.monthlyPayment !== undefined,
      overdueAmount: (loans.length > 0 && loans.every((item) => item.overdueAmount !== null)) || input.summaryOverrides?.overdueAmount !== undefined,
      guaranteeExposure: active.some((item) => item.guaranteeAmount !== null) || input.summaryOverrides?.guaranteeExposure !== undefined,
    },
  };
  return { ...input, summary: { ...base, ...input.summaryOverrides } };
}

export function parseCreditHistoryText(text: string, fileName = "credit-history.pdf"): CreditHistoryReport {
  const source = normalizedText(text);
  if (/Рейтинг и портрет заёмщика|Главное о кредитной истории/i.test(source)) return parseSbReport(source, fileName);
  if (/Субъект:\s*Кредитная история юридического лица|При наличии вопросов обратитесь в НБКИ/i.test(source)) return parseNbkiReport(source, fileName);
  throw new Error("Формат БКИ пока не распознан. Нужен текстовый PDF СБ БКИ или НБКИ; скан можно будет подключить через OCR позднее.");
}

export function compareCreditPortfolio(input: {
  report: CreditHistoryReport;
  avgMonthlyInflow: number;
  statementMonthlyDebtPayment: number;
  baseMonthlyPaymentCapacity: number;
  estimatedLimitMax: number;
  limitConfidence: number;
}): { comparison: CreditPortfolioComparison; insights: CreditHistoryInsight[] } {
  const affectsCompanyDebt = input.report.subjectType === "Юридическое лицо" || input.report.affectsCompanyDebt;
  const bureauMonthlyPaymentKnown = affectsCompanyDebt && input.report.obligations.some((item) => item.monthlyPayment !== null);
  const bureauOutstandingKnown = affectsCompanyDebt && input.report.obligations.some((item) => item.outstandingPrincipal !== null || item.totalOutstanding !== null);
  const bureauPayment = affectsCompanyDebt ? input.report.summary.monthlyPayment : 0;
  const confirmedPayment = Math.max(input.statementMonthlyDebtPayment, bureauPayment);
  const unseen = Math.max(0, bureauPayment - input.statementMonthlyDebtPayment);
  const adjustedCapacity = Math.max(0, input.baseMonthlyPaymentCapacity - unseen);
  const adjustedLimit = input.baseMonthlyPaymentCapacity > 0 ? input.estimatedLimitMax * adjustedCapacity / input.baseMonthlyPaymentCapacity : 0;
  const paymentShare = input.avgMonthlyInflow > 0 ? confirmedPayment / input.avgMonthlyInflow : null;
  const annualInflow = input.avgMonthlyInflow * 12;
  const outstandingShare = affectsCompanyDebt && annualInflow > 0 ? input.report.summary.outstandingPrincipal / annualInflow : null;
  const comparison: CreditPortfolioComparison = {
    statementMonthlyDebtPayment: Math.round(input.statementMonthlyDebtPayment),
    bureauMonthlyDebtPayment: Math.round(bureauPayment),
    bureauMonthlyPaymentKnown,
    bureauOutstandingKnown,
    confirmedMonthlyDebtPayment: Math.round(confirmedPayment),
    paymentNotVisibleInStatements: Math.round(unseen),
    debtPaymentToMonthlyInflow: paymentShare,
    outstandingToAnnualInflow: outstandingShare,
    adjustedMonthlyPaymentCapacity: Math.round(adjustedCapacity),
    adjustedLimitMax: Math.round(adjustedLimit / 1000) * 1000,
    confidence: Math.min(99, Math.round((input.limitConfidence + input.report.parserConfidence) / 2)),
  };
  const activeObligations = input.report.obligations.filter((item) => !/закрыт|погашен|прекращ/i.test(item.status));
  const currentOverdueKnown = activeObligations.length > 0 && activeObligations.every((item) => item.overdueAmount !== null);
  const hasReportedOverdue = input.report.summary.overdueAmount > 0;
  const insights: CreditHistoryInsight[] = [];
  if (!affectsCompanyDebt) insights.push({
    tone: "neutral",
    title: "Личный БКИ отделён от корпоративного долга",
    facts: `Роль субъекта: ${input.report.relationshipToCompany}. Личные обязательства не добавлены к платежам компании.`,
    impact: "Портфель собственника или руководителя оценивается как отдельный риск поручительства и не смешивается с долгом юридического лица.",
    action: "Укажите роль субъекта и добавьте корпоративный отчёт БКИ либо договоры компании для расчёта долговой ёмкости.",
  });
  if (!bureauMonthlyPaymentKnown || !bureauOutstandingKnown) insights.push({
    tone: "neutral",
    title: "В отчёте БКИ есть неполные поля по портфелю",
    facts: `${bureauMonthlyPaymentKnown ? "Платёж распознан" : "Ежемесячный платёж не указан"}; ${bureauOutstandingKnown ? "остаток распознан" : "остаток задолженности не указан"}.`,
    impact: "Отсутствующие значения не считаются нулём. Корректировка лимита выполняется только по подтверждённым суммам.",
    action: "Приложить актуальные справки об остатках и графики платежей либо более свежий отчёт БКИ.",
  });
  insights.push({
    tone: input.report.summary.debtServiceQuality === "Без просрочек" ? "positive" : input.report.summary.debtServiceQuality === "Недостаточно данных" ? "neutral" : "critical",
    title: `Качество обслуживания долга: ${input.report.summary.debtServiceQuality.toLowerCase()}`,
    facts: `Текущая просрочка: ${currentOverdueKnown ? Math.round(input.report.summary.overdueAmount).toLocaleString("ru-RU") + " ₽" : hasReportedOverdue ? "не менее " + Math.round(input.report.summary.overdueAmount).toLocaleString("ru-RU") + " ₽ по раскрытым обязательствам" : "недостаточно данных"}; обязательств распознано: ${input.report.obligations.length}.`,
    impact: hasReportedOverdue ? "Просрочка может стать стоп-фактором до её погашения и обновления данных в БКИ." : currentOverdueKnown ? "Отсутствие просрочки поддерживает кредитный профиль, но не гарантирует одобрение." : "Неполные сведения не подтверждают отсутствие текущей просрочки.",
    action: hasReportedOverdue ? "Погасить просрочку и запросить обновлённый отчёт БКИ." : "Сверить актуальность открытых договоров и сохранить отчёт в кредитном досье.",
  });
  if (affectsCompanyDebt) insights.push({
    tone: unseen > 0 ? "warning" : "positive",
    title: unseen > 0 ? "БКИ показывает платежи, не полностью видимые в выписках" : "Долговые платежи БКИ и выписки не противоречат друг другу",
    facts: `По выпискам: ${Math.round(input.statementMonthlyDebtPayment).toLocaleString("ru-RU")} ₽/мес.; по БКИ: ${Math.round(bureauPayment).toLocaleString("ru-RU")} ₽/мес.`,
    impact: unseen > 0 ? `Для расчёта долговой ёмкости дополнительно учтено ${Math.round(unseen).toLocaleString("ru-RU")} ₽ в месяц.` : "Дополнительная корректировка расчётной долговой ёмкости не требуется.",
    action: unseen > 0 ? "Найти соответствующие списания во всех банковских счетах или приложить графики платежей." : "Использовать подтверждённый платёж при подготовке заявки.",
  });
  if (input.report.summary.guaranteeExposure > 0) insights.push({
    tone: "neutral",
    title: "Банковские гарантии выделены отдельно от кредитного долга",
    facts: `Распознанный объём гарантий: ${Math.round(input.report.summary.guaranteeExposure).toLocaleString("ru-RU")} ₽.`,
    impact: "Гарантия обычно не равна текущей задолженности, но создаёт условное обязательство и использует лимит на принципала.",
    action: "Проверить действующие гарантии, сроки, обеспеченность и исключить уже прекращённые обязательства.",
  });
  if (input.report.selfBanActive) insights.push({
    tone: "critical",
    title: "В БКИ действует самозапрет",
    facts: "Отчёт содержит действующий запрет на заключение потребительских кредитов и займов.",
    impact: "Новый договор в охваченном запретом контуре оформить нельзя до снятия запрета и обновления данных.",
    action: "Уточнить применимость запрета к цели финансирования и при необходимости снять его установленным способом.",
  });
  return { comparison, insights };
}
