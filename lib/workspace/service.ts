import type { AnalysisResult } from "../prescore.ts";
import type { CompanyProfileData } from "../company-profile.ts";
import type { AnalysisTier } from "../entitlements.ts";
import { diagnostic, safeReason } from "../credit-engine/production/diagnostics.ts";
import { buildCanonicalCreditAnalysis, CanonicalUnavailable } from "../credit-engine/production/orchestrator.ts";
import { publicCanonicalModel } from "../credit-engine/production/public-model.ts";
import { buildWorkspaceBasicV1, WORKSPACE_MODEL_VERSION, type WorkspaceAccessRole, type WorkspaceModelV1 } from "./model.ts";

export type WorkspaceAccess = {
  row: { payload: string; companyInn: string; ownerEmail?: string };
  access: WorkspaceAccessRole;
};

export type WorkspaceServiceDependencies = {
  readAccess: (analysisId: string) => Promise<WorkspaceAccess | null>;
  readTier: (analysisId: string, access: WorkspaceAccess) => Promise<AnalysisTier>;
  readProfile: (companyInn: string) => Promise<CompanyProfileData | undefined>;
};

export type WorkspaceLoadResult =
  | { status: "READY"; model: WorkspaceModelV1 }
  | { status: "NOT_FOUND" }
  | { status: "UNAVAILABLE"; diagnostic: ReturnType<typeof diagnostic> };

export async function loadWorkspaceModel(
  analysisId: string,
  dependencies: WorkspaceServiceDependencies,
): Promise<WorkspaceLoadResult> {
  const access = await dependencies.readAccess(analysisId);
  if (!access) return { status: "NOT_FOUND" };

  let analysis: AnalysisResult;
  try {
    analysis = JSON.parse(access.row.payload) as AnalysisResult;
  } catch {
    return { status: "UNAVAILABLE", diagnostic: diagnostic("SAVED_INPUT", "INVALID_SAVED_JSON") };
  }
  if (analysis.id !== analysisId || analysis.companyInn !== access.row.companyInn) {
    return { status: "UNAVAILABLE", diagnostic: diagnostic("SAVED_IDENTITY", "SAVED_IDENTITY_MISMATCH") };
  }

  const tier = await dependencies.readTier(analysisId, access);
  const basic = buildWorkspaceBasicV1(analysis);

  let full: WorkspaceModelV1["full"] = { status: "LOCKED" };
  if (tier === "FULL") {
    let stage = "PROFILE_READ";
    try {
      const companyProfile = await dependencies.readProfile(analysis.companyInn);
      stage = "SOURCES";
      const result = buildCanonicalCreditAnalysis({ analysis, companyProfile });
      full = { status: "READY", model: publicCanonicalModel(result.model, result) };
    } catch (error) {
      const canonical = error instanceof CanonicalUnavailable ? error : null;
      full = {
        status: "UNAVAILABLE",
        diagnostic: diagnostic(canonical?.stage ?? stage, canonical?.reason ?? safeReason(error)),
      };
    }
  }

  return {
    status: "READY",
    model: {
      version: WORKSPACE_MODEL_VERSION,
      analysisId,
      tier,
      accessRole: access.access,
      readOnly: access.access === "agent",
      basic,
      full,
    },
  };
}
