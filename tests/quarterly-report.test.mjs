import assert from "node:assert/strict";
import test from "node:test";
import { parseQuarterlyReportText } from "../lib/quarterly-report.ts";
import { recurringCuratorPayment, recurringReferralPayment } from "../lib/partner-commissions.ts";

test("flags negative capital and loss as a likely refusal without advising data manipulation", () => {
  const report = parseQuarterlyReportText(`
    БУХГАЛТЕРСКАЯ ОТЧЁТНОСТЬ за 9 месяцев 2026 года
    Единица измерения: тыс. руб.
    Внеоборотные активы 1100 7800
    Оборотные активы 1200 16200
    Дебиторская задолженность 1230 14200
    Денежные средства 1250 450
    БАЛАНС Актив 1600 24000
    Капитал и резервы 1300 -1800
    Долгосрочные обязательства 1400 4200
    Краткосрочные обязательства 1500 21600
    Кредиторская задолженность 1520 17300
    Выручка 2110 28700
    Чистая прибыль (убыток) 2400 -2350
  `, "quarterly-risk-fixture.xlsx");
  assert.equal(report.verdictCode, "STOP");
  assert.equal(report.values.equity, -1_800_000);
  assert.equal(report.values.netProfit, -2_350_000);
  assert.match(report.verdict, /формальный отказ/i);
  assert.match(report.submissionAdvice, /не об изменении отчётности/i);
  assert.doesNotMatch(report.submissionAdvice, /исправить|увеличить прибыль|уменьшить кредиторку/i);
});

test("rejects an image-only or textless report instead of inventing values", () => {
  assert.throws(() => parseQuarterlyReportText("скан страница 1", "scan.pdf"), /сканом|фотографией/i);
});

test("reads the current-period column from a real 1C-style interim form", () => {
  const report = parseQuarterlyReportText(`
    Бухгалтерская отчетность за Январь - Март 2026 г.
    Организация Общество с ограниченной ответственностью "ТЕСТ" по ОКПО 12345678
    Идентификационный номер налогоплательщика ИНН 7701234567
    Единица измерения: в тыс. рублей по ОКЕИ 384
    Итого по разделу I 1100 - - -
    Дебиторская задолженность 1230 11 222 3 819 164
    Денежные средства и денежные эквиваленты 1250 885 148 50
    Итого по разделу II 1200 13 301 4 241 1 232
    БАЛАНС 1600 13 301 4 241 1 232
    Итого по разделу III 1300 5 152 2 913 (338)
    Итого по разделу IV 1400 5 036 - 352
    Кредиторская задолженность 1520 3 114 1 328 1 217
    Итого по разделу V 1500 3 114 1 328 1 217
    Выручка 2110 9 199 6 687
    Чистая прибыль (убыток) 2400 1 795 2 440
  `, "quarter.pdf");
  assert.equal(report.companyInn, "7701234567");
  assert.match(report.companyName, /ТЕСТ/);
  assert.equal(report.values.assets, 13_301_000);
  assert.equal(report.values.receivables, 11_222_000);
  assert.equal(report.values.longTermLiabilities, 5_036_000);
  assert.equal(report.values.netProfit, 1_795_000);
  assert.equal(report.verdictCode, "HIGH_RISK");
});

test("treats a dash in the current column as zero, not as the prior-period value", () => {
  const report = parseQuarterlyReportText(`
    Бухгалтерский баланс за 9 месяцев 2026 г. Единица измерения: тыс. руб.
    Внеоборотные активы 1100 - - -
    Оборотные активы 1200   3 267   1 232   -
    Дебиторская задолженность 1230   2 557   164   -
    Денежные средства 1250   17   50   -
    БАЛАНС 1600   3 267   1 232   -
    Капитал и резервы 1300   3 094   (338)   -
    Долгосрочные обязательства 1400   -   352   -
    Краткосрочные обязательства 1500   173   1 217   -
    Кредиторская задолженность 1520   173   1 217   -
    Выручка 2110   20 509   311
    Чистая прибыль (убыток) 2400   3 431   (127)
  `, "quarter.xlsx");
  assert.equal(report.values.longTermLiabilities, 0);
  assert.equal(report.values.revenue, 20_509_000);
  assert.deepEqual(report.warnings, []);
});

test("keeps the agent and curator recurring shares separate", () => {
  assert.equal(recurringReferralPayment, 1950);
  assert.equal(recurringCuratorPayment, 650);
});
