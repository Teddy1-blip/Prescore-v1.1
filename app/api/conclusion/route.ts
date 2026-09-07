import { buildUnifiedRiskContext } from "../../../lib/risk-context";
import type { AnalysisResult } from "../../../lib/prescore";
import type { CompanyProfileData } from "../../../lib/company-profile";
import { reconciliationForAnalysis } from "../../../lib/credit-engine/reconciliation/integration";
import { applyAnalysisControls, readControlState } from "../../../lib/admin-controls";
import { readableAnalysis, requireApiUser, unauthorized } from "../api-auth";
import { resolveAnalysisTier } from "../../../lib/entitlements";

type Statement = { bind: (...values: unknown[]) => Statement; first: <T = unknown>() => Promise<T | null>; run: () => Promise<unknown> };
type Database = { prepare: (query: string) => Statement; batch: (statements: Statement[]) => Promise<Array<{ results: unknown[] }>> };

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const analysisId = new URL(request.url).searchParams.get("analysisId") || "";
  if (!analysisId) return Response.json({ error: "Не указан анализ" }, { status: 400 });
  try {
    const { env } = await import("cloudflare:workers");
    const db = env.DB as unknown as Database;
    const access = await readableAnalysis<{ payload: string; companyInn: string; ownerEmail: string }>(db, analysisId, user);
    if (!access) return Response.json({ error: "Анализ не найден в вашем кабинете" }, { status: 404 });
    const analysisRow = access.row;
    const tier = await resolveAnalysisTier(db, { analysisId, userEmail: analysisRow.ownerEmail, companyInn: analysisRow.companyInn, privileged: user.isAdmin || access.access === "agent" });
    if (tier !== "FULL") return Response.json({ error: "Единое кредитное заключение доступно в Prescore Full", locked: true, tier }, { status: 403 });
    const profileRow = await db.prepare("SELECT payload FROM checko_profiles WHERE inn = ? LIMIT 1").bind(analysisRow.companyInn).first<{ payload: string }>();
    if (!profileRow) return Response.json({ error: "Сначала обновите БФО и правовой контур" }, { status: 409 });
    const controls = await readControlState(db);
    const analysis = applyAnalysisControls(JSON.parse(analysisRow.payload) as AnalysisResult, controls);
    const profile = JSON.parse(profileRow.payload) as CompanyProfileData;
    return Response.json({ ...buildUnifiedRiskContext(profile, analysis, controls), ...reconciliationForAnalysis(analysis, profile), readOnly: access.access === "agent" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось сформировать единое заключение" }, { status: 500 });
  }
}
