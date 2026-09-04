import { TRANSACTION_NORMALIZATION_VERSION, type CanonicalTransaction } from "../contracts/transactions.ts";
import { normalizeCounterparty, normalizeInnValue } from "./counterparty-normalizer.ts";
import { determineDirection } from "./direction.ts";
import { normalizeAccountValue, normalizeAmount, normalizeCurrency, normalizePurpose, normalizeTransactionDate } from "./value-normalizers.ts";

export type RawBankTransactionInput = {
  bankDocumentId?: string | null;
  date?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  payerName?: string | null;
  payerInn?: string | null;
  payerAccount?: string | null;
  recipientName?: string | null;
  recipientInn?: string | null;
  recipientAccount?: string | null;
  purpose?: string | null;
  statementAccount?: string | null;
  companyInn?: string | null;
  companyAccounts: string[];
  bank?: string | null;
  sourceId: string;
  sourceFileId: string;
  sourceFileName: string;
  sourceRow?: number | null;
  rawReference?: string | null;
  parserVersion: string;
  ordinal: number;
};

function stableHash(value: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
  }
  return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}

export function normalizeTransaction(input: RawBankTransactionInput): CanonicalTransaction {
  const warnings: string[] = [];
  const date = normalizeTransactionDate(input.date);
  const amount = normalizeAmount(input.amount);
  const currency = normalizeCurrency(input.currency);
  const payerAccount = normalizeAccountValue(input.payerAccount);
  const recipientAccount = normalizeAccountValue(input.recipientAccount);
  const statementAccount = normalizeAccountValue(input.statementAccount);
  const companyInn = normalizeInnValue(input.companyInn);
  const payerInn = normalizeInnValue(input.payerInn);
  const recipientInn = normalizeInnValue(input.recipientInn);
  const purpose = normalizePurpose(input.purpose);
  for (const result of [date, amount, currency, purpose]) if (result.warning) warnings.push(result.warning);
  const companyAccounts = new Set(input.companyAccounts.map((item) => normalizeAccountValue(item).value).filter((item): item is string => Boolean(item)));
  if (statementAccount.value) companyAccounts.add(statementAccount.value);
  const direction = determineDirection({
    companyInn: companyInn.value,
    companyAccounts,
    payerInn: payerInn.value,
    recipientInn: recipientInn.value,
    payerAccount: payerAccount.value,
    recipientAccount: recipientAccount.value,
  });
  warnings.push(...direction.warnings);
  const counterpartyName = direction.direction === "OUT" ? input.recipientName : input.payerName;
  const counterpartyInn = direction.direction === "OUT" ? input.recipientInn : input.payerInn;
  const counterparty = normalizeCounterparty(counterpartyName, counterpartyInn);
  warnings.push(...counterparty.warnings);
  const ownTransferEvidence: string[] = [];
  if (companyInn.value && payerInn.value === companyInn.value && recipientInn.value === companyInn.value) ownTransferEvidence.push("BOTH_SIDES_COMPANY_INN");
  if (payerAccount.value && recipientAccount.value && companyAccounts.has(payerAccount.value) && companyAccounts.has(recipientAccount.value)) ownTransferEvidence.push("BOTH_SIDES_COMPANY_ACCOUNTS");
  const companyAccount = direction.direction === "OUT"
    ? (payerAccount.value && companyAccounts.has(payerAccount.value) ? payerAccount.value : statementAccount.value || payerAccount.value)
    : direction.direction === "IN"
      ? (recipientAccount.value && companyAccounts.has(recipientAccount.value) ? recipientAccount.value : statementAccount.value || recipientAccount.value)
      : statementAccount.value || (payerAccount.value && companyAccounts.has(payerAccount.value) ? payerAccount.value : recipientAccount.value);
  const known = [date.value, amount.value, direction.direction !== "UNKNOWN" ? direction.direction : null, companyAccount, counterparty.counterparty.nameNormalized || counterparty.counterparty.innNormalized, purpose.value].filter((value) => value !== null && value !== undefined && value !== "").length;
  const criticalInvalid = !date.value || amount.value === null || amount.value <= 0;
  const qualityLevel = criticalInvalid || direction.evidence.conflict ? "LOW" : warnings.length || known < 6 ? "MEDIUM" : "HIGH";
  const transactionId = `tx_${stableHash([input.sourceId, input.ordinal, input.bankDocumentId || "", input.date || "", String(input.amount ?? "")].join("|"))}`;
  return {
    transactionId,
    bankDocumentId: input.bankDocumentId?.trim() || null,
    date: date.value,
    amount: amount.value,
    currency: currency.value,
    direction: direction.direction,
    directionEvidence: direction.evidence,
    companyInn: companyInn.value,
    companyAccount,
    bank: input.bank?.trim() || null,
    counterparty: counterparty.counterparty,
    purposeRaw: input.purpose?.trim() || null,
    purposeNormalized: purpose.value,
    isOwnAccountTransfer: ownTransferEvidence.length > 0,
    ownAccountTransferEvidence: ownTransferEvidence,
    duplicateStatus: "NOT_DUPLICATE",
    duplicateOfTransactionId: null,
    transferPairId: null,
    transferPairConfidence: "NONE",
    possibleReversalOfTransactionId: null,
    relatedPartyStatus: "UNKNOWN",
    sourceId: input.sourceId,
    sourceFileId: input.sourceFileId,
    sourceFileName: input.sourceFileName,
    sourceRow: input.sourceRow ?? null,
    rawReference: input.rawReference ?? null,
    parserVersion: input.parserVersion,
    normalizationVersion: TRANSACTION_NORMALIZATION_VERSION,
    quality: { level: qualityLevel, warnings: [...new Set(warnings)], knownFields: known, totalFields: 6 },
    rawValues: {
      date: input.date?.toString().trim() || null,
      amount: input.amount === null || input.amount === undefined ? null : String(input.amount),
      currency: input.currency?.trim() || null,
      payerName: input.payerName?.trim() || null,
      payerInn: input.payerInn?.trim() || null,
      payerAccount: input.payerAccount?.trim() || null,
      recipientName: input.recipientName?.trim() || null,
      recipientInn: input.recipientInn?.trim() || null,
      recipientAccount: input.recipientAccount?.trim() || null,
      purpose: input.purpose?.trim() || null,
    },
  };
}
