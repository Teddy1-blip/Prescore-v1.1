import {savedCanonicalInput} from "../../workspace/financing-request.ts";
import {diagnostic, inputSummary} from './diagnostics.ts';
import { publicCanonicalModel } from './public-model.ts';
import type { AnalysisResult } from '../../prescore.ts';
import type { CompanyProfileData } from '../../company-profile.ts';
import { buildCanonicalCreditAnalysis, CanonicalUnavailable } from './orchestrator.ts';

export type ReportAccess = {row: {payload: string; companyInn: string; ownerEmail?: string}; access: 'owner'|'agent'|'admin'};
export type ReportServiceDependencies = {
  readAccess: (id: string) => Promise<ReportAccess|null>;
  readTier: (id: string, access: ReportAccess) => Promise<'FREE'|'FULL'>;
  includeInputDiagnostics?: boolean;
  readSourceAvailability?: (access: ReportAccess) => Promise<{documents: number; inlineDocuments: number; storedDocuments: number; analysisDocuments: number}|null>;
  readProfile: (inn: string) => Promise<CompanyProfileData|undefined>;
};
export async function loadCanonicalReport(analysisId: string, dependencies: ReportServiceDependencies) {
  // Authorization and entitlement precede JSON parsing, profile access and calculation.
  const access = await dependencies.readAccess(analysisId);
  if (!access) return {status: 'NOT_FOUND' as const};
  const tier = await dependencies.readTier(analysisId, access);
  if (tier !== 'FULL') return {status: 'LOCKED' as const};
  let analysis: AnalysisResult | undefined;
  let companyProfile: CompanyProfileData | undefined;
  let stage = 'SAVED_INPUT';
  try {
    try { analysis = JSON.parse(access.row.payload) as AnalysisResult; } catch { throw new CanonicalUnavailable('SAVED_INPUT', 'INVALID_SAVED_JSON'); }
    if (analysis.id !== analysisId || analysis.companyInn !== access.row.companyInn) throw new CanonicalUnavailable('SAVED_IDENTITY', 'SAVED_IDENTITY_MISMATCH');
    stage = 'PROFILE_READ';
    companyProfile = await dependencies.readProfile(access.row.companyInn);
    stage = 'SOURCES';
    const result = buildCanonicalCreditAnalysis(savedCanonicalInput(analysis,companyProfile));
    // Only the presentation contract leaves this server boundary. Engines, evidence,
    // policy thresholds, raw source fields and the future AI seam stay server-side.
    return {status: 'READY' as const, model: publicCanonicalModel(result.model, result)};
  } catch (error) {
    const details = diagnostic(error instanceof CanonicalUnavailable ? error.stage : stage, error instanceof CanonicalUnavailable ? error.reason : 'UNEXPECTED_FAILURE');
    console.error('canonical_report_unavailable', details);
    let sourceAvailability: Awaited<ReturnType<NonNullable<ReportServiceDependencies['readSourceAvailability']>>> = null;
    if (dependencies.includeInputDiagnostics && dependencies.readSourceAvailability) {
      try { sourceAvailability = await dependencies.readSourceAvailability(access); } catch { /* Unknown availability is never reported as absent. */ }
    }
    return {status: 'UNAVAILABLE' as const, stage: details.stage, diagnostic: details, ...(dependencies.includeInputDiagnostics ? {inputSummary: {...inputSummary(analysis, companyProfile), sourceAvailability}} : {})};
  }
}
