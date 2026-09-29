import {getRuntime} from "../../../lib/platform/runtime";
import { getChatGPTUser } from "../../chatgpt-auth";
import { controlDefinitions, ensureControlSettings, isKnownControlKey, readControlSettings, type ControlCategory } from "../../../lib/admin-controls";
import { ensureEntitlementSchema, grantFullEntitlement, setAnalysisTier } from "../../../lib/entitlements";

type PreparedStatement = { bind: (...values: unknown[]) => PreparedStatement; run: () => Promise<unknown>; first: <T = unknown>() => Promise<T | null> };
type RuntimeDatabase = { prepare: (query: string) => PreparedStatement; batch: (statements: PreparedStatement[]) => Promise<Array<{ results: unknown[] }>> };


const moduleDefaults = [
  ["overview", "Обзор и метрики"], ["analysis", "Анализ выписок"], ["report", "Скоринг и отчёт"],
  ["credit", "БКИ и кредитный портфель"], ["company", "БФО и правовой контур"], ["offers", "Умный подбор финансирования"],
  ["analyst", "Кредитный аналитик Prescore"],
  ["applications", "Заявки в банки"], ["documents", "Документы и хранилище"], ["chats", "Чаты клиент — брокер"],
  ["exports", "Excel-выгрузки"], ["methodology", "Методология"], ["agent", "Кабинет агента"],
  ["prospects", "База закупок и прозвон Gold44 / ЕИС"],
] as const;

async function db() { const env = getRuntime(); return env.DB as unknown as RuntimeDatabase; }

async function authorize() {
  const user = await getChatGPTUser();
  return user?.roles.includes("ADMIN") ? user : null;
}

async function ensureSchema(database: RuntimeDatabase) {
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS module_settings (module_key TEXT PRIMARY KEY, label TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    database.prepare(`CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY, company_inn TEXT NOT NULL, company_name TEXT NOT NULL, user_email TEXT NOT NULL DEFAULT '',
      payer_type TEXT NOT NULL DEFAULT 'Юридическое лицо', payer_inn TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Активна',
      access_from TEXT NOT NULL, access_until TEXT NOT NULL, days INTEGER NOT NULL DEFAULT 30, amount INTEGER NOT NULL DEFAULT 6500,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, subscription_id TEXT NOT NULL, payer_type TEXT NOT NULL, payer_inn TEXT NOT NULL DEFAULT '', amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Оплачен', paid_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, payer_type TEXT NOT NULL, payer_inn TEXT NOT NULL DEFAULT '', payer_name TEXT NOT NULL,
      company_inn TEXT NOT NULL, company_name TEXT NOT NULL, user_email TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 6500, days INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'Ожидает оплаты', offer_accepted_at TEXT NOT NULL, privacy_accepted_at TEXT NOT NULL, authority_confirmed_at TEXT NOT NULL,
      receipt_requested_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS client_documents (
      id TEXT PRIMARY KEY, company_inn TEXT NOT NULL, analysis_id TEXT NOT NULL DEFAULT '', application_id TEXT NOT NULL DEFAULT '', category TEXT NOT NULL,
      file_name TEXT NOT NULL, mime_type TEXT NOT NULL DEFAULT '', size_bytes INTEGER NOT NULL DEFAULT 0, content_base64 TEXT NOT NULL DEFAULT '', uploaded_by TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Загружен', storage_key TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS application_messages (id TEXT PRIMARY KEY, application_id TEXT NOT NULL, author_role TEXT NOT NULL, author_name TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', document_id TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    database.prepare(`CREATE TABLE IF NOT EXISTS ai_usage (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, owner_email TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, input_tokens INTEGER, output_tokens INTEGER, latency_ms INTEGER NOT NULL, success INTEGER NOT NULL, error_type TEXT, created_at TEXT NOT NULL)`),
    database.prepare(`CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, actor_role TEXT NOT NULL, actor_email TEXT NOT NULL DEFAULT '', metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)`),
    database.prepare(`CREATE TABLE IF NOT EXISTS agent_leads (
      id TEXT PRIMARY KEY, agent_code TEXT NOT NULL, company_name TEXT NOT NULL, company_inn TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'Реферальная ссылка', status TEXT NOT NULL DEFAULT 'Новый клиент',
      subscription_status TEXT NOT NULL DEFAULT 'Ожидает оплаты', consent_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
  ]);
  await database.batch(moduleDefaults.map(([key, label]) => database.prepare("INSERT OR IGNORE INTO module_settings (module_key, label, enabled, updated_at) VALUES (?, ?, 1, ?)").bind(key, label, new Date().toISOString())));
  await ensureControlSettings(database);
  await ensureEntitlementSchema(database);
  for (const statement of [
    "ALTER TABLE payment_orders ADD COLUMN analysis_id TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE payment_orders ADD COLUMN product_type TEXT NOT NULL DEFAULT 'FULL_ANALYSIS'",
  ]) { try { await database.prepare(statement).run(); } catch { /* migrated */ } }
}

export async function GET() {
  const user = await authorize();
  if (!user) return Response.json({ error: "Доступ только администратору" }, { status: 403 });
  try {
    const database = await db();
    await ensureSchema(database);
    const safe = async (query: string) => { try { return (await database.batch([database.prepare(query)]))[0]?.results ?? []; } catch { return []; } };
    const [modules, entitlements, analyses, orders, summary, daily, statuses, products, storage, analysisPayloads, controls] = await Promise.all([
      safe("SELECT module_key AS moduleKey, label, enabled, updated_at AS updatedAt FROM module_settings ORDER BY rowid"),
      safe(`SELECT e.analysis_id AS id, e.analysis_id AS analysisId, e.company_inn AS companyInn,
        COALESCE(a.company_name, '') AS companyName, e.user_email AS userEmail, e.tier,
        e.payment_order_id AS paymentOrderId, e.granted_by AS grantedBy, e.granted_at AS grantedAt,
        e.revoked_at AS revokedAt, e.updated_at AS updatedAt
        FROM analysis_entitlements e LEFT JOIN analyses a ON a.id = e.analysis_id ORDER BY e.updated_at DESC LIMIT 500`),
      safe(`SELECT a.id, a.company_name AS companyName, a.company_inn AS companyInn,
        a.owner_email AS ownerEmail, a.period_from AS periodFrom, a.period_to AS periodTo,
        a.created_at AS createdAt, COALESCE(e.tier, 'FREE') AS tier
        FROM analyses a LEFT JOIN analysis_entitlements e ON e.analysis_id = a.id
        ORDER BY a.created_at DESC LIMIT 500`),
      safe("SELECT id, order_number AS orderNumber, payer_type AS payerType, payer_inn AS payerInn, payer_name AS payerName, company_inn AS companyInn, company_name AS companyName, user_email AS userEmail, amount, analysis_id AS analysisId, product_type AS productType, status, created_at AS createdAt FROM payment_orders ORDER BY created_at DESC LIMIT 200"),
      safe(`SELECT
        (SELECT COUNT(DISTINCT company_inn) FROM analyses) AS clients,
        (SELECT COUNT(*) FROM analyses) AS analyses,
        (SELECT COUNT(*) FROM analysis_entitlements WHERE tier = 'FULL') AS activeFull,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'Оплачен') AS revenue,
        (SELECT COUNT(*) FROM deals) AS applications,
        (SELECT COUNT(*) FROM deals WHERE status = 'Одобрена') AS approvals,
        (SELECT COUNT(*) FROM agent_leads) AS agentClients,
        (SELECT COUNT(*) FROM client_documents) AS documents,
        (SELECT COUNT(*) FROM application_messages) AS messages,
        (SELECT COUNT(*) FROM ai_usage) AS aiQuestions,
        (SELECT COUNT(*) FROM ai_usage WHERE success = 1) AS aiSuccess,
        (SELECT COALESCE(SUM(input_tokens), 0) + COALESCE(SUM(output_tokens), 0) FROM ai_usage) AS aiTokens,
        (SELECT COALESCE(AVG(latency_ms), 0) FROM ai_usage WHERE success = 1) AS aiLatency,
        (SELECT COUNT(*) FROM audit_log) AS auditEvents`),
      safe("SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count FROM analyses GROUP BY substr(created_at, 1, 10) ORDER BY day DESC LIMIT 14"),
      safe("SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM deals GROUP BY status ORDER BY count DESC"),
      safe("SELECT product, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM deals GROUP BY product ORDER BY count DESC LIMIT 12"),
      safe("SELECT COUNT(*) AS files, COALESCE(SUM(size_bytes), 0) AS bytes, COUNT(DISTINCT company_inn) AS companies FROM client_documents"),
      safe("SELECT payload FROM analyses ORDER BY created_at DESC LIMIT 500"),
      readControlSettings(database),
    ]);
    const parsedAnalyses = (analysisPayloads as Array<{ payload?: string }>).map((row) => { try { return JSON.parse(row.payload || ""); } catch { return null; } }).filter(Boolean) as Array<Record<string, unknown>>;
    const recommendationCounts = new Map<string, number>();
    let scoreTotal = 0; let scoreCount = 0; let criticalSignals = 0; let recommendationsCount = 0; let limitPotential = 0;
    for (const analysis of parsedAnalyses) {
      if (Number.isFinite(Number(analysis.score))) { scoreTotal += Number(analysis.score); scoreCount += 1; }
      const metrics = analysis.metrics as Record<string, unknown> | undefined;
      limitPotential += Number(metrics?.estimatedLimitMax) || 0;
      const factors = Array.isArray(analysis.factors) ? analysis.factors as Array<Record<string, unknown>> : [];
      criticalSignals += factors.filter((factor) => factor.severity === "critical").length;
      const recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations as Array<Record<string, unknown>> : [];
      recommendationsCount += recommendations.length;
      for (const item of recommendations) {
        const title = String(item.title || item.product || "Другая рекомендация");
        recommendationCounts.set(title, (recommendationCounts.get(title) || 0) + 1);
      }
    }
    const recommendationThemes = [...recommendationCounts.entries()].map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count).slice(0, 12);
    const controlSummary = controls.reduce<Record<string, { total: number; enabled: number }>>((result, item) => {
      result[item.category] ??= { total: 0, enabled: 0 };
      result[item.category].total += 1;
      result[item.category].enabled += Number(Boolean(item.enabled));
      return result;
    }, {});
    return Response.json({ admin: user, modules, controls, controlSummary, entitlements, subscriptions: entitlements, analyses, orders, summary: summary[0] ?? {}, expert: { averageScore: scoreCount ? Math.round(scoreTotal / scoreCount) : 0, criticalSignals, recommendationsCount, limitPotential }, recommendationThemes, daily: daily.reverse(), applicationStatuses: statuses, products, storage: storage[0] ?? {} });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить панель" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return Response.json({ error: "Доступ только администратору" }, { status: 403 });
  try {
    const database = await db();
    await ensureSchema(database);
    const body = await request.json() as Record<string, unknown>;
    if (body.type === "module") {
      const key = String(body.moduleKey || "");
      if (!moduleDefaults.some(([candidate]) => candidate === key)) return Response.json({ error: "Неизвестный модуль" }, { status: 400 });
      const now = new Date().toISOString();
      await database.batch([
        database.prepare("UPDATE module_settings SET enabled = ?, updated_at = ? WHERE module_key = ?").bind(body.enabled === true ? 1 : 0, now, key),
        database.prepare("INSERT INTO audit_log (id, entity_type, entity_id, action, actor_role, actor_email, metadata, created_at) VALUES (?, 'MODULE_SETTING', ?, 'TOGGLE', 'ADMIN', ?, ?, ?)").bind(crypto.randomUUID(), key, user.email.toLowerCase(), JSON.stringify({ enabled: body.enabled === true }), now),
      ]);
      return Response.json({ ok: true });
    }
    if (body.type === "control") {
      const key = String(body.controlKey || "");
      if (!isKnownControlKey(key)) return Response.json({ error: "Неизвестный показатель" }, { status: 400 });
      const now = new Date().toISOString();
      await database.batch([
        database.prepare("UPDATE control_settings SET enabled = ?, updated_at = ? WHERE control_key = ?").bind(body.enabled === true ? 1 : 0, now, key),
        database.prepare("INSERT INTO audit_log (id, entity_type, entity_id, action, actor_role, actor_email, metadata, created_at) VALUES (?, 'CONTROL_SETTING', ?, 'TOGGLE', 'ADMIN', ?, ?, ?)").bind(crypto.randomUUID(), key, user.email.toLowerCase(), JSON.stringify({ enabled: body.enabled === true }), now),
      ]);
      return Response.json({ ok: true });
    }
    if (body.type === "bulk-control") {
      const category = String(body.category || "") as ControlCategory;
      const groupName = String(body.groupName || "");
      const matched = controlDefinitions.filter((item) => item.category === category && (!groupName || item.groupName === groupName));
      if (!matched.length) return Response.json({ error: "Группа показателей не найдена" }, { status: 400 });
      const now = new Date().toISOString();
      const enabled = body.enabled === true;
      for (let index = 0; index < matched.length; index += 75) {
        await database.batch(matched.slice(index, index + 75).map((item) => database.prepare("UPDATE control_settings SET enabled = ?, updated_at = ? WHERE control_key = ?").bind(enabled ? 1 : 0, now, item.controlKey)));
      }
      await database.prepare("INSERT INTO audit_log (id, entity_type, entity_id, action, actor_role, actor_email, metadata, created_at) VALUES (?, 'CONTROL_GROUP', ?, 'BULK_TOGGLE', 'ADMIN', ?, ?, ?)").bind(crypto.randomUUID(), `${category}:${groupName || "all"}`, user.email.toLowerCase(), JSON.stringify({ enabled, count: matched.length }), now).run();
      return Response.json({ ok: true, count: matched.length });
    }
    if (body.type === "subscription") {
      const companyInn = String(body.companyInn || "").replace(/\D/g, "");
      const companyName = String(body.companyName || "").trim();
      const amount = Math.max(0, Number(body.amount) || 6500);
      if (!/^(?:\d{10}|\d{12})$/.test(companyInn) || !companyName) return Response.json({ error: "Укажите компанию и корректный ИНН" }, { status: 400 });
      const now = new Date();
      const payerType = String(body.payerType || "Юридическое лицо");
      const payerInn = String(body.payerInn || "").replace(/\D/g, "");
      const requestedAnalysisId = String(body.analysisId || "");
      const analysis = await database.prepare(requestedAnalysisId
        ? "SELECT id, owner_email AS ownerEmail FROM analyses WHERE id = ? AND company_inn = ? LIMIT 1"
        : "SELECT id, owner_email AS ownerEmail FROM analyses WHERE company_inn = ? ORDER BY created_at DESC LIMIT 1")
        .bind(...(requestedAnalysisId ? [requestedAnalysisId, companyInn] : [companyInn])).first<{ id?: string; ownerEmail?: string }>();
      if (!analysis?.id) return Response.json({ error: "Сначала создайте анализ этой компании: FULL открывается для конкретной версии" }, { status: 409 });
      const userEmail = String(analysis.ownerEmail || body.userEmail || "").trim().toLowerCase();
      await grantFullEntitlement(database, { analysisId: analysis.id, userEmail, companyInn, grantedBy: "ADMIN_MANUAL" });
      await database.prepare("UPDATE agent_leads SET subscription_status = 'FULL', updated_at = ? WHERE company_inn = ?").bind(now.toISOString(), companyInn).run();
      if (body.paymentConfirmed === true) await database.prepare(`INSERT INTO payments (id, subscription_id, payer_type, payer_inn, amount, status, paid_at, created_at) VALUES (?, ?, ?, ?, ?, 'Оплачен', ?, ?)`)
        .bind(crypto.randomUUID(), analysis.id, payerType, payerInn, amount, now.toISOString(), now.toISOString()).run();
      return Response.json({ ok: true, analysisId: analysis.id, tier: "FULL" }, { status: 201 });
    }
    if (body.type === "access") {
      const id = String(body.id || "");
      const enabled = body.enabled === true;
      await setAnalysisTier(database, id, enabled ? "FULL" : "FREE", user.email.toLowerCase());
      return Response.json({ ok: true, tier: enabled ? "FULL" : "FREE" });
    }
    if (body.type === "confirm-order") {
      const orderId = String(body.id || "");
      const order = await database.prepare("SELECT * FROM payment_orders WHERE id = ? LIMIT 1").bind(orderId).first<Record<string, unknown>>();
      if (!order) return Response.json({ error: "Заказ не найден" }, { status: 404 });
      if (String(order.status) === "Оплачен") return Response.json({ error: "Заказ уже подтверждён" }, { status: 409 });
      const now = new Date();
      let analysisId = String(order.analysis_id || "");
      let analysis: Record<string, unknown> | null = null;
      if (analysisId) analysis = await database.prepare("SELECT id, company_inn, owner_email FROM analyses WHERE id = ? LIMIT 1").bind(analysisId).first<Record<string, unknown>>();
      if (!analysis) analysis = await database.prepare("SELECT id, company_inn, owner_email FROM analyses WHERE company_inn = ? AND owner_email = ? ORDER BY created_at DESC LIMIT 1").bind(String(order.company_inn), String(order.user_email).toLowerCase()).first<Record<string, unknown>>();
      analysisId = String(analysis?.id || "");
      if (analysisId) await grantFullEntitlement(database, { analysisId, userEmail: String(analysis?.owner_email || order.user_email), companyInn: String(analysis?.company_inn || order.company_inn), orderId, grantedBy: "PAID_ORDER" });
      await database.batch([
        database.prepare(`INSERT INTO payments (id, subscription_id, payer_type, payer_inn, amount, status, paid_at, created_at) VALUES (?, ?, ?, ?, ?, 'Оплачен', ?, ?)`).bind(crypto.randomUUID(), analysisId || orderId, String(order.payer_type), String(order.payer_inn || ""), Number(order.amount) || 6500, now.toISOString(), now.toISOString()),
        database.prepare("UPDATE payment_orders SET status = 'Оплачен', updated_at = ? WHERE id = ?").bind(now.toISOString(), orderId),
        database.prepare("UPDATE agent_leads SET subscription_status = 'FULL', updated_at = ? WHERE company_inn = ?").bind(now.toISOString(), String(order.company_inn)),
      ]);
      if (analysisId) await database.prepare("UPDATE payment_orders SET analysis_id = ?, updated_at = ? WHERE id = ?").bind(analysisId, now.toISOString(), orderId).run();
      return Response.json({ ok: true, analysisId, tier: analysisId ? "FULL" : "PENDING_ANALYSIS" });
    }
    return Response.json({ error: "Неизвестная операция" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить настройку" }, { status: 500 });
  }
}
