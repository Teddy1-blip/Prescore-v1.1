import {brokerApplicationSQL,dossierAuthorizationSQL} from '../../../lib/auth/broker-authorizations';
import {boundedPage} from '../../../lib/release/pagination';
import {safeErrorText} from '../../../lib/release/security';
import {createHash} from "node:crypto";
import {getRuntime} from "../../../lib/platform/runtime";
import { averagePartnerCommissionRate, partnerCommissions } from "../../../lib/partner-commissions";
import { bankControlKey, productControlKey, readControlState } from "../../../lib/admin-controls";
import { matchGuaranteePolicies } from "../../../lib/bank-guarantees";
import { requireApiUser, unauthorized, readableAnalysis } from "../api-auth";

type PreparedStatement = {
  bind: (...values: unknown[]) => PreparedStatement;
  run: () => Promise<unknown>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
};

type RuntimeDatabase = {
  prepare: (query: string) => PreparedStatement;
  batch: (statements: PreparedStatement[]) => Promise<Array<{ results: unknown[] }>>;
};

async function getDatabase() {
  const env = getRuntime();
  return env.DB as unknown as RuntimeDatabase;
}

async function ensureSchema(db: RuntimeDatabase) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_leads (
      id TEXT PRIMARY KEY, agent_code TEXT NOT NULL, company_name TEXT NOT NULL,
      company_inn TEXT NOT NULL DEFAULT '', contact_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'Реферальная ссылка', status TEXT NOT NULL DEFAULT 'Новый клиент',
      subscription_status TEXT NOT NULL DEFAULT 'Ожидает оплаты', consent_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_applications (
      id TEXT PRIMARY KEY, agent_code TEXT NOT NULL, lead_id TEXT NOT NULL,
      analysis_id TEXT NOT NULL DEFAULT '', company_name TEXT NOT NULL, bank TEXT NOT NULL,
      product TEXT NOT NULL, requested_amount INTEGER NOT NULL DEFAULT 0,
      calculated_limit INTEGER NOT NULL DEFAULT 0, reward_rate_bps INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Подготовка', next_action TEXT NOT NULL DEFAULT 'Проверить комплект документов',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_partners (
      agent_code TEXT PRIMARY KEY, curator_code TEXT NOT NULL, name TEXT NOT NULL,
      agency TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Активен', consent_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_accounts (
      user_email TEXT PRIMARY KEY, agent_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL, company_name TEXT NOT NULL,
      product TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Новая',
      owner TEXT NOT NULL DEFAULT 'Не назначен', next_action TEXT NOT NULL DEFAULT 'Связаться с клиентом',
      bank TEXT NOT NULL DEFAULT '', application_group_id TEXT NOT NULL DEFAULT '', consent_at TEXT NOT NULL DEFAULT '',
      owner_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS application_status_history (
      id TEXT PRIMARY KEY, application_id TEXT NOT NULL, from_status TEXT NOT NULL DEFAULT '', to_status TEXT NOT NULL,
      actor_role TEXT NOT NULL, actor_email TEXT NOT NULL DEFAULT '', public_comment TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL,
      actor_role TEXT NOT NULL, actor_email TEXT NOT NULL DEFAULT '', metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS module_settings (module_key TEXT PRIMARY KEY, label TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, payer_type TEXT NOT NULL, payer_inn TEXT NOT NULL DEFAULT '', payer_name TEXT NOT NULL,
      company_inn TEXT NOT NULL, company_name TEXT NOT NULL, user_email TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 6500,
      days INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Ожидает оплаты', analysis_id TEXT NOT NULL DEFAULT '',
      product_type TEXT NOT NULL DEFAULT 'FULL_ANALYSIS', offer_accepted_at TEXT NOT NULL, privacy_accepted_at TEXT NOT NULL,
      authority_confirmed_at TEXT NOT NULL, receipt_requested_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_prospects (
      id TEXT PRIMARY KEY, agent_code TEXT NOT NULL, source_file TEXT NOT NULL, notice_number TEXT NOT NULL,
      company_name TEXT NOT NULL, company_inn TEXT NOT NULL, region TEXT NOT NULL DEFAULT '', contract_price INTEGER NOT NULL DEFAULT 0,
      guarantee_amount INTEGER NOT NULL DEFAULT 0, protocol_date TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new',
      reject_reason TEXT NOT NULL DEFAULT '', lead_id TEXT NOT NULL DEFAULT '', application_id TEXT NOT NULL DEFAULT '',
      data_json TEXT NOT NULL, imported_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS agent_leads_code_idx ON agent_leads (agent_code, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS agent_apps_code_idx ON agent_applications (agent_code, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS agent_partners_curator_idx ON agent_partners (curator_code, updated_at)"),
  ]);
  for (const statement of [
    "ALTER TABLE deals ADD COLUMN bank TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE deals ADD COLUMN application_group_id TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE deals ADD COLUMN consent_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE deals ADD COLUMN owner_email TEXT NOT NULL DEFAULT ''",
  ]) {
    try { await db.prepare(statement).run(); } catch { /* column already exists */ }
  }

}

function normalizeCode(value: string | null) {
  return (value || "").trim().toUpperCase().replace(/[^A-ZА-Я0-9-]/g, "").slice(0, 48);
}

async function accountFor(db: RuntimeDatabase, user: { email: string }) {
  return db.prepare("SELECT agent_code AS agentCode, name FROM agent_accounts WHERE lower(user_email) = ? LIMIT 1").bind(user.email).first<{ agentCode: string; name: string }>();
}

// Explicit self-enrollment only. requireApiUser accepts verified native sessions;
// neither GET, a requested role nor a submitted email can create this account.
async function connectAccount(request: Request, db: RuntimeDatabase, user: NonNullable<Awaited<ReturnType<typeof requireApiUser>>>, body: Record<string, unknown>) {
  try {
    const base = process.env.PRESCORE_BASE_URL;
    if (!base || request.headers.get("origin") !== new URL(base).origin || request.headers.get("sec-fetch-site") === "cross-site") {
      return Response.json({ error: "Не удалось подтвердить источник запроса. Обновите страницу." }, { status: 403 });
    }
  } catch { return Response.json({ error: "Подключение временно недоступно" }, { status: 503 }); }
  const existing = await accountFor(db, user);
  if (existing) return Response.json({ ok: true, agent: existing, alreadyConnected: true });
  if (body.offerAccepted !== true || body.consent !== true) {
    return Response.json({ error: "Примите условия партнёрской программы и отдельно подтвердите согласие на обработку данных" }, { status: 400 });
  }
  if (body.invitation !== undefined && typeof body.invitation !== "string") return Response.json({ error: "Некорректное приглашение" }, { status: 400 });
  const rawInvitation = typeof body.invitation === "string" ? body.invitation.trim().toUpperCase() : "";
  const invitation = normalizeCode(rawInvitation);
  if (invitation !== rawInvitation) return Response.json({ error: "Некорректное приглашение" }, { status: 400 });
  const agentCode = invitation || `AGENT-${crypto.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase()}`;
  const name = user.displayName || "Партнёр Прескор", now = new Date().toISOString();
  const insert = invitation
    ? db.prepare(`INSERT INTO agent_accounts (user_email, agent_code, name, created_at, updated_at)
        SELECT ?, agent_code, ?, ?, ? FROM agent_partners
        WHERE agent_code = ? AND lower(email) = ? AND status IN ('На подключении', 'Активен')
        ON CONFLICT (user_email) DO NOTHING`).bind(user.email, name, now, now, invitation, user.email)
    : db.prepare(`INSERT INTO agent_accounts (user_email, agent_code, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_email) DO NOTHING`).bind(user.email, agentCode, name, now, now);
  await db.batch([
    insert,
    db.prepare(`UPDATE agent_partners SET status = 'Активен', consent_at = ?, updated_at = ?
      WHERE agent_code = ? AND lower(email) = ? AND EXISTS
      (SELECT 1 FROM agent_accounts WHERE user_email = ? AND agent_code = ?)`)
      .bind(now, now, agentCode, user.email, user.email, agentCode),
    db.prepare(`INSERT INTO audit_log (id, entity_type, entity_id, action, actor_role, actor_email, metadata, created_at)
      SELECT ?, 'AGENT_ACCOUNT', agent_code, 'SELF_CONNECT', 'CLIENT', user_email, ?, ?
      FROM agent_accounts WHERE user_email = ? AND agent_code = ? ON CONFLICT (id) DO NOTHING`)
      .bind('agent-connect-' + agentCode, JSON.stringify({ offer: '/offer', consent: '/consent', privacy: '/privacy', documentRevision: '2026-08-20', offerAccepted: true, consentAccepted: true }), now, user.email, agentCode),
  ]);
  const account = await accountFor(db, user);
  if (!account) return Response.json({ error: "Приглашение не связано с подтверждённой почтой этой учётной записи. Подключение не выполнено." }, { status: 409 });
  return Response.json({ ok: true, agent: account }, { status: 201 });
}

async function createMatchedGuaranteeDraft(db: RuntimeDatabase, input: { agentCode: string; leadId: string; analysisId?: string; companyName: string; consentAt?: string; prospectId: string; noticeNumber: string; amount: number; ownerEmail: string }) {
  const id = `BG-${input.prospectId}`;
  const exists = await db.prepare("SELECT id FROM agent_applications WHERE id = ? LIMIT 1").bind(id).first();
  if (exists) return id;
  const now = new Date().toISOString();
  const nextAction = `Связаться с клиентом по извещению ${input.noticeNumber}, подтвердить потребность и получить отдельное согласие на передачу документов финансовому партнёру`;
  await db.batch([
    db.prepare(`INSERT INTO agent_applications (id, agent_code, lead_id, analysis_id, company_name, bank, product, requested_amount, calculated_limit, reward_rate_bps, status, next_action, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'Подбор по условиям БГ', 'Банковская гарантия', ?, ?, ?, 'Подготовка заявки', ?, ?, ?)`)
      .bind(id, input.agentCode, input.leadId, input.analysisId || "", input.companyName, input.amount, input.amount, Math.round(averagePartnerCommissionRate * 10_000), nextAction, now, now),
    db.prepare(`INSERT OR IGNORE INTO deals (id, analysis_id, company_name, product, amount, status, owner, next_action, bank, application_group_id, consent_at, owner_email, created_at, updated_at) VALUES (?, ?, ?, 'Банковская гарантия', ?, 'Подготовка документов', 'Брокер', ?, 'Подбор по условиям БГ', ?, ?, ?, ?, ?)`)
      .bind(id, input.analysisId || "", input.companyName, input.amount, nextAction, id, input.consentAt || "", input.ownerEmail, now, now),
  ]);
  return id;
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (!user.roles.includes("AGENT") && !user.isAdmin) return Response.json({error:"Нет доступа к кабинету агента"},{status:403});
  try {
    const paging=boundedPage(request.url);
    const db = await getDatabase();
    await ensureSchema(db);
    const controls = await readControlState(db);
    const account = await accountFor(db, user);
    if (!account) return Response.json({ error: "Сначала подключите свой брокерский профиль в /agent" }, { status: 409 });
    const prospectsModule = await db.prepare("SELECT enabled FROM module_settings WHERE module_key = 'prospects' LIMIT 1").first<{ enabled: number }>();
    const requestedCode = normalizeCode(new URL(request.url).searchParams.get("code"));
    const code = requestedCode && requestedCode === account.agentCode ? requestedCode : account.agentCode;
    const [leadResult, applicationResult, partnerResult] = await db.batch([
      db.prepare(`SELECT l.id, l.company_name AS companyName, l.company_inn AS companyInn,
        l.contact_name AS contactName, l.phone, l.email, l.source, l.status,
        l.subscription_status AS subscriptionStatus, l.consent_at AS consentAt,
        l.created_at AS createdAt, l.updated_at AS updatedAt,
        (SELECT COUNT(*) FROM payment_orders po JOIN analyses paid_analysis ON paid_analysis.id=po.analysis_id WHERE po.company_inn=l.company_inn AND po.status='Оплачен' AND ${dossierAuthorizationSQL('paid_analysis','actor.email')}) AS paidFullOrders,
        (SELECT a.id FROM analyses a WHERE a.company_inn = l.company_inn AND a.archive_state='ACTIVE' AND (a.owner_email=actor.email OR ${dossierAuthorizationSQL('a','actor.email')}) ORDER BY a.created_at DESC LIMIT 1) AS analysisId
        FROM agent_leads l CROSS JOIN (SELECT ?::text AS email) actor WHERE (NOT EXISTS (SELECT 1 FROM analyses ax WHERE ax.company_inn=l.company_inn AND ${dossierAuthorizationSQL('ax','actor.email')}) OR EXISTS (SELECT 1 FROM analyses ax WHERE ax.company_inn=l.company_inn AND ${dossierAuthorizationSQL('ax','actor.email')} AND ax.archive_state='ACTIVE') OR NOT EXISTS (SELECT 1 FROM analyses ax JOIN analysis_archive_batches ab ON ab.id=ax.archive_batch_id WHERE ax.company_inn=l.company_inn AND ${dossierAuthorizationSQL('ax','actor.email')} AND ax.archive_state<>'ACTIVE' AND l.created_at::timestamp AT TIME ZONE 'UTC' < ab.cutover_at)) AND l.agent_code = ? ORDER BY l.updated_at DESC,l.id DESC LIMIT ? OFFSET ?`).bind(user.email,code,paging.limit,paging.offset),
      db.prepare(`SELECT id, lead_id AS leadId, analysis_id AS analysisId, company_name AS companyName,
        bank, product, requested_amount AS requestedAmount, calculated_limit AS calculatedLimit,
        COALESCE((SELECT d.status FROM deals d WHERE d.id = agent_applications.id), status) AS status, next_action AS nextAction,
        created_at AS createdAt, updated_at AS updatedAt
        FROM agent_applications CROSS JOIN (SELECT ?::text AS email) actor WHERE ${brokerApplicationSQL('agent_applications','actor.email')} AND agent_code = ? ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?`).bind(user.email,code,paging.limit,paging.offset),
      db.prepare(`SELECT p.agent_code AS agentCode, p.name, p.agency, p.city, p.status, p.created_at AS createdAt,
        COUNT(l.id) AS clientsCount,
        (SELECT COUNT(*) FROM billing_orders po WHERE po.broker_code=p.agent_code AND po.curator_code=p.curator_code AND po.status='PAID') AS activeSubscriptions
        FROM agent_partners p LEFT JOIN agent_leads l ON l.agent_code = p.agent_code
        WHERE p.curator_code = ?
        GROUP BY p.agent_code, p.curator_code, p.name, p.agency, p.city, p.status, p.created_at
        ORDER BY "activeSubscriptions" DESC, p.created_at DESC,p.agent_code DESC LIMIT ? OFFSET ?`).bind(code,paging.limit,paging.offset),
    ]);
    const partners = (partnerResult.results as Array<Record<string, unknown>>).map((item) => ({
      ...item,
      clientsCount: Number(item.clientsCount) || 0,
      activeSubscriptions: Number(item.activeSubscriptions) || 0,
      monthlyIncome: (Number(item.activeSubscriptions) || 0) * 650,
    }));
    const applications = applicationResult.results as Array<Record<string, unknown>>;
    const applicationForecast = applications.reduce((sum, item) => sum + (Number(item.calculatedLimit) || 0) * averagePartnerCommissionRate, 0);
    return Response.json({
      pagination:{page:paging.page,limit:paging.limit,hasNext:[leadResult,applicationResult,partnerResult].some(r=>r.results.length===paging.limit)},
      agent: { code, name: account.name, referralPath: `/ref/${encodeURIComponent(code)}`, isAdmin: user.isAdmin },
      modules: { prospects: prospectsModule == null || Boolean(prospectsModule.enabled) },
      leads: leadResult.results,
      applications,
      applicationForecast,
      offerOptions: partnerCommissions.filter((item) => !controls.disabled.has(bankControlKey(item.bank)) && !controls.disabled.has(productControlKey(item.product))).map(({ id, bank, product, kind }) => ({ id, bank, product, kind })),
      curator: {
        referralPath: `/agent-ref/${encodeURIComponent(code)}`,
        agents: partners,
        agentsCount: partners.length,
        clientsCount: partners.reduce((sum, item) => sum + item.clientsCount, 0),
        activeSubscriptions: partners.reduce((sum, item) => sum + item.activeSubscriptions, 0),
        monthlyIncome: partners.reduce((sum, item) => sum + item.monthlyIncome, 0),
      },
    });
  } catch (error) {
    return Response.json({ error: safeErrorText(error, "Не удалось загрузить агентский кабинет") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const type = String(body.type || "lead");
    const publicReferral = type === "subagent" || (type === "lead" && String(body.source || "") === "Реферальная ссылка");
    const user = publicReferral ? null : await requireApiUser();
    if (!publicReferral && !user) return unauthorized();
    const db = await getDatabase();
    if (type === "connect") return await connectAccount(request, db, user!, body);
    if (user && !user.roles.includes("AGENT") && !user.isAdmin) return Response.json({error:"Нет доступа к кабинету агента"},{status:403});
    await ensureSchema(db);
    const account = user ? await accountFor(db, user) : null;
    if (user && !account) return Response.json({ error: "Сначала подключите свой брокерский профиль в /agent" }, { status: 409 });
    const agentCode = account?.agentCode || normalizeCode(String(body.agentCode || ""));
    if (!agentCode) return Response.json({ error: "Некорректная реферальная ссылка" }, { status: 400 });
    if (publicReferral) {
      const target = await db.prepare("SELECT agent_code AS agentCode FROM agent_accounts WHERE agent_code = ? UNION SELECT agent_code AS agentCode FROM agent_partners WHERE agent_code = ? LIMIT 1").bind(agentCode, agentCode).first();
      if (!target) return Response.json({ error: "Реферальная ссылка не активна" }, { status: 404 });
    }
    const now = new Date().toISOString();
    if (type === "lead") {
      const companyName = String(body.companyName || "").trim();
      const companyInn = String(body.companyInn || "").replace(/\D/g, "");
      const contactName = String(body.contactName || "").trim();
      const phone = String(body.phone || "").trim();
      const email = String(body.email || "").trim();
      if (!companyName || !contactName || (!phone && !email) || ![10, 12].includes(companyInn.length)) {
        return Response.json({ error: "Укажите компанию, ИНН, контактное лицо и телефон или email" }, { status: 400 });
      }
      if (body.consent !== true) return Response.json({ error: "Необходимо согласие на обработку данных" }, { status: 400 });
      const id = crypto.randomUUID();
      await db.prepare(`INSERT INTO agent_leads
        (id, agent_code, company_name, company_inn, contact_name, phone, email, source, status, subscription_status, consent_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          id, agentCode, companyName, companyInn, contactName, phone, email,
          String(body.source || "Добавлен агентом"), "Новый клиент", "Ожидает оплаты", now, now, now,
        ).run();
      const matched = await db.batch([db.prepare("SELECT id, notice_number AS noticeNumber, guarantee_amount AS guaranteeAmount FROM agent_prospects WHERE agent_code = ? AND company_inn = ? AND status = 'new' LIMIT 20").bind(agentCode, companyInn)]);
      let autoApplications = 0;
      for (const prospect of matched[0].results as Array<Record<string, unknown>>) {
        const applicationId = await createMatchedGuaranteeDraft(db, { agentCode, leadId: id, companyName, consentAt: now, prospectId: String(prospect.id), noticeNumber: String(prospect.noticeNumber), amount: Number(prospect.guaranteeAmount), ownerEmail: user?.email || "" });
        await db.prepare("UPDATE agent_prospects SET status = 'matched', lead_id = ?, application_id = ?, updated_at = ? WHERE id = ? AND agent_code = ?").bind(id, applicationId, now, prospect.id, agentCode).run();
        autoApplications += 1;
      }
      return Response.json({ id, ok: true, autoApplications }, { status: 201 });
    }
    if (type === "subagent") {
      const name = String(body.name || "").trim();
      const agency = String(body.agency || "").trim();
      const city = String(body.city || "").trim();
      const phone = String(body.phone || "").trim();
      const email = String(body.email || "").trim();
      if (!name || (!phone && !email)) return Response.json({ error: "Укажите имя агента и телефон или email" }, { status: 400 });
      if (body.consent !== true) return Response.json({ error: "Необходимо согласие на обработку данных и условия партнёрской программы" }, { status: 400 });
      const generated = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
      const newAgentCode = `AGENT-${generated}`;
      await db.prepare(`INSERT INTO agent_partners
        (agent_code, curator_code, name, agency, city, phone, email, status, consent_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          newAgentCode, agentCode, name, agency, city, phone, email, "На подключении", now, now, now,
        ).run();
      return Response.json({ ok: true, agentCode: newAgentCode }, { status: 201 });
    }
    if (type === "application") {
      const leadId = String(body.leadId || "");
      const companyName = String(body.companyName || "").trim();
      const bank = String(body.bank || "").trim();
      const product = String(body.product || "").trim();
      if (!leadId || !companyName || !bank || !product) return Response.json({ error: "Выберите клиента, банк и продукт" }, { status: 400 });
      const guarantee = String(body.applicationType || "") === "guarantee" || product === "Банковская гарантия";
      if (!guarantee && !partnerCommissions.some((item) => item.bank === bank && item.product === product)) return Response.json({ error: "Маршрут отсутствует во внутреннем справочнике" }, { status: 400 });
      if (guarantee) {
        const matches = matchGuaranteePolicies({ amount: Number(body.requestedAmount) || 0, law: String(body.law || ""), guaranteeType: String(body.guaranteeType || ""), termDays: Number(body.termDays) || null });
        if (!matches.some((item) => item.eligible)) return Response.json({ error: "По введённым базовым параметрам нет доступного маршрута БГ. Проверьте сумму, ФЗ и вид гарантии." }, { status: 409 });
      }
      const controls = await readControlState(db);
      if ((!guarantee && controls.disabled.has(bankControlKey(bank))) || controls.disabled.has(productControlKey(product))) return Response.json({ error: "Маршрут отключён администратором" }, { status: 409 });
      const analysisId = String(body.analysisId || "");
      const requestedAmount = Number(body.requestedAmount) || 0;
      const nextAction = String(body.nextAction || "Проверить комплект документов");
      const lead = await db.prepare("SELECT consent_at AS consentAt, company_inn AS companyInn, company_name AS companyName FROM agent_leads WHERE id = ? AND agent_code = ? LIMIT 1").bind(leadId, agentCode).first<{ consentAt?: string; companyInn:string; companyName:string }>();
      if (!lead) return Response.json({ error: "Клиент не принадлежит вашему кабинету" }, { status: 403 });
      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) return Response.json({error:"Укажите положительную сумму заявки"},{status:400});
      if (companyName !== lead.companyName) return Response.json({error:"Компания не соответствует клиенту"},{status:400});
      if (analysisId) {
        const access = await readableAnalysis(db, analysisId, user!);
        if (!access) return Response.json({error:"Нет доступа к анализу"},{status:403});
        const source = await db.prepare("SELECT company_inn AS inn FROM analyses WHERE id = ? LIMIT 1").bind(analysisId).first<{inn:string}>();
        if (source?.inn !== lead.companyInn) return Response.json({error:"Анализ относится к другой компании"},{status:400});
      }
      const id = "broker-" + createHash("sha256").update(JSON.stringify([agentCode,leadId,analysisId,bank,product,requestedAmount,guarantee?[body.law,body.guaranteeType,body.noticeNumber,body.termDays]:null])).digest("hex");
      const existing = await db.prepare("SELECT id FROM agent_applications WHERE id = ? AND agent_code = ? LIMIT 1").bind(id,agentCode).first();
      if(existing) return Response.json({id,ok:true,duplicate:true});
      const analysisOwner = analysisId ? await db.prepare("SELECT owner_email AS ownerEmail FROM analyses WHERE id = ? LIMIT 1").bind(analysisId).first<{ ownerEmail?: string }>() : null;
      const dealOwner = analysisOwner?.ownerEmail || user?.email || "";
      await db.batch([db.prepare(`INSERT OR IGNORE INTO agent_applications
        (id, agent_code, lead_id, analysis_id, company_name, bank, product, requested_amount, calculated_limit, reward_rate_bps, status, next_action, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          id, agentCode, leadId, analysisId, companyName, bank, product,
          requestedAmount, Number(body.calculatedLimit) || 0,
          Math.round(averagePartnerCommissionRate * 10_000), "Подготовка заявки",
          nextAction, now, now,
        ), db.prepare(`INSERT OR IGNORE INTO deals (id, analysis_id, company_name, product, amount, status, owner, next_action, bank, application_group_id, consent_at, owner_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'Подготовка документов', 'Брокер', ?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, analysisId, companyName, product, requestedAmount, nextAction, bank, id, lead?.consentAt || now, dealOwner, now, now),
        db.prepare("INSERT OR IGNORE INTO application_status_history (id, application_id, from_status, to_status, actor_role, actor_email, public_comment, created_at) VALUES (?, ?, '', 'Подготовка документов', 'AGENT', ?, 'Брокер создал заявку', ?)").bind(id+"-created", id, user?.email || "", now),
        db.prepare("INSERT OR IGNORE INTO audit_log (id, entity_type, entity_id, action, actor_role, actor_email, metadata, created_at) VALUES (?, 'APPLICATION', ?, 'CREATE', 'AGENT', ?, ?, ?)").bind(id+"-audit", id, user?.email || "", JSON.stringify({ bank, product, applicationType: guarantee ? "guarantee" : "credit", law: body.law, guaranteeType: body.guaranteeType, noticeNumber: body.noticeNumber, termDays: body.termDays }), now),
      ]);
      return Response.json({ id, ok: true }, { status: 201 });
    }
    return Response.json({ error: "Неизвестный тип операции" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: safeErrorText(error, "Не удалось сохранить данные") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (!user.roles.includes("AGENT") && !user.isAdmin) return Response.json({error:"Нет доступа к кабинету агента"},{status:403});
  try {
    const db = await getDatabase();
    await ensureSchema(db);
    const account = await accountFor(db, user);
    if (!account) return Response.json({ error: "Сначала подключите свой брокерский профиль в /agent" }, { status: 409 });
    const body = await request.json() as { id?: string; entity?: string; status?: string };
    if (!body.id || !body.status) return Response.json({ error: "Нужны id и статус" }, { status: 400 });
    if (body.entity === "lead") {
      const allowedLead = ["Новый клиент", "Анализ готов", "Подготовка заявки"];
      if (!allowedLead.includes(body.status)) return Response.json({ error: "Недопустимый этап клиента" }, { status: 400 });
      await db.prepare("UPDATE agent_leads SET status = ?, updated_at = ? WHERE id = ? AND agent_code = ?").bind(body.status, new Date().toISOString(), body.id, account.agentCode).run();
      return Response.json({ ok: true });
    }
    const allowed = ["Подготовка заявки", "Подготовка документов", "Требуются документы", "На рассмотрении у финансового партнёра", "Предварительное решение", "Одобрена", "Выдана", "Отклонена", "Закрыта"];
    if (!allowed.includes(body.status)) return Response.json({ error: "Недопустимый статус заявки" }, { status: 400 });
    const current = await db.prepare(`SELECT COALESCE((SELECT d.status FROM deals d WHERE d.id = agent_applications.id), status) AS status FROM agent_applications CROSS JOIN (SELECT ?::text AS email) actor WHERE id = ? AND agent_code = ? AND ${brokerApplicationSQL('agent_applications','actor.email')} LIMIT 1`).bind(user.email, body.id, account.agentCode).first<{ status?: string }>();
    if (!current?.status) return Response.json({ error: "Заявка не найдена" }, { status: 404 });
    const terminal = ["Выдана", "Отклонена", "Закрыта", "Отменена клиентом"];
    if (terminal.includes(current.status) && current.status !== body.status) return Response.json({ error: "Завершённый статус нельзя изменить" }, { status: 409 });
    const clientStatus = body.status === "Подготовка заявки" ? "Подготовка документов" : body.status;
    const nextAction: Record<string, string> = {
      "Подготовка документов": "Загрузить и проверить обязательный комплект",
      "Требуются документы": "Клиенту необходимо добавить запрошенные документы",
      "На рассмотрении у финансового партнёра": "Ожидать решение и отвечать на запросы",
      "Предварительное решение": "Согласовать условия и предоставить уточнения",
      "Одобрена": "Проверить условия одобрения и перейти к оформлению",
      "Выдана": "Финансирование завершено",
      "Отклонена": "Зафиксировать причину и обновить план действий",
      "Закрыта": "Заявка закрыта",
    };
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE agent_applications SET status = ?, next_action = ?, updated_at = ? WHERE id = ? AND agent_code = ?").bind(body.status, nextAction[body.status] || "Продолжить подготовку", now, body.id, account.agentCode),
      db.prepare("UPDATE deals SET status = ?, next_action = ?, updated_at = ? WHERE id = ?").bind(clientStatus, nextAction[body.status] || "Продолжить подготовку", now, body.id),
      db.prepare("INSERT INTO application_status_history (id, application_id, from_status, to_status, actor_role, actor_email, public_comment, created_at) VALUES (?, ?, ?, ?, 'AGENT', ?, ?, ?)").bind(crypto.randomUUID(), body.id, current.status, clientStatus, user.email, nextAction[body.status] || "Статус обновлён", now),
      db.prepare("INSERT INTO audit_log (id, entity_type, entity_id, action, actor_role, actor_email, metadata, created_at) VALUES (?, 'APPLICATION', ?, 'STATUS_CHANGE', 'AGENT', ?, ?, ?)").bind(crypto.randomUUID(), body.id, user.email, JSON.stringify({ from: current.status, to: body.status }), now),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: safeErrorText(error, "Не удалось обновить статус") }, { status: 500 });
  }
}
