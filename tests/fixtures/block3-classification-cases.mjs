const IN = "IN";
const OUT = "OUT";

export const classificationCases = [
  { case_id: "OP-IN-001", direction: IN, purpose: "Оплата за поставленный товар", expected_category: "SALE_PROCEEDS", expected_confidence: "HIGH", evidence: "PURPOSE_SALE_SPECIFIC", forbidden: ["OTHER_LOAN_RECEIVED"] },
  { case_id: "OP-IN-002", direction: IN, purpose: "Оплата за оказанные услуги", expected_category: "SALE_PROCEEDS", expected_confidence: "HIGH", evidence: "PURPOSE_SALE_SPECIFIC" },
  { case_id: "OP-IN-003", direction: IN, purpose: "Оплата за выполненные работы", expected_category: "SALE_PROCEEDS", expected_confidence: "HIGH", evidence: "PURPOSE_SALE_SPECIFIC" },
  { case_id: "OP-IN-004", direction: IN, purpose: "Предоплата за товар по счету", expected_category: "CUSTOMER_ADVANCE", expected_confidence: "HIGH", evidence: "PURPOSE_CUSTOMER_ADVANCE" },
  { case_id: "OP-IN-005", direction: IN, purpose: "Оплата по договору № 15", expected_category: "UNKNOWN_INFLOW", expected_confidence: "LOW", evidence: "PURPOSE_GENERIC_CONTRACT_ONLY", review_required: true, forbidden: ["SALE_PROCEEDS"] },
  { case_id: "OP-IN-006", direction: IN, purpose: "Зачисление по торговому эквайрингу", expected_category: "ACQUIRING_SETTLEMENT", expected_confidence: "HIGH", evidence: "PURPOSE_ACQUIRING_SETTLEMENT", tags: ["ACQUIRING", "PAYMENT_INTERMEDIARY"] },
  { case_id: "OP-IN-007", direction: IN, purpose: "Выплата Ozon за продажи по реестру", counterparty: "ООО Интернет Решения", expected_category: "MARKETPLACE_SETTLEMENT", expected_confidence: "HIGH", evidence: "PURPOSE_MARKETPLACE_SETTLEMENT", tags: ["MARKETPLACE", "PAYMENT_INTERMEDIARY"] },

  { case_id: "FIN-IN-008", direction: IN, purpose: "Предоставление кредита по договору", counterparty: "ПАО Банк", expected_category: "BANK_LOAN_RECEIVED", expected_confidence: "HIGH", evidence: "PURPOSE_BANK_LOAN_RECEIVED", tags: ["FINANCIAL_INSTITUTION"] },
  { case_id: "FIN-IN-009", direction: IN, purpose: "Транш кредитной линии", counterparty: "АО Банк", expected_category: "BANK_LOAN_RECEIVED", expected_confidence: "HIGH", evidence: "PURPOSE_BANK_LOAN_RECEIVED" },
  { case_id: "FIN-IN-010", direction: IN, purpose: "Получен займ от ООО Альфа", expected_category: "OTHER_LOAN_RECEIVED", expected_confidence: "MEDIUM", evidence: "PURPOSE_OTHER_LOAN_RECEIVED", review_required: true },
  { case_id: "FIN-IN-011", direction: IN, purpose: "Займ от учредителя по договору", counterparty: "Учредитель", expected_category: "OWNER_LOAN_RECEIVED", expected_confidence: "HIGH", evidence: "PURPOSE_OWNER_LOAN", forbidden: ["OWNER_CONTRIBUTION"] },
  { case_id: "OWN-IN-012", direction: IN, purpose: "Вклад учредителя в имущество общества", counterparty: "Учредитель", expected_category: "OWNER_CONTRIBUTION", expected_confidence: "HIGH", evidence: "PURPOSE_OWNER_CONTRIBUTION", forbidden: ["OWNER_LOAN_RECEIVED"] },
  { case_id: "OWN-IN-013", direction: IN, purpose: "Финансовая помощь учредителя", counterparty: "Учредитель", expected_category: "OWNER_FUNDING_UNSPECIFIED", expected_confidence: "MEDIUM", evidence: "PURPOSE_OWNER_FUNDING_UNSPECIFIED", review_required: true, alternatives: ["OWNER_CONTRIBUTION", "OWNER_LOAN_RECEIVED"] },
  { case_id: "FIN-IN-014", direction: IN, purpose: "Финансирование по договору факторинга под уступку требования", counterparty: "АО Фактор", expected_category: "FACTORING_PROCEEDS", expected_confidence: "HIGH", evidence: "PURPOSE_FACTORING", tags: ["FACTORING"] },
  { case_id: "FIN-IN-015", direction: IN, purpose: "Возврат ранее выданного займа", expected_category: "LOAN_REPAYMENT_RECEIVED", expected_confidence: "HIGH", evidence: "PURPOSE_LOAN_REPAYMENT_RECEIVED", forbidden: ["BANK_LOAN_RECEIVED", "SALE_PROCEEDS"] },

  { case_id: "FIN-OUT-016", direction: OUT, purpose: "Погашение основного долга по кредиту", counterparty: "ПАО Банк", expected_category: "LOAN_PRINCIPAL_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_LOAN_PRINCIPAL" },
  { case_id: "FIN-OUT-017", direction: OUT, purpose: "Уплата процентов по кредиту", counterparty: "ПАО Банк", expected_category: "INTEREST_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_INTEREST" },
  { case_id: "FIN-OUT-018", direction: OUT, purpose: "Погашение кредита и процентов", counterparty: "ПАО Банк", expected_category: "DEBT_SERVICE_UNSPLIT", expected_confidence: "MEDIUM", evidence: "PURPOSE_DEBT_PRINCIPAL_AND_INTEREST", review_required: true, tags: ["MIXED_PAYMENT"] },
  { case_id: "FIN-OUT-019", direction: OUT, purpose: "Лизинговый платеж за оборудование", counterparty: "АО Лизинг", expected_category: "LEASING_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_LEASING" },
  { case_id: "FIN-OUT-020", direction: OUT, purpose: "Комиссия фактору по договору факторинга", counterparty: "АО Фактор", expected_category: "FACTORING_FEE", expected_confidence: "HIGH", evidence: "PURPOSE_FACTORING_FEE" },
  { case_id: "FIN-OUT-021", direction: OUT, purpose: "Выдача займа ООО Бета", expected_category: "LOAN_ISSUED", expected_confidence: "MEDIUM", evidence: "PURPOSE_LOAN_ISSUED", review_required: true },

  { case_id: "TAX-OUT-022", direction: OUT, purpose: "Уплата ЕНП", counterparty: "УФК", expected_category: "TAX_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_TAX" },
  { case_id: "TAX-OUT-023", direction: OUT, purpose: "НДС за 2 квартал", counterparty: "УФК", expected_category: "TAX_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_TAX" },
  { case_id: "TAX-OUT-024", direction: OUT, purpose: "Страховые взносы за работников", counterparty: "СФР", expected_category: "SOCIAL_CONTRIBUTION", expected_confidence: "HIGH", evidence: "PURPOSE_SOCIAL_CONTRIBUTION" },
  { case_id: "TAX-IN-025", direction: IN, purpose: "Возврат излишне уплаченного налога", counterparty: "УФК", expected_category: "TAX_REFUND", expected_confidence: "HIGH", evidence: "PURPOSE_TAX_REFUND", forbidden: ["SALE_PROCEEDS"] },
  { case_id: "OTHER-IN-026", direction: IN, purpose: "Субсидия из федерального бюджета", counterparty: "УФК", expected_category: "SUBSIDY_GRANT", expected_confidence: "HIGH", evidence: "PURPOSE_SUBSIDY", forbidden: ["TAX_REFUND"] },

  { case_id: "EMP-OUT-027", direction: OUT, purpose: "Заработная плата за август", individual: true, expected_category: "PAYROLL", expected_confidence: "HIGH", evidence: "PURPOSE_PAYROLL" },
  { case_id: "EMP-OUT-028", direction: OUT, purpose: "Аванс сотрудникам за первую половину месяца", individual: true, expected_category: "PAYROLL", expected_confidence: "HIGH", evidence: "PURPOSE_PAYROLL" },
  { case_id: "IND-OUT-029", direction: OUT, purpose: "Оплата услуг физическому лицу по договору ГПХ", individual: true, expected_category: "INDIVIDUAL_BUSINESS_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_INDIVIDUAL_BUSINESS", tags: ["INDIVIDUAL_COUNTERPARTY"] },
  { case_id: "EMP-OUT-030", direction: OUT, purpose: "Перечисление под отчет сотруднику", individual: true, expected_category: "EMPLOYEE_REIMBURSEMENT", expected_confidence: "HIGH", evidence: "PURPOSE_EMPLOYEE_REIMBURSEMENT" },
  { case_id: "IND-OUT-031", direction: OUT, purpose: "Перевод денежных средств", individual: true, expected_category: "INDIVIDUAL_UNCLEAR_PAYMENT", expected_confidence: "LOW", evidence: "COUNTERPARTY_INDIVIDUAL_WITHOUT_PURPOSE", review_required: true },
  { case_id: "CASH-OUT-032", direction: OUT, purpose: "Снятие наличных по чековой книжке", expected_category: "CASH_WITHDRAWAL", expected_confidence: "HIGH", evidence: "PURPOSE_CASH" },

  { case_id: "OP-OUT-033", direction: OUT, purpose: "Оплата поставщику за товар", expected_category: "SUPPLIER_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_SUPPLIER_SPECIFIC" },
  { case_id: "OP-OUT-034", direction: OUT, purpose: "Оплата за услуги связи", expected_category: "SUPPLIER_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_SUPPLIER_SPECIFIC" },
  { case_id: "OP-OUT-035", direction: OUT, purpose: "Оплата подрядчику за выполненные работы", expected_category: "SUPPLIER_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_SUPPLIER_SPECIFIC" },
  { case_id: "OP-OUT-036", direction: OUT, purpose: "Арендная плата за офис", expected_category: "RENT_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_RENT" },

  { case_id: "REF-IN-037", direction: IN, purpose: "Возврат от поставщика излишне перечисленных средств", expected_category: "REFUND_RECEIVED", expected_confidence: "HIGH", evidence: "PURPOSE_REFUND_RECEIVED" },
  { case_id: "REF-OUT-038", direction: OUT, purpose: "Возврат оплаты покупателю", expected_category: "CUSTOMER_REFUND", expected_confidence: "HIGH", evidence: "PURPOSE_CUSTOMER_REFUND" },
  { case_id: "REF-IN-039", direction: IN, purpose: "Перечисление денежных средств", reversal: true, expected_category: "UNKNOWN_INFLOW", expected_confidence: "LOW", evidence: "INSUFFICIENT_EVIDENCE", review_required: true, tags: ["REVERSAL_CANDIDATE"], forbidden: ["REFUND_RECEIVED"] },

  { case_id: "OWN-OUT-040", direction: OUT, purpose: "Выплата дивидендов участнику", individual: true, expected_category: "DIVIDEND", expected_confidence: "HIGH", evidence: "PURPOSE_DIVIDEND" },
  { case_id: "OWN-OUT-041", direction: OUT, purpose: "Изъятие средств собственником", individual: true, expected_category: "OWNER_WITHDRAWAL", expected_confidence: "HIGH", evidence: "PURPOSE_OWNER_WITHDRAWAL" },

  { case_id: "INV-OUT-042", direction: OUT, purpose: "Приобретение производственного оборудования", expected_category: "ASSET_PURCHASE", expected_confidence: "HIGH", evidence: "PURPOSE_ASSET_PURCHASE" },
  { case_id: "INV-OUT-043", direction: OUT, purpose: "Оплата за автомобиль", expected_category: "ASSET_PURCHASE", expected_confidence: "HIGH", evidence: "PURPOSE_ASSET_PURCHASE" },
  { case_id: "INV-IN-044", direction: IN, purpose: "Поступление от продажи оборудования", expected_category: "ASSET_SALE_PROCEEDS", expected_confidence: "HIGH", evidence: "PURPOSE_ASSET_SALE", forbidden: ["SALE_PROCEEDS"] },

  { case_id: "TR-045", direction: OUT, purpose: "Перевод между собственными счетами", own: true, expected_category: "INTERNAL_TRANSFER", expected_confidence: "HIGH", evidence: "STRUCTURAL_INTERNAL_TRANSFER", tags: ["OWN_ACCOUNT"] },
  { case_id: "TR-046", direction: IN, purpose: "Перевод между счетами", own: true, pair: true, expected_category: "INTERNAL_TRANSFER", expected_confidence: "HIGH", evidence: "STRUCTURAL_INTERNAL_TRANSFER", tags: ["OWN_ACCOUNT"] },

  { case_id: "DEF-047", direction: OUT, purpose: "Оплата по договору займа", expected_category: "LOAN_ISSUED", expected_confidence: "MEDIUM", evidence: "PURPOSE_LOAN_ISSUED", review_required: true, forbidden: ["SUPPLIER_PAYMENT"] },
  { case_id: "DEF-048", direction: IN, purpose: "Возврат займа", expected_category: "LOAN_REPAYMENT_RECEIVED", expected_confidence: "HIGH", evidence: "PURPOSE_LOAN_REPAYMENT_RECEIVED", forbidden: ["OTHER_LOAN_RECEIVED"] },
  { case_id: "DEF-049", direction: OUT, purpose: "Комиссия за эквайринг", expected_category: "ACQUIRING_FEE", expected_confidence: "HIGH", evidence: "PURPOSE_ACQUIRING_FEE", forbidden: ["SUPPLIER_PAYMENT"] },
  { case_id: "DEF-050", direction: IN, purpose: "Финансирование по факторингу", expected_category: "FACTORING_PROCEEDS", expected_confidence: "HIGH", evidence: "PURPOSE_FACTORING", forbidden: ["SALE_PROCEEDS"] },
  { case_id: "DEF-051", direction: OUT, purpose: "Погашение кредита", counterparty: "ПАО Банк", expected_category: "LOAN_PRINCIPAL_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_LOAN_PRINCIPAL", forbidden: ["SUPPLIER_PAYMENT"] },
  { case_id: "DEF-052", direction: IN, purpose: "Возврат ошибочного платежа", expected_category: "REFUND_RECEIVED", expected_confidence: "HIGH", evidence: "PURPOSE_REFUND_RECEIVED", forbidden: ["SALE_PROCEEDS"] },
  { case_id: "DEF-053", direction: OUT, purpose: "Перечисление Ozon по реестру продаж", expected_category: "UNKNOWN_OUTFLOW", expected_confidence: "LOW", evidence: "INSUFFICIENT_EVIDENCE", review_required: true, forbidden: ["MARKETPLACE_SETTLEMENT"] },

  { case_id: "DEF-054", direction: OUT, purpose: "Возврат займа по договору", expected_category: "LOAN_PRINCIPAL_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_LOAN_PRINCIPAL" },
  { case_id: "BANK-OUT-055", direction: OUT, purpose: "Банковская комиссия за РКО", counterparty: "ПАО Банк", expected_category: "BANK_FEE", expected_confidence: "HIGH", evidence: "PURPOSE_BANK_FEE" },
  { case_id: "OTHER-IN-056", direction: IN, purpose: "Страховое возмещение по договору", counterparty: "АО Страхование", expected_category: "INSURANCE_PAYOUT", expected_confidence: "HIGH", evidence: "PURPOSE_INSURANCE_PAYOUT" },
  { case_id: "IND-OUT-057", direction: OUT, purpose: "Оплата самозанятому за услуги", individual: true, expected_category: "INDIVIDUAL_BUSINESS_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_INDIVIDUAL_BUSINESS" },
  { case_id: "FIN-OUT-058", direction: OUT, purpose: "Погашение кредита 900 000 руб., проценты 100 000 руб.", counterparty: "ПАО Банк", expected_category: "DEBT_SERVICE_UNSPLIT", expected_confidence: "HIGH", evidence: "PURPOSE_DEBT_PRINCIPAL_AND_INTEREST", components: [900000, 100000] },
  { case_id: "ADV-059", direction: IN, purpose: "Возврат займа по договору поставки", expected_category: "LOAN_REPAYMENT_RECEIVED", expected_confidence: "MEDIUM", evidence: "PURPOSE_LOAN_REPAYMENT_RECEIVED", review_required: true, alternatives: ["SALE_PROCEEDS"] },
  { case_id: "REL-060", direction: OUT, purpose: "Оплата за услуги", related: true, expected_category: "SUPPLIER_PAYMENT", expected_confidence: "HIGH", evidence: "PURPOSE_SUPPLIER_SPECIFIC", tags: ["RELATED_PARTY"] },
];

export const saleVariations = [
  "Оплата за товар",
  "Оплата товара по счету",
  "За поставленный товар",
  "Оплата по счету за материалы",
];

export const contractVariations = [
  { direction: IN, purpose: "Оплата по договору", expected_category: "UNKNOWN_INFLOW" },
  { direction: OUT, purpose: "Оплата по договору займа", expected_category: "LOAN_ISSUED" },
  { direction: OUT, purpose: "Оплата по договору аренды", expected_category: "RENT_PAYMENT" },
  { direction: OUT, purpose: "Оплата по кредитному договору", expected_category: "UNKNOWN_OUTFLOW" },
];
