import assert from "node:assert/strict";
import test from "node:test";
import { buildPaymentCalendar, buildXlsx, creditWorkbook } from "../lib/excel-export.ts";

function report() {
  return {
    source: "НБКИ", subjectType: "Юридическое лицо", subjectName: "ООО Тест", subjectInn: "7701234567", reportDate: "2026-08-18", fileName: "test.pdf",
    bureauScore: null, bureauScoreMax: null, selfBanActive: false, parserConfidence: 90, warnings: [],
    obligations: [{
      id: "1", creditor: "Тест Банк", product: "Кредитная линия", status: "Действующий", role: "Заёмщик", openedAt: "2025-01-01", scheduledCloseAt: "2027-12-31", updatedAt: "2026-08-18",
      originalAmount: 5_000_000, creditLimit: 5_000_000, outstandingPrincipal: 3_000_000, totalOutstanding: 3_100_000, monthlyPayment: 250_000, nextPaymentAmount: 260_000,
      nextPaymentDate: "2026-09-15", annualRate: 22, rateLabel: "Ставка", overdueAmount: 0, maxDelinquencyDays: 0, paymentQuality: "Без просрочек", collateral: "", guaranteeAmount: null, accountNumber: "", sourcePageHint: "",
    }],
    summary: { reportedOpenCount: 1, reportedClosedCount: 0, negativeAccounts: 0, inquiries30Days: 0, inquiries12Months: 1, inquiries24Months: 1, originalAmount: 5_000_000, outstandingPrincipal: 3_000_000, totalOutstanding: 3_100_000, monthlyPayment: 250_000, overdueAmount: 0, guaranteeExposure: 0, knownRatesCount: 1, weightedAnnualRate: 22, debtServiceQuality: "Без просрочек" },
  };
}

test("builds a 12-month payment calendar and marks calculated dates", () => {
  const rows = buildPaymentCalendar(report());
  assert.equal(rows.length, 12);
  assert.equal(rows[0].amount, 260_000);
  assert.equal(rows[0].basis, "Дата из БКИ");
  assert.equal(rows[1].amount, 250_000);
  assert.equal(rows[1].basis, "Расчёт по ежемесячному платежу");
});

test("creates an Excel workbook with portfolio and calendar sheets", () => {
  const sheets = creditWorkbook(report());
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Сводка", "Активные обязательства", "Закрытые обязательства", "Просрочки", "Запросы", "Платёжный календарь"]);
  assert.equal(sheets.find((sheet) => sheet.name === "Активные обязательства").rows.length, 2);
  assert.equal(sheets.find((sheet) => sheet.name === "Закрытые обязательства").rows.length, 1);
  const bytes = buildXlsx(sheets);
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), "PK");
  assert.ok(bytes.length > 1000);
});
