import {buildExpertise} from '../expertise/model.ts';
import {analysisV3Presentation} from '../client-report/analysis-v3.ts';
import type {CanonicalCreditAnalysisV1} from './orchestrator.ts';
import type {ClientReportModelV1} from '../contracts/client-report.ts';
// Presentation-only redaction. Numeric results and claim IDs are unchanged.
// Internal policy constants embedded in legacy binding names are not client copy.
export function publicCanonicalModel(model: ClientReportModelV1, result?: CanonicalCreditAnalysisV1): ClientReportModelV1 {
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
  if (result) { const projection = analysisV3Presentation(result, copy); if (projection) copy.analysisV3 = projection; }
  delete copy.expertise;
  if (result && copy.meta.entitlement === 'FULL') copy.expertise = buildExpertise(result, copy);
  if (copy.meta.entitlement === 'FREE') delete copy.analysisV3;
  return copy;
}
