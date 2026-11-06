import type { RawBankTransactionInput } from "./transaction-normalizer.ts";
import { determineDirection } from "./direction.ts";
import { normalizeAccountValue } from "./value-normalizers.ts";
import { normalizeInnValue } from "./counterparty-normalizer.ts";

type OneCRecord = Record<string, string> & { __account?: string };

function field(record: OneCRecord, ...names: string[]) {
  for (const name of names) if (record[name]) return record[name].trim();
  return "";
}

export type OneCAdapterContext = Omit<RawBankTransactionInput,
  "bankDocumentId" | "date" | "documentDate" | "amount" | "currency" | "payerName" | "payerInn" | "payerAccount" |
  "recipientName" | "recipientInn" | "recipientAccount" | "purpose" | "statementAccount">;

export function adaptOneCDocument(document: OneCRecord, context: OneCAdapterContext): RawBankTransactionInput {
  const statementAccount = document.__account || context.companyAccounts[0] || null;
  const companyAccounts = new Set([...context.companyAccounts, statementAccount]
    .map(value => normalizeAccountValue(value).value).filter((value): value is string => Boolean(value)));
  // Use the same side-selection rules as normalization. The counterparty's
  // posting date must not move this account's cash to a different day/month.
  const creditDate = field(document, "ДатаПоступило");
  const debitDate = field(document, "ДатаСписано");
  const postingSide = creditDate && !debitDate ? "IN"
    : debitDate && !creditDate ? "OUT" : undefined;
  const { direction } = determineDirection({
    postingSide,
    companyInn: normalizeInnValue(context.companyInn).value,
    companyAccounts,
    payerInn: normalizeInnValue(field(document, "ПлательщикИНН", "ИННПлательщика")).value,
    recipientInn: normalizeInnValue(field(document, "ПолучательИНН", "ИННПолучателя")).value,
    payerAccount: normalizeAccountValue(field(document, "ПлательщикСчет", "СчетПлательщика")).value,
    recipientAccount: normalizeAccountValue(field(document, "ПолучательСчет", "СчетПолучателя")).value,
  });
  const documentDate = field(document, "Дата") || null;
  const postingDate = direction === "IN" ? field(document, "ДатаПоступило")
    : direction === "OUT" ? field(document, "ДатаСписано") : "";
  return {
    ...context,
    postingSide,
    bankDocumentId: field(document, "Номер") || null,
    date: postingDate || documentDate,
    ...(postingDate ? { documentDate } : {}),
    amount: field(document, "Сумма") || null,
    currency: field(document, "Валюта", "КодВалюты") || null,
    payerName: field(document, "Плательщик", "Плательщик1", "НаименованиеПлательщика", "ПлательщикНаименование") || null,
    payerInn: field(document, "ПлательщикИНН", "ИННПлательщика") || null,
    payerAccount: field(document, "ПлательщикСчет", "СчетПлательщика") || null,
    recipientName: field(document, "Получатель", "Получатель1", "НаименованиеПолучателя", "ПолучательНаименование") || null,
    recipientInn: field(document, "ПолучательИНН", "ИННПолучателя") || null,
    recipientAccount: field(document, "ПолучательСчет", "СчетПолучателя") || null,
    purpose: field(document, "НазначениеПлатежа", "Назначение") || null,
    statementAccount,
  };
}
