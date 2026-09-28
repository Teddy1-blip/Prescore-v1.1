import { strToU8, zipSync } from "fflate";
import type { CreditHistoryReport, CreditObligation } from "./credit-history";
import type { AnalysisResult } from "./prescore";

export type ExcelCell = string | number | boolean | null | undefined;
export type ExcelSheet = { name: string; rows: ExcelCell[][]; widths?: number[] };

const xmlEscape = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

function columnName(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function sheetXml(sheet: ExcelSheet) {
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((cell, cellIndex) => {
      const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
      const style = rowIndex === 0 ? ' s="1"' : typeof cell === "number" ? ' s="2"' : "";
      if (typeof cell === "number" && Number.isFinite(cell)) return `<c r="${ref}"${style}><v>${cell}</v></c>`;
      if (typeof cell === "boolean") return `<c r="${ref}" t="b"${style}><v>${cell ? 1 : 0}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(cell == null ? "" : String(cell))}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const columns = (sheet.widths ?? []).map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${columns ? `<cols>${columns}</cols>` : ""}<sheetData>${rows}</sheetData><autoFilter ref="A1:${columnName(Math.max(0, (sheet.rows[0]?.length ?? 1) - 1))}${Math.max(1, sheet.rows.length)}"/></worksheet>`;
}

export function buildXlsx(sheets: ExcelSheet[]) {
  const safeSheets = sheets.length ? sheets : [{ name: "Данные", rows: [["Нет данных"]] }];
  const files: Record<string, Uint8Array> = {};
  files["[Content_Types].xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${safeSheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  files["_rels/.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  files["xl/workbook.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${safeSheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name.slice(0, 31).replace(/[\\/*?:\[\]]/g, " "))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`);
  files["xl/_rels/workbook.xml.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${safeSheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  files["xl/styles.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF174C6B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFill="1" applyFont="1"><alignment wrapText="1"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`);
  safeSheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheetXml(sheet)); });
  return zipSync(files, { level: 6 });
}

export function downloadXlsx(fileName: string, sheets: ExcelSheet[]) {
  const bytes = buildXlsx(sheets);
  const blob = new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function activeObligation(item: CreditObligation) {
  return !/закрыт|погашен|прекращ/i.test(item.status);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addMonths(value: Date, months: number) {
  const day = value.getUTCDate();
  const result = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export type PaymentCalendarRow = {
  date: string;
  creditor: string;
  product: string;
  amount: number;
  principalBalance: number | null;
  basis: "Дата из БКИ" | "Расчёт по ежемесячному платежу";
  quality: string;
};

export function buildPaymentCalendar(report: CreditHistoryReport, months = 12): PaymentCalendarRow[] {
  const now = new Date();
  const defaultDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 25));
  return report.obligations.filter(activeObligation).flatMap((item) => {
    const amount = item.nextPaymentAmount ?? item.monthlyPayment ?? 0;
    if (amount <= 0) return [];
    const parsed = item.nextPaymentDate ? new Date(`${item.nextPaymentDate}T00:00:00Z`) : defaultDate;
    const start = Number.isNaN(parsed.getTime()) ? defaultDate : parsed;
    const close = item.scheduledCloseAt ? new Date(`${item.scheduledCloseAt}T23:59:59Z`) : null;
    const rows: PaymentCalendarRow[] = [];
    for (let index = 0; index < months; index += 1) {
      const date = addMonths(start, index);
      if (close && !Number.isNaN(close.getTime()) && date > close) break;
      rows.push({
        date: isoDate(date),
        creditor: item.creditor,
        product: item.product,
        amount: index === 0 ? (item.nextPaymentAmount ?? item.monthlyPayment ?? 0) : (item.monthlyPayment ?? item.nextPaymentAmount ?? 0),
        principalBalance: item.totalOutstanding ?? item.outstandingPrincipal,
        basis: index === 0 && item.nextPaymentDate ? "Дата из БКИ" : "Расчёт по ежемесячному платежу",
        quality: item.paymentQuality,
      });
    }
    return rows;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function cashFlowWorkbook(analysis: Omit<AnalysisResult, "transactions"> & { transactions?: AnalysisResult["transactions"] }): ExcelSheet[] {
  const transactionRows = analysis.transactions ?? [];
  const categories = new Map<string, { inflow: number; outflow: number }>();
  for (const item of transactionRows) {
    const current = categories.get(item.category) ?? { inflow: 0, outflow: 0 };
    if (item.direction === "in") current.inflow += item.amount;
    if (item.direction === "out") current.outflow += item.amount;
    categories.set(item.category, current);
  }
  return [
    {
      name: "ОДДС по месяцам",
      widths: [16, 20, 20, 20],
      rows: [["Период", "Поступления, ₽", "Платежи, ₽", "Чистый поток, ₽"], ...analysis.monthly.map((item) => [item.month, item.inflow, item.outflow, item.inflow - item.outflow])],
    },
    {
      name: "Категории",
      widths: [28, 20, 20, 20],
      rows: [["Категория", "Поступления, ₽", "Платежи, ₽", "Сальдо, ₽"], ...[...categories.entries()].map(([category, value]) => [category, value.inflow, value.outflow, value.inflow - value.outflow]), ...(categories.size ? [] : [["Детализация недоступна после локальной обработки", 0, 0, 0]])],
    },
    {
      name: "Параметры отчёта",
      widths: [32, 48],
      rows: [["Параметр", "Значение"], ["Компания", analysis.companyName], ["ИНН", analysis.companyInn], ["Период", `${analysis.periodFrom} — ${analysis.periodTo}`], ["Банки", (analysis.bankNames ?? []).join(", ")], ["Файлов выписок", analysis.sourceFiles?.length ?? analysis.metrics.statements ?? 1], ["Примечание", "Информационно-аналитическая управленческая форма, не заменяет регламентированную бухгалтерскую отчётность"]],
    },
  ];
}

export function creditWorkbook(report: CreditHistoryReport): ExcelSheet[] {
  const calendar = buildPaymentCalendar(report);
  const active = report.obligations.filter(activeObligation);
  const closed = report.obligations.filter((item) => !activeObligation(item));
  const overdue = report.obligations.filter((item) => (item.overdueAmount ?? 0) > 0 || (item.maxDelinquencyDays ?? 0) > 0 || !["Без просрочек", "Недостаточно данных"].includes(item.paymentQuality));
  const portfolioHeader = ["Кредитор", "Продукт", "Роль", "Статус", "Сумма / лимит, ₽", "Остаток, ₽", "Платёж, ₽", "Ставка, %", "Просрочка, ₽", "Макс. просрочка, дней", "Качество", "Открыт", "Плановое закрытие", "Обновлено", "Обеспечение", "Источник"];
  const portfolioRow = (item: CreditObligation): ExcelCell[] => [item.creditor, item.product, item.role, item.status, item.creditLimit ?? item.originalAmount, item.totalOutstanding ?? item.outstandingPrincipal, item.monthlyPayment ?? item.nextPaymentAmount, item.annualRate, item.overdueAmount, item.maxDelinquencyDays, item.paymentQuality, item.openedAt, item.scheduledCloseAt, item.updatedAt, item.collateral, item.sourcePageHint];
  return [
    {
      name: "Сводка",
      widths: [36, 48],
      rows: [["Показатель", "Значение"], ["Источник", report.source], ["Субъект", report.subjectName], ["ИНН", report.subjectInn], ["Роль относительно компании", report.relationshipToCompany || "Не указано"], ["Включается в долг компании", report.affectsCompanyDebt ? "Да" : "Нет"], ["Дата отчёта", report.reportDate], ["Активных обязательств", active.length], ["Закрытых обязательств", closed.length], ["Сумма / активные лимиты, ₽", report.summary.originalAmount], ["Остаток основного долга, ₽", report.summary.outstandingPrincipal], ["Полный остаток, ₽", report.summary.totalOutstanding], ["Платёж в месяц, ₽", report.summary.monthlyPayment], ["Текущая просрочка, ₽", report.summary.overdueAmount], ["Средневзвешенная ставка, %", report.summary.weightedAnnualRate], ["Качество обслуживания", report.summary.debtServiceQuality], ["Достоверность парсинга, %", report.parserConfidence], ["Ограничение", "Отсутствующее значение означает «нет данных» и не считается нулём. Итоги требуют сверки с первичным отчётом и договорами."]],
    },
    {
      name: "Активные обязательства",
      widths: [26, 24, 18, 18, 18, 18, 18, 14, 18, 16, 24, 14, 18, 16, 28, 24],
      rows: [portfolioHeader, ...active.map(portfolioRow)],
    },
    {
      name: "Закрытые обязательства",
      widths: [26, 24, 18, 18, 18, 18, 18, 14, 18, 16, 24, 14, 18, 16, 28, 24],
      rows: [portfolioHeader, ...closed.map(portfolioRow)],
    },
    {
      name: "Просрочки",
      widths: [26, 24, 18, 18, 18, 18, 18, 14, 18, 16, 24, 14, 18, 16, 28, 24],
      rows: [portfolioHeader, ...overdue.map(portfolioRow)],
    },
    {
      name: "Запросы",
      widths: [34, 22, 42],
      rows: [["Период / показатель", "Количество", "Источник"], ["Последние 30 дней", report.summary.inquiries30Days, report.source], ["Последние 12 месяцев", report.summary.inquiries12Months, report.source], ["Последние 24 месяца", report.summary.inquiries24Months, report.source], ["Примечание", "", "Если бюро не раскрыло отдельные запросы, выгружается только подтверждённый агрегат; значение не подменяется нулём."]],
    },
    {
      name: "Платёжный календарь",
      widths: [16, 28, 24, 18, 18, 32, 24],
      rows: [["Дата", "Кредитор", "Продукт", "Платёж, ₽", "Остаток по БКИ, ₽", "Основание даты", "Качество обслуживания"], ...calendar.map((item) => [item.date, item.creditor, item.product, item.amount, item.principalBalance, item.basis, item.quality])],
    },
  ];
}
