import {configuredProvider, generateWithFallback, minimizeQuestion} from "../../../lib/ai/providers";
import {getRuntime} from "../../../lib/platform/runtime";
import type { AnalysisResult } from "../../../lib/prescore";
import type { CompanyProfileData } from "../../../lib/company-profile";
import { buildUnifiedRiskContext } from "../../../lib/risk-context";
import { AI_ANALYST_PROMPT_VERSION, AI_ANALYST_SYSTEM_PROMPT, buildLocalAnalystAnswer, buildSanitizedCreditContext } from "../../../lib/ai-credit-analyst";
import { applyAnalysisControls, readControlState } from "../../../lib/admin-controls";
import { readableAnalysis, requireApiUser, unauthorized } from "../api-auth";
import { resolveAnalysisTier } from "../../../lib/entitlements";

type Statement = { bind: (...values: unknown[]) => Statement; first: <T = unknown>() => Promise<T | null>; all: <T = unknown>() => Promise<{ results?: T[] }>; run: () => Promise<unknown> };
type Database = { prepare: (query: string) => Statement; batch: (statements: Statement[]) => Promise<Array<{ results: unknown[] }>> };
type AiMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string };

const DEFAULT_DAILY_LIMIT = 30;
const DEFAULT_MINUTE_LIMIT = 5;

async function runtime() {
  const env = getRuntime();
  const values = env as unknown as Record<string, unknown>;
  return {
    db: env.DB as unknown as Database,
    apiKey: String(values.DEEPSEEK_API_KEY ?? ""),
    model: String(values.DEEPSEEK_MODEL ?? ""),
    baseUrl: String(values.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"),
    dailyLimit: Number(values.AI_QUESTIONS_PER_DAY ?? DEFAULT_DAILY_LIMIT),
    minuteLimit: Number(values.AI_QUESTIONS_PER_MINUTE ?? DEFAULT_MINUTE_LIMIT),
  };
}

async function ensureSchema(db: Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL, owner_email TEXT NOT NULL,
    analysis_version TEXT NOT NULL, prompt_version TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(analysis_id, owner_email)
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL,
    content TEXT NOT NULL, created_at TEXT NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS ai_usage (
    id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, owner_email TEXT NOT NULL,
    provider TEXT NOT NULL, model TEXT NOT NULL, input_tokens INTEGER,
    output_tokens INTEGER, latency_ms INTEGER NOT NULL, success INTEGER NOT NULL,
    error_type TEXT, created_at TEXT NOT NULL
  )`).run();
}

async function ownedContext(db: Database, analysisId: string, user: { email: string; isAdmin: boolean }) {
  const access = await readableAnalysis<{ payload: string; companyInn: string; ownerEmail: string }>(db, analysisId, user);
  if (!access) return null;
  const row = access.row;
  const tier = await resolveAnalysisTier(db, { analysisId, userEmail: row.ownerEmail, companyInn: row.companyInn, privileged: user.isAdmin || access.access === "agent" });
  if (tier !== "FULL") return { locked: true as const };
  const profile = await db.prepare("SELECT payload FROM checko_profiles WHERE inn = ? LIMIT 1").bind(row.companyInn).first<{ payload: string }>();
  if (!profile) return null;
  const controls = await readControlState(db);
  const analysis = applyAnalysisControls(JSON.parse(row.payload) as AnalysisResult, controls);
  const company = JSON.parse(profile.payload) as CompanyProfileData;
  return { locked: false as const, analysis, company, risk: buildUnifiedRiskContext(company, analysis, controls) };
}

function publicMessage(row: AiMessage) {
  return { id: row.id, role: row.role, content: row.content, createdAt: row.createdAt };
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const analysisId = new URL(request.url).searchParams.get("analysisId") || "";
  try {
    const { db, apiKey, model } = await runtime();
    await ensureSchema(db);
    const source = await ownedContext(db, analysisId, user);
    if (!source) return Response.json({ error: "Анализ не найден в вашем кабинете" }, { status: 404 });
    if (source.locked) return Response.json({ error: "Кредитный аналитик доступен в Prescore Full", locked: true, tier: "FREE" }, { status: 403 });
    const conversationId = `${analysisId}:${user.email}`;
    const rows = await db.prepare("SELECT id, role, content, created_at AS createdAt FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 40").bind(conversationId).all<AiMessage>();
    return Response.json({ available: true, providerConnected: Boolean(apiKey && model), mode: apiKey && model ? "provider" : "rules", messages: (rows.results ?? []).map(publicMessage), promptVersion: AI_ANALYST_PROMPT_VERSION });
  } catch {
    return Response.json({ error: "Кредитный аналитик временно недоступен. Сам анализ сохранён и доступен." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const started = Date.now();
  let conversationId = "";
  let runtimeValues: Awaited<ReturnType<typeof runtime>> | null = null;
  try {
    const body = await request.json() as { analysisId?: string; question?: string };
    const analysisId = String(body.analysisId ?? "");
    const question = String(body.question ?? "").trim();
    if (!analysisId || question.length < 3 || question.length > 1200) return Response.json({ error: "Введите вопрос от 3 до 1200 символов" }, { status: 400 });
    runtimeValues = await runtime();
    const { db, model, dailyLimit, minuteLimit } = runtimeValues;
    await ensureSchema(db);
    const source = await ownedContext(db, analysisId, user);
    if (!source) return Response.json({ error: "Анализ не найден в вашем кабинете" }, { status: 404 });
    if (source.locked) return Response.json({ error: "Кредитный аналитик доступен в Prescore Full", locked: true, tier: "FREE" }, { status: 403 });
    conversationId = `${analysisId}:${user.email}`;
    const now = new Date().toISOString();
    const sinceMinute = new Date(Date.now() - 60_000).toISOString();
    const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const minute = await db.prepare("SELECT COUNT(*) AS count FROM ai_usage WHERE owner_email = ? AND created_at >= ?").bind(user.email, sinceMinute).first<{ count: number }>();
    const day = await db.prepare("SELECT COUNT(*) AS count FROM ai_usage WHERE owner_email = ? AND created_at >= ?").bind(user.email, sinceDay).first<{ count: number }>();
    if ((minute?.count ?? 0) >= minuteLimit || (day?.count ?? 0) >= dailyLimit) return Response.json({ error: "Лимит вопросов временно исчерпан. Попробуйте позже." }, { status: 429 });

    await db.prepare(`INSERT INTO ai_conversations (id, analysis_id, owner_email, analysis_version, prompt_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET analysis_version = excluded.analysis_version, prompt_version = excluded.prompt_version, updated_at = excluded.updated_at`)
      .bind(conversationId, analysisId, user.email, source.analysis.methodologyVersion || "PRESCORE-CORE-2026.08", AI_ANALYST_PROMPT_VERSION, now, now).run();
    const history = await db.prepare("SELECT id, role, content, created_at AS createdAt FROM ai_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 8").bind(conversationId).all<AiMessage>();
    const providerQuestion = minimizeQuestion(question);
    const {analysis_id: omittedAnalysisId, ...sanitized} = buildSanitizedCreditContext(providerQuestion, source.analysis, source.company, source.risk);
    void omittedAnalysisId; // Never transmit internal analysis identity to a provider.
    const generated = await generateWithFallback(configuredProvider(), [
      {role: "system", content: AI_ANALYST_SYSTEM_PROMPT},
      {role: "system", content: `Текущий SanitizedCreditContext:\n${JSON.stringify(sanitized)}`},
      ...(history.results ?? []).reverse().map(item => ({role: item.role, content: minimizeQuestion(item.content)})),
      {role: "user", content: providerQuestion},
    ], () => buildLocalAnalystAnswer(question, source.analysis, source.risk));
    const answer = generated.text;
    const userId = crypto.randomUUID(); const answerId = crypto.randomUUID();
    await db.prepare("INSERT INTO ai_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)").bind(userId, conversationId, question, now).run();
    await db.prepare("INSERT INTO ai_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)").bind(answerId, conversationId, answer, new Date().toISOString()).run();
    await db.prepare("INSERT INTO ai_usage (id, conversation_id, owner_email, provider, model, input_tokens, output_tokens, latency_ms, success, error_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), conversationId, user.email, generated.mode === "provider" ? "deepseek" : "local-rules", generated.mode === "provider" ? model : "deterministic", generated.inputTokens, generated.outputTokens, Date.now() - started, generated.failure ? 0 : 1, generated.failure, new Date().toISOString()).run();
    return Response.json({ message: publicMessage({ id: answerId, role: "assistant", content: answer, createdAt: new Date().toISOString() }), mode: generated.mode });
  } catch {
    if (runtimeValues && conversationId) {
      try { await runtimeValues.db.prepare("INSERT INTO ai_usage (id, conversation_id, owner_email, provider, model, latency_ms, success, error_type, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)").bind(crypto.randomUUID(), conversationId, user.email, "deepseek", runtimeValues.model || "not-configured", Date.now() - started, "AI_REQUEST_FAILED", new Date().toISOString()).run(); } catch { /* metadata logging must not mask the user-safe error */ }
    }
    return Response.json({ error: "Кредитный аналитик временно перегружен. Попробуйте повторить вопрос. Сам анализ Prescore сохранён и доступен." }, { status: 503 });
  }
}
