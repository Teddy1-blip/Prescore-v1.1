import type { CanonicalCounterparty } from "../contracts/transactions.ts";

function normalizedName(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const normalized = value
    .replace(/ё/g, "е")
    .replace(/Ё/g, "Е")
    .replace(/[«»„“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/^[-–—,.;:\s]+|[-–—,.;:\s]+$/g, "")
    .trim()
    .toUpperCase();
  return normalized || null;
}

export function normalizeInnValue(value: string | null | undefined) {
  if (!value?.trim()) return { value: null, warning: "COUNTERPARTY_INN_UNKNOWN" };
  const digits = value.trim().replace(/[ -]/g, "");
  if (!/^(?:\d{10}|\d{12})$/.test(digits)) return { value: null, warning: "COUNTERPARTY_INN_INVALID" };
  return { value: digits };
}

export function normalizeCounterparty(name: string | null | undefined, inn: string | null | undefined): { counterparty: CanonicalCounterparty; warnings: string[] } {
  const warnings: string[] = [];
  const nameNormalized = normalizedName(name);
  const innResult = normalizeInnValue(inn);
  if (innResult.warning) warnings.push(innResult.warning);
  if (!nameNormalized) warnings.push("COUNTERPARTY_NAME_UNKNOWN");
  const substantiveName = Boolean(nameNormalized && nameNormalized.replace(/[^А-ЯA-Z0-9]/g, "").length >= 5);
  const identityConfidence = innResult.value ? "HIGH" : substantiveName ? "MEDIUM" : nameNormalized ? "LOW" : "UNKNOWN";
  return {
    counterparty: {
      nameRaw: name?.trim() || null,
      nameNormalized,
      innRaw: inn?.trim() || null,
      innNormalized: innResult.value,
      identityConfidence,
    },
    warnings,
  };
}
