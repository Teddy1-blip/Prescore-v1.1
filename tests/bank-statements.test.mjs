import assert from "node:assert/strict";
import test from "node:test";

import { analyzeBankStatements, inspectBankStatement, screenBankStatements } from "../lib/prescore.ts";

function statement({ account, inn, company, bank, date = "01.07.2026", amount = "100000.00", incoming = true }) {
  const payerAccount = incoming ? "40702810999990000001" : account;
  const recipientAccount = incoming ? account : "40702810999990000002";
  const payerInn = incoming ? "7701234567" : inn;
  const recipientInn = incoming ? inn : "7707654321";
  const payerName = incoming ? "ООО Покупатель" : company;
  const recipientName = incoming ? company : "ООО Поставщик";
  const payerBank = incoming ? "АО Банк покупателя" : bank;
  const recipientBank = incoming ? bank : "АО Банк поставщика";
  return [
    "1CClientBankExchange", "ВерсияФормата=1.03", "Кодировка=Windows", "Отправитель=Банк Клиент Онлайн",
    "ДатаНачала=01.07.2026", "ДатаКонца=31.07.2026", `РасчСчет=${account}`,
    "СекцияРасчСчет", "ДатаНачала=01.07.2026", "ДатаКонца=31.07.2026", `РасчСчет=${account}`,
    "НачальныйОстаток=50000.00", `ВсегоПоступило=${incoming ? amount : "0.00"}`, `ВсегоСписано=${incoming ? "0.00" : amount}`, "КонечныйОстаток=150000.00", "КонецРасчСчет",
    "СекцияДокумент=Платежное поручение", "Номер=1", `Дата=${date}`, `Сумма=${amount}`,
    `Плательщик=${payerName}`, `ПлательщикИНН=${payerInn}`, `ПлательщикСчет=${payerAccount}`, `ПлательщикБанк1=${payerBank}`,
    `Получатель=${recipientName}`, `ПолучательИНН=${recipientInn}`, `ПолучательСчет=${recipientAccount}`, `ПолучательБанк1=${recipientBank}`,
    "НазначениеПлатежа=Оплата по договору за выполненные работы", "КонецДокумента", "КонецФайла",
  ].join("\n");
}

test("recognizes the servicing bank from the company side of a generic 1C export", () => {
  const text = statement({ account: "40702810111110000001", inn: "5032333146", company: "ООО СИТИМЭЙТС", bank: "ПАО БАНК УРАЛСИБ" });
  const inspection = inspectBankStatement(text, "statement.txt");
  assert.equal(inspection.companyInn, "5032333146");
  assert.equal(inspection.bankName, "Уралсиб");
});

test("accepts a declared inactive account when active postings prove the same owner", () => {
  const active = statement({ account: "40702810111110000001", inn: "5032333146", company: "ООО СИТИМЭЙТС", bank: "ПАО БАНК УРАЛСИБ" });
  const inactive = [
    "СекцияРасчСчет",
    "ДатаНачала=01.07.2026",
    "ДатаКонца=31.07.2026",
    "РасчСчет=40702810999990000003",
    "НачальныйОстаток=0.00",
    "ВсегоПоступило=0.00",
    "ВсегоСписано=0.00",
    "КонечныйОстаток=0.00",
    "КонецРасчСчет",
  ].join("\n");
  const text = active.replace("КонецФайла", inactive + "\nКонецФайла");
  const inspection = inspectBankStatement(text, "statement.txt");
  assert.equal(inspection.companyInn, "5032333146");
  assert.deepEqual(inspection.accounts.sort(), ["40702810111110000001", "40702810999990000003"].sort());
});

test("accepts case-only variants of known 1C field names", () => {
  const text = statement({ account: "40702810111110000001", inn: "5032333146", company: "ООО СИТИМЭЙТС", bank: "ПАО БАНК УРАЛСИБ" })
    .replace("ПолучательИНН=5032333146", "получательинн=5032333146")
    .replace("ПолучательСчет=40702810111110000001", "получательсчет=40702810111110000001");
  const inspection = inspectBankStatement(text, "statement.txt");
  assert.equal(inspection.companyInn, "5032333146");
});

test("still rejects an active account when owner evidence is missing", () => {
  const text = statement({ account: "40702810111110000001", inn: "5032333146", company: "ООО СИТИМЭЙТС", bank: "ПАО БАНК УРАЛСИБ" })
    .replace("ПолучательИНН=5032333146", "ПолучательИНН=");
  assert.throws(() => inspectBankStatement(text, "statement.txt"), /активных счетов/);
});

test("combines several statements of one company", () => {
  const first = statement({ account: "40702810111110000001", inn: "5032333146", company: "ООО СИТИМЭЙТС", bank: "ПАО БАНК УРАЛСИБ", date: "01.07.2026" });
  const second = statement({ account: "40702810222220000002", inn: "5032333146", company: "ООО СИТИМЭЙТС", bank: "АО ТИНЬКОФФ БАНК", date: "02.07.2026", amount: "200000.00" });
  const analysis = analyzeBankStatements([{ text: first, fileName: "one.txt" }, { text: second, fileName: "two.txt" }]);
  assert.equal(analysis.companyInn, "5032333146");
  assert.equal(analysis.metrics.statements, 2);
  assert.equal(analysis.metrics.accounts, 2);
  assert.equal(analysis.metrics.transactions, 2);
  assert.deepEqual(analysis.bankNames.sort(), ["Т-Банк", "Уралсиб"].sort());
});

test("rejects another INN and exposes an explicit per-file screening result", () => {
  const own = statement({ account: "40702810111110000001", inn: "5032333146", company: "ООО СИТИМЭЙТС", bank: "ПАО БАНК УРАЛСИБ" });
  const foreign = statement({ account: "40702810222220000002", inn: "7701234567", company: "ООО ДРУГОЙ КЛИЕНТ", bank: "АО ТИНЬКОФФ БАНК" });
  const screened = screenBankStatements([
    { text: own, fileName: "own.txt" },
    { text: foreign, fileName: "foreign.txt" },
    { text: "обычный текст", fileName: "unknown.txt" },
  ]);
  assert.equal(screened.companyInn, "5032333146");
  assert.deepEqual(screened.accepted.map((item) => item.fileName), ["own.txt"]);
  assert.deepEqual(screened.unrecognizedFiles, ["unknown.txt"]);
  assert.equal(screened.screeningResults.find((item) => item.fileName === "foreign.txt")?.status, "COMPANY_MISMATCH");
});
