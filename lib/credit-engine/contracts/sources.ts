export type SourceStatus =
  | "NOT_REQUESTED"
  | "PROCESSING"
  | "READY"
  | "EMPTY"
  | "FAILED"
  | "STALE";

export type SourceType =
  | "BANK_STATEMENT"
  | "BFO"
  | "QUARTERLY"
  | "BKI"
  | "CHECKO"
  | "EIS"
  | "OTHER";

export type ValueKnowledge = "KNOWN" | "UNKNOWN";

export type KnownValue<T> =
  | { status: "KNOWN"; value: T }
  | { status: "UNKNOWN"; value: null };

export type SourceEnvelope = {
  sourceId: string;
  sourceType: SourceType;
  status: SourceStatus;
  companyInn: string;
  fileName?: string;
  sourceName?: string;
  periodFrom?: string;
  periodTo?: string;
  receivedAt: string;
  parserVersion?: string;
  normalizationVersion?: string;
  classifierVersion?: string;
  integrityVersion?: string;
  confidence: number | null;
  warnings: string[];
  rawReference?: string;
  contentHash?: string;
  fieldAvailability?: Record<string, ValueKnowledge>;
};

export type MonthCoverageStatus = "FULL" | "PARTIAL" | "MISSING" | "OVERLAP";

export type MonthCoverage = {
  month: string;
  status: MonthCoverageStatus;
  daysCovered: number;
  calendarDays: number;
  sourceIds: string[];
  from?: string;
  to?: string;
  warnings: string[];
};

export type StatementScreeningStatus =
  | "ACCEPTED"
  | "UNRECOGNIZED"
  | "COMPANY_MISMATCH"
  | "DUPLICATE"
  | "UNSUPPORTED"
  | "INVALID";

export type StatementScreeningResult = {
  fileName: string;
  status: StatementScreeningStatus;
  detectedInn?: string;
  expectedInn?: string;
  bankName?: string;
  periodFrom?: string;
  periodTo?: string;
  sourceId?: string;
  contentHash?: string;
  openingBalanceStatus?: ValueKnowledge;
  endingBalanceStatus?: ValueKnowledge;
  reason?: string;
};

export type DeduplicationDiagnostic = {
  originalCount: number;
  removedCount: number;
  retainedCount: number;
  sourceFiles: string[];
  rule: string;
  candidates?: Array<{
    retainedId?: string;
    duplicateId?: string;
    rule: string;
    sourceRefs: string[];
    status?: "EXACT" | "PROBABLE";
  }>;
  candidatesTruncated?: boolean;
  exactDuplicateCount?: number;
  probableDuplicateCount?: number;
};

export type DataIntegritySummary = {
  confidence: number | null;
  completeness: number | null;
  fullMonths: number;
  partialMonths: number;
  missingMonths: number;
  overlapMonths: number;
  sourceCount: number;
  knownFieldsRate: number | null;
  fieldKnownRates: {
    direction: number | null;
    counterparty: number | null;
    counterpartyInn: number | null;
    purpose: number | null;
    account: number | null;
    source: number | null;
  };
  parserConfidence: number | null;
  unknownClassificationRate: number | null;
  warnings: string[];
};

export type AnalysisSourceManifest = {
  bankStatements: SourceEnvelope[];
  bfo?: SourceEnvelope;
  quarterly?: SourceEnvelope;
  bki?: SourceEnvelope;
  external?: SourceEnvelope[];
};

export type AnalysisIntegritySummary = {
  confidence: number | null;
  completeness: number | null;
  missingSources: string[];
  failedSources: string[];
  staleSources: string[];
  calendarCoverage?: MonthCoverage[];
  dataQuality: DataIntegritySummary;
  warnings: string[];
  integrityVersion: string;
};

export type InfrastructureVersions = {
  statementParser: string;
  transactionNormalizer: string;
  transactionClassifier: string;
  economicClassifier: string;
  integrity: string;
};

export const INFRASTRUCTURE_VERSIONS: InfrastructureVersions = {
  statementParser: "PRESCORE-STATEMENT-PARSER-1",
  transactionNormalizer: "PRESCORE-TX-NORMALIZER-1",
  transactionClassifier: "PRESCORE-TX-CLASSIFIER-1",
  economicClassifier: "PRESCORE-TX-CLASSIFIER-2.0.0-SHADOW",
  integrity: "PRESCORE-INTEGRITY-1",
};
