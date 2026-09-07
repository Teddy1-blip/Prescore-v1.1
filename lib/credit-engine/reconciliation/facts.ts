import type { ReconciliationFact as Fact, ReconciliationInput, ReconciliationDataset, ReconciliationEntityScope } from "../contracts/reconciliation.ts";
import type { SourceEnvelope } from "../contracts/sources.ts";
import type { MetricResult } from "../contracts/metrics.ts";
import { INCOME_CODES } from "../contracts/financial-statements.ts";
import { finite, numericConfidence, sourceBound, stableId, unique, weakest } from "./common.ts";
import { monthBounds, validDate } from "./periods.ts";

const identityPeriod: Fact["period"] = { kind: "IDENTITY", from: null, to: null, asOf: null };
function seed(companyInn: string, sourceType: Fact["sourceType"], sourceIds: string[], semanticCode: string, period: Fact["period"], value: Fact["value"], basis: string): Fact {
  return { factId: stableId(sourceIds, semanticCode, period), semanticCode, companyInn, subjectInn: companyInn || null,
    entityScope: "COMPANY", affectsCompanyDebt: null, sourceType, sourceIds, value, unit: "RUB",
    status: value === null ? "UNKNOWN" : "KNOWN", confidence: "HIGH", period, calculationBasis: basis, warnings: [] };
}
export function bankFacts(input: ReconciliationInput): Fact[] {
  const bank = input.bank;
  if (!bank) return [];
  const sources = (input.manifest?.bankStatements ?? []).filter(s => s.sourceType === "BANK_STATEMENT");
  const ids = unique(sources.map(s => s.sourceId));
  const companyInn = sources.find(s => s.companyInn !== input.companyInn)?.companyInn ?? input.companyInn;
  const confidence = weakest(numericConfidence(bank.quality.sourceIntegrityConfidence), input.integrity ? numericConfidence(input.integrity.confidence) : "HIGH");
  const flow: Fact["period"] = { kind: "FLOW", from: bank.period.from, to: bank.period.to, asOf: null };
  const bankWarnings = bank.quality.warnings;
  function metric(code: string, m: MetricResult, period = flow): Fact {
    return sourceBound({ ...seed(companyInn, "BANK_STATEMENT", ids, code, period, m.value, m.calculationBasis),
      status: m.status, confidence: weakest(m.confidence, confidence), sourceMetricCode: m.code,
      warnings: [...m.warnings, ...bankWarnings, ...(input.integrity?.warnings ?? [])] }, sources);
  }
  const fields: Array<[string, MetricResult]> = [
    ["BANK_OPERATING_RECEIPTS", bank.operating.operatingCashReceipts],
    ["BANK_FINANCING_INFLOWS", bank.financing.financingCashInflow], ["BANK_LOAN_INFLOW", bank.financing.bankLoanInflow],
    ["BANK_OTHER_LOAN_INFLOW", bank.financing.otherLoanInflow], ["BANK_OWNER_LOAN_INFLOW", bank.financing.ownerLoanInflow],
    ["BANK_FACTORING_INFLOW", bank.financing.factoringInflow], ["BANK_LOAN_PRINCIPAL_PAID", bank.debtService.loanPrincipalPaid],
    ["BANK_INTEREST_PAID", bank.debtService.interestPaid], ["BANK_UNSPLIT_DEBT_SERVICE", bank.debtService.unsplitDebtService],
    ["BANK_LEASING_PAID", bank.debtService.leasingPaid], ["BANK_DEBT_SERVICE_OUTFLOW", bank.debtService.debtServiceCashOutflow],
    ["BANK_TAX_PAID", bank.tax.taxPaymentsAmount],
  ];
  const output = fields.map(([code, m]) => metric(code, m));
  output.push(metric("BANK_ENDING_BALANCE", bank.liquidity.endingBalance, { kind: "SNAPSHOT", from: null, to: null, asOf: bank.period.to }));
  for (const month of bank.monthly) {
    const bounds = monthBounds(month.month), base = bank.operating.operatingCashReceipts;
    // Monthly aggregates have no independent confidence. Bound by the canonical parent metric.
    output.push(sourceBound({ ...seed(companyInn, "BANK_STATEMENT", ids, "BANK_MONTHLY_OPERATING_RECEIPTS", { kind: "FLOW", ...bounds, asOf: null }, finite(month.operatingReceipts) ? month.operatingReceipts : null, "Block 4 monthly.operatingReceipts; no financing or gross-inflow substitution"),
      coverage: month.coverage, sourceMetricCode: base.code,
      status: base.status === "UNKNOWN" || base.status === "NOT_APPLICABLE" ? "UNKNOWN" : month.coverage === "FULL" ? "KNOWN" : "PARTIAL",
      confidence: weakest(base.confidence, confidence), warnings: [...month.warnings, ...base.warnings] }, sources));
  }
  return output;
}
export function financialFacts(input: ReconciliationInput): Fact[] {
  const history = input.financialAnalysis?.history ?? [];
  const snapshots = new Map(history.map(p => [p.snapshot.snapshotId, p.snapshot]));
  for (const s of input.snapshots ?? []) snapshots.set(s.snapshotId, s);
  return [...snapshots.values()].flatMap(s => {
    const analysis = history.find(p => p.snapshot.snapshotId === s.snapshotId);
    const fields = { ...s.balance, ...s.income, REPORTED_NET_ASSETS: s.reportedNetAssets };
    const facts = Object.entries(fields).map(([code, value]): Fact => {
      const flow = code in INCOME_CODES;
      const period: Fact["period"] = flow ? { kind: "FLOW", from: s.period.from, to: s.period.to, asOf: null } : { kind: "SNAPSHOT", from: null, to: null, asOf: s.period.asOf };
      const amount = analysis?.amounts[code];
      const invalidBasis = s.accountingStandard !== "RAS" || s.confirmedScale == null || (flow && s.period.flowPeriodType === "UNKNOWN") || s.source.companyInn !== s.companyInn;
      return sourceBound({ ...seed(s.companyInn, s.sourceType, [s.sourceId], code, period, value.origin === "PROXY" || invalidBasis ? null : value.value, amount?.calculationBasis ?? `Canonical Block 5 ${code} normalized RUB`),
        factId: stableId(s.snapshotId, code, period), groupId: s.snapshotId, sourceScale: s.confirmedScale, accountingStandard: s.accountingStandard,
        status: value.origin === "PROXY" || invalidBasis ? "UNKNOWN" : value.status,
        confidence: weakest(value.confidence, s.period.confidence, numericConfidence(s.quality.parserConfidence), amount?.confidence ?? "HIGH"),
        rawCode: value.rawCode, rawLabel: value.rawLabel, sourceMetricCode: amount?.code, origin: value.origin,
        warnings: [...value.warnings, ...s.quality.warnings, ...(invalidBasis ? ["FINANCIAL_BASIS_UNKNOWN"] : [])] }, [s.source]);
    });
    const components = [facts.find(f => f.semanticCode === "LONG_TERM_BORROWINGS")!, facts.find(f => f.semanticCode === "SHORT_TERM_BORROWINGS")!];
    const sum = components.every(f => f.status === "KNOWN" && finite(f.value)) ? components.reduce((n, f) => n + (f.value as number), 0) : null;
    facts.push({ ...components[0], factId: stableId(s.snapshotId, "TOTAL_BORROWINGS"), semanticCode: "TOTAL_BORROWINGS", value: finite(sum) ? sum : null,
      status: finite(sum) ? "KNOWN" : "UNKNOWN", confidence: weakest(...components.map(f => f.confidence)), origin: "DERIVED",
      rawCode: undefined, rawLabel: undefined, sourceMetricCode: analysis?.amounts.TOTAL_BORROWINGS?.code,
      dependencyFactIds: components.map(f => f.factId),
      calculationBasis: "Canonical LONG_TERM_BORROWINGS + SHORT_TERM_BORROWINGS; every component required; no guarantees",
      warnings: unique(components.flatMap(f => f.warnings)) });
    return facts;
  });
}
export function bkiFacts(input: ReconciliationInput): Fact[] {
  const report = input.bki, source = input.manifest?.bki;
  if (!report) return [];
  const scopes: Record<string, ReconciliationEntityScope> = { "Компания-заёмщик": "COMPANY", "ИП-заёмщик": "IP", "Собственник": "OWNER", "Поручитель": "GUARANTOR", "Руководитель": "DIRECTOR", "Не указано": "UNKNOWN" };
  const scope = scopes[report.relationshipToCompany] ?? "OTHER", ids = source ? [source.sourceId] : [];
  const asOf = validDate(report.reportDate) ? report.reportDate : null;
  const fields = ["outstandingPrincipal", "totalOutstanding", "monthlyPayment", "overdueAmount", "guaranteeExposure"] as const;
  const codes = ["BKI_OUTSTANDING_PRINCIPAL", "BKI_TOTAL_OUTSTANDING", "BKI_MONTHLY_PAYMENT", "BKI_OVERDUE_AMOUNT", "BKI_GUARANTEE_EXPOSURE"];
  const common = { subjectInn: report.subjectInn || null, entityScope: scope, affectsCompanyDebt: report.affectsCompanyDebt, confidence: numericConfidence(report.parserConfidence) };
  const facts = fields.map((field, i) => sourceBound({ ...seed(source?.companyInn ?? input.companyInn, "BKI", ids, codes[i], { kind: "SNAPSHOT", from: null, to: null, asOf },
    report.summary.knownValues?.[field] === true && finite(report.summary[field]) ? report.summary[field] : null,
    `CreditHistoryReport.summary.${field}; knownValues confirmation required; obligations count ${report.obligations.length}; guarantee exposure separate`), ...common,
    warnings: [...report.warnings, ...(!asOf ? ["BKI_REPORT_DATE_UNKNOWN"] : [])] }, source ? [source] : []));
  facts.push(sourceBound({ ...seed(source?.companyInn ?? input.companyInn, "BKI", ids, "SUBJECT_INN", identityPeriod, report.subjectInn || null, "CreditHistoryReport.subjectInn / relationshipToCompany / affectsCompanyDebt"), ...common, unit: "TEXT" }, source ? [source] : []));
  return facts;
}
export function buildFacts(input: ReconciliationInput): ReconciliationDataset {
  const m = input.manifest;
  const sources = new Map<string, SourceEnvelope>();
  for (const source of [...(m?.bankStatements ?? []), m?.bfo, m?.quarterly, m?.bki, ...(m?.external ?? []), ...(input.financialAnalysis?.sources ?? []), ...(input.snapshots ?? []).map(s => s.source)]) {
    if (source) sources.set(source.sourceId, source);
  }
  const facts = [...bankFacts(input), ...financialFacts(input), ...bkiFacts(input), ...(input.extraFacts ?? [])];
  for (const s of sources.values()) {
    if (s.sourceType === "BKI") continue;
    facts.push(sourceBound({ ...seed(s.companyInn, s.sourceType, [s.sourceId], "COMPANY_INN", identityPeriod, s.companyInn || null, "Canonical SourceEnvelope.companyInn"), unit: "TEXT" }, [s]));
  }
  return { companyInn: input.companyInn, facts, sources: [...sources.values()], bankPeriod: input.bank?.period };
}
