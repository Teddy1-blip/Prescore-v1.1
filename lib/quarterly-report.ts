import { BALANCE_CODES, INCOME_CODES, type QuarterlyFinancialMetadata } from "./credit-engine/contracts/financial-statements.ts";
import { parseFinancialPeriod } from "./credit-engine/financial-analysis/periods.ts";

export type QuarterlyFactor = {
  severity: "critical" | "warning" | "info";
  title: string;
  evidence: string;
  bankImpact: string;
  nextStep: string;
};

export type QuarterlyFinancialReport = {
  id: string;
  fileName: string;
  fileType: "pdf" | "xlsx" | "csv";
  companyName: string | null;
  companyInn: string | null;
  period: string;
  extractedAt: string;
  parserConfidence: number;
  unitScale: number;
  unitLabel: string;
  financialMetadataV2?: QuarterlyFinancialMetadata;
  values: {
    revenue: number | null;
    netProfit: number | null;
    assets: number | null;
    nonCurrentAssets: number | null;
    currentAssets: number | null;
    receivables: number | null;
    cash: number | null;
    equity: number | null;
    netAssets: number | null;
    longTermLiabilities: number | null;
    currentLiabilities: number | null;
    payables: number | null;
  };
  ratios: {
    currentLiquidity: number | null;
    autonomy: number | null;
    receivablesToAssets: number | null;
    payablesToRevenue: number | null;
    netWorkingCapital: number | null;
  };
  verdictCode: "STOP" | "HIGH_RISK" | "REVIEW" | "READY";
  verdict: string;
  conclusion: string;
  submissionAdvice: string;
  factors: QuarterlyFactor[];
  warnings: string[];
};

const labels: Record<keyof QuarterlyFinancialReport["values"], RegExp[]> = {
  revenue: [/^выручка\b/i, /выручка\s*\(нетто\)/i],
  netProfit: [/чистая прибыль/i, /чистый убыток/i, /чистая прибыль.*убыток/i],
  assets: [/^баланс\b.*актив/i, /^итого.*актив/i, /^активы всего/i],
  nonCurrentAssets: [/^внеоборотные активы/i],
  currentAssets: [/оборотные активы/i],
  receivables: [/дебиторская задолженность/i],
  cash: [/денежные средства/i],
  equity: [/капитал и резервы/i, /собственный капитал/i],
  netAssets: [/чистые активы/i],
  longTermLiabilities: [/^долгосрочные обязательства/i],
  currentLiabilities: [/краткосрочные обязательства/i],
  payables: [/кредиторская задолженность/i],
};

const codes: Partial<Record<keyof QuarterlyFinancialReport["values"], string>> = {
  revenue: "2110", netProfit: "2400", assets: "1600", nonCurrentAssets: "1100",
  currentAssets: "1200", receivables: "1230", cash: "1250", equity: "1300",
  longTermLiabilities: "1400", currentLiabilities: "1500", payables: "1520",
};

function parseNumber(token: string) {
  const negative = /^\s*\(/.test(token) || /^\s*-/.test(token);
  const cleaned = token.replace(/[()\s₽]/g, "").replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function firstFinancialValue(value: string) {
  const dash = value.match(/^\s*[-–—](?=\s|$)/);
  if (dash) return 0;
  const match = value.match(/\(\s*-?\d+(?:[ \u00a0]\d{3})*(?:[,.]\d+)?\s*\)|-?\d{1,3}(?:[ \u00a0]\d{3})+(?:[,.]\d+)?|-?\d+(?:[,.]\d+)?/);
  if (!match) return null;
  const token = match[0];
  // An incomplete accounting-negative token must not become positive profit.
  if (!token.startsWith("(") && (/\(\s*$/.test(value.slice(0, match.index))
    || /^\s*\)/.test(value.slice((match.index ?? 0) + token.length)))) return null;
  return parseNumber(token);
}

// A wrapped value may occupy the next line. A different labelled financial
// row is never a substitute for a missing value in the current row.
function standaloneFinancialLine(value: string) {
  return /^[\s()\d.,+\-–—₽]+(?:\s*(?:руб(?:лей|ля|ль)?\.?|RUB))?\s*$/iu.test(value);
}

function valueAfterCode(lines: string[], code: string) {
  const pattern = new RegExp(`(?:^|\\D)${code}(?:\\D|$)`);
  const index = lines.findIndex((line) => pattern.test(line));
  if (index < 0) return null;
  const line = lines[index];
  const codeIndex = line.search(new RegExp(`\\b${code}\\b`));
  const tail = line.slice(Math.max(0, codeIndex + code.length));
  if (line.includes("\t") && tail.startsWith("\t")) {
    const current = tail.split("\t")[1].trim().replace(/^"(.*)"$/, "$1");
    if (/^[-–—]$/.test(current)) return 0;
    if (!/^(?:-?\d+(?:[ \u00a0]\d{3})*(?:[.,]\d+)?|\(\s*\d+(?:[ \u00a0]\d{3})*(?:[.,]\d+)?\s*\))$/.test(current)) return null;
    return parseNumber(current);
  }
  if (tail.trim()) {
    const firstColumn = tail.trim().split(/ {2,}/)[0];
    if (!standaloneFinancialLine(firstColumn)) return null;
    return firstFinancialValue(firstColumn);
  }
  for (let offset = 1; offset <= 2; offset += 1) {
    const nextLine = lines[index + offset] ?? "";
    if (!standaloneFinancialLine(nextLine)) break;
    const next = firstFinancialValue(nextLine);
    if (next !== null) return next;
  }
  return null;
}

function valueAfterLabel(lines: string[], patterns: RegExp[], expectedCode?: string) {
  const index = lines.findIndex((line) => patterns.some((pattern) => pattern.test(line.trim())));
  if (index < 0) return null;
  const candidates = [lines[index], lines[index + 1] ?? ""];
  for (const [offset, candidate] of candidates.entries()) {
    if (offset > 0 && !standaloneFinancialLine(candidate)) break;
    // Remove only this row's expected standalone code, not an amount such as
    // (1234), nor a code-shaped number in a label-only net-assets disclosure.
    if (offset === 0 && expectedCode) {
      // In a simplified form the displayed code can be the largest component.
      // Its number is never an amount. Only the exact aggregate label establishes equity.
      const coded = candidate.match(/^(.+?)\s+(1[1-7]\d0|2[1-4]\d0)\s{2,}(.+)$/u);
      if (coded && coded[2] !== expectedCode) {
        return expectedCode === "1300" && /^капитал и резервы$/iu.test(coded[1].trim())
          ? firstFinancialValue(coded[3].trim().split(/\s{2,}/)[0]) : null;
      }
    }
    const withoutCode = expectedCode && offset === 0
      ? candidate.replace(new RegExp(`(?:^|\\s)${expectedCode}(?=\\s|$)`), " ")
      : candidate;
    if (offset === 0 && expectedCode && new RegExp(`(?:^|\\s)${expectedCode}(?=\\s|$)`).test(candidate)) return null;
    const value = firstFinancialValue(withoutCode.replace(/^.*?(?=\(\s*-?\d|-?\d|[-–—])/u, ""));
    if (value !== null) return value;
  }
  return null;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function ratio(a: number | null, b: number | null, multiplier = 1) {
  return a == null || b == null || b === 0 ? null : round(a / b * multiplier);
}

function detectPeriod(text: string) {
  const explicit = text.match(/(?:за|по состоянию на)\s+([^\n]{3,55}?(?:20\d{2}))/i)?.[1];
  if (explicit) return explicit.replace(/\s+/g, " ").trim();
  const date = text.match(/\b(?:0?[1-9]|[12]\d|3[01])[.\/-](?:0?[1-9]|1[0-2])[.\/-](20\d{2})\b/)?.[0];
  return date ? `на ${date}` : "Период требует подтверждения";
}

function detectCompany(text: string) {
  const companyName = text.match(/(?:^|\n)\s*Организация\s*:?\s*(.+?)(?:\s+по\s+ОКПО|\n|$)/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  const companyInn = text.match(/Идентификационный номер налогоплательщика[^\n]{0,140}?\b(\d{10}|\d{12})\b/i)?.[1]
    ?? text.match(/(?:^|\s)ИНН\s*:?\s*(\d{10}|\d{12})\b/i)?.[1]
    ?? null;
  return { companyName, companyInn };
}

function money(value: number | null) {
  return value == null ? "нет данных" : new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

export function parseQuarterlyReportText(text: string, fileName: string): QuarterlyFinancialReport {
  // PDF/Excel text can use thin grouping spaces and typographic minus signs.
  // Only a sign attached to a numeric amount is normalized; bare dash cells
  // retain their existing meaning. Parentheses are handled as a signed token.
  const normalized = text.replace(/[\u00a0\u202f\u2009]/g, " ")
    .replace(/[\u2212\ufe63\uff0d][ \t]*(?=\d)|[\u2012\u2013\u2014](?=\d)/g, "-")
    .replace(/\r/g, "");
  const lines = normalized.split("\n").map((line) => line.trimStart().replace(/[ ]+$/, "")).filter(Boolean);
  const markerCount = ["баланс", "актив", "выруч", "прибыл", "дебитор", "кредитор"].filter((marker) => normalized.toLowerCase().includes(marker)).length;
  if (normalized.replace(/\s/g, "").length < 180 || markerCount < 2) {
    throw new Error("В файле не найден читаемый финансовый текст. PDF, вероятно, является сканом или фотографией. Выгрузите текстовый PDF либо Excel (.xlsx/.csv). OCR в этом модуле не используется.");
  }
  const lower = normalized.toLowerCase();
  const subject = detectCompany(normalized);
  const declaredScales = new Set<number>();
  if (/млн\.?\s*руб|океи\s*[:|]?\s*385/.test(lower)) declaredScales.add(1_000_000);
  if (/тыс\.?\s*руб|океи\s*[:|]?\s*384/.test(lower)) declaredScales.add(1_000);
  if (/единица измерения\s*[:|]?\s*(?:в\s+)?руб|океи\s*[:|]?\s*383/.test(lower)) declaredScales.add(1);
  const unitDeclarations = lower.split("\n").filter(line => /единица измерения|валюта отч[её]тности|^валюта\s*[:|]/.test(line));
  const unsupportedDeclaration = unitDeclarations.some(line => !/руб|₽|rub\b|океи\s*[:|]?\s*38[345]\b/.test(line)
    || /доллар|евро|франк|фунт|тенге|юан|гривн|\b(?:usd|eur|kzt|cny|chf|gbp|byn|uah)\b/.test(line)
    || /белорусск|миллиард|млрд/.test(line));
  const scaleConfirmed = declaredScales.size === 1 && !unsupportedDeclaration;
  const unitScale = [...declaredScales][0] ?? 1;
  const unitLabel = unitScale === 1_000_000 ? "млн ₽" : unitScale === 1_000 ? "тыс. ₽" : "₽";
  const values = {} as QuarterlyFinancialReport["values"];
  for (const key of Object.keys(labels) as Array<keyof typeof labels>) {
    const raw = codes[key] ? valueAfterCode(lines, codes[key] as string) : null;
    const fallback = raw ?? valueAfterLabel(lines, labels[key], codes[key]);
    values[key] = fallback == null ? null : fallback * unitScale;
  }
  if (values.netAssets == null && values.equity != null) values.netAssets = values.equity;

  const recognized = Object.values(values).filter((value) => value !== null).length;
  if (recognized < 5 || values.assets == null) {
    throw new Error("Структура отчётности пока не распознана надёжно. Нужны формы с кодами строк бухгалтерского баланса и отчёта о финансовых результатах либо Excel с подписанными строками.");
  }

  const currentLiquidity = ratio(values.currentAssets, values.currentLiabilities);
  const autonomy = ratio(values.equity, values.assets, 100);
  const receivablesToAssets = ratio(values.receivables, values.assets);
  const payablesToRevenue = ratio(values.payables, values.revenue);
  const netWorkingCapital = values.currentAssets == null || values.currentLiabilities == null ? null : values.currentAssets - values.currentLiabilities;
  const factors: QuarterlyFactor[] = [];
  const critical = (title: string, evidence: string, bankImpact: string, nextStep: string) => factors.push({ severity: "critical", title, evidence, bankImpact, nextStep });
  const warning = (title: string, evidence: string, bankImpact: string, nextStep: string) => factors.push({ severity: "warning", title, evidence, bankImpact, nextStep });

  if ((values.netAssets ?? values.equity ?? 0) <= 0) critical(
    "Отрицательные или нулевые чистые активы",
    `Чистые активы / капитал: ${money(values.netAssets ?? values.equity)}.`,
    "Для многих программ необеспеченного кредитования это формальный стоп-фактор независимо от оборота по счетам.",
    "Не направлять данный комплект до проверки бухгалтером корректности строк и подтверждения подписанной версии отчётности.",
  );
  if ((values.netProfit ?? 0) < 0) critical(
    "Отрицательный финансовый результат",
    `Чистый результат промежуточного периода: ${money(values.netProfit)}.`,
    "Банк может сделать вывод об отсутствии источника обслуживания нового долга и сформировать отрицательное решение.",
    "До подачи подготовить документальное объяснение результата и проверить, отражает ли файл завершённый отчётный период.",
  );
  if (currentLiquidity != null && currentLiquidity < 0.8) critical(
    "Дефицит текущей ликвидности",
    `Оборотные активы покрывают краткосрочные обязательства с коэффициентом ${currentLiquidity}.`,
    "Высока вероятность отказа либо требования ликвидного обеспечения.",
    "Проверить расшифровки краткосрочных обязательств, дебиторки и запасов до направления файла кредитору.",
  );
  else if (currentLiquidity != null && currentLiquidity < 1.2) warning(
    "Ликвидность ниже комфортного банковского ориентира",
    `Коэффициент текущей ликвидности: ${currentLiquidity}.`,
    "Расчётный лимит может быть снижен; возможен запрос дополнительного обеспечения.",
    "Приложить расшифровки оборотных активов и сроков погашения обязательств.",
  );
  if (receivablesToAssets != null && receivablesToAssets >= 0.65) critical(
    "Баланс перегружен дебиторской задолженностью",
    `Дебиторка составляет ${Math.round(receivablesToAssets * 100)}% активов.`,
    "Без подтверждения качества и сроков взыскания банк может исключить существенную часть активов из расчёта и отказать.",
    "Нужны реестр дебиторов, сроки, просрочка и документы по крупнейшим суммам; сам показатель в отчётности не корректируется ради подачи.",
  );
  else if (receivablesToAssets != null && receivablesToAssets >= 0.45) warning(
    "Высокая доля дебиторской задолженности",
    `Дебиторка составляет ${Math.round(receivablesToAssets * 100)}% активов.`,
    "Кредитный аналитик будет отдельно оценивать реальность взыскания и концентрацию на покупателях.",
    "Подготовить расшифровку дебиторки и подтвердить последующие оплаты выписками.",
  );
  if (payablesToRevenue != null && payablesToRevenue >= 0.6) warning(
    "Кредиторская задолженность велика относительно выручки периода",
    `Кредиторка / выручка: ${Math.round(payablesToRevenue * 100)}%.`,
    "Банк может трактовать показатель как финансирование оборота за счёт поставщиков и риск кассового разрыва.",
    "Проверить период сопоставления и предоставить расшифровку сроков и просроченной кредиторки.",
  );
  if (netWorkingCapital != null && netWorkingCapital < 0) warning(
    "Отрицательный чистый оборотный капитал",
    `Оборотных активов меньше краткосрочных обязательств на ${money(Math.abs(netWorkingCapital))}.`,
    "Новая долговая нагрузка может быть признана несоответствующей структуре баланса.",
    "Сопоставить сроки дебиторки и кредиторки и подтвердить источники погашения выписками и контрактами.",
  );
  if (!factors.length) factors.push({ severity: "info", title: "Явных отказных показателей не выявлено", evidence: "Капитал, прибыль и текущая ликвидность не формируют автоматический стоп.", bankImpact: "Файл можно использовать как дополнительный источник после сверки с годовой БФО и выписками.", nextStep: "Подтвердить период, подпись и полноту форм отчётности." });

  const balanceLiabilities = [values.equity, values.longTermLiabilities, values.currentLiabilities].every((value) => value !== null)
    ? (values.equity ?? 0) + (values.longTermLiabilities ?? 0) + (values.currentLiabilities ?? 0) : null;
  const balanceGap = values.assets != null && balanceLiabilities != null && values.assets !== 0 ? Math.abs(values.assets - balanceLiabilities) / Math.abs(values.assets) : null;
  const warnings: string[] = [];
  if (!scaleConfirmed) warnings.push("Единица измерения не найдена явно; проверьте масштаб сумм.");
  if (balanceGap != null && balanceGap > 0.03) warnings.push(`Баланс не сошёлся на ${Math.round(balanceGap * 100)}%; требуется проверить распознанные колонки и исходный файл.`);
  const hasFormalStop = (values.netAssets ?? values.equity ?? 0) <= 0;
  const criticalCount = factors.filter((factor) => factor.severity === "critical").length;
  const warningCount = factors.filter((factor) => factor.severity === "warning").length;
  const verdictCode = hasFormalStop ? "STOP" : criticalCount ? "HIGH_RISK" : warningCount ? "REVIEW" : "READY";
  const verdict = verdictCode === "STOP" ? "По этому балансу вероятен формальный отказ"
    : verdictCode === "HIGH_RISK" ? "По текущему отчёту вероятность отказа высокая"
    : verdictCode === "REVIEW" ? "Подача возможна только после проверки расшифровок"
    : "Явных отказных показателей в квартальном отчёте не выявлено";
  const submissionAdvice = verdictCode === "READY"
    ? "Отчёт можно включать в досье после проверки периода, подписей и сверки с официальной БФО и банковскими оборотами."
    : "Прескор не рекомендует направлять именно этот комплект в банк без предварительной внутренней проверки. Речь не об изменении отчётности: банк должен получить достоверные данные, а клиенту важно заранее понимать вероятный результат их оценки.";
  const parserConfidence = Math.max(45, Math.min(98, Math.round(50 + recognized / 12 * 40 - warnings.length * 7)));
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `quarter-${Date.now()}`,
    fileName,
    fileType: fileName.toLowerCase().endsWith(".pdf") ? "pdf" : fileName.toLowerCase().endsWith(".csv") ? "csv" : "xlsx",
    companyName: subject.companyName,
    companyInn: subject.companyInn,
    period: detectPeriod(normalized), extractedAt: new Date().toISOString(), parserConfidence, unitScale, unitLabel,
    financialMetadataV2: {
      scaleConfirmed,
      rawScale: unitScale,
      rawLines: Object.fromEntries([...Object.values(BALANCE_CODES), ...Object.values(INCOME_CODES)].map((code) => [code, valueAfterCode(lines, code)])),
      labelValues: Object.fromEntries(Object.entries(codes).flatMap(([key, code]) => {
        if (valueAfterCode(lines, code) !== null) return [];
        // Cyrillic labels need explicit boundaries; keep legacy matching untouched.
        const patterns = key === "revenue" ? [/^выручка(?=\s|$|\()/i, ...labels.revenue]
          : key === "currentAssets" ? [/^оборотные активы/i]
          : labels[key as keyof typeof labels];
        const rawValue = valueAfterLabel(lines, patterns, code);
        const line = lines.find((line) => patterns.some((pattern) => pattern.test(line.trim())));
        const rawLabel = line?.trim().match(patterns.find((pattern) => pattern.test(line.trim()))!)?.[0];
        return rawValue !== null && rawLabel ? [[code, { rawValue, rawLabel }]] : [];
      })),
      reportedNetAssets: valueAfterLabel(lines, labels.netAssets),
      reportedNetAssetsLabel: lines.find((line) => labels.netAssets.some((pattern) => pattern.test(line)))?.match(/чистые активы/i)?.[0],
      period: parseFinancialPeriod(normalized),
    },
    values, ratios: { currentLiquidity, autonomy, receivablesToAssets, payablesToRevenue, netWorkingCapital },
    verdictCode, verdict,
    conclusion: `Распознано ${recognized} ключевых строк. Активы ${money(values.assets)}, капитал ${money(values.equity)}, выручка ${money(values.revenue)}, чистый результат ${money(values.netProfit)}.`,
    submissionAdvice, factors, warnings,
  };
}
