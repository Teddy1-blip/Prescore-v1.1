import {cachedProfile} from "../../../lib/external/checko-profile";
import {safeErrorText} from '../../../lib/release/security';
import {getRuntime} from "../../../lib/platform/runtime";
import { buildRiskShadow } from "../../../lib/credit-engine/risk/integration";
import { buildUnifiedRiskContext } from "../../../lib/risk-context";
import type { AnalysisResult } from "../../../lib/prescore";
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
    const env = getRuntime();
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
    const profile = cachedProfile(profileRow.payload,analysisRow.companyInn);
    if (!profile) return Response.json({error:"Подтверждённый профиль недоступен"},{status:409});
    const reconciliation = reconciliationForAnalysis(analysis, profile);
    const asOfDate = [analysis.periodTo, profile.fetchedAt?.slice(0, 10) ?? "", analysis.creditHistory?.reportDate ?? ""].filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1) ?? "";
    const risk = buildRiskShadow({ analysis: { ...analysis, ...reconciliation }, companyProfile: profile, asOfDate });
    return Response.json({ ...buildUnifiedRiskContext(profile, analysis, controls), ...reconciliation, ...risk, readOnly: access.access === "agent" });
  } catch (error) {
    return Response.json({ error: safeErrorText(error, "Не удалось сформировать единое заключение") }, { status: 500 });
  }
}
