export type CanonicalDirection = "IN" | "OUT" | "UNKNOWN";

export type DirectionEvidenceRule =
  | "COMPANY_PAYER_ACCOUNT"
  | "COMPANY_RECIPIENT_ACCOUNT"
  | "COMPANY_PAYER_INN"
  | "COMPANY_RECIPIENT_INN"
  | "NOT_DETERMINED";

export type DirectionEvidence = {
  selectedRule: DirectionEvidenceRule;
  candidates: Array<{ direction: CanonicalDirection; rule: DirectionEvidenceRule }>;
  conflict: boolean;
};

export type CounterpartyIdentityConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type CanonicalDataQuality = "HIGH" | "MEDIUM" | "LOW";
export type DuplicateStatus = "EXACT" | "PROBABLE" | "NOT_DUPLICATE";
export type TransferPairConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type RelatedPartyStatus = "RELATED" | "NOT_RELATED" | "UNKNOWN";

export type CanonicalCounterparty = {
  nameRaw: string | null;
  nameNormalized: string | null;
  innRaw: string | null;
  innNormalized: string | null;
  identityConfidence: CounterpartyIdentityConfidence;
};

export type CanonicalTransactionQuality = {
  level: CanonicalDataQuality;
  warnings: string[];
  knownFields: number;
  totalFields: number;
};

export type RawTransactionValues = {
  date: string | null;
  amount: string | null;
  currency: string | null;
  payerName: string | null;
  payerInn: string | null;
  payerAccount: string | null;
  recipientName: string | null;
  recipientInn: string | null;
  recipientAccount: string | null;
  purpose: string | null;
};

export type CanonicalTransaction = {
  transactionId: string;
  bankDocumentId: string | null;
  date: string | null;
  amount: number | null;
  currency: string | null;
  direction: CanonicalDirection;
  directionEvidence: DirectionEvidence;
  companyInn: string | null;
  companyAccount: string | null;
  bank: string | null;
  counterparty: CanonicalCounterparty;
  purposeRaw: string | null;
  purposeNormalized: string | null;
  isOwnAccountTransfer: boolean;
  ownAccountTransferEvidence: string[];
  duplicateStatus: DuplicateStatus;
  duplicateOfTransactionId: string | null;
  transferPairId: string | null;
  transferPairConfidence: TransferPairConfidence;
  possibleReversalOfTransactionId: string | null;
  relatedPartyStatus: RelatedPartyStatus;
  sourceId: string;
  sourceFileId: string;
  sourceFileName: string;
  sourceRow: number | null;
  rawReference: string | null;
  parserVersion: string;
  normalizationVersion: string;
  quality: CanonicalTransactionQuality;
  rawValues: RawTransactionValues;
};

export type NormalizationSummary = {
  version: string;
  originalCount: number;
  normalizedCount: number;
  retainedCount: number;
  invalidCount: number;
  exactDuplicateCount: number;
  probableDuplicateCount: number;
  ownTransferCount: number;
  transferPairCount: number;
  possibleReversalCount: number;
  unknownDirectionCount: number;
  warnings: string[];
};

export const TRANSACTION_NORMALIZATION_VERSION = "PRESCORE-TX-NORMALIZER-1";
