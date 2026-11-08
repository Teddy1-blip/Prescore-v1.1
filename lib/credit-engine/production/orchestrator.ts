import {activeFinancialSnapshots, currentFinancialSnapshots, financialSources} from "../financial-analysis/source-selection.ts";
import {publicReceipt, type DecisionReceipt} from '../explainability/receipts.ts';
import {checkoSummary} from '../../external/checko-summary.ts';
import {activeLegalReceipt} from '../../legal-registry.ts';
import {safeReason} from './diagnostics.ts';
import type { AnalysisResult } from '../../prescore.ts';
import type { CompanyProfileData } from '../../company-profile.ts';
import type { SourceEnvelope } from '../contracts/sources.ts';
import type { FinancingCaseInputV1 } from '../contracts/context.ts';
import type { DebtCapacityScenarioInputV1 } from '../contracts/debt-capacity.ts';
import { validDate, stable, id } from '../credit-portfolio/common.ts';
import { buildFinancialAnalysis } from '../financial-analysis/engine.ts';
import { adaptUploadedBki } from '../credit-portfolio/bki-adapter.ts';
import { buildCreditPortfolio } from '../credit-portfolio/resolver.ts';
import { buildReconciliation } from '../reconciliation/engine.ts';
import { adaptRiskFacts } from '../risk/facts.ts';
import { evaluateRiskFacts } from '../risk/engine.ts';
import { buildContextAssessment } from '../context/engine.ts';
import { buildPrescoreIndex } from '../index/engine.ts';
import { buildFinancingReadiness } from '../readiness/engine.ts';
import {observedBankProfile} from '../credit-assessment/bank-profile.ts';
import { buildCreditAssessment } from '../credit-assessment/engine.ts';
import { buildDebtCapacity } from '../debt-capacity/engine.ts';
import { buildProductSelection } from '../product-selection/engine.ts';
import { buildRecommendations } from '../recommendations/engine.ts';
import { buildActionPlan } from '../action-plan/engine.ts';
import { buildExplainability } from '../explainability/engine.ts';
import { buildClientReportModel } from '../client-report/adapter.ts';

export const CANONICAL_WIRING_VERSION = 'PRESCORE-CANONICAL-WIRING-1.1.0';
export type CanonicalSavedInput = {
  analysis: AnalysisResult;
  companyProfile?: CompanyProfileData;
  financingCase?: FinancingCaseInputV1;
  scenarios?: DebtCapacityScenarioInputV1[];
};
export class CanonicalUnavailable extends Error {
  readonly stage: string;
  readonly reason: string;
  constructor(stage: string, reason = 'UNEXPECTED_FAILURE') { super('CANONICAL_REPORT_UNAVAILABLE'); this.stage = stage; this.reason = reason; }
}
function sourcesOf({analysis: a, companyProfile: p}: CanonicalSavedInput): SourceEnvelope[] {
  return [...(a.sourceManifest?.bankStatements ?? []),
    ...financialSources(a.sourceManifest), ...financialSources(p?.sourceManifest),
    ...[a.sourceManifest?.bki].filter((s): s is SourceEnvelope => !!s),
    ...(a.sourceManifest?.external ?? []), ...(p?.sourceManifest?.external ?? [])];
}
// Knowledge cutoff: latest recorded observation/receipt or period end, never the wall clock.
// Upload/receipt times are fixed source provenance, not a new "today" on each render.
export function canonicalAsOf(input: CanonicalSavedInput): string {
  const a = input.analysis, p = input.companyProfile;
  const dates = [a.periodTo, a.metricsV2?.period.to, a.creditHistory?.reportDate, p?.fetchedAt,
    // A saved client declaration is a recorded observation, not a wall-clock refresh.
    // Advancing knowledge does not advance the effective dates of source balances.
    a.financingRequestV1?.receivedAt,
    ...(a.legalRegistryV1?.history ?? []).map(r => r.informationDate),
    ...(p?.externalFacts?.receipts ?? []).map(r => r.retrievedAt),
    ...sourcesOf(input).flatMap(s => [s.periodFrom, s.periodTo, s.receivedAt]),
    ...(a.financialStatementsV2 ?? []).map(s => s.period.asOf),
    ...(p?.financialStatementsV2 ?? []).map(s => s.period.asOf)];
  const present = dates.filter((d): d is string => typeof d === 'string' && d.length > 0);
  if (!present.length || present.some(d => !validDate(d.slice(0, 10)))) throw new CanonicalUnavailable('SOURCE_DATES', 'INVALID_SOURCE_DATES');
  if (!validDate(a.periodFrom) || !validDate(a.periodTo) || a.periodFrom > a.periodTo || sourcesOf(input).some(s => s.periodFrom && s.periodTo && s.periodFrom > s.periodTo)) throw new CanonicalUnavailable('SOURCE_DATES', 'INVALID_SOURCE_DATES');
  return present.map(d => d.slice(0, 10)).sort().at(-1)!;
}

// Pure orchestration. Stored full-population canonical metrics are authoritative;
// the masked/truncated display transaction list is deliberately never reprocessed.
export function buildCanonicalCreditAnalysis(input: CanonicalSavedInput) {
  let stage = 'SOURCES';
  try {
    const a = structuredClone(input.analysis), p = input.companyProfile ? structuredClone(input.companyProfile) : undefined;
    const allSources = sourcesOf(input);
    if (!/^\d{10}(\d{2})?$/.test(a.companyInn) || p && p.inn !== a.companyInn || allSources.some(s => s.companyInn !== a.companyInn)) throw new CanonicalUnavailable(stage, 'SOURCE_IDENTITY_MISMATCH');
    if (!a.metricsV2 || !a.sourceManifest?.bankStatements.length) throw new CanonicalUnavailable('BANK_METRICS_REQUIRED', 'BANK_METRICS_MISSING');
    const asOfDate = canonicalAsOf(input);
    const analysisBfo = a.sourceManifest.bfo;
    const profileBfo = p?.sourceManifest?.bfo;
    const authoritativeBfo = analysisBfo?.status === 'READY' ? analysisBfo : profileBfo ?? analysisBfo;
    const manifest = {...a.sourceManifest, ...(authoritativeBfo ? {bfo: authoritativeBfo} : {}), external: [...(a.sourceManifest.external ?? []), ...(p?.sourceManifest?.external ?? [])]};
    stage = 'FINANCIAL_ANALYSIS';
    const availableSnapshots = [...(a.financialStatementsV2 ?? a.financialAnalysisV2?.history.map(h => h.snapshot) ?? []),
      ...(p?.financialStatementsV2 ?? p?.financialAnalysisV2?.history.map(h => h.snapshot) ?? [])];
    const currentSnapshots = currentFinancialSnapshots(availableSnapshots, [a.sourceManifest, p?.sourceManifest]);
    const snapshots = activeFinancialSnapshots(currentSnapshots, [a.sourceManifest, p?.sourceManifest]);
    if (currentSnapshots.some(s => s.companyInn !== a.companyInn)) throw new CanonicalUnavailable(stage, 'SOURCE_IDENTITY_MISMATCH');
    const financialAnalysis = snapshots.length ? buildFinancialAnalysis(snapshots) : undefined;
    stage = 'CREDIT_PORTFOLIO';
    const source = manifest.bki;
    const bki = a.creditHistory && source?.status === 'READY' ? adaptUploadedBki(a.creditHistory, {companyInn: a.companyInn, source}) : undefined;
    const creditPortfolio = buildCreditPortfolio({companyInn: a.companyInn, asOfDate,
      previousPortfolio: a.creditPortfolioV1, creditHistorySnapshots: bki ? [bki] : [], paymentObservations: a.debtPaymentObservationsV1});
    stage = 'RECONCILIATION';
    const reconciliation = buildReconciliation({companyInn: a.companyInn, bank: a.metricsV2, manifest, integrity: a.integrity,
      // Authority chooses calculation inputs, not which current evidence may be compared.
      // Keep competing source facts for reconciliation without duplicating financial history.
      snapshots: currentSnapshots, financialAnalysis, bki: source?.status === 'READY' ? a.creditHistory : undefined});
    const analysis = {...a, sourceManifest: manifest, financialStatementsV2: snapshots, financialAnalysisV2: financialAnalysis, creditPortfolioV1: creditPortfolio, reconciliationV1: reconciliation};
    // The combined financial history is supplied exactly once. No legacy BFO ratios.
    const companyProfile = p ? {...p, financialStatementsV2: undefined, financialAnalysisV2: undefined} : undefined;
    stage = 'RISK';
    const riskAssessment = evaluateRiskFacts({companyInn: a.companyInn, asOfDate, facts: adaptRiskFacts({analysis, companyProfile, asOfDate})});
    stage = 'CONTEXT';
    const contextAssessment = buildContextAssessment({analysis, companyProfile, riskAssessment, asOfDate, financingCase: input.financingCase});
    const base = {riskAssessment, contextAssessment, asOfDate};
    stage = 'INDEX'; const prescoreIndex = buildPrescoreIndex(base);
    const indexed = {...base, prescoreIndex};
    stage = 'READINESS'; const financingReadiness = buildFinancingReadiness(indexed);
    const ready = {...indexed, financingReadiness};
    stage = 'ASSESSMENT'; const creditAssessment = buildCreditAssessment(ready);
    creditAssessment.bankObservations = observedBankProfile(a,a.metricsV2,riskAssessment,creditPortfolio);
    const assessed = {...ready, creditAssessment, creditPortfolio};
    stage = 'CAPACITY'; const debtCapacity = buildDebtCapacity({...assessed, bankMetrics: a.metricsV2, scenarios: input.scenarios});
    const capacity = {...assessed, debtCapacity};
    stage = 'PRODUCTS'; const productSelection = buildProductSelection(capacity);
    const products = {...capacity, productSelection};
    stage = 'RECOMMENDATIONS'; const recommendationSet = buildRecommendations(products);
    const recommendations = {...products, recommendationSet};
    stage = 'ACTION_PLAN'; const actionPlan = buildActionPlan(recommendations);
    stage = 'EXPLAINABILITY';
    const receipts=new Map<string,DecisionReceipt>(allSources.map(s=>[s.sourceId,publicReceipt(s)]));
    for(const r of p?.externalFacts?.receipts ?? []) if(r.retrievedAt && p?.externalFacts?.inn===a.companyInn)
      receipts.set(r.id,{sourceId:r.id,sourceType:r.provider==='CHECKO'?'CHECKO':'EIS',provider:r.provider,
        upstream:r.authority,direct:r.direct,receivedAt:r.retrievedAt,informationDate:r.informationDate});
    const registry=activeLegalReceipt(a);
    if(registry) receipts.set(registry.id,{sourceId:registry.id,sourceType:'OTHER',provider:'FNS_DIRECT',upstream:'FNS',direct:true,
      receivedAt:registry.receivedAt,informationDate:registry.informationDate});
    if(input.financingCase) {
      const sourceId='case:'+input.financingCase.caseId;
      receipts.set(sourceId,{sourceId,sourceType:'OTHER',receivedAt:a.financingRequestV1?.receivedAt??input.financingCase.financingPurpose.evidenceAsOf??input.financingCase.asOfDate});
    }
    const explainability = buildExplainability({...recommendations, actionPlan, sourceReceipts:[...receipts.values()]});
    const reportInput = {...recommendations, actionPlan, explainability, company: {name: a.companyName, inn: a.companyInn}};
    stage = 'CLIENT_REPORT'; const model = buildClientReportModel(reportInput, {entitlement: 'FULL', mode: 'SAVED_ANALYSIS'});
    const checko=checkoSummary(p,a.checkoAttempt);
    if(checko)model.checko=checko;
    return {version: CANONICAL_WIRING_VERSION, analysisId: a.id,
      inputFingerprint: id('canonical-input', stable({asOfDate, integrity: a.integrity, legal: a.legalRegistryV1, bki: a.creditHistory, metrics: a.metricsV2, snapshots: currentSnapshots, portfolio: creditPortfolio, manifest, profile: p, financingCase: input.financingCase, scenarios: input.scenarios})),
      sourceObservations: allSources.map(s => ({sourceId: s.sourceId, sourceType: s.sourceType, status: s.status, periodFrom: s.periodFrom ?? null, periodTo: s.periodTo ?? null, receivedAt: s.receivedAt})),
      financialAnalysis, reconciliation, ...reportInput, model};
  } catch (error) {
    if (error instanceof CanonicalUnavailable) throw error;
    // Neither raw provider errors nor client evidence are sent to the browser/logs.
    throw new CanonicalUnavailable(stage, safeReason(error));
  }
}
export type CanonicalCreditAnalysisV1 = ReturnType<typeof buildCanonicalCreditAnalysis>;
// Future AI can explain this already-computed presentation; it receives no policies,
// raw source documents or authority to recalculate any decision.
export function canonicalExplanationContext(result: CanonicalCreditAnalysisV1) {
  return {version: result.version, analysisId: result.analysisId, asOfDate: result.asOfDate, report: result.model};
}
