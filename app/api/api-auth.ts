import { dossierAuthorizationSQL } from '../../lib/auth/broker-authorizations';
import { getChatGPTUser } from "../chatgpt-auth";



export async function requireApiUser() {
  const user = await getChatGPTUser();
  if (!user?.email) return null;
  return { ...user, email: user.email.trim().toLowerCase(), isAdmin: user.roles.includes("ADMIN") };
}

export function unauthorized() {
  return Response.json({ error: "Требуется вход в защищённый кабинет" }, { status: 401 });
}

type AnalysisStatement = { bind: (...values: unknown[]) => AnalysisStatement; first: <T = unknown>() => Promise<T | null> };
type AnalysisDatabase = { prepare: (query: string) => AnalysisStatement };
export type AnalysisAccessRow = { payload: string; companyInn: string; ownerEmail?: string };

export async function readableAnalysis<T extends AnalysisAccessRow = AnalysisAccessRow>(database: AnalysisDatabase, analysisId: string, user: { email: string; isAdmin: boolean }, includeArchived = false) {
  const archiveFilter = includeArchived && user.isAdmin ? "1=1" : "archive_state = 'ACTIVE'";
  const ownerQuery = user.isAdmin
    ? `SELECT payload, company_inn AS companyInn, owner_email AS ownerEmail FROM analyses WHERE ${archiveFilter} AND id = ? LIMIT 1`
    : "SELECT payload, company_inn AS companyInn, owner_email AS ownerEmail FROM analyses WHERE archive_state = 'ACTIVE' AND id = ? AND owner_email = ? LIMIT 1";
  const owned = await database.prepare(ownerQuery).bind(...(user.isAdmin ? [analysisId] : [analysisId, user.email])).first<T>();
  if (owned) return { row: owned, access: user.isAdmin && owned.ownerEmail !== user.email ? "admin" as const : "owner" as const };
  try {
    const assigned = await database.prepare(`SELECT a.payload, a.company_inn AS companyInn, a.owner_email AS ownerEmail
      FROM analyses a
      WHERE a.archive_state = 'ACTIVE' AND a.id = ? AND ${dossierAuthorizationSQL('a')} LIMIT 1`).bind(analysisId, user.email).first<T>();
    return assigned ? { row: assigned, access: "agent" as const } : null;
  } catch {
    return null;
  }
}
