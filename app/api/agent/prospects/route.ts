import {getRuntime} from "../../../../lib/platform/runtime";
import { averagePartnerCommissionRate } from "../../../../lib/partner-commissions";
import type { Gold44Record } from "../../../../lib/gold44";
import { requireApiUser, unauthorized } from "../../api-auth";

type PreparedStatement = { bind: (...values: unknown[]) => PreparedStatement; run: () => Promise<unknown>; first: <T = Record<string, unknown>>() => Promise<T | null> };
type RuntimeDatabase = { prepare: (query: string) => PreparedStatement; batch: (statements: PreparedStatement[]) => Promise<Array<{ results: unknown[] }>> };

async function database() { const env = getRuntime(); return env.DB as unknown as RuntimeDatabase; }

async function ensureSchema(db: RuntimeDatabase) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_accounts (user_email TEXT PRIMARY KEY, agent_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_leads (id TEXT PRIMARY KEY, agent_code TEXT NOT NULL, company_name TEXT NOT NULL, company_inn TEXT NOT NULL DEFAULT '', contact_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'Реферальная ссылка', status TEXT NOT NULL DEFAULT 'Новый клиент', subscription_status TEXT NOT NULL DEFAULT 'Ожидает оплаты', consent_at TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_applications (id TEXT PRIMARY KEY, agent_code TEXT NOT NULL, lead_id TEXT NOT NULL, analysis_id TEXT NOT NULL DEFAULT '', company_name TEXT NOT NULL, bank TEXT NOT NULL, product TEXT NOT NULL, requested_amount INTEGER NOT NULL DEFAULT 0, calculated_limit INTEGER NOT NULL DEFAULT 0, reward_rate_bps INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Подготовка', next_action TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS deals (id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL, company_name TEXT NOT NULL, product TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Новая', owner TEXT NOT NULL DEFAULT 'Не назначен', next_action TEXT NOT NULL DEFAULT '', bank TEXT NOT NULL DEFAULT '', application_group_id TEXT NOT NULL DEFAULT '', consent_at TEXT NOT NULL DEFAULT '', owner_email TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_prospects (
      id TEXT PRIMARY KEY, agent_code TEXT NOT NULL, source_file TEXT NOT NULL, notice_number TEXT NOT NULL,
      company_name TEXT NOT NULL, company_inn TEXT NOT NULL, region TEXT NOT NULL DEFAULT '',
      contract_price INTEGER NOT NULL DEFAULT 0, guarantee_amount INTEGER NOT NULL DEFAULT 0,
      protocol_date TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', reject_reason TEXT NOT NULL DEFAULT '',
      lead_id TEXT NOT NULL DEFAULT '', application_id TEXT NOT NULL DEFAULT '', data_json TEXT NOT NULL,
      imported_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, actor_role TEXT NOT NULL, actor_email TEXT NOT NULL DEFAULT '', metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS module_settings (module_key TEXT PRIMARY KEY, label TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare("CREATE INDEX IF NOT EXISTS prospects_agent_status_idx ON agent_prospects (agent_code, status, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS prospects_agent_inn_idx ON agent_prospects (agent_code, company_inn)"),
  ]);
}

async function moduleAvailable(db: RuntimeDatabase) {
  const setting = await db.prepare("SELECT enabled FROM module_settings WHERE module_key = 'prospects' LIMIT 1").first<{ enabled: number }>();
  return setting == null || Boolean(setting.enabled);
}

async function accountFor(db: RuntimeDatabase, user: { email: string }) {
  const existing = await db.prepare("SELECT agent_code AS agentCode FROM agent_accounts WHERE lower(user_email) = ? LIMIT 1").bind(user.email).first<{ agentCode: string }>();
  return existing?.agentCode ?? null;
}

function parseRecord(row: Record<string, unknown>) {
  try { return JSON.parse(String(row.dataJson || "{}")) as Gold44Record; } catch { return {} as Gold44Record; }
}

async function createGuaranteeDraft(db: RuntimeDatabase, agentCode: string, lead: { id: string; companyName: string; analysisId?: string; consentAt?: string }, prospect: { id: string; guaranteeAmount: number; noticeNumber: string }, ownerEmail: string) {
  const id = `BG-${prospect.id}`;
  const exists = await db.prepare("SELECT id FROM agent_applications WHERE id = ? LIMIT 1").bind(id).first();
  if (exists) return id;
  const now = new Date().toISOString();
  const nextAction = `Связаться с клиентом, подтвердить потребность по извещению ${prospect.noticeNumber} и получить отдельное согласие на передачу документов финансовому партнёру`;
  await db.batch([
    db.prepare(`INSERT INTO agent_applications (id, agent_code, lead_id, analysis_id, company_name, bank, product, requested_amount, calculated_limit, reward_rate_bps, status, next_action, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'Подбор по условиям БГ', 'Банковская гарантия', ?, ?, ?, 'Подготовка заявки', ?, ?, ?)`)
      .bind(id, agentCode, lead.id, lead.analysisId || "", lead.companyName, prospect.guaranteeAmount, prospect.guaranteeAmount, Math.round(averagePartnerCommissionRate * 10_000), nextAction, now, now),
    db.prepare(`INSERT OR IGNORE INTO deals (id, analysis_id, company_name, product, amount, status, owner, next_action, bank, application_group_id, consent_at, owner_email, created_at, updated_at) VALUES (?, ?, ?, 'Банковская гарантия', ?, 'Подготовка документов', 'Брокер', ?, 'Подбор по условиям БГ', ?, ?, ?, ?, ?)`)
      .bind(id, lead.analysisId || "", lead.companyName, prospect.guaranteeAmount, nextAction, id, lead.consentAt || "", ownerEmail, now, now),
    db.prepare("INSERT INTO audit_log (id, entity_type, entity_id, action, actor_role, actor_email, metadata, created_at) VALUES (?, 'APPLICATION', ?, 'AUTO_CREATE_GOLD44_MATCH', 'SYSTEM', ?, ?, ?)")
      .bind(crypto.randomUUID(), id, ownerEmail, JSON.stringify({ prospectId: prospect.id, noticeNumber: prospect.noticeNumber, consentRequired: true }), now),
  ]);
  return id;
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (!user.roles.includes("AGENT") && !user.isAdmin) return Response.json({error:"Нет доступа к кабинету агента"},{status:403});
  try {
    const db = await database(); await ensureSchema(db); if (!await moduleAvailable(db)) return Response.json({ error: "Модуль базы для прозвона отключён администратором" }, { status: 403 }); const agentCode = await accountFor(db, user);
    if (!agentCode) return Response.json({ error: "Сначала подключите свой брокерский профиль в /agent" }, { status: 409 });
    const url = new URL(request.url); const status = String(url.searchParams.get("status") || "all");
    const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const region = String(url.searchParams.get("region") || "").trim().toLowerCase();
    const minGuarantee = Math.max(0, Number(url.searchParams.get("minGuarantee")) || 0);
    const hasContacts = url.searchParams.get("hasContacts") === "1";
    const limit=Number(url.searchParams.get("limit")??100);if(!Number.isInteger(limit)||limit<1||limit>200)return Response.json({error:"INVALID_PAGINATION"},{status:400});
    const offset=Number(url.searchParams.get("offset")??0);if(!Number.isInteger(offset)||offset<0||offset>10000000||query.length>120||region.length>120)return Response.json({error:"INVALID_FILTER"},{status:400});
    const clauses = ["agent_code = ?"]; const values: unknown[] = [agentCode];
    if (status !== "all") { clauses.push("status = ?"); values.push(status); }
    if (query) { clauses.push("(lower(company_name) LIKE ? OR company_inn LIKE ? OR notice_number LIKE ? OR lower(data_json) LIKE ?)"); const like = `%${query}%`; values.push(like, like, like, like); }
    if (region) { clauses.push("lower(region) LIKE ?"); values.push(`%${region}%`); }
    if (minGuarantee) { clauses.push("guarantee_amount >= ?"); values.push(minGuarantee); }
    if (hasContacts) clauses.push("(data_json LIKE '%\"phones\":[\"%' OR data_json LIKE '%\"emails\":[\"%')");
    const where = clauses.join(" AND ");
    const [rowsResult, summaryResult, regionResult] = await db.batch([
      db.prepare(`SELECT id, status, reject_reason AS rejectReason, lead_id AS leadId, application_id AS applicationId, data_json AS dataJson, updated_at AS updatedAt FROM agent_prospects WHERE ${where} ORDER BY guarantee_amount DESC, updated_at DESC,id DESC LIMIT ? OFFSET ?`).bind(...values, limit, offset),
      db.prepare(`SELECT status, COUNT(*) AS count FROM agent_prospects WHERE agent_code = ? GROUP BY status`).bind(agentCode),
      db.prepare(`SELECT region, COUNT(*) AS count FROM agent_prospects WHERE agent_code = ? AND region <> '' GROUP BY region ORDER BY count DESC LIMIT 50`).bind(agentCode),
    ]);
    const records = (rowsResult.results as Array<Record<string, unknown>>).map((row) => ({ ...parseRecord(row), id: String(row.id), status: row.status, rejectReason: row.rejectReason, leadId: row.leadId, applicationId: row.applicationId, updatedAt: row.updatedAt }));
    const summary = Object.fromEntries((summaryResult.results as Array<{ status: string; count: number }>).map((item) => [item.status, Number(item.count)]));
    return Response.json({ records, summary, regions: regionResult.results, limit, offset });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить базу прозвона" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (!user.roles.includes("AGENT") && !user.isAdmin) return Response.json({error:"Нет доступа к кабинету агента"},{status:403});
  try {
    const db = await database(); await ensureSchema(db); if (!await moduleAvailable(db)) return Response.json({ error: "Модуль базы для прозвона отключён администратором" }, { status: 403 }); const agentCode = await accountFor(db, user);
    if (!agentCode) return Response.json({ error: "Сначала подключите свой брокерский профиль в /agent" }, { status: 409 });
    const body = await request.json() as Record<string, unknown>; const type = String(body.type || ""); const now = new Date().toISOString();
    if (type === "import") {
      const records = Array.isArray(body.records) ? body.records.slice(0, 75) as Gold44Record[] : [];
      if (!records.length) return Response.json({ error: "Нет строк для импорта" }, { status: 400 });
      const statements = records.filter((item) => item.id && item.inn && item.companyName).map((item) => db.prepare(`INSERT INTO agent_prospects (id, agent_code, source_file, notice_number, company_name, company_inn, region, contract_price, guarantee_amount, protocol_date, status, data_json, imported_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?) ON CONFLICT(id) DO UPDATE SET source_file = excluded.source_file, company_name = excluded.company_name, region = excluded.region, contract_price = excluded.contract_price, guarantee_amount = excluded.guarantee_amount, protocol_date = excluded.protocol_date, data_json = excluded.data_json, updated_at = excluded.updated_at`)
        .bind(`${agentCode}:${item.id}`, agentCode, item.sourceFile, item.noticeNumber, item.companyName, item.inn, item.region, Math.round(item.contractPrice), Math.round(item.guaranteeAmount), item.protocolDate, JSON.stringify(item), now, now));
      if (statements.length) await db.batch(statements);
      return Response.json({ ok: true, imported: statements.length });
    }
    if (type === "match") {
      const matches = await db.batch([db.prepare(`SELECT p.id, p.notice_number AS noticeNumber, p.guarantee_amount AS guaranteeAmount, l.id AS leadId, l.company_name AS companyName, l.consent_at AS consentAt, (SELECT a.id FROM analyses a WHERE a.company_inn = l.company_inn AND a.archive_state='ACTIVE' ORDER BY a.created_at DESC LIMIT 1) AS analysisId FROM agent_prospects p JOIN agent_leads l ON l.agent_code = p.agent_code AND l.company_inn = p.company_inn WHERE p.agent_code = ? AND p.status = 'new' LIMIT 200`).bind(agentCode)]);
      let created = 0;
      for (const row of matches[0].results as Array<Record<string, unknown>>) {
        const applicationId = await createGuaranteeDraft(db, agentCode, { id: String(row.leadId), companyName: String(row.companyName), analysisId: String(row.analysisId || ""), consentAt: String(row.consentAt || "") }, { id: String(row.id), guaranteeAmount: Number(row.guaranteeAmount), noticeNumber: String(row.noticeNumber) }, user.email);
        await db.prepare("UPDATE agent_prospects SET status = 'matched', lead_id = ?, application_id = ?, updated_at = ? WHERE id = ? AND agent_code = ?").bind(row.leadId, applicationId, now, row.id, agentCode).run(); created += 1;
      }
      return Response.json({ ok: true, matched: created });
    }
    if (type === "decision") {
      const id = String(body.id || ""); const decision = String(body.decision || "");
      const prospect = await db.prepare("SELECT id, company_name AS companyName, company_inn AS companyInn, notice_number AS noticeNumber, guarantee_amount AS guaranteeAmount, data_json AS dataJson, status FROM agent_prospects WHERE id = ? AND agent_code = ? LIMIT 1").bind(id, agentCode).first<Record<string, unknown>>();
      if (!prospect) return Response.json({ error: "Карточка не найдена" }, { status: 404 });
      if (decision === "reject") {
        await db.prepare("UPDATE agent_prospects SET status = 'rejected', reject_reason = ?, updated_at = ? WHERE id = ? AND agent_code = ?").bind(String(body.reason || "Не соответствует текущему профилю прозвона"), now, id, agentCode).run();
        return Response.json({ ok: true });
      }
      if (decision === "crm") {
        const record = parseRecord(prospect); let lead = await db.prepare("SELECT id, company_name AS companyName, consent_at AS consentAt FROM agent_leads WHERE agent_code = ? AND company_inn = ? ORDER BY created_at DESC LIMIT 1").bind(agentCode, prospect.companyInn).first<{ id: string; companyName: string; consentAt: string }>();
        if (!lead) {
          const leadId = crypto.randomUUID();
          await db.prepare(`INSERT INTO agent_leads (id, agent_code, company_name, company_inn, contact_name, phone, email, source, status, subscription_status, consent_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'Gold44 / закупки', 'Новый клиент', 'Контакт не установлен', '', ?, ?)`)
            .bind(leadId, agentCode, String(prospect.companyName), String(prospect.companyInn), record.director || "Контакт не установлен", record.mobilePhone || record.phones?.[0] || "", record.emails?.[0] || "", now, now).run();
          lead = { id: leadId, companyName: String(prospect.companyName), consentAt: "" };
        }
        const applicationId = await createGuaranteeDraft(db, agentCode, lead, { id, guaranteeAmount: Number(prospect.guaranteeAmount), noticeNumber: String(prospect.noticeNumber) }, user.email);
        await db.prepare("UPDATE agent_prospects SET status = 'added', lead_id = ?, application_id = ?, updated_at = ? WHERE id = ? AND agent_code = ?").bind(lead.id, applicationId, now, id, agentCode).run();
        return Response.json({ ok: true, leadId: lead.id, applicationId });
      }
      return Response.json({ error: "Неизвестное решение" }, { status: 400 });
    }
    return Response.json({ error: "Неизвестная операция" }, { status: 400 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось обработать базу" }, { status: 500 }); }
}
