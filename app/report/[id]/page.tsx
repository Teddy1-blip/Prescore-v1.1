import {notFound,redirect} from 'next/navigation';
import {getRuntime} from '../../../lib/platform/runtime';
import {readableAnalysis} from '../../api/api-auth';
import {resolveAnalysisTier} from '../../../lib/entitlements';
import {requireChatGPTUser} from '../../chatgpt-auth';
export const dynamic = "force-dynamic";

type Statement = { bind: (...values: unknown[]) => Statement; first: <T = unknown>() => Promise<T | null>; run: () => Promise<unknown> };
type Database = { prepare: (query: string) => Statement; batch: (statements: Statement[]) => Promise<Array<{ results: unknown[] }>> };
export default async function DynamicReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireChatGPTUser("/dashboard");
  const { id } = await params;
  const env = getRuntime();
  const db = env.DB as unknown as Database;
  const normalizedUser = { email: user.email.toLowerCase(), isAdmin: user.roles.includes("ADMIN") };
  const access = await readableAnalysis<{ payload: string; companyInn: string; ownerEmail: string }>(db, id, normalizedUser);
  if (!access) notFound();
  const row = access.row;
  const tier = await resolveAnalysisTier(db, { analysisId: id, userEmail: row.ownerEmail, companyInn: row.companyInn, privileged: normalizedUser.isAdmin || access.access === "agent" });
  if (tier !== "FULL") redirect(`/checkout?analysisId=${encodeURIComponent(id)}`);
  redirect('/dashboard/report-v2?analysisId='+encodeURIComponent(id)+'&print=1');
}
