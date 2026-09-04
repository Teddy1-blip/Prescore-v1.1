export type NormalizedValue<T> = { value: T | null; warning?: string };

export function normalizeAmount(input: string | number | null | undefined): NormalizedValue<number> {
  if (input === null || input === undefined || input === "") return { value: null, warning: "AMOUNT_UNKNOWN" };
  if (typeof input === "number") {
    return Number.isFinite(input) ? { value: Math.abs(input), ...(input === 0 ? { warning: "AMOUNT_ZERO" } : {}) } : { value: null, warning: "AMOUNT_MALFORMED" };
  }
  const compact = input.trim().replace(/[\s\u00a0]/g, "").replace(/₽|руб\.?/gi, "").replace(/[−–—]/g, "-");
  if (!compact) return { value: null, warning: "AMOUNT_UNKNOWN" };
  const sign = compact.startsWith("-") ? -1 : 1;
  const unsigned = compact.replace(/^[+-]/, "");
  if (!/^\d+(?:[.,]\d+)*$/.test(unsigned)) return { value: null, warning: "AMOUNT_MALFORMED" };
  const separators = [...unsigned].filter((char) => char === "," || char === ".");
  let normalized = unsigned;
  if (separators.length) {
    const unique = new Set(separators);
    const lastSeparatorIndex = Math.max(unsigned.lastIndexOf(","), unsigned.lastIndexOf("."));
    const integerRaw = unsigned.slice(0, lastSeparatorIndex);
    const fractionRaw = unsigned.slice(lastSeparatorIndex + 1);
    const validGroupedInteger = /^\d{1,3}(?:[.,]\d{3})*$/.test(integerRaw);
    if (unique.size === 2) {
      if (!validGroupedInteger || !/^\d{1,2}$/.test(fractionRaw)) return { value: null, warning: "AMOUNT_MALFORMED" };
      normalized = `${integerRaw.replace(/[.,]/g, "")}.${fractionRaw}`;
    } else {
      const separator = separators[0];
      const parts = unsigned.split(separator);
      const grouped = parts.length > 1 && /^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((part) => /^\d{3}$/.test(part));
      const decimal = parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1]);
      const groupedWithDecimal = parts.length > 2 && /^\d{1,3}$/.test(parts[0]) && parts.slice(1, -1).every((part) => /^\d{3}$/.test(part)) && /^\d{1,2}$/.test(parts.at(-1) ?? "");
      if (grouped) normalized = parts.join("");
      else if (decimal) normalized = `${parts[0]}.${parts[1]}`;
      else if (groupedWithDecimal) normalized = `${parts.slice(0, -1).join("")}.${parts.at(-1)}`;
      else return { value: null, warning: "AMOUNT_MALFORMED" };
    }
  }
  const parsed = Number(normalized) * sign;
  if (!Number.isFinite(parsed)) return { value: null, warning: "AMOUNT_MALFORMED" };
  const value = Math.abs(parsed);
  return { value, ...(value === 0 ? { warning: "AMOUNT_ZERO" } : {}) };
}

export function normalizeTransactionDate(input: string | null | undefined): NormalizedValue<string> {
  if (!input?.trim()) return { value: null, warning: "DATE_UNKNOWN" };
  const match = input.trim().match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (!match) return { value: null, warning: "DATE_MALFORMED" };
  const [, dayRaw, monthRaw, yearRaw] = match;
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    return { value: null, warning: "DATE_INVALID" };
  }
  return { value: `${yearRaw}-${monthRaw.padStart(2, "0")}-${dayRaw.padStart(2, "0")}` };
}

export function normalizeAccountValue(input: string | null | undefined): NormalizedValue<string> {
  if (!input?.trim()) return { value: null, warning: "ACCOUNT_UNKNOWN" };
  const value = input.replace(/\D/g, "");
  if (!value) return { value: null, warning: "ACCOUNT_MALFORMED" };
  return { value };
}

export function normalizePurpose(input: string | null | undefined): NormalizedValue<string> {
  if (!input?.trim()) return { value: null, warning: "PURPOSE_UNKNOWN" };
  return { value: input.replace(/\s+/g, " ").trim() };
}

export function normalizeCurrency(input: string | null | undefined): NormalizedValue<string> {
  if (!input?.trim()) return { value: "RUB" };
  const value = input.trim().toUpperCase().replace("РУБ", "RUB");
  if (/^[A-Z]{3}$/.test(value)) return { value };
  if (value === "643") return { value: "RUB" };
  return { value: null, warning: "CURRENCY_UNKNOWN" };
}
