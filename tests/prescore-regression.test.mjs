import assert from "node:assert/strict";
import test from "node:test";
import { analysisForStorage, analyzeBankStatement } from "../lib/prescore.ts";

const account = "40702810900000012345";
const inn = "7701234567";

function document(rows) {
  return ["СекцияДокумент=Платежное поручение", ...Object.entries(rows).map(([key, value]) => `${key}=${value}`), "КонецДокумента"];
}

function statement(withLoan = false) {
  const rows = [];
  for (let month = 1; month <= 6; month += 1) {
    const mm = String(month).padStart(2, "0");
    rows.push(...document({
      Номер: String(month * 10 + 1), Дата: `05.${mm}.2026`, Сумма: "1000000.00",
      Плательщик: `ООО ПОКУПАТЕЛЬ ${month}`, ПлательщикИНН: `77010000${String(month).padStart(2, "0")}`,
      ПлательщикСчет: `4070281011111111111${month}`, Получатель: "ООО ТЕСТ", ПолучательИНН: inn,
      ПолучательСчет: account, НазначениеПлатежа: "Оплата товаров по договору поставки, в том числе НДС",
    }));
    rows.push(...document({
      Номер: String(month * 10 + 2), Дата: `20.${mm}.2026`, Сумма: "500000.00",
      Плательщик: "ООО ТЕСТ", ПлательщикИНН: inn, ПлательщикСчет: account,
      Получатель: "ООО ПОСТАВЩИК", ПолучательИНН: "7812345678", ПолучательСчет: "40702810222222222222",
      НазначениеПлатежа: "Оплата сырья по договору поставки, в том числе НДС",
    }));
  }
  if (withLoan) rows.push(...document({
    Номер: "999", Дата: "28.06.2026", Сумма: "10000000.00",
    Плательщик: "ПАО ТЕСТ БАНК", ПлательщикИНН: "7700000000", ПлательщикСчет: "47427810999999999999",
    Получатель: "ООО ТЕСТ", ПолучательИНН: inn, ПолучательСчет: account,
    НазначениеПлатежа: "Зачисление кредитных средств по договору кредита КЛ-1",
  }));
  return [
    "1CClientBankExchange", "ВерсияФормата=1.03", "Отправитель=Тест Банк",
    "ДатаНачала=01.01.2026", "ДатаКонца=30.06.2026", `РасчСчет=${account}`,
    "СекцияРасчСчет", "ДатаНачала=01.01.2026", "ДатаКонца=30.06.2026", `РасчСчет=${account}`,
    "НачальныйОстаток=1000000.00", "КонечныйОстаток=4000000.00", "КонецРасчСчет",
    ...rows, "КонецФайла",
  ].join("\r\n");
}

test("incoming credit increases gross inflow but not operating revenue or calculated limit", () => {
  const baseline = analyzeBankStatement(statement(false), "baseline.txt");
  const financed = analyzeBankStatement(statement(true), "with-loan.txt");
  assert.equal(financed.metrics.grossInflow - baseline.metrics.grossInflow, 10_000_000);
  assert.equal(financed.metrics.operatingInflow, baseline.metrics.operatingInflow);
  assert.equal(financed.metrics.avgMonthlyInflow, baseline.metrics.avgMonthlyInflow);
  assert.equal(financed.metrics.estimatedLimitMax, baseline.metrics.estimatedLimitMax);
  assert.equal(financed.transactions.find((item) => item.amount === 10_000_000)?.category, "loan_inflow");
});

test("stored analysis keeps auditable normalized operations and masks accounts", () => {
  const result = analyzeBankStatement(statement(false), "audit.txt");
  const stored = analysisForStorage(result);
  assert.equal(stored.transactions.length, result.transactions.length);
  assert.match(stored.transactions[0].account, /^••••\d{4}$/);
  assert.ok(stored.transactions[0].classificationEvidence);
});
