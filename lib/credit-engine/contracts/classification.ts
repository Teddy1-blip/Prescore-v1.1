import type { CanonicalDirection, CanonicalTransaction } from "./transactions.ts";

export type EconomicFamily =
  | "OPERATING"
  | "FINANCING"
  | "OWNER"
  | "TAX"
  | "EMPLOYEE"
  | "BANK"
  | "INVESTING"
  | "TRANSFER"
  | "REFUND"
  | "OTHER"
  | "UNKNOWN";

export type EconomicCategory =
  | "SALE_PROCEEDS"
  | "CUSTOMER_ADVANCE"
  | "ACQUIRING_SETTLEMENT"
  | "MARKETPLACE_SETTLEMENT"
  | "SUPPLIER_PAYMENT"
  | "RENT_PAYMENT"
  | "INDIVIDUAL_BUSINESS_PAYMENT"
  | "BANK_LOAN_RECEIVED"
  | "OTHER_LOAN_RECEIVED"
  | "OWNER_LOAN_RECEIVED"
  | "FACTORING_PROCEEDS"
  | "LOAN_REPAYMENT_RECEIVED"
  | "LOAN_PRINCIPAL_PAYMENT"
  | "INTEREST_PAYMENT"
  | "DEBT_SERVICE_UNSPLIT"
  | "LEASING_PAYMENT"
  | "FACTORING_FEE"
  | "LOAN_ISSUED"
  | "OWNER_CONTRIBUTION"
  | "OWNER_FUNDING_UNSPECIFIED"
  | "OWNER_WITHDRAWAL"
  | "DIVIDEND"
  | "TAX_PAYMENT"
  | "SOCIAL_CONTRIBUTION"
  | "TAX_REFUND"
  | "PAYROLL"
  | "EMPLOYEE_REIMBURSEMENT"
  | "BANK_FEE"
  | "ACQUIRING_FEE"
  | "ASSET_PURCHASE"
  | "ASSET_SALE_PROCEEDS"
  | "REFUND_RECEIVED"
  | "CUSTOMER_REFUND"
  | "INTERNAL_TRANSFER"
  | "SUBSIDY_GRANT"
  | "INSURANCE_PAYOUT"
  | "OTHER_INFLOW"
  | "OTHER_OUTFLOW"
  | "UNKNOWN_INFLOW"
  | "UNKNOWN_OUTFLOW"
  | "UNKNOWN_DIRECTION"
  | "CASH_WITHDRAWAL"
  | "INDIVIDUAL_UNCLEAR_PAYMENT";

export type ClassificationConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type EvidenceStrength = "STRONG" | "MEDIUM" | "WEAK";
export type ClassificationTag =
  | "PAYMENT_INTERMEDIARY"
  | "MARKETPLACE"
  | "ACQUIRING"
  | "FACTORING"
  | "RELATED_PARTY"
  | "REVERSAL_CANDIDATE"
  | "OWN_ACCOUNT"
  | "FINANCIAL_INSTITUTION"
  | "INDIVIDUAL_COUNTERPARTY"
  | "MIXED_PAYMENT";

export type ClassificationEvidence = {
  type: "PURPOSE" | "COUNTERPARTY" | "DIRECTION" | "ACCOUNT" | "TRANSFER_PAIR" | "REVERSAL_PAIR" | "EXTERNAL_PROFILE" | "STRUCTURAL";
  code: string;
  strength: EvidenceStrength;
  description: string;
  rawReference?: string;
};

export type ClassificationComponent = {
  category: EconomicCategory;
  amount: number | null;
  confidence: ClassificationConfidence;
};

export type ClassificationCandidate = {
  family: EconomicFamily;
  category: EconomicCategory;
  confidence: ClassificationConfidence;
  ruleCode: string;
  ruleVersion: string;
  priority: number;
  evidence: ClassificationEvidence[];
  negativeEvidence: ClassificationEvidence[];
  tags: ClassificationTag[];
  requiresReview: boolean;
  ambiguityReasons: string[];
  components?: ClassificationComponent[];
};

export type TransactionClassification = {
  version: string;
  family: EconomicFamily;
  primaryCategory: EconomicCategory;
  confidence: ClassificationConfidence;
  ruleCode: string | null;
  evidence: ClassificationEvidence[];
  alternatives: ClassificationCandidate[];
  tags: ClassificationTag[];
  requiresReview: boolean;
  ambiguityReasons: string[];
  components?: ClassificationComponent[];
  legacyCategory?: string;
  legacyDiff?: boolean;
};

export type ClassificationContext = {
  legacyCategory?: string;
  materialityThreshold?: number;
};

export type TransactionSignals = {
  purpose: string;
  counterparty: string;
  direction: CanonicalDirection;
  isFinancialInstitution: boolean;
  isIndividualCounterparty: boolean;
  isMarketplace: boolean;
  isRelatedParty: boolean;
  isReversalCandidate: boolean;
  isOwnAccount: boolean;
  hasTransferPair: boolean;
  principalAmount: number | null;
  interestAmount: number | null;
  flags: ReadonlySet<string>;
};

export type ClassificationRule = {
  code: string;
  version: string;
  priority: number;
  direction?: CanonicalDirection[];
  evaluate(tx: CanonicalTransaction, signals: TransactionSignals, context: ClassificationContext): ClassificationCandidate | null;
};

export type LegacyClassificationDiff = {
  transactionId: string;
  amount: number | null;
  purpose: string | null;
  legacyCategory: string;
  newCategory: EconomicCategory;
  confidence: ClassificationConfidence;
  ruleCode: string | null;
  evidence: ClassificationEvidence[];
};

export type ClassificationSummary = {
  version: string;
  total: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  unknown: number;
  legacyDiffCount: number;
  categoryCounts: Record<string, number>;
  reviewRequiredCount: number;
  warnings: string[];
  materialDiffs?: LegacyClassificationDiff[];
  diffsTruncated?: boolean;
};

export const ECONOMIC_CLASSIFICATION_VERSION = "PRESCORE-TX-CLASSIFIER-2.0.0-SHADOW";
