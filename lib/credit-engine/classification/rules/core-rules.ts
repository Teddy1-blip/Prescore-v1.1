import type {
  ClassificationCandidate,
  ClassificationConfidence,
  ClassificationContext,
  ClassificationEvidence,
  ClassificationRule,
  ClassificationTag,
  EconomicCategory,
  EconomicFamily,
  TransactionSignals,
} from "../../contracts/classification.ts";
import type { CanonicalDirection, CanonicalTransaction } from "../../contracts/transactions.ts";

const RULE_VERSION = "1.0.0";

function evidence(type: ClassificationEvidence["type"], code: string, strength: ClassificationEvidence["strength"], description: string, tx: CanonicalTransaction): ClassificationEvidence {
  return { type, code, strength, description, ...(tx.rawReference ? { rawReference: tx.rawReference } : {}) };
}

function candidate(rule: ClassificationRule, tx: CanonicalTransaction, family: EconomicFamily, category: EconomicCategory, confidence: ClassificationConfidence, purposeCode: string, options: {
  tags?: ClassificationTag[];
  requiresReview?: boolean;
  ambiguityReasons?: string[];
  negativeEvidence?: ClassificationEvidence[];
  extraEvidence?: ClassificationEvidence[];
  components?: ClassificationCandidate["components"];
} = {}): ClassificationCandidate {
  return {
    family,
    category,
    confidence,
    ruleCode: rule.code,
    ruleVersion: rule.version,
    priority: rule.priority,
    evidence: [
      evidence("DIRECTION", `DIRECTION_${tx.direction}`, "STRONG", `Направление операции: ${tx.direction}`, tx),
      evidence("PURPOSE", purposeCode, confidence === "HIGH" ? "STRONG" : confidence === "MEDIUM" ? "MEDIUM" : "WEAK", "Экономический признак найден в назначении платежа", tx),
      ...(options.extraEvidence ?? []),
    ],
    negativeEvidence: options.negativeEvidence ?? [],
    tags: options.tags ?? [],
    requiresReview: options.requiresReview ?? (confidence === "LOW" || confidence === "UNKNOWN"),
    ambiguityReasons: options.ambiguityReasons ?? [],
    ...(options.components ? { components: options.components } : {}),
  };
}

function flagRule(config: {
  code: string;
  priority: number;
  direction: CanonicalDirection[];
  flag: string;
  family: EconomicFamily;
  category: EconomicCategory;
  confidence?: ClassificationConfidence;
  tags?: ClassificationTag[];
  requiresReview?: boolean;
  excludedBy?: string[];
}): ClassificationRule {
  const rule: ClassificationRule = {
    code: config.code,
    version: RULE_VERSION,
    priority: config.priority,
    direction: config.direction,
    evaluate(tx, signals) {
      if (!signals.flags.has(config.flag) || config.excludedBy?.some((flag) => signals.flags.has(flag))) return null;
      return candidate(rule, tx, config.family, config.category, config.confidence ?? "HIGH", `PURPOSE_${config.flag}`, {
        tags: config.tags,
        requiresReview: config.requiresReview,
      });
    },
  };
  return rule;
}

const internalTransferRule: ClassificationRule = {
  code: "TXC-TRANSFER-001",
  version: RULE_VERSION,
  priority: 1000,
  evaluate(tx, signals) {
    if (!signals.isOwnAccount && !signals.hasTransferPair) return null;
    const structural = signals.hasTransferPair
      ? evidence("TRANSFER_PAIR", "CONFIRMED_TRANSFER_PAIR", "STRONG", "Операция связана с парной операцией между собственными счетами", tx)
      : evidence("STRUCTURAL", "OWN_ACCOUNT_TRANSFER", "STRONG", "Обе стороны операции подтверждены как счета или ИНН компании", tx);
    return candidate(internalTransferRule, tx, "TRANSFER", "INTERNAL_TRANSFER", "HIGH", "STRUCTURAL_INTERNAL_TRANSFER", {
      tags: ["OWN_ACCOUNT"],
      extraEvidence: [structural],
    });
  },
};

const bankLoanRule: ClassificationRule = {
  code: "TXC-IN-BANK-LOAN-001",
  version: RULE_VERSION,
  priority: 910,
  direction: ["IN"],
  evaluate(tx, signals) {
    if (!signals.flags.has("BANK_LOAN_RECEIVED")) return null;
    const confidence = signals.isFinancialInstitution ? "HIGH" : "MEDIUM";
    return candidate(bankLoanRule, tx, "FINANCING", "BANK_LOAN_RECEIVED", confidence, "PURPOSE_BANK_LOAN_RECEIVED", {
      tags: signals.isFinancialInstitution ? ["FINANCIAL_INSTITUTION"] : [],
      requiresReview: !signals.isFinancialInstitution,
      ambiguityReasons: signals.isFinancialInstitution ? [] : ["FINANCIAL_COUNTERPARTY_NOT_CONFIRMED"],
      extraEvidence: signals.isFinancialInstitution
        ? [evidence("COUNTERPARTY", "COUNTERPARTY_FINANCIAL_INSTITUTION", "STRONG", "Контрагент идентифицирован как финансовая организация", tx)]
        : [],
    });
  },
};

const ownerUnspecifiedRule: ClassificationRule = {
  code: "TXC-IN-OWNER-UNSPECIFIED-001",
  version: RULE_VERSION,
  priority: 850,
  direction: ["IN"],
  evaluate(tx, signals) {
    if (!signals.flags.has("OWNER_FUNDING_UNSPECIFIED")) return null;
    return candidate(ownerUnspecifiedRule, tx, "OWNER", "OWNER_FUNDING_UNSPECIFIED", "MEDIUM", "PURPOSE_OWNER_FUNDING_UNSPECIFIED", {
      requiresReview: true,
      ambiguityReasons: ["LEGAL_NATURE_OF_OWNER_FUNDING_NOT_SPECIFIED"],
    });
  },
};

function ownerAlternative(code: string, category: "OWNER_CONTRIBUTION" | "OWNER_LOAN_RECEIVED", family: EconomicFamily): ClassificationRule {
  const rule: ClassificationRule = {
    code,
    version: RULE_VERSION,
    priority: 100,
    direction: ["IN"],
    evaluate(tx, signals) {
      if (!signals.flags.has("OWNER_FUNDING_UNSPECIFIED")) return null;
      return candidate(rule, tx, family, category, "LOW", "PURPOSE_OWNER_FUNDING_UNSPECIFIED", {
        requiresReview: true,
        ambiguityReasons: ["ALTERNATIVE_LEGAL_NATURE_ONLY"],
      });
    },
  };
  return rule;
}

const debtUnsplitRule: ClassificationRule = {
  code: "TXC-OUT-DEBT-UNSPLIT-001",
  version: RULE_VERSION,
  priority: 930,
  direction: ["OUT"],
  evaluate(tx, signals) {
    if (!signals.flags.has("DEBT_UNSPLIT")) return null;
    const hasBreakdown = signals.principalAmount !== null && signals.interestAmount !== null;
    return candidate(debtUnsplitRule, tx, "FINANCING", "DEBT_SERVICE_UNSPLIT", hasBreakdown ? "HIGH" : "MEDIUM", "PURPOSE_DEBT_PRINCIPAL_AND_INTEREST", {
      tags: ["MIXED_PAYMENT", ...(signals.isFinancialInstitution ? ["FINANCIAL_INSTITUTION" as const] : [])],
      requiresReview: !hasBreakdown,
      ambiguityReasons: hasBreakdown ? [] : ["PRINCIPAL_INTEREST_BREAKDOWN_NOT_PROVEN"],
      components: [
        { category: "LOAN_PRINCIPAL_PAYMENT", amount: signals.principalAmount, confidence: hasBreakdown ? "HIGH" : "UNKNOWN" },
        { category: "INTEREST_PAYMENT", amount: signals.interestAmount, confidence: hasBreakdown ? "HIGH" : "UNKNOWN" },
      ],
    });
  },
};

const operatingSaleRule: ClassificationRule = {
  code: "TXC-IN-SALE-001",
  version: RULE_VERSION,
  priority: 650,
  direction: ["IN"],
  evaluate(tx, signals) {
    if (!signals.flags.has("SALE_SPECIFIC")) return null;
    const excluded = signals.flags.has("NEGATIVE_OPERATING");
    return candidate(operatingSaleRule, tx, "OPERATING", "SALE_PROCEEDS", excluded ? "MEDIUM" : "HIGH", "PURPOSE_SALE_SPECIFIC", {
      requiresReview: excluded,
      ambiguityReasons: excluded ? ["OPERATING_WORDS_CONFLICT_WITH_SPECIFIC_NON_OPERATING_SIGNAL"] : [],
      negativeEvidence: excluded ? [evidence("PURPOSE", "NEGATIVE_NON_OPERATING_CONTEXT", "STRONG", "Назначение также содержит признак займа, налога, лизинга, факторинга, возврата или актива", tx)] : [],
    });
  },
};

const supplierRule: ClassificationRule = {
  code: "TXC-OUT-SUPPLIER-001",
  version: RULE_VERSION,
  priority: 600,
  direction: ["OUT"],
  evaluate(tx, signals) {
    if (!signals.flags.has("SUPPLIER") || signals.flags.has("NEGATIVE_OPERATING")) return null;
    return candidate(supplierRule, tx, "OPERATING", "SUPPLIER_PAYMENT", "HIGH", "PURPOSE_SUPPLIER_SPECIFIC");
  },
};

const individualBusinessRule: ClassificationRule = {
  code: "TXC-OUT-INDIVIDUAL-BUSINESS-001",
  version: RULE_VERSION,
  priority: 700,
  direction: ["OUT"],
  evaluate(tx, signals) {
    if (!signals.isIndividualCounterparty || (!signals.flags.has("INDIVIDUAL_BUSINESS") && !signals.flags.has("SUPPLIER"))) return null;
    return candidate(individualBusinessRule, tx, "OPERATING", "INDIVIDUAL_BUSINESS_PAYMENT", "HIGH", "PURPOSE_INDIVIDUAL_BUSINESS", {
      tags: ["INDIVIDUAL_COUNTERPARTY"],
      extraEvidence: [evidence("COUNTERPARTY", "COUNTERPARTY_INDIVIDUAL", "STRONG", "Контрагент идентифицирован как физическое лицо или самозанятый", tx)],
    });
  },
};

const individualUnclearRule: ClassificationRule = {
  code: "TXC-OUT-INDIVIDUAL-UNCLEAR-001",
  version: RULE_VERSION,
  priority: 650,
  direction: ["OUT"],
  evaluate(tx, signals) {
    if (!signals.isIndividualCounterparty) return null;
    return candidate(individualUnclearRule, tx, "OTHER", "INDIVIDUAL_UNCLEAR_PAYMENT", "LOW", "COUNTERPARTY_INDIVIDUAL_WITHOUT_PURPOSE", {
      tags: ["INDIVIDUAL_COUNTERPARTY"],
      requiresReview: true,
      ambiguityReasons: ["INDIVIDUAL_PAYMENT_ECONOMIC_PURPOSE_NOT_CONFIRMED"],
    });
  },
};

function fallbackRule(direction: CanonicalDirection, genericContract: boolean): ClassificationRule {
  const category: EconomicCategory = direction === "IN" ? "UNKNOWN_INFLOW" : direction === "OUT" ? "UNKNOWN_OUTFLOW" : "UNKNOWN_DIRECTION";
  const directionCode = direction === "IN" ? "IN" : direction === "OUT" ? "OUT" : "DIRECTION";
  const code = `TXC-${directionCode}-UNKNOWN-${genericContract ? "CONTRACT-" : ""}001`;
  const rule: ClassificationRule = {
    code,
    version: RULE_VERSION,
    priority: genericContract ? 50 : 1,
    direction: [direction],
    evaluate(tx, signals, context) {
      if (genericContract !== signals.flags.has("GENERIC_CONTRACT_PAYMENT")) return null;
      const material = (tx.amount ?? 0) >= (context.materialityThreshold ?? 1_000_000);
      return candidate(rule, tx, "UNKNOWN", category, direction === "UNKNOWN" ? "UNKNOWN" : "LOW", genericContract ? "PURPOSE_GENERIC_CONTRACT_ONLY" : "INSUFFICIENT_EVIDENCE", {
        requiresReview: true,
        ambiguityReasons: [genericContract ? "GENERIC_CONTRACT_WORDING_IS_NOT_ECONOMIC_EVIDENCE" : "INSUFFICIENT_ECONOMIC_EVIDENCE", ...(material ? ["MATERIAL_UNCLASSIFIED_TRANSACTION"] : [])],
      });
    },
  };
  return rule;
}

export const CORE_CLASSIFICATION_RULES: ClassificationRule[] = [
  internalTransferRule,

  flagRule({ code: "TXC-IN-TAX-REFUND-001", priority: 940, direction: ["IN"], flag: "TAX_REFUND", family: "TAX", category: "TAX_REFUND" }),
  flagRule({ code: "TXC-IN-SUBSIDY-001", priority: 935, direction: ["IN"], flag: "SUBSIDY", family: "OTHER", category: "SUBSIDY_GRANT" }),
  flagRule({ code: "TXC-IN-INSURANCE-001", priority: 930, direction: ["IN"], flag: "INSURANCE_PAYOUT", family: "OTHER", category: "INSURANCE_PAYOUT" }),
  flagRule({ code: "TXC-IN-LOAN-REPAYMENT-001", priority: 920, direction: ["IN"], flag: "LOAN_REPAYMENT_RECEIVED", family: "FINANCING", category: "LOAN_REPAYMENT_RECEIVED" }),
  flagRule({ code: "TXC-IN-OWNER-LOAN-001", priority: 915, direction: ["IN"], flag: "OWNER_LOAN", family: "FINANCING", category: "OWNER_LOAN_RECEIVED" }),
  bankLoanRule,
  flagRule({ code: "TXC-IN-OTHER-LOAN-001", priority: 900, direction: ["IN"], flag: "OTHER_LOAN_RECEIVED", family: "FINANCING", category: "OTHER_LOAN_RECEIVED", confidence: "MEDIUM", requiresReview: true }),
  flagRule({ code: "TXC-IN-FACTORING-001", priority: 890, direction: ["IN"], flag: "FACTORING", family: "FINANCING", category: "FACTORING_PROCEEDS", tags: ["FACTORING"] }),
  flagRule({ code: "TXC-IN-OWNER-CONTRIBUTION-001", priority: 860, direction: ["IN"], flag: "OWNER_CONTRIBUTION", family: "OWNER", category: "OWNER_CONTRIBUTION" }),
  ownerUnspecifiedRule,
  flagRule({ code: "TXC-IN-ASSET-SALE-001", priority: 820, direction: ["IN"], flag: "ASSET_SALE", family: "INVESTING", category: "ASSET_SALE_PROCEEDS" }),
  flagRule({ code: "TXC-IN-REFUND-001", priority: 810, direction: ["IN"], flag: "REFUND_RECEIVED", family: "REFUND", category: "REFUND_RECEIVED", excludedBy: ["TAX_REFUND"] }),
  flagRule({ code: "TXC-IN-MARKETPLACE-001", priority: 760, direction: ["IN"], flag: "MARKETPLACE_SETTLEMENT", family: "OPERATING", category: "MARKETPLACE_SETTLEMENT", tags: ["MARKETPLACE", "PAYMENT_INTERMEDIARY"] }),
  flagRule({ code: "TXC-IN-ACQUIRING-001", priority: 750, direction: ["IN"], flag: "ACQUIRING_SETTLEMENT", family: "OPERATING", category: "ACQUIRING_SETTLEMENT", tags: ["ACQUIRING", "PAYMENT_INTERMEDIARY"] }),
  flagRule({ code: "TXC-IN-ADVANCE-001", priority: 700, direction: ["IN"], flag: "CUSTOMER_ADVANCE", family: "OPERATING", category: "CUSTOMER_ADVANCE" }),
  operatingSaleRule,
  flagRule({ code: "TXC-IN-OTHER-001", priority: 100, direction: ["IN"], flag: "OTHER_KNOWN", family: "OTHER", category: "OTHER_INFLOW", confidence: "MEDIUM" }),
  ownerAlternative("TXC-IN-OWNER-ALT-CONTRIBUTION-001", "OWNER_CONTRIBUTION", "OWNER"),
  ownerAlternative("TXC-IN-OWNER-ALT-LOAN-001", "OWNER_LOAN_RECEIVED", "FINANCING"),
  fallbackRule("IN", true),
  fallbackRule("IN", false),

  debtUnsplitRule,
  flagRule({ code: "TXC-OUT-DEBT-PRINCIPAL-001", priority: 920, direction: ["OUT"], flag: "LOAN_PRINCIPAL", family: "FINANCING", category: "LOAN_PRINCIPAL_PAYMENT" }),
  flagRule({ code: "TXC-OUT-DEBT-INTEREST-001", priority: 915, direction: ["OUT"], flag: "INTEREST", family: "FINANCING", category: "INTEREST_PAYMENT" }),
  flagRule({ code: "TXC-OUT-LOAN-ISSUED-001", priority: 910, direction: ["OUT"], flag: "LOAN_ISSUED", family: "FINANCING", category: "LOAN_ISSUED", confidence: "MEDIUM", requiresReview: true }),
  flagRule({ code: "TXC-OUT-FACTORING-FEE-001", priority: 900, direction: ["OUT"], flag: "FACTORING_FEE", family: "BANK", category: "FACTORING_FEE", tags: ["FACTORING"] }),
  flagRule({ code: "TXC-OUT-TAX-001", priority: 870, direction: ["OUT"], flag: "TAX", family: "TAX", category: "TAX_PAYMENT" }),
  flagRule({ code: "TXC-OUT-SOCIAL-001", priority: 875, direction: ["OUT"], flag: "SOCIAL_CONTRIBUTION", family: "TAX", category: "SOCIAL_CONTRIBUTION" }),
  flagRule({ code: "TXC-OUT-LEASING-001", priority: 860, direction: ["OUT"], flag: "LEASING", family: "FINANCING", category: "LEASING_PAYMENT" }),
  flagRule({ code: "TXC-OUT-REFUND-001", priority: 830, direction: ["OUT"], flag: "CUSTOMER_REFUND", family: "REFUND", category: "CUSTOMER_REFUND" }),
  flagRule({ code: "TXC-OUT-DIVIDEND-001", priority: 820, direction: ["OUT"], flag: "DIVIDEND", family: "OWNER", category: "DIVIDEND" }),
  flagRule({ code: "TXC-OUT-OWNER-WITHDRAWAL-001", priority: 815, direction: ["OUT"], flag: "OWNER_WITHDRAWAL", family: "OWNER", category: "OWNER_WITHDRAWAL" }),
  flagRule({ code: "TXC-OUT-PAYROLL-001", priority: 800, direction: ["OUT"], flag: "PAYROLL", family: "EMPLOYEE", category: "PAYROLL" }),
  flagRule({ code: "TXC-OUT-EMPLOYEE-REIMBURSEMENT-001", priority: 790, direction: ["OUT"], flag: "EMPLOYEE_REIMBURSEMENT", family: "EMPLOYEE", category: "EMPLOYEE_REIMBURSEMENT" }),
  flagRule({ code: "TXC-OUT-ACQUIRING-FEE-001", priority: 780, direction: ["OUT"], flag: "ACQUIRING_FEE", family: "BANK", category: "ACQUIRING_FEE", tags: ["ACQUIRING"] }),
  flagRule({ code: "TXC-OUT-BANK-FEE-001", priority: 770, direction: ["OUT"], flag: "BANK_FEE", family: "BANK", category: "BANK_FEE" }),
  flagRule({ code: "TXC-OUT-ASSET-PURCHASE-001", priority: 750, direction: ["OUT"], flag: "ASSET_PURCHASE", family: "INVESTING", category: "ASSET_PURCHASE", excludedBy: ["LEASING"] }),
  flagRule({ code: "TXC-OUT-CASH-001", priority: 740, direction: ["OUT"], flag: "CASH", family: "OTHER", category: "CASH_WITHDRAWAL" }),
  flagRule({ code: "TXC-OUT-RENT-001", priority: 720, direction: ["OUT"], flag: "RENT", family: "OPERATING", category: "RENT_PAYMENT" }),
  individualBusinessRule,
  individualUnclearRule,
  supplierRule,
  flagRule({ code: "TXC-OUT-OTHER-001", priority: 100, direction: ["OUT"], flag: "OTHER_KNOWN", family: "OTHER", category: "OTHER_OUTFLOW", confidence: "MEDIUM" }),
  fallbackRule("OUT", true),
  fallbackRule("OUT", false),
  fallbackRule("UNKNOWN", true),
  fallbackRule("UNKNOWN", false),
];

export function ruleAppliesToDirection(rule: ClassificationRule, direction: CanonicalDirection) {
  return !rule.direction || rule.direction.includes(direction);
}

export function evaluateRule(rule: ClassificationRule, tx: CanonicalTransaction, signals: TransactionSignals, context: ClassificationContext) {
  return ruleAppliesToDirection(rule, tx.direction) ? rule.evaluate(tx, signals, context) : null;
}
