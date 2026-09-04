import type { RawBankTransactionInput } from "./transaction-normalizer.ts";

type OneCRecord = Record<string, string> & { __account?: string };

function field(record: OneCRecord, ...names: string[]) {
  for (const name of names) if (record[name]) return record[name].trim();
  return "";
}

export type OneCAdapterContext = Omit<RawBankTransactionInput,
  "bankDocumentId" | "date" | "amount" | "currency" | "payerName" | "payerInn" | "payerAccount" |
  "recipientName" | "recipientInn" | "recipientAccount" | "purpose" | "statementAccount">;

export function adaptOneCDocument(document: OneCRecord, context: OneCAdapterContext): RawBankTransactionInput {
  return {
    ...context,
    bankDocumentId: field(document, "Номер") || null,
    date: field(document, "Дата") || null,
    amount: field(document, "Сумма") || null,
    currency: field(document, "Валюта", "КодВалюты") || null,
    payerName: field(document, "Плательщик", "Плательщик1", "НаименованиеПлательщика", "ПлательщикНаименование") || null,
    payerInn: field(document, "ПлательщикИНН", "ИННПлательщика") || null,
    payerAccount: field(document, "ПлательщикСчет", "СчетПлательщика") || null,
    recipientName: field(document, "Получатель", "Получатель1", "НаименованиеПолучателя", "ПолучательНаименование") || null,
    recipientInn: field(document, "ПолучательИНН", "ИННПолучателя") || null,
    recipientAccount: field(document, "ПолучательСчет", "СчетПолучателя") || null,
    purpose: field(document, "НазначениеПлатежа", "Назначение") || null,
    statementAccount: document.__account || context.companyAccounts[0] || null,
  };
}
