import {diagnostic, safeReason, type CanonicalDiagnosticV1} from "../credit-engine/production/diagnostics.ts";
import {savedCanonicalInput} from "./financing-request.ts";
import type { AnalysisResult } from "../prescore.ts";
import type { CompanyProfileData } from "../company-profile.ts";
import type { AnalysisTier } from "../entitlements.ts";
import type { ClientReportModelV1 } from "../credit-engine/contracts/client-report.ts";
import { buildCanonicalCreditAnalysis, CanonicalUnavailable } from "../credit-engine/production/orchestrator.ts";
import { publicCanonicalModel } from "../credit-engine/production/public-model.ts";
import type { ReportAccess } from "../credit-engine/production/report-service.ts";
import { projectWorkspaceBasic, WORKSPACE_MODEL_V1, type WorkspaceAccessRoleV1, type WorkspaceModelV1, type WorkspaceOperationalInput } from "./model.ts";

export type WorkspaceServiceDependencies = {
  readAccess: (analysisId: string) => Promise<ReportAccess | null>;
  readTier: (analysisId: string, access: ReportAccess) => Promise<AnalysisTier>;
  readProfile: (companyInn: string) => Promise<CompanyProfileData | undefined>;
  readOperations: (analysisId: string, access: ReportAccess) => Promise<WorkspaceOperationalInput>;
};

function accessRole(access: ReportAccess["access"]): WorkspaceAccessRoleV1 {
  if (access === "agent") return "ASSIGNED_BROKER";
  if (access === "admin") return "ADMIN";
  return "OWNER";
}

function parseSavedAnalysis(access: ReportAccess, analysisId: string): AnalysisResult {
  let value: unknown;
  try { value = JSON.parse(access.row.payload); }
  catch { throw new CanonicalUnavailable("SAVED_INPUT", "INVALID_SAVED_JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CanonicalUnavailable("SAVED_INPUT", "INVALID_SAVED_SHAPE");
  }
  const analysis = value as Partial<AnalysisResult>;
  if (analysis.id !== analysisId || analysis.companyInn !== access.row.companyInn) {
    throw new CanonicalUnavailable("SAVED_IDENTITY", "SAVED_IDENTITY_MISMATCH");
  }
  if (typeof analysis.companyName !== "string" || typeof analysis.periodFrom !== "string" ||
      typeof analysis.periodTo !== "string" || typeof analysis.createdAt !== "string") {
    throw new CanonicalUnavailable("SAVED_INPUT", "INVALID_SAVED_SHAPE");
  }
  return analysis as AnalysisResult;
}

function failureDiagnostic(stage: string, error: unknown): CanonicalDiagnosticV1 {
  const details = diagnostic(error instanceof CanonicalUnavailable ? error.stage : stage,
    error instanceof CanonicalUnavailable ? error.reason : safeReason(error));
  // Log only allowlisted metadata. Never log payloads, thrown messages or stacks.
  console.error("workspace_model_unavailable", details);
  return details;
}

function unknownOperations(): WorkspaceOperationalInput {
  return {
    documents: { status: "UNKNOWN", count: null, analysisCount: null },
    applications: { status: "UNKNOWN", count: null, activeCount: null, statuses: null },
  };
}

export async function loadWorkspaceModelV1(analysisId: string, dependencies: WorkspaceServiceDependencies): Promise<WorkspaceModelV1 | { version: typeof WORKSPACE_MODEL_V1; state: "NOT_FOUND" | "UNAVAILABLE"; analysisId: string; diagnostic?: CanonicalDiagnosticV1 }> {
  const access = await dependencies.readAccess(analysisId);
  if (!access) return { version: WORKSPACE_MODEL_V1, state: "NOT_FOUND", analysisId };
  let analysis: AnalysisResult;
  try { analysis = parseSavedAnalysis(access, analysisId); }
  catch (error) {
    return { version: WORKSPACE_MODEL_V1, state: "UNAVAILABLE", analysisId,
      diagnostic: failureDiagnostic("SAVED_INPUT", error) };
  }

  let tier: AnalysisTier = "FREE";
  let entitlementDiagnostic: CanonicalDiagnosticV1 | undefined;
  try { tier = await dependencies.readTier(analysisId, access); }
  catch (error) { entitlementDiagnostic = failureDiagnostic("ENTITLEMENT_READ", error); }

  let operations = unknownOperations();
  try { operations = await dependencies.readOperations(analysisId, access); } catch { /* Unknown operational state is not an empty state. */ }
  let basic: ReturnType<typeof projectWorkspaceBasic>;
  try { basic = projectWorkspaceBasic(analysis, operations); }
  catch (error) {
    return { version: WORKSPACE_MODEL_V1, state: "UNAVAILABLE", analysisId,
      diagnostic: failureDiagnostic("BASIC_PROJECTION", error) };
  }
  const base = {
    version: WORKSPACE_MODEL_V1 as typeof WORKSPACE_MODEL_V1,
    analysisId,
    access: { role: accessRole(access.access), readOnly: access.access === "agent" },
    entitlement: tier === "FULL" ? "FULL" as const : "BASIC" as const,
    basic,
  };

  if (entitlementDiagnostic) {
    return { ...base, state: "READY_BASIC", fullAvailability: "UNAVAILABLE",
      limitations: { code: "CANONICAL_REPORT_UNAVAILABLE" }, diagnostic: entitlementDiagnostic };
  }
  if (tier !== "FULL") {
    // A saved bank analysis without metrics is a processing problem, not a paid feature.
    // No FULL engine or provider is invoked to diagnose this structural BASIC input.
    const missingBankMetrics = !analysis.metricsV2;
    return { ...base, state: "READY_BASIC", fullAvailability: "LOCKED",
      ...(missingBankMetrics ? { diagnostic: diagnostic("BANK_METRICS_REQUIRED", "BANK_METRICS_MISSING") } : {}) };
  }

  let stage = "PROFILE_READ";
  try {
    const companyProfile = await dependencies.readProfile(analysis.companyInn);
    stage = "SOURCES";
    const canonical = buildCanonicalCreditAnalysis(savedCanonicalInput(analysis,companyProfile));
    stage = "PUBLIC_MODEL";
    const report: ClientReportModelV1 = publicCanonicalModel(canonical.model, canonical);
    return {
      ...base,
      // Publish the same source set that the canonical calculation actually read,
      // including cached company BFO. The saved bank-only manifest is not enough.
      basic: { ...basic, sources: { ...basic.sources, availability:
        [...new Map(canonical.sourceObservations.map(source => [source.sourceId, source])).values()].map(source => ({
          source: source.sourceId.startsWith("client-request-") ? "CLIENT_DECLARATION" :
            ({ BANK_STATEMENT: "BANK_STATEMENTS", BFO: "FINANCIAL_STATEMENTS", QUARTERLY: "QUARTERLY_REPORT", BKI: "CREDIT_HISTORY" } as Record<string,string>)[source.sourceType] ?? "EXTERNAL_SOURCE",
          status: source.status, periodFrom: source.periodFrom, periodTo: source.periodTo,
          // FULL rebuilds this list; retain validated metadata only for the same saved BKI source.
          ...(source.sourceType === "BKI" ? { reportDate:
            source.sourceId === analysis.sourceManifest?.bki?.sourceId
              ? basic.sources.availability.find(item => item.source === "CREDIT_HISTORY")?.reportDate ?? null
              : null,
          } : {}),
        }))
      } },
      state: "READY_FULL",
      fullAvailability: "READY",
      full: {
        report,
        canonical: {
          prescoreIndex: canonical.prescoreIndex,
          financingReadiness: canonical.financingReadiness,
          creditAssessment: canonical.creditAssessment,
          debtCapacity: canonical.debtCapacity,
          productSelection: canonical.productSelection,
          recommendations: canonical.recommendationSet,
          actionPlan: canonical.actionPlan,
          explainability: canonical.explainability,
          expertise: report.expertise ?? null,
        },
      },
    };
  } catch (error) {
    return { ...base, state: "READY_BASIC", fullAvailability: "UNAVAILABLE",
      limitations: { code: "CANONICAL_REPORT_UNAVAILABLE" }, diagnostic: failureDiagnostic(stage, error) };
  }
}

type WorkspaceOperationsDatabase = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<{ results?: T[] }>;
    };
  };
};

export async function readWorkspaceOperations(
  db: WorkspaceOperationsDatabase,
  analysisId: string,
  companyInn: string,
  user: { email: string; isAdmin: boolean },
): Promise<WorkspaceOperationalInput> {
  const unknown = unknownOperations();
  let documents = unknown.documents;
  try {
    const row = await db.prepare(`SELECT COUNT(*) AS count,
      COALESCE(SUM(CASE WHEN d.analysis_id = ? THEN 1 ELSE 0 END), 0) AS analysis_count
      FROM client_documents d WHERE d.company_inn = ? AND
      (? = 1 OR d.owner_email = ? OR EXISTS
      (SELECT 1 FROM agent_leads l JOIN agent_accounts u ON u.agent_code = l.agent_code
       WHERE l.company_inn = d.company_inn AND u.user_email = ?))`)
      .bind(analysisId, companyInn, user.isAdmin ? 1 : 0, user.email, user.email)
      .first<{ count: number | string; analysis_count: number | string }>();
    if (row) {
      const count = Number(row.count), analysisCount = Number(row.analysis_count);
      if (Number.isSafeInteger(count) && Number.isSafeInteger(analysisCount)) documents = {
        status: count ? "AVAILABLE" : "NONE",
        count,
        analysisCount,
      };
    }
  } catch { /* An unavailable documents table remains UNKNOWN. */ }

  let applications = unknown.applications;
  try {
    const rows = await db.prepare(`SELECT id, status, 'deal' AS source FROM deals WHERE analysis_id = ?
      UNION ALL SELECT id, status, 'agent' AS source FROM agent_applications WHERE analysis_id = ?`)
      .bind(analysisId, analysisId).all<{ id: string; status: string; source: "deal" | "agent" }>();
    if (rows.results) {
      // One logical application per ID; the client-facing deal status wins,
      // regardless of database row order. Agent-only applications are retained.
      const logical = new Map<string, { status: string; source: "deal" | "agent" }>();
      for (const row of rows.results) {
        if (!logical.has(row.id) || row.source === "deal") logical.set(row.id, row);
      }
      const counts = new Map<string, number>();
      for (const row of logical.values()) {
        const status = String(row.status ?? "");
        if (status) counts.set(status, (counts.get(status) ?? 0) + 1);
      }
      const statuses = [...counts].map(([status, count]) => ({ status, count })).sort((a, b) => a.status.localeCompare(b.status, "ru"));
      const count = logical.size;
      const activeStatuses=new Set(['Новая','Черновик','Подготовка','Подготовка заявки','Подготовка документов','Требуются документы','Отправлена в банк','На рассмотрении у финансового партнёра','Предварительное решение','Одобрена']);
      const terminalStatuses=new Set(['Выдана','Отклонена','Закрыта','Отменена клиентом']);
      const known=[...logical.values()].every(row=>activeStatuses.has(row.status)||terminalStatuses.has(row.status));
      const activeCount=known?[...logical.values()].filter(row=>activeStatuses.has(row.status)).length:null;
      applications = { status: count ? "AVAILABLE" : "NONE", count, activeCount, statuses };
    }
  } catch { /* Missing operational schema stays UNKNOWN and never becomes zero. */ }
  return { documents, applications };
}
