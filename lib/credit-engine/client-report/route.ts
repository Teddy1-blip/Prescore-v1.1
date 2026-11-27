import type {ClientReportInputV1,ClientReportModelV1} from '../contracts/client-report.ts';
export type DecisionRouteCode='READY_FOR_FINANCING'|'NEEDS_PREPARATION'|'INSUFFICIENT_DATA';
export function decisionRoute(report:ClientReportModelV1, readiness:ClientReportInputV1['financingReadiness'],
  assessment:ClientReportInputV1['creditAssessment'], capacity:number|null): DecisionRouteCode {
  const globalStop=report.hero.globalStop || assessment.globalStop.status==='PRESENT' || assessment.status==='NOT_RATABLE_GLOBAL_STOP';
  if (globalStop || readiness.level === "NOT_READY") return 'NEEDS_PREPARATION';

  const insufficient = report.hero.cta.target === "data" && readiness.caseDefinition?.status !== "DEFINED"
    || readiness.status === "INSUFFICIENT_DATA"
    || readiness.level === "UNKNOWN"
    || assessment.status === "INSUFFICIENT_DATA";
  if (insufficient) return 'INSUFFICIENT_DATA';

  const readinessUsable = readiness.status === "ASSESSED" || readiness.status === "PARTIAL";
  const assessmentUsable = assessment.status === "COMPLETE" || assessment.status === "PARTIAL";
  const hasFinancingBasis = (typeof capacity === "number" && Number.isFinite(capacity) && capacity > 0)
    || report.productFit.primary.length > 0;
  const readyBand = readiness.level === "HIGH" || readiness.level === "MEDIUM";

  if (readyBand && readinessUsable && assessmentUsable && hasFinancingBasis) return 'READY_FOR_FINANCING';
  return 'NEEDS_PREPARATION';
}
