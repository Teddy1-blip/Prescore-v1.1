import {cachedProfile} from "../../../lib/external/checko-profile";
import {configuredProvider, generateWithFallback} from "../../../lib/ai/providers";
import {getRuntime} from "../../../lib/platform/runtime";
import { createHash } from "node:crypto";
import { loadWorkspaceModelV1, readWorkspaceOperations } from "../../../lib/workspace/service.ts";
import type { WorkspaceModelV1 } from "../../../lib/workspace/model.ts";
import { AI_ANALYST_PROMPT_VERSION, AI_ANALYST_SYSTEM_PROMPT, ANALYST_QUESTIONS, analystTopic, type CanonicalAnalystContextV1, buildLocalAnalystAnswer, buildSanitizedCreditContext } from "../../../lib/ai-credit-analyst";
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

// Same service and access/entitlement dependencies as the CLIENT workspace route.
async function ownedContext(db: Database, analysisId: string, user: { email: string; isAdmin: boolean }) {
  return loadWorkspaceModelV1(analysisId, {
    readAccess: id => readableAnalysis(db, id, user),
    readTier: (id, access) => resolveAnalysisTier(db, { analysisId:id, userEmail:access.row.ownerEmail ?? user.email, companyInn:access.row.companyInn, privileged:user.isAdmin || access.access === "agent", readOnly:true }),
    readProfile: async inn => {
      const row = await db.prepare("SELECT payload FROM checko_profiles WHERE inn = ? LIMIT 1").bind(inn).first<{payload:string}>();
      if (!row) return undefined;
      try { return cachedProfile(row.payload,inn); } catch { return undefined; }
    },
    readOperations: (id, access) => readWorkspaceOperations(db, id, access.row.companyInn, user),
  });
}
const fullUnavailable = "Полный кредитный анализ временно недоступен. Банковские результаты сохранены.";
function accessError(source: Awaited<ReturnType<typeof ownedContext>>) {
  if(source.state === "NOT_FOUND") return Response.json({error:"Анализ не найден в вашем кабинете"},{status:404});
  if("entitlement" in source && source.entitlement === "BASIC" && source.fullAvailability === "LOCKED") return Response.json({error:"Кредитный аналитик доступен в Prescore Full",locked:true,tier:"FREE"},{status:403});
  if(source.state !== "READY_FULL" || !("full" in source) || !source.full || source.fullAvailability !== "READY" || source.entitlement !== "FULL") return Response.json({error:fullUnavailable},{status:503});
  return null;
}
// Existing message IDs carry a context namespace. Old messages are preserved but cannot
// enter a new context even when requests overlap. No schema change or destructive reset.
function contextVersion(model: WorkspaceModelV1) {
  // Fingerprint the complete canonical snapshot locally, not a question-specific subset.
  // Operational counters are excluded; this digest is never sent to the provider.
  const snapshot = {period:model.basic.analysis.period,sources:model.basic.sources,bankingFacts:model.basic.bankingFacts,full:model.full};
  return "canonical-" + createHash("sha256").update(AI_ANALYST_PROMPT_VERSION+JSON.stringify(snapshot)).digest("hex");
}
export const dynamic = "force-dynamic";

type Evidence = CanonicalAnalystContextV1['explanations'];
function publicMessage(row: AiMessage) {
  if(row.role === "assistant"){
    const saved = JSON.parse(row.content) as {text:string;evidence:Evidence};
    return {...row,content:saved.text,evidence:saved.evidence};
  }
  return row;
}

// A model may prioritize an existing Block 17 claim. Provider prose is never published.
function evidenceChoice(raw:string, count:number): number | null {
  const value:unknown=JSON.parse(raw);
  if (!value || typeof value !== "object" || Object.keys(value).length!==1 || !("firstEvidence" in value)) throw Error("AI_RESPONSE_INVALID");
  const n=value.firstEvidence;
  if(n===null)return null;
  if(typeof n!=="number" || !Number.isSafeInteger(n) || n<0 || n>=count)throw Error("AI_RESPONSE_INVALID");
  return n;
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const analysisId = new URL(request.url).searchParams.get("analysisId") || "";
  try {
    const { db, apiKey, model } = await runtime();
    await ensureSchema(db);
    const source = await ownedContext(db, analysisId, user);
    const denied = accessError(source);
    if (denied) return denied;
    const workspace = source as WorkspaceModelV1;
    const version = contextVersion(workspace);
    const conversationId = `${analysisId}:${user.email}`;
    const rows = await db.prepare("SELECT id, role, content, created_at AS createdAt FROM ai_messages WHERE conversation_id = ? AND id LIKE ? ORDER BY created_at DESC, id DESC LIMIT 40").bind(conversationId, version+":%").all<AiMessage>();
    return Response.json({ available: true, providerConnected: Boolean(apiKey && model), mode: apiKey && model ? "provider" : "rules", version, messages: (rows.results ?? []).reverse().map(publicMessage), promptVersion: AI_ANALYST_PROMPT_VERSION }, { headers: { "Cache-Control":"private, no-store", Vary:"Cookie, Authorization" } });
  } catch {
    return Response.json({ error: "Кредитный аналитик временно недоступен. Сам анализ сохранён и доступен." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const started = Date.now();
  let conversationId = "";
  let usageId = "";
  let runtimeValues: Awaited<ReturnType<typeof runtime>> | null = null;
  try {
    request.signal.throwIfAborted();
    const body = await request.json() as { analysisId?: string; question?: string; version?: string };
    const analysisId = String(body.analysisId ?? "");
    const question = String(body.question ?? "").trim();
    if (!analysisId || question.length < 3 || question.length > 1200) return Response.json({ error: "Введите вопрос от 3 до 1200 символов" }, { status: 400 });
    runtimeValues = await runtime();
    const { db, model, dailyLimit, minuteLimit } = runtimeValues;
    await ensureSchema(db);
    const source = await ownedContext(db, analysisId, user);
    const denied = accessError(source);
    if (denied) return denied;
    const workspace = source as WorkspaceModelV1;
    const version = contextVersion(workspace);
    if (body.version && body.version !== version) return Response.json({error:"Версия анализа изменилась. Откройте актуальный диалог.",version},{status:409});
    conversationId = `${analysisId}:${user.email}`;
    const now = new Date().toISOString();
    const sinceMinute = new Date(Date.now() - 60_000).toISOString();
    const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await db.prepare(`INSERT INTO ai_conversations (id, analysis_id, owner_email, analysis_version, prompt_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET analysis_version = excluded.analysis_version, prompt_version = excluded.prompt_version, updated_at = excluded.updated_at`)
      .bind(conversationId, analysisId, user.email, version, AI_ANALYST_PROMPT_VERSION, now, now).run();
    // Serialize quota reservations for this viewer. The provider call runs outside the transaction.
    request.signal.throwIfAborted();
    const reservationId=crypto.randomUUID();
    const reservation=await db.batch([
      db.prepare("SELECT pg_advisory_xact_lock(hashtext(?))").bind("analyst-usage:"+user.email),
      db.prepare(`INSERT INTO ai_usage (id, conversation_id, owner_email, provider, model, latency_ms, success, error_type, created_at)
        SELECT ?,?,?, 'pending','pending',0,0,'IN_PROGRESS',? WHERE
        (SELECT COUNT(*) FROM ai_usage WHERE owner_email=? AND created_at>=?) < ? AND
        (SELECT COUNT(*) FROM ai_usage WHERE owner_email=? AND created_at>=?) < ? RETURNING id`)
        .bind(reservationId,conversationId,user.email,now,user.email,sinceMinute,minuteLimit,user.email,sinceDay,dailyLimit),
    ]);
    if(!reservation[1].results.length)return Response.json({error:"Лимит вопросов временно исчерпан. Попробуйте позже."},{status:429});
    usageId=reservationId;
    request.signal.throwIfAborted();
    const sanitized = buildSanitizedCreditContext(question, workspace);
    // Classify locally: user-pasted identifiers/documents and past assistant answers
    // never become provider context. Every answer is grounded afresh in this snapshot.
    let provider: ReturnType<typeof configuredProvider> = null;
    try { provider = configuredProvider(); } catch { /* Invalid provider configuration uses the same canonical fallback. */ }
    const generated = await generateWithFallback(analystTopic(question)==="boundary" ? null : provider, [
      {role:"system",content:AI_ANALYST_SYSTEM_PROMPT},
      {role:"system",content:`Текущий CanonicalAnalystContextV1:\n${JSON.stringify(sanitized)}`},
      {role:"user",content:ANALYST_QUESTIONS[analystTopic(question)]},
    ], () => buildLocalAnalystAnswer(question, workspace),request.signal);
    request.signal.throwIfAborted();
    let firstEvidence:number|null=null;
    let mode=generated.mode, failure=generated.failure;
    if(mode==="provider"){
      try { firstEvidence=evidenceChoice(generated.text,sanitized.explanations.length); }
      catch { mode="rules"; failure="AI_RESPONSE_UNGROUNDED"; }
    }
    if (provider && analystTopic(question)!=="boundary") {
      const latest=await ownedContext(db,analysisId,user);
      const deniedNow=accessError(latest);
      if(deniedNow || contextVersion(latest as WorkspaceModelV1)!==version){
        await db.prepare("UPDATE ai_usage SET provider=?,model=?,input_tokens=?,output_tokens=?,latency_ms=?,error_type=? WHERE id=?")
          .bind("deepseek",model,generated.inputTokens,generated.outputTokens,Date.now()-started,"CONTEXT_CHANGED",usageId).run();
        return deniedNow??Response.json({error:"Версия анализа изменилась. Откройте актуальный диалог."},{status:409});
      }
    }
    const answer=buildLocalAnalystAnswer(question,workspace,firstEvidence??undefined);
    const evidence=analystTopic(question)==="boundary"?[]:sanitized.explanations
      .filter(x=>x.evidence.length).sort((a,b)=>Number(b===sanitized.explanations[firstEvidence??-1])-Number(a===sanitized.explanations[firstEvidence??-1])).slice(0,4);
    const turn=version+":"+crypto.randomUUID(), userId=turn+":0", answerId=turn+":1", createdAt=new Date().toISOString();
    const reply={id:answerId,role:"assistant" as const,content:JSON.stringify({text:answer,evidence}),createdAt};
    request.signal.throwIfAborted();
    await db.batch([
      db.prepare("INSERT INTO ai_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)").bind(userId,conversationId,question,now),
      db.prepare("INSERT INTO ai_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)").bind(answerId,conversationId,reply.content,createdAt),
      db.prepare("UPDATE ai_usage SET provider=?,model=?,input_tokens=?,output_tokens=?,latency_ms=?,success=?,error_type=? WHERE id=?")
        .bind(generated.mode==="provider"||generated.failure?"deepseek":"local-rules",generated.mode==="provider"||generated.failure?model:"deterministic",generated.inputTokens,generated.outputTokens,Date.now()-started,failure?0:1,failure,usageId),
    ]);
    return Response.json({message:publicMessage(reply),mode,version});

  } catch {
    if (runtimeValues && usageId) {
      try { await runtimeValues.db.prepare("UPDATE ai_usage SET latency_ms=?,error_type=? WHERE id=?").bind(Date.now()-started,request.signal.aborted?"CANCELLED":"AI_REQUEST_FAILED",usageId).run(); } catch { /* Preserve the original service error. */ }
    }
    if(request.signal.aborted)return Response.json({error:"Запрос отменён."},{status:499});
    return Response.json({ error: "Кредитный аналитик временно перегружен. Попробуйте повторить вопрос. Сам анализ Prescore сохранён и доступен." }, { status: 503 });
  }
}
