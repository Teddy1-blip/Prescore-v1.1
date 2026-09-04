import type { CanonicalTransaction } from "../contracts/transactions.ts";
import type { NormalizedTransaction, TransactionDirection } from "../../prescore.ts";
import { INFRASTRUCTURE_VERSIONS } from "../contracts/sources.ts";

export type LegacyTransactionFacts = Omit<NormalizedTransaction, "category" | "categoryConfidence" | "classificationEvidence">;

function legacyDirection(direction: CanonicalTransaction["direction"]): TransactionDirection {
  if (direction === "IN") return "in";
  if (direction === "OUT") return "out";
  return "unknown";
}

export function canonicalToLegacyFacts(item: CanonicalTransaction): LegacyTransactionFacts {
  return {
    id: item.bankDocumentId || item.transactionId,
    canonicalTransactionId: item.transactionId,
    bankDocumentId: item.bankDocumentId || undefined,
    date: item.date || "",
    amount: item.amount ?? 0,
    currency: item.currency || undefined,
    direction: legacyDirection(item.direction),
    directionEvidence: item.directionEvidence,
    counterparty: item.counterparty.nameRaw || item.counterparty.nameNormalized || "Контрагент не указан",
    counterpartyInn: item.counterparty.innNormalized || "",
    purpose: item.purposeRaw || item.purposeNormalized || "",
    account: item.companyAccount || "",
    sourceId: item.sourceId,
    sourceFileId: item.sourceFileId,
    sourceFileName: item.sourceFileName,
    bank: item.bank || undefined,
    sourceRow: item.sourceRow ?? undefined,
    rawReference: item.rawReference || undefined,
    parserVersion: item.parserVersion,
    classifierVersion: INFRASTRUCTURE_VERSIONS.transactionClassifier,
    normalizationVersion: item.normalizationVersion,
    quality: item.quality,
    duplicateStatus: item.duplicateStatus,
    duplicateOfTransactionId: item.duplicateOfTransactionId || undefined,
    transferPairId: item.transferPairId || undefined,
    transferPairConfidence: item.transferPairConfidence,
    possibleReversalOfTransactionId: item.possibleReversalOfTransactionId || undefined,
    relatedPartyStatus: item.relatedPartyStatus,
    isOwnAccountTransfer: item.isOwnAccountTransfer,
  };
}
