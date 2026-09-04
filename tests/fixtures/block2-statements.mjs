const COMPANY_INN = "5032333146";
const COMPANY = "ООО СИТИМЭЙТС";
const ACCOUNT = "40702810111110000001";

function document({ number, date, amount, purpose, direction = "in", counterparty = "ООО Контрагент", counterpartyInn = "7701234567", internal = false }) {
  const payerCompany = direction === "out" || internal;
  const recipientCompany = direction === "in" || internal;
  return [
    "СекцияДокумент=Платежное поручение",
    `Номер=${number}`,
    `Дата=${date}`,
    `Сумма=${amount.toFixed(2)}`,
    `Плательщик=${payerCompany ? COMPANY : counterparty}`,
    `ПлательщикИНН=${payerCompany ? COMPANY_INN : counterpartyInn}`,
    `ПлательщикСчет=${payerCompany ? ACCOUNT : "40702810999990000001"}`,
    `ПлательщикБанк1=${payerCompany ? "ПАО БАНК УРАЛСИБ" : "АО Банк контрагента"}`,
    `Получатель=${recipientCompany ? COMPANY : counterparty}`,
    `ПолучательИНН=${recipientCompany ? COMPANY_INN : counterpartyInn}`,
    `ПолучательСчет=${recipientCompany ? ACCOUNT : "40702810999990000002"}`,
    `ПолучательБанк1=${recipientCompany ? "ПАО БАНК УРАЛСИБ" : "АО Банк контрагента"}`,
    `НазначениеПлатежа=${purpose}`,
    "КонецДокумента",
  ];
}

export function block2StatementFixture() {
  const rows = [];
  const revenues = [900000, 1000000, 1100000, 1200000, 1300000, 1400000];
  const revenueCounterparties = [
    ["ООО Альфа", "7701000001"],
    ["ООО Альфа", "7701000001"],
    ["ООО Альфа", "7701000001"],
    ["ООО Дельта", "7701000004"],
    ["ООО Гамма", "7701000003"],
    ["ООО Бета", "7701000002"],
  ];
  for (let month = 1; month <= 6; month += 1) {
    const mm = String(month).padStart(2, "0");
    const [buyer, buyerInn] = revenueCounterparties[month - 1];
    rows.push(...document({ number: `R-${month}`, date: `05.${mm}.2026`, amount: revenues[month - 1], purpose: "Оплата по договору за выполненные работы", counterparty: buyer, counterpartyInn: buyerInn }));
    rows.push(...document({ number: `T-${month}`, date: `10.${mm}.2026`, amount: 45000, direction: "out", purpose: "Уплата НДС и налогов", counterparty: "УФК", counterpartyInn: "7700000000" }));
    rows.push(...document({ number: `P-${month}`, date: `15.${mm}.2026`, amount: 200000, direction: "out", purpose: "Заработная плата сотрудникам", counterparty: "Сотрудники", counterpartyInn: "" }));
    rows.push(...document({ number: `S-${month}`, date: `20.${mm}.2026`, amount: 240000, direction: "out", purpose: "Оплата поставщику по договору", counterparty: "ООО Поставщик", counterpartyInn: "7702000001" }));
    rows.push(...document({ number: `D-${month}`, date: `25.${mm}.2026`, amount: 150000, direction: "out", purpose: "Погашение кредита и процентов", counterparty: "Банк", counterpartyInn: "7703000001" }));
    rows.push(...document({ number: `L-${month}`, date: `27.${mm}.2026`, amount: 30000, direction: "out", purpose: "Лизинговый платеж", counterparty: "АО Лизинг", counterpartyInn: "7704000001" }));
  }
  rows.push(...document({ number: "N-1", date: "07.01.2026", amount: 600000, purpose: "Зачисление кредитных средств", counterparty: "Банк", counterpartyInn: "7703000001" }));
  rows.push(...document({ number: "O-1", date: "07.02.2026", amount: 100000, purpose: "Финансовая помощь от учредителя", counterparty: "Учредитель", counterpartyInn: "503200000001" }));
  rows.push(...document({ number: "F-1", date: "07.03.2026", amount: 50000, purpose: "Возврат ошибочного платежа", counterparty: "ООО Контрагент", counterpartyInn: "7705000001" }));
  rows.push(...document({ number: "U-1", date: "07.04.2026", amount: 70000, purpose: "Перечисление денежных средств", counterparty: "ООО Контрагент", counterpartyInn: "7706000001" }));
  rows.push(...document({ number: "C-1", date: "11.06.2026", amount: 100, direction: "out", purpose: "Снятие наличных", counterparty: "Касса", counterpartyInn: "" }));
  rows.push(...document({ number: "X-1", date: "12.06.2026", amount: 29900, direction: "out", purpose: "Перевод физическому лицу", counterparty: "Физическое лицо", counterpartyInn: "500000000001" }));
  rows.push(...document({ number: "B-1", date: "13.06.2026", amount: 105000, direction: "out", purpose: "Возврат оплаты покупателю", counterparty: "ООО Покупатель", counterpartyInn: "7707000001" }));
  rows.push(...document({ number: "I-1", date: "14.06.2026", amount: 250000, direction: "out", purpose: "Перевод между собственными счетами", internal: true }));

  return [
    "1CClientBankExchange",
    "ВерсияФормата=1.03",
    "Кодировка=Windows",
    "Отправитель=Банк Клиент Онлайн",
    "ДатаНачала=01.01.2026",
    "ДатаКонца=30.06.2026",
    `РасчСчет=${ACCOUNT}`,
    "СекцияРасчСчет",
    "ДатаНачала=01.01.2026",
    "ДатаКонца=30.06.2026",
    `РасчСчет=${ACCOUNT}`,
    "НачальныйОстаток=700000.00",
    "ВсегоПоступило=7970000.00",
    "ВсегоСписано=4375000.00",
    "КонечныйОстаток=800000.00",
    "КонецРасчСчет",
    ...rows,
    "КонецФайла",
  ].join("\n");
}
