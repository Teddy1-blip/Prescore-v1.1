import {getRuntime} from "../../../lib/platform/runtime";
import { evaluateBankRoutes, type BankRoute } from "../../../lib/bank-offers";
import { buildUnifiedRiskContext } from "../../../lib/risk-context";
import type { AnalysisResult } from "../../../lib/prescore";
import type { CompanyProfileData } from "../../../lib/company-profile";
import type { FinancingNeed, FundingKind } from "../../../lib/financing-types";
import { productTermsDate } from "../../../lib/financing-offers";
import { applyAnalysisControls, filterOfferProducts, readControlState } from "../../../lib/admin-controls";
import { readableAnalysis, requireApiUser, unauthorized } from "../api-auth";
import { resolveAnalysisTier } from "../../../lib/entitlements";

type Statement = { bind: (...values: unknown[]) => Statement; first: <T = unknown>() => Promise<T | null>; run: () => Promise<unknown> };
type Database = { prepare: (query: string) => Statement; batch: (statements: Statement[]) => Promise<Array<{ results: unknown[] }>> };
const allowedNeeds = new Set<FinancingNeed>(["auto", "working-capital", "staged-limit", "cash-gap", "receivables", "government-contract", "marketplace", "equipment", "refinance", "secured"]);

function chooseRoutes(routes: BankRoute[], need: FinancingNeed) {
  const statusWeight = { go: 0, conditional: 10, stop: 100 } as const;
  const kindWeight: Record<FundingKind, number> = { bank: 0, factoring: 1, seller: 1, leasing: 1, mfo: 4, "secured-personal": 8 };
  const ranked = [...routes].sort((a, b) => statusWeight[a.status] - statusWeight[b.status] || Number(b.existingRelationship) - Number(a.existingRelationship) || kindWeight[a.kind] - kindWeight[b.kind] || b.amount - a.amount);
  if (need !== "auto") return ranked.slice(0, 3);
  const selected: BankRoute[] = [];
  for (const route of ranked) {
    if (selected.length >= 3) break;
    if (selected.some((item) => item.bank === route.bank)) continue;
    if (selected.length && selected.some((item) => item.kind === route.kind) && ranked.some((item) => !selected.some((current) => current.kind === item.kind) && item.status !== "stop")) continue;
    selected.push(route);
  }
  for (const route of ranked) if (selected.length < 3 && !selected.some((item) => item.id === route.id)) selected.push(route);
  return selected;
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const url = new URL(request.url);
  const analysisId = url.searchParams.get("analysisId") || "";
  const rawNeed = (url.searchParams.get("need") || "auto") as FinancingNeed;
  const need = allowedNeeds.has(rawNeed) ? rawNeed : "auto";
  if (!analysisId) return Response.json({ error: "Не указан анализ" }, { status: 400 });
  try {
    const env = getRuntime();
    const db = env.DB as unknown as Database;
    const access = await readableAnalysis<{ payload: string; companyInn: string; ownerEmail: string }>(db, analysisId, user);
    if (!access) return Response.json({ error: "Анализ не найден в вашем кабинете" }, { status: 404 });
    const row = access.row;
    const tier = await resolveAnalysisTier(db, { analysisId, userEmail: row.ownerEmail, companyInn: row.companyInn, privileged: user.isAdmin || access.access === "agent" });
    if (tier !== "FULL") return Response.json({ error: "Персональная карта финансирования доступна в Prescore Full", locked: true, tier }, { status: 403 });
    const controls = await readControlState(db);
    const profileRow = await db.prepare("SELECT payload FROM checko_profiles WHERE inn = ? LIMIT 1").bind(row.companyInn).first<{ payload: string }>();
    const analysis = applyAnalysisControls(JSON.parse(row.payload) as AnalysisResult, controls);
    const profile = profileRow ? JSON.parse(profileRow.payload) as CompanyProfileData : null;
    const evaluated = evaluateBankRoutes(analysis, profile, need);
    const risk = profile ? buildUnifiedRiskContext(profile, analysis, controls) : null;
    const blocked = Boolean(risk?.finalConclusion.hardStop);
    const controlledRoutes = evaluated.routes.map((route) => filterOfferProducts(route, controls)).filter((route): route is BankRoute => Boolean(route));
    const routes = blocked ? [] : chooseRoutes(controlledRoutes, need);
    return Response.json({ ...evaluated, routes, fullRouteCount: controlledRoutes.length, adminExcludedCount: evaluated.routes.length - controlledRoutes.length, blocked, blockedBy: risk?.globalStops.map((item) => item.title).slice(0, 5) ?? [], termsDate: productTermsDate, riskCode: risk?.finalConclusion.code ?? "PREPARE", readOnly: access.access === "agent" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось подобрать маршруты" }, { status: 500 });
  }
}
