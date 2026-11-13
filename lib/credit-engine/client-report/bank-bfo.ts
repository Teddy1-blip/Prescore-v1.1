import type { CrossSourceReconciliationV1, ReconciliationFact, ReconciliationFinding } from "../contracts/reconciliation.ts";

type Evidence = {
  label: string;
  sourceIds: string[];
  period: ReconciliationFact["period"];
  value: number | null;
};
export type BankBfoComparison = {
  findingId: string;
  title: string;
  bank: Evidence | null;
  accounting: Evidence;
  context: Evidence[];
  direction: ReconciliationFinding["direction"];
  difference: number | null;
  limitation: string;
  action: string | null;
};

function evidence(f: ReconciliationFact, label: string): Evidence {
  const row = f.rawCode ? ` · строка ${f.rawCode}` : f.rawLabel ? ` · ${f.rawLabel}` : "";
  return { label: label + row, sourceIds: [...f.sourceIds], period: { ...f.period },
    value: f.unit === "RUB" && f.status === "KNOWN" && typeof f.value === "number" && Number.isFinite(f.value) ? f.value : null };
}

function unavailable(f: ReconciliationFinding): string {
  const reasons = new Set([...f.reasonCodes, ...f.warnings]);
  if (reasons.has("FINANCIAL_BASIS_UNKNOWN") || reasons.has("MONETARY_UNIT_UNKNOWN")) return "Для сравнения нужны подтверждённые единицы в рублях, принадлежность отчётности компании и период.";
  if (reasons.has("AS_OF_DATE_MISMATCH")) return "У банковского остатка и баланса разные или неизвестные даты. Для сверки нужна одна отчётная дата.";
  if (["PARTIAL_BANK_MONTH", "MISSING_BANK_MONTH", "OVERLAP_BANK_MONTH", "PERIOD_NOT_ALIGNED"].some(s => reasons.has(s))) return "Выписки должны покрывать каждый полный месяц отчётного периода без пропусков и перекрытий.";
  if (reasons.has("INCOMPLETE_ACCOUNT_OR_BALANCE_COVERAGE")) return "В представленных выписках не подтверждены конечные остатки по всем включённым счетам.";
  return "Для сравнения требуется подтверждённая сумма в каждом источнике. Пропущенный показатель остаётся неизвестным.";
}

// The dossier and printable snapshot receive the same allowlisted, resolved observations.
export function bankBfoComparisons(r: CrossSourceReconciliationV1): BankBfoComparison[] {
  if (!r.sources.bankStatementSourceIds.length) return [];
  return r.findings.flatMap((f, index) => {
    const [left] = f.leftFacts, [right] = f.rightFacts;
    const flow = f.code === "REC-REV";
    if ((!flow && f.code !== "REC-CASH") || right?.sourceType !== "BFO" || !r.companyInn ||
        right.companyInn !== r.companyInn || (left && left.companyInn !== r.companyInn) ||
        f.reasonCodes.some(s => s.startsWith("COMPANY_IDENTITY_"))) return [];
    const bankPeriod = !left && r.facts.find(v => v.semanticCode === "BANK_OPERATING_RECEIPTS" && v.companyInn === r.companyInn);
    const compared = f.outcome === "RELATIONSHIP_OBSERVED" && f.absoluteDifference !== null;
    const gap = compared && f.absoluteDifference !== 0;
    const context = (f.contextFacts ?? []).filter(v => v.companyInn === r.companyInn);
    const advance = context.some(v => v.semanticCode === "BANK_CUSTOMER_ADVANCES");
    const receivable = context.some(v => v.semanticCode === "RECEIVABLES");
    const action = !gap ? null : !flow ? "Сверьте остатки по представленным счетам с расшифровкой денежных средств и эквивалентов на эту дату."
      : advance && receivable ? "Сопоставьте полученные авансы с отгрузками и проверьте движение расчётов с покупателями за период."
      : advance ? "Сопоставьте полученные авансы с датами отгрузок за период."
      : receivable ? "Сверьте начисления и оплаты по расчётам с покупателями за период."
      : "Сопоставьте оплаты и признанную выручку по датам за отчётный период.";
    return [{ findingId: "reconciliation-" + index,
      title: flow ? "Операционные поступления и выручка" : "Денежные остатки на отчётную дату",
      bank: left ? evidence(left, flow ? "Выписки · операционные поступления" : "Выписки · конечный остаток") : bankPeriod ? { ...evidence(bankPeriod, "Выписки · доступный период"), value: null } : null,
      accounting: evidence(right, flow ? "БФО · выручка" : "БФО · денежные средства и эквиваленты"),
      context: context.map(v => evidence(v, v.semanticCode === "RECEIVABLES" ? "БФО · дебиторская задолженность" : "Выписки · распознанные авансы покупателей")),
      direction: f.direction, difference: compared ? f.absoluteDifference : null,
      limitation: !compared ? unavailable(f) : flow ?
        "Выписки отражают оплаты по представленным счетам. БФО отражает признанную выручку. По этим суммам нельзя установить причину разницы или величину кредитного риска." :
        "Банковская сумма охватывает представленные счета. Строка баланса может также включать кассу и денежные эквиваленты. Остатки по другим счетам неизвестны.",
      action }];
  });
}
