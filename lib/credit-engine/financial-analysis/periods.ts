import type { FinancialPeriod, FinancialStatementSnapshot, PeriodComparability } from "../contracts/financial-statements.ts";

export const unknownPeriod = (): FinancialPeriod => ({ kind: "UNKNOWN", from: null, to: null, asOf: null, year: null, monthsCovered: null, flowPeriodType: "UNKNOWN", confidence: "UNKNOWN" });
export function annualPeriod(year: number): FinancialPeriod {
  return { kind: "ANNUAL", from: `${year}-01-01`, to: `${year}-12-31`, asOf: `${year}-12-31`, year, monthsCovered: 12, flowPeriodType: "FULL_YEAR", confidence: "HIGH" };
}
export function validDate(value: string | null): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
}
export function daysInPeriod(period: FinancialPeriod): number | null {
  if (period.confidence === "UNKNOWN" || period.confidence === "LOW" || period.flowPeriodType === "UNKNOWN" || !validDate(period.from) || !validDate(period.to)) return null;
  const days = (Date.parse(period.to!) - Date.parse(period.from!)) / 86_400_000 + 1;
  return days > 0 ? days : null;
}
// Recognize explicit reporting spans only, never infer flows from a balance-sheet date.
export function parseFinancialPeriod(text: string): FinancialPeriod {
  const normalized = text.toLowerCase().replace(/[–—]/g, "-");
  const span = normalized.match(/(?:за\s+)?(3|6|9|12)\s*месяц\S*\s+(20\d{2})/);
  const named = normalized.match(/(?:за\s+)?(январь\s*-\s*(?:март|июнь|сентябрь|декабрь)|полугодие)\s+(20\d{2})/);
  const months = span ? Number(span[1]) : named ? (/март|квартал/.test(named[1]) ? 3 : /июнь|полугодие/.test(named[1]) ? 6 : /сентябрь/.test(named[1]) ? 9 : 12) : null;
  const year = Number(span?.[2] ?? named?.[2]);
  if (months && year) {
    if (months === 12) return annualPeriod(year);
    const to = new Date(Date.UTC(year, months, 0)).toISOString().slice(0, 10);
    return { kind: "INTERIM", from: `${year}-01-01`, to, asOf: to, year, monthsCovered: months, flowPeriodType: "CUMULATIVE_YTD", confidence: "HIGH" };
  }
  const standalone = normalized.match(/(?:^|\s)([1-4]|iv|iii|ii|i|первый)\s+квартал\s+(20\d{2})/);
  if (standalone) {
    const year = Number(standalone[2]), quarter = ({ i: 1, ii: 2, iii: 3, iv: 4, первый: 1 } as Record<string, number>)[standalone[1]] ?? Number(standalone[1]);
    const from = new Date(Date.UTC(year, (quarter - 1) * 3, 1)).toISOString().slice(0, 10);
    const to = new Date(Date.UTC(year, quarter * 3, 0)).toISOString().slice(0, 10);
    return { kind: "INTERIM", from, to, asOf: to, year, monthsCovered: 3, flowPeriodType: "STANDALONE_PERIOD", confidence: "HIGH" };
  }
  const annual = normalized.match(/за\s+(20\d{2})\s*(?:год|г\.)/);
  if (annual) return annualPeriod(Number(annual[1]));
  const date = normalized.match(/(?:на|по состоянию на)\s+(\d{2})\.(\d{2})\.(20\d{2})/);
  if (date) {
    const asOf = `${date[3]}-${date[2]}-${date[1]}`;
    if (validDate(asOf)) return { ...unknownPeriod(), kind: "SNAPSHOT", asOf, year: Number(date[3]), confidence: "LOW" };
  }
  return unknownPeriod();
}
export function comparePeriods(current: FinancialStatementSnapshot, previous?: FinancialStatementSnapshot): PeriodComparability {
  if (!previous) return "INSUFFICIENT_DATA";
  const a = current.period, b = previous.period;
  if (!current.companyInn || current.companyInn !== previous.companyInn || current.accountingStandard !== "RAS" || previous.accountingStandard !== "RAS") return "NOT_COMPARABLE";
  if (!daysInPeriod(a) || !daysInPeriod(b) || !a.year || !b.year || !a.monthsCovered || !b.monthsCovered) return "INSUFFICIENT_DATA";
  if (a.kind === "ANNUAL" && b.kind === "ANNUAL" && a.flowPeriodType === "FULL_YEAR" && b.flowPeriodType === "FULL_YEAR" && a.monthsCovered === 12 && b.monthsCovered === 12 && a.year === b.year + 1) return "COMPARABLE_ANNUAL_YOY";
  if (a.kind === "INTERIM" && b.kind === "INTERIM" && a.monthsCovered === b.monthsCovered && a.flowPeriodType === b.flowPeriodType) {
    if (a.year === b.year + 1 && a.from!.slice(5) === b.from!.slice(5) && a.to!.slice(5) === b.to!.slice(5)) return "COMPARABLE_INTERIM_YOY";
    if (a.flowPeriodType === "STANDALONE_PERIOD" && Date.parse(a.from!) - Date.parse(b.to!) === 86_400_000) return "COMPARABLE_SEQUENTIAL";
  }
  return "NOT_COMPARABLE";
}
