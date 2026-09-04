import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAuthoritativeCreditHistoryText,
  parseAuthoritativeQuarterlyText,
  structuredAttachmentIsUntrusted,
} from "../lib/credit-engine/source-foundation.ts";

test("server-authoritative BKI rejects a corporate report for another INN", () => {
  assert.throws(() => parseAuthoritativeCreditHistoryText({
    text: `Субъект: Кредитная история юридического лица\nИНН\nНомер\n7701000000\nСводка Счета\nВсе счета Всего: 0\nПри наличии вопросов обратитесь в НБКИ\nПредоставлен 02-08-2026`,
    fileName: "foreign-nbki.pdf",
    analysisInn: "5032333146",
    relationship: "Компания-заёмщик",
  }), /ИНН корпоративного БКИ не совпадает/i);
});

test("server-authoritative quarterly rejects a report for another INN", () => {
  assert.throws(() => parseAuthoritativeQuarterlyText({
    text: `Бухгалтерская отчетность за Январь - Март 2026 г.\nОрганизация ООО ТЕСТ\nИНН 7701234567\nЕдиница измерения: тыс. руб.\nОборотные активы 1200 100\nБАЛАНС 1600 100\nКапитал и резервы 1300 100\nВыручка 2110 100\nЧистая прибыль 2400 10`,
    fileName: "foreign-quarter.xlsx",
    analysisInn: "5032333146",
  }), /ИНН квартальной отчётности не совпадает/i);
});

test("ready-made client BKI and quarterly payloads are never authoritative", () => {
  assert.equal(structuredAttachmentIsUntrusted({ type: "credit-history", creditHistory: { summary: { monthlyPayment: 1 } } }), true);
  assert.equal(structuredAttachmentIsUntrusted({ type: "quarterly-report", quarterlyReport: { values: { revenue: 1 } } }), true);
  assert.equal(structuredAttachmentIsUntrusted({ type: "applications" }), false);
});

