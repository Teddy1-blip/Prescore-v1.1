import { publicCanonicalModel } from './public-model.ts';
import type { AnalysisResult } from '../../prescore.ts';
import type { CompanyProfileData } from '../../company-profile.ts';
import { buildCanonicalCreditAnalysis, CanonicalUnavailable } from './orchestrator.ts';

export type ReportAccess = {row: {payload: string; companyInn: string; ownerEmail?: string}; access: 'owner'|'agent'|'admin'};
export type ReportServiceDependencies = {
  readAccess: (id: string) => Promise<ReportAccess|null>;
  readTier: (id: string, access: ReportAccess) => Promise<'FREE'|'FULL'>;
  readProfile: (inn: string) => Promise<CompanyProfileData|undefined>;
};
export async function loadCanonicalReport(analysisId: string, dependencies: ReportServiceDependencies) {
  // Authorization and entitlement precede JSON parsing, profile access and calculation.
  const access = await dependencies.readAccess(analysisId);
  if (!access) return {status: 'NOT_FOUND' as const};
  const tier = await dependencies.readTier(analysisId, access);
  if (tier !== 'FULL') return {status: 'LOCKED' as const};
  try {
    const analysis = JSON.parse(access.row.payload) as AnalysisResult;
    if (analysis.id !== analysisId || analysis.companyInn !== access.row.companyInn) throw new CanonicalUnavailable('SAVED_IDENTITY');
    const companyProfile = await dependencies.readProfile(access.row.companyInn);
    const result = buildCanonicalCreditAnalysis({analysis, companyProfile});
    // Only the presentation contract leaves this server boundary. Engines, evidence,
    // policy thresholds, raw source fields and the future AI seam stay server-side.
    return {status: 'READY' as const, model: publicCanonicalModel(result.model)};
  } catch (error) {
    return {status: 'UNAVAILABLE' as const, stage: error instanceof CanonicalUnavailable ? error.stage : 'SAVED_INPUT'};
  }
}
