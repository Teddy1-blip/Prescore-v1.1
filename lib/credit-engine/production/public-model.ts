import {decisionSnapshot} from './snapshot.ts';
import {buildExpertise} from '../expertise/model.ts';
import {analysisV3Presentation} from '../client-report/analysis-v3.ts';
import {publicFinancialAnalysis,publicReconciliation} from '../client-report/source-detail.ts';
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
  if(result&&copy.meta.entitlement==='FULL') {
    const risk=result.riskAssessment;
    copy.bankRuleCoverage=risk.evaluations.filter(e=>e.ruleCode.startsWith('RISK-CF-')&&e.status==='INSUFFICIENT_DATA').map(e=>({
      code:e.ruleCode,
      reasons:[...new Set([...e.reasonCodes,...e.requiredFactCodes.flatMap(code=>{
        const f=risk.facts.find(v=>v.semanticCode===code);
        if(!f)return [code+':MISSING'];
        const reasons=[...f.warnings];
        if(f.status!=='KNOWN')reasons.push(f.status);
        if(!['HIGH','MEDIUM'].includes(f.confidence))reasons.push('CONFIDENCE_'+f.confidence);
        if(code==='BANK_COVERAGE_ADEQUATE'&&f.value===false)reasons.push('INCOMPLETE_PERIOD');
        return reasons.map(reason=>code+':'+reason);
      })])]
    }));
  }
  delete copy.expertise;
  delete copy.financialAnalysis;
  delete copy.reconciliation;
  if(result && copy.meta.entitlement === 'FULL') {copy.financialAnalysis=publicFinancialAnalysis(result);copy.reconciliation=publicReconciliation(result);}
  if (result && copy.meta.entitlement === 'FULL') copy.expertise = buildExpertise(result, copy);
  if (copy.meta.entitlement === 'FREE') delete copy.analysisV3;
  delete copy.meta.snapshot;
  if (result && copy.meta.entitlement === 'FULL' && copy.meta.mode === 'SAVED_ANALYSIS') {
    copy.meta.snapshot = decisionSnapshot(result);
  }
  return copy;
}
