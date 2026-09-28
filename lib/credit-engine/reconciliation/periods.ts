export const MAX_NEAR_STOCK_GAP_DAYS = 45;
export function validDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
}
export function gapDays(a: string | null, b: string | null): number | null {
  return validDate(a) && validDate(b) ? Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000 : null;
}
export function calendarMonths(from: string | null, to: string | null): string[] | null {
  if (!validDate(from) || !validDate(to) || from > to || !from.endsWith("-01")) return null;
  const end = new Date(to), next = new Date(Date.parse(to) + 86_400_000);
  if (next.getUTCDate() !== 1) return null;
  const start = new Date(from), count = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1;
  if (count > 1200) return null; // Malformed/unbounded periods are not useful reporting spans.
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
}
export function monthBounds(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { from: null, to: null };
  const [year, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10) };
}
