import assert from "node:assert/strict";
import test from "node:test";
import { compareCreditPortfolio, parseCreditHistoryText } from "../lib/credit-history.ts";

test("parses a modern SB BKI obligation into the normalized portfolio", () => {
  const report = parseCreditHistoryText(`
Иванов Иван Иванович
Содержание
Рейтинг и портрет заёмщика
Ваш рейтинг — 811
Главное о кредитной истории
1 открытых кредитов / займов
120 000.00 ₽ срочный основной долг
9 000.00 ₽ среднемесячный платёж
Сведения о самозапрете
Действующие запреты на заключение договоров
Отсутствуют
Ранее действовавшие
Банк: Тест Банк  Действующий
Потребительский кредит
Данные обновлены 01.08.2026
1
Взяли на таких условиях
200 000.00 ₽ с 01.01.2025 по 01.01.2028
Выплатили
80 000.00 ₽
Осталось выплатить
120 000.00 ₽
120 000.00 ₽
Полная стоимость кредита
19.5 % годовых или 30 000.00 ₽
Среднемесячный платёж
9 000.00 ₽
Текущая просрочка
нет
Своевременность платежей по договору
2026 0 0 0
Закрытые кредиты, займы, карты
Отчёт от 2 августа 2026
ИНН 123456789012
`, "sb.pdf");

  assert.equal(report.source, "СБ БКИ");
  assert.equal(report.obligations.length, 1);
  assert.equal(report.obligations[0].originalAmount, 200000);
  assert.equal(report.obligations[0].outstandingPrincipal, 120000);
  assert.equal(report.obligations[0].monthlyPayment, 9000);
  assert.equal(report.obligations[0].annualRate, 19.5);
  assert.equal(report.summary.debtServiceQuality, "Без просрочек");
});

test("keeps unavailable legacy NBKI balance, payment and rate as missing", () => {
  const report = parseCreditHistoryText(`
Субъект: Кредитная история юридического лица
Наименование организации
ООО "ТЕСТ"
Сводка Счета
Все счета Всего: 1
Негативных: 0
Открытых: 0
Запросы
Все запросы 4 1 4 01-08-2026
Субъект: Кредитная история юридического лица
ИНН
Номер
7701000000
Счет
Вид:
Отношение: Принципал
Кредитор: Тест Банк
Счет: BG-1
Размер/лимит: нет данных
Полная стоимость: нет данных
Открыт: 01-01-2025
Статус: нет данных
Задолж-сть: нет данных
Просрочено: нет данных
След.платеж: нет данных
Банковские гарантии
Сумма: RUB 500000
Действ.до: 01-01-2026
Просрочки (0 просроч.платежей)
Просрочек от 30 до 59 дн.: 0
Просрочек от 60 до 89 дн.: 0
Просрочек более, чем на 90 дн.: 0
При наличии вопросов обратитесь в НБКИ
Предоставлен 02-08-2026
`, "nbki.pdf");

  assert.equal(report.source, "НБКИ");
  assert.equal(report.obligations.length, 1);
  assert.equal(report.obligations[0].product, "Банковская гарантия");
  assert.equal(report.obligations[0].totalOutstanding, null);
  assert.equal(report.obligations[0].monthlyPayment, null);
  assert.equal(report.obligations[0].annualRate, null);
  assert.equal(report.summary.guaranteeExposure, 500000);
  assert.equal(report.summary.knownValues?.outstandingPrincipal, false);
  assert.equal(report.summary.knownValues?.monthlyPayment, false);
  assert.equal(report.summary.knownValues?.guaranteeExposure, true);

  const result = compareCreditPortfolio({
    report,
    avgMonthlyInflow: 2_000_000,
    statementMonthlyDebtPayment: 120_000,
    baseMonthlyPaymentCapacity: 300_000,
    estimatedLimitMax: 5_000_000,
    limitConfidence: 80,
  });
  assert.equal(result.comparison.bureauMonthlyPaymentKnown, false);
  assert.equal(result.comparison.bureauOutstandingKnown, false);
  assert.equal(result.comparison.adjustedLimitMax, 5_000_000);
  assert.match(result.insights[0].impact, /не считаются нулём/i);
});

test("does not mix the owner's personal BKI into company debt capacity", () => {
  const report = parseCreditHistoryText(`
Иванов Иван Иванович
Рейтинг и портрет заёмщика
Главное о кредитной истории
1 открытых кредитов / займов
500 000.00 ₽ срочный основной долг
50 000.00 ₽ среднемесячный платёж
Банк: Тест Банк Действующий
Потребительский кредит
Взяли на таких условиях
700 000.00 ₽ с 01.01.2025 по 01.01.2028
Осталось выплатить
500 000.00 ₽
Среднемесячный платёж
50 000.00 ₽
Текущая просрочка
нет
Закрытые кредиты, займы, карты
Отчёт от 2 августа 2026
ИНН 123456789012
`, "owner.pdf");
  report.relationshipToCompany = "Собственник";
  report.affectsCompanyDebt = false;
  const result = compareCreditPortfolio({
    report, avgMonthlyInflow: 2_000_000, statementMonthlyDebtPayment: 120_000,
    baseMonthlyPaymentCapacity: 300_000, estimatedLimitMax: 5_000_000, limitConfidence: 80,
  });
  assert.equal(result.comparison.bureauMonthlyDebtPayment, 0);
  assert.equal(result.comparison.outstandingToAnnualInflow, null);
  assert.equal(result.comparison.adjustedLimitMax, 5_000_000);
  assert.match(result.insights[0].title, /личный БКИ отделён/i);
});
