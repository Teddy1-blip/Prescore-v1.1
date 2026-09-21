import type {ClientReportModelV1} from '../contracts/client-report.ts';
// Presentation-only redaction. Numeric results and claim IDs are unchanged.
// Internal policy constants embedded in legacy binding names are not client copy.
export function publicCanonicalModel(model: ClientReportModelV1): ClientReportModelV1 {
  const copy = structuredClone(model);
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const item = value as Record<string, unknown>;
    if (item.bindingCode === 'PRUDENTIAL_20_PERCENT_CEILING') {
      item.bindingCode = 'PRUDENTIAL_MONTHLY_CEILING'; item.label = 'Осторожная граница обслуживания';
    } else if (item.bindingCode === 'MAXIMUM_25_PERCENT_CEILING') {
      item.bindingCode = 'MAXIMUM_MONTHLY_CEILING'; item.label = 'Верхняя граница обслуживания';
    }
    for (const child of Object.values(item)) visit(child);
  }
  visit(copy);
  return copy;
}
