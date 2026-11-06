import { getRuntime } from "../../../lib/platform/runtime";
import { resolveAnalysisTier, type EntitlementDatabase } from "../../../lib/entitlements";
import type { CompanyProfileData } from "../../../lib/company-profile";
import { loadWorkspaceModelV1, parseSavedAnalysis, readWorkspaceOperations, type WorkspaceServiceDependencies } from "../../../lib/workspace/service.ts";
import { readableAnalysis, requireApiUser } from "../api-auth";

import {cashEvidence} from "../../../lib/workspace/cash-evidence.ts";
import {isCashSeries} from "../../../lib/workspace/cash-series.ts";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie, Authorization",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStoreHeaders });
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return json({ error: "Требуется вход в защищённый кабинет" }, 401);

  const params = new URL(request.url).searchParams;
  const analysisId = params.get("analysisId")?.trim();
  if (!analysisId || analysisId.length > 180) return json({ error: "Укажите корректную версию анализа" }, 400);

  try {
    const db = getRuntime().DB as unknown as EntitlementDatabase & {
      prepare: (query: string) => {
        bind: (...values: unknown[]) => {
          first: <T = unknown>() => Promise<T | null>;
          all: <T = unknown>() => Promise<{ results?: T[] }>;
        };
      };
    };
    const dependencies: WorkspaceServiceDependencies = {
      readAccess: (id) => readableAnalysis(db, id, user, user.isAdmin && new URL(request.url).pathname === '/api/admin' && new URL(request.url).searchParams.get('archive') === 'archived'),
      readTier: (id, access) => resolveAnalysisTier(db, {
        analysisId: id,
        userEmail: access.row.ownerEmail ?? user.email,
        companyInn: access.row.companyInn,
        privileged: user.isAdmin || access.access === "agent",
        readOnly: true,
      }),
      readProfile: async (inn) => {
        const row = await db.prepare("SELECT payload FROM checko_profiles WHERE inn = ? LIMIT 1").bind(inn).first<{ payload: string }>();
        if (!row) return undefined;
        try { return JSON.parse(row.payload) as CompanyProfileData; } catch { return undefined; }
      },
      readOperations: (id, access) => readWorkspaceOperations(db, id, access.row.companyInn, user),
    };
    if (params.get("projection") === "cash-operations") {
      const month = params.get("month") ?? "";
      const series = params.get("series");
      const offset = Number(params.get("offset") ?? 0);
      if ((month!=="all" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) || !isCashSeries(series) || !Number.isSafeInteger(offset) || offset < 0) {
        return json({error: "Некорректный период или показатель."}, 400);
      }
      const access = await dependencies.readAccess(analysisId);
      if (!access) return json({error: "Анализ недоступен."}, 404);
      if (await dependencies.readTier(analysisId, access) !== "FULL") {
        return json({error: "Детализация операций доступна в полном анализе."}, 403);
      }
      const result = cashEvidence(parseSavedAnalysis(access, analysisId), month, series, offset);
      return json(result.body, result.status);
    }
    const workspace = await loadWorkspaceModelV1(analysisId, dependencies);
    if (workspace.state === "NOT_FOUND") return json(workspace, 404);
    if (workspace.state === "UNAVAILABLE") return json(workspace, 503);
    return json(workspace);
  } catch {
    return json({ version: "PRESCORE-WORKSPACE-MODEL-1.0.0", state: "UNAVAILABLE", analysisId }, 503);
  }
}
