import { getChatGPTUser } from "../chatgpt-auth";

export const ADMIN_EMAIL = "dorogovab@gmail.com";

export async function requireApiUser() {
  const user = await getChatGPTUser();
  if (!user?.email) return null;
  return { ...user, email: user.email.trim().toLowerCase(), isAdmin: user.email.trim().toLowerCase() === ADMIN_EMAIL };
}

export function unauthorized() {
  return Response.json({ error: "Требуется вход в защищённый кабинет" }, { status: 401 });
}

type AnalysisStatement = { bind: (...values: unknown[]) => AnalysisStatement; first: <T = unknown>() => Promise<T | null> };
type AnalysisDatabase = { prepare: (query: string) => AnalysisStatement };
export type AnalysisAccessRow = { payload: string; companyInn: string; ownerEmail?: string };

export async function readableAnalysis<T extends AnalysisAccessRow = AnalysisAccessRow>(database: AnalysisDatabase, analysisId: string, user: { email: string; isAdmin: boolean }) {
  const ownerQuery = user.isAdmin
    ? "SELECT payload, company_inn AS companyInn, owner_email AS ownerEmail FROM analyses WHERE id = ? LIMIT 1"
    : "SELECT payload, company_inn AS companyInn, owner_email AS ownerEmail FROM analyses WHERE id = ? AND owner_email = ? LIMIT 1";
  const owned = await database.prepare(ownerQuery).bind(...(user.isAdmin ? [analysisId] : [analysisId, user.email])).first<T>();
  if (owned) return { row: owned, access: user.isAdmin && owned.ownerEmail !== user.email ? "admin" as const : "owner" as const };
  try {
    const assigned = await database.prepare(`SELECT a.payload, a.company_inn AS companyInn, a.owner_email AS ownerEmail
      FROM analyses a
      JOIN agent_leads l ON l.company_inn = a.company_inn
      JOIN agent_accounts aa ON aa.agent_code = l.agent_code
      WHERE a.id = ? AND aa.user_email = ?
      ORDER BY l.updated_at DESC LIMIT 1`).bind(analysisId, user.email).first<T>();
    return assigned ? { row: assigned, access: "agent" as const } : null;
  } catch {
    return null;
  }
}
