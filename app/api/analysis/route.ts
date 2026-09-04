import { analysisForStorage, analyzeBankStatements, screenBankStatements, type StatementInput } from "../../../lib/prescore";
import { sha256Hex } from "../../../lib/credit-engine/source-foundation";
import { applyAnalysisControls, readControlState } from "../../../lib/admin-controls";
import { requireApiUser, unauthorized } from "../api-auth";
import { analysisView, ensureFreeEntitlement, grantFullEntitlement, resolveAnalysisTier } from "../../../lib/entitlements";

const MAX_FILES = 30;
const MAX_SOURCE_LENGTH = 60 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json() as { statements?: StatementInput[] };
    const statements = Array.isArray(body.statements) ? body.statements : [];
    if (!statements.length || statements.length > MAX_FILES) return Response.json({ error: "Добавьте от 1 до 30 выписок" }, { status: 400 });
    let totalLength = 0;
    const rawCandidates = statements.map((item, index) => {
      const text = String(item?.text || "");
      const fileName = String(item?.fileName || `statement-${index + 1}.txt`).slice(0, 180);
      totalLength += text.length;
      return { text, fileName };
    });
    if (totalLength > MAX_SOURCE_LENGTH) return Response.json({ error: "Суммарный размер выписок превышает 60 МБ" }, { status: 413 });
    const candidates: StatementInput[] = await Promise.all(rawCandidates.map(async (item) => {
      const contentHash = await sha256Hex(item.text);
      return { ...item, contentHash, sourceId: `statement:${contentHash}` };
    }));
    const screened = screenBankStatements(candidates);
    if (!screened.accepted.length) return Response.json({ error: "Загруженные выписки не распознаны. Отправьте файлы на support@prescore.ru для проверки формата." }, { status: 400 });
    const safeStatements = screened.accepted;
    const rejectedFiles = screened.unrecognizedFiles;
    const result = analyzeBankStatements(safeStatements, { screeningResults: screened.screeningResults });
    const { env } = await import("cloudflare:workers");
    type Statement = { bind: (...values: unknown[]) => Statement; run: () => Promise<unknown>; first: <T = unknown>() => Promise<T | null> };
    const db = env.DB as unknown as { prepare: (query: string) => Statement; batch: (statements: Statement[]) => Promise<Array<{ results: unknown[] }>> };
    await db.prepare(`CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY, company_name TEXT NOT NULL, company_inn TEXT NOT NULL DEFAULT '', file_name TEXT NOT NULL,
      period_from TEXT NOT NULL, period_to TEXT NOT NULL, score INTEGER NOT NULL, grade TEXT NOT NULL,
      readiness TEXT NOT NULL, payload TEXT NOT NULL, owner_email TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();
    try { await db.prepare("ALTER TABLE analyses ADD COLUMN owner_email TEXT NOT NULL DEFAULT ''").run(); } catch { /* already migrated */ }
    const stored = analysisForStorage(result);
    await db.prepare(`INSERT INTO analyses (id, company_name, company_inn, file_name, period_from, period_to, score, grade, readiness, payload, owner_email, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(result.id, result.companyName, result.companyInn, result.fileName, result.periodFrom, result.periodTo, result.score, result.grade, result.readiness, JSON.stringify(stored), user.email, result.createdAt).run();
    await ensureFreeEntitlement(db, result.id, user.email, result.companyInn);
    try {
      const paid = await db.prepare(`SELECT id FROM payment_orders WHERE company_inn = ? AND user_email = ? AND status = 'Оплачен'
        AND (analysis_id = '' OR analysis_id = ?) ORDER BY created_at DESC LIMIT 1`)
        .bind(result.companyInn, user.email, result.id).first<{ id?: string }>();
      if (paid?.id) {
        await grantFullEntitlement(db, { analysisId: result.id, userEmail: user.email, companyInn: result.companyInn, orderId: paid.id, grantedBy: "PAID_ORDER" });
        await db.prepare("UPDATE payment_orders SET analysis_id = ?, updated_at = ? WHERE id = ? AND analysis_id = ''").bind(result.id, new Date().toISOString(), paid.id).run();
      }
    } catch { /* payment schema can be migrated later */ }
    const controls = await readControlState(db);
    const controlled = applyAnalysisControls(result, controls);
    const tier = await resolveAnalysisTier(db, { analysisId: result.id, userEmail: user.email, companyInn: result.companyInn, privileged: user.isAdmin });
    return Response.json({
      analysis: analysisView(controlled, tier),
      processedBy: "server",
      tier,
      rejectedFiles,
      screeningResults: screened.screeningResults,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось выполнить анализ" }, { status: 400 });
  }
}
