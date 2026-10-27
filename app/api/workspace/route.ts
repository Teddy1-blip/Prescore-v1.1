import {safeErrorText} from '../../../lib/release/security';
import {parseFinancingRequest} from "../../../lib/workspace/financing-request";
import {getRuntime} from "../../../lib/platform/runtime";
import { analysisForStorage, type AnalysisResult } from "../../../lib/prescore";
import { compareCreditPortfolio, type CreditHistoryReport } from "../../../lib/credit-history";
import type { QuarterlyFinancialReport } from "../../../lib/quarterly-report";
import { applyAnalysisControls, readControlState } from "../../../lib/admin-controls";
import { readableAnalysis, requireApiUser, unauthorized } from "../api-auth";
import { analysisView, resolveAnalysisTier } from "../../../lib/entitlements";
import { structuredAttachmentIsUntrusted } from "../../../lib/credit-engine/source-foundation";

// Batch consumers (including admin controls) require only the common statement methods.
// Keep all() on prepared statements used for lightweight summary queries.
type BatchStatement = {
  bind: (...values: unknown[]) => BatchStatement;
  run: () => Promise<unknown>;
  first: <T = unknown>() => Promise<T | null>;
};

type PreparedStatement = {
  bind: (...values: unknown[]) => PreparedStatement;
  run: () => Promise<unknown>;
  first: <T = unknown>() => Promise<T | null>;
  all: <T = unknown>() => Promise<{ results: T[] }>;
};

type RuntimeDatabase = {
  prepare: (query: string) => PreparedStatement;
  batch: (statements: BatchStatement[]) => Promise<Array<{ results: unknown[] }>>;
};

async function getDatabase() {
  const env = getRuntime();
  return env.DB as unknown as RuntimeDatabase;
}

type AnalysisPayload = {
  id: string;
  companyName: string;
  companyInn?: string;
  fileName: string;
  periodFrom: string;
  periodTo: string;
  score: number;
  grade: string;
  readiness: string;
};

async function ensureSchema(db: RuntimeDatabase) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      company_inn TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      period_from TEXT NOT NULL,
      period_to TEXT NOT NULL,
      score INTEGER NOT NULL,
      grade TEXT NOT NULL,
      readiness TEXT NOT NULL,
      payload TEXT NOT NULL,
      owner_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      analysis_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      product TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Новая',
      owner TEXT NOT NULL DEFAULT 'Не назначен',
      next_action TEXT NOT NULL DEFAULT 'Связаться с клиентом',
      bank TEXT NOT NULL DEFAULT '',
      application_group_id TEXT NOT NULL DEFAULT '',
      consent_at TEXT NOT NULL DEFAULT '',
      owner_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_leads (
      id TEXT PRIMARY KEY, agent_code TEXT NOT NULL, company_name TEXT NOT NULL,
      company_inn TEXT NOT NULL DEFAULT '', contact_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'Клиентский кабинет', status TEXT NOT NULL DEFAULT 'Подготовка заявки',
      subscription_status TEXT NOT NULL DEFAULT 'Активна', consent_at TEXT NOT NULL,
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
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_accounts (
      user_email TEXT PRIMARY KEY, agent_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS application_status_history (
      id TEXT PRIMARY KEY, application_id TEXT NOT NULL, from_status TEXT NOT NULL DEFAULT '',
      to_status TEXT NOT NULL, actor_role TEXT NOT NULL, actor_email TEXT NOT NULL DEFAULT '',
      public_comment TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL,
      actor_role TEXT NOT NULL, actor_email TEXT NOT NULL DEFAULT '', metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS analyses_created_idx ON analyses (created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS deals_status_idx ON deals (status, updated_at)"),
  ]);
  for (const statement of [
    "ALTER TABLE deals ADD COLUMN bank TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE deals ADD COLUMN application_group_id TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE deals ADD COLUMN consent_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE deals ADD COLUMN owner_email TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE analyses ADD COLUMN owner_email TEXT NOT NULL DEFAULT ''",
  ]) {
    try { await db.prepare(statement).run(); } catch { /* column already exists */ }
  }
}

function safeJson(value: string) {
  try { return JSON.parse(value); } catch { return null; }
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  try {
    const db = await getDatabase();
    // The landing page needs labels and IDs, not dozens of full credit payloads.
    // This owner-scoped, read-only projection never migrates, mutates or calculates.
    const requestUrl = new URL(request.url);
    if (!requestUrl.searchParams.get("client") && requestUrl.searchParams.get("projection") === "summary") {
      const ownerFilter = user.isAdmin
        ? "(owner_email = ? OR owner_email = '')"
        : "owner_email = ?";
      const sql = `SELECT id, company_name AS companyName, company_inn AS companyInn,
        created_at AS createdAt, period_from AS periodFrom, period_to AS periodTo
        FROM analyses WHERE archive_state = 'ACTIVE' AND ${ownerFilter}
        ORDER BY created_at DESC LIMIT 50`;
      const { results } = await db.prepare(sql).bind(user.email).all<{
        id: string; companyName: string; companyInn: string;
        createdAt: string; periodFrom: string; periodTo: string;
      }>();
      return Response.json({ analyses: results, deals: [], readOnly: false,
        accessRole: "owner", projection: "summary" });
    }
    await ensureSchema(db);
    if (user.isAdmin) await db.batch([
      db.prepare("UPDATE analyses SET owner_email = ? WHERE owner_email = ''").bind(user.email),
      db.prepare("UPDATE deals SET owner_email = ? WHERE owner_email = ''").bind(user.email),
    ]);
    const requestedId = new URL(request.url).searchParams.get("client") || "";
    const controls = await readControlState(db);
    if (requestedId) {
      const access = await readableAnalysis<{ payload: string; companyInn: string; ownerEmail: string }>(db, requestedId, user);
      if (!access) return Response.json({ error: "Досье не найдено или не закреплено за вашим кабинетом" }, { status: 404 });
      const [dealResult, historyResult] = await db.batch([
        db.prepare("SELECT id, analysis_id AS analysisId, company_name AS companyName, product, amount, status, owner, next_action AS nextAction, bank, application_group_id AS applicationGroupId, consent_at AS consentAt, created_at AS createdAt, updated_at AS updatedAt FROM deals WHERE analysis_id = ? ORDER BY updated_at DESC LIMIT 100").bind(requestedId),
        db.prepare(`SELECT h.id, h.application_id AS applicationId, h.from_status AS fromStatus, h.to_status AS toStatus,
          h.actor_role AS actorRole, h.public_comment AS publicComment, h.created_at AS createdAt
          FROM application_status_history h JOIN deals d ON d.id = h.application_id
          WHERE d.analysis_id = ? ORDER BY h.created_at ASC LIMIT 1000`).bind(requestedId),
      ]);
      const parsed = safeJson(access.row.payload) as AnalysisResult | null;
      if (!parsed) return Response.json({ error: "Сохранённое досье повреждено" }, { status: 409 });
      const histories = historyResult.results as Array<{ applicationId: string }>;
      const deals = (dealResult.results as Array<Record<string, unknown>>).map((deal) => ({ ...deal, statusHistory: histories.filter((item) => item.applicationId === deal.id) }));
      const tier = await resolveAnalysisTier(db, { analysisId: parsed.id, userEmail: access.row.ownerEmail, companyInn: access.row.companyInn, privileged: user.isAdmin || access.access === "agent" });
      return Response.json({ analyses: [analysisView(applyAnalysisControls(parsed, controls), tier)], deals, readOnly: access.access === "agent", accessRole: access.access });
    }
    const [analysisResult, dealResult, historyResult] = await db.batch([
      db.prepare("SELECT payload FROM analyses WHERE archive_state = 'ACTIVE' AND owner_email = ? ORDER BY created_at DESC LIMIT 50").bind(user.email),
      db.prepare("SELECT id, analysis_id AS analysisId, company_name AS companyName, product, amount, status, owner, next_action AS nextAction, bank, application_group_id AS applicationGroupId, consent_at AS consentAt, created_at AS createdAt, updated_at AS updatedAt FROM deals WHERE NOT EXISTS (SELECT 1 FROM analyses archived WHERE archived.id=deals.analysis_id AND archived.archive_state<>'ACTIVE') AND owner_email = ? ORDER BY updated_at DESC LIMIT 100").bind(user.email),
      db.prepare(`SELECT h.id, h.application_id AS applicationId, h.from_status AS fromStatus, h.to_status AS toStatus,
        h.actor_role AS actorRole, h.public_comment AS publicComment, h.created_at AS createdAt
        FROM application_status_history h JOIN deals d ON d.id = h.application_id
        WHERE NOT EXISTS (SELECT 1 FROM analyses archived WHERE archived.id=d.analysis_id AND archived.archive_state<>'ACTIVE') AND d.owner_email = ? ORDER BY h.created_at ASC LIMIT 1000`).bind(user.email),
    ]);
    const storedAnalyses = (analysisResult.results as Array<{ payload: string }>).map((row) => safeJson(row.payload) as AnalysisResult | null).filter((item): item is AnalysisResult => Boolean(item));
    const analyses = await Promise.all(storedAnalyses.map(async (item) => {
      const tier = await resolveAnalysisTier(db, { analysisId: item.id, userEmail: user.email, companyInn: item.companyInn, privileged: user.isAdmin });
      return analysisView(applyAnalysisControls(item, controls), tier);
    }));
    const histories = historyResult.results as Array<{ applicationId: string }>;
    const deals = (dealResult.results as Array<Record<string, unknown>>).map((deal) => ({ ...deal, statusHistory: histories.filter((item) => item.applicationId === deal.id) }));
    return Response.json({ analyses, deals, readOnly: false, accessRole: "owner" });
  } catch (error) {
    return Response.json({ error: safeErrorText(error, "Не удалось загрузить кабинет") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  try {
    const db = await getDatabase();
    await ensureSchema(db);
    const body = await request.json() as { type?: string; analysis?: AnalysisPayload & Record<string, unknown>; deal?: Record<string, unknown>; analysisId?: string; companyName?: string; companyInn?: string; agentCode?: string; consentAt?: string; creditHistory?: CreditHistoryReport; quarterlyReport?: QuarterlyFinancialReport; requestId?: string; financingRequest?: unknown; applications?: Array<{ bank?: string; product?: string; amount?: number }> };
    if (body.type === "analysis" && body.analysis) {
      return Response.json({ error: "Расчётный результат создаётся и изменяется только серверными модулями" }, { status: 409 });
    }
    if (structuredAttachmentIsUntrusted(body)) {
      return Response.json({ error: "Готовые значения БКИ и квартальной отчётности не принимаются. Передайте исходный файл в /api/source-documents для серверной проверки." }, { status: 409 });
    }
    if ((body.type === "credit-history" || body.type === "quarterly-report") && body.analysisId) {
      const rows = await db.batch([db.prepare("SELECT payload, owner_email AS ownerEmail FROM analyses WHERE archive_state = 'ACTIVE' AND id = ? LIMIT 1").bind(body.analysisId)]);
      const row = (rows[0]?.results as Array<{ payload?: string; ownerEmail?: string }>)[0];
      if (!row?.payload || (row.ownerEmail !== user.email && !user.isAdmin)) return Response.json({ error: "Анализ не найден в вашем кабинете" }, { status: 404 });
      const analysis = safeJson(row.payload) as AnalysisResult | null;
      if (!analysis) return Response.json({ error: "Сохранённый анализ повреждён" }, { status: 409 });
      let updated: AnalysisResult;
      if (body.type === "credit-history" && body.creditHistory) {
        const report = body.creditHistory;
        if (report.subjectType === "Юридическое лицо" && report.subjectInn && report.subjectInn !== analysis.companyInn) return Response.json({ error: "ИНН корпоративного БКИ не совпадает с компанией" }, { status: 400 });
        if (report.subjectType === "Физическое лицо" && (!report.relationshipToCompany || report.relationshipToCompany === "Не указано")) return Response.json({ error: "Укажите роль субъекта БКИ" }, { status: 400 });
        const affectsCompanyDebt = report.subjectType === "Юридическое лицо" || (report.relationshipToCompany === "ИП-заёмщик" && analysis.companyInn.length === 12 && report.subjectInn === analysis.companyInn);
        const normalizedReport = { ...report, affectsCompanyDebt };
        const calculated = compareCreditPortfolio({ report: normalizedReport, avgMonthlyInflow: analysis.metrics.avgMonthlyInflow, statementMonthlyDebtPayment: analysis.metrics.currentMonthlyDebtPayment, baseMonthlyPaymentCapacity: analysis.metrics.baseMonthlyPaymentCapacity, estimatedLimitMax: analysis.metrics.estimatedLimitMax, limitConfidence: analysis.metrics.limitConfidence });
        updated = { ...analysis, creditHistory: normalizedReport, creditPortfolioComparison: calculated.comparison, creditHistoryInsights: calculated.insights };
      } else if (body.type === "quarterly-report" && body.quarterlyReport) {
        if (body.quarterlyReport.companyInn && body.quarterlyReport.companyInn !== analysis.companyInn) return Response.json({ error: "ИНН квартальной отчётности не совпадает с компанией" }, { status: 400 });
        updated = { ...analysis, quarterlyReport: body.quarterlyReport };
      } else return Response.json({ error: "Не передан структурированный результат" }, { status: 400 });
      const stored = analysisForStorage(updated);
      await db.prepare("UPDATE analyses SET payload = ? WHERE id = ? AND owner_email = ?").bind(JSON.stringify(stored), body.analysisId, row.ownerEmail).run();
      const controls = await readControlState(db);
      const tier = await resolveAnalysisTier(db, { analysisId: stored.id, userEmail: row.ownerEmail || user.email, companyInn: stored.companyInn, privileged: user.isAdmin });
      return Response.json({ analysis: analysisView(applyAnalysisControls(stored, controls), tier) });
    }
    if(body.type==='financing-request'&&body.analysisId){
      const row=await db.prepare("SELECT payload, owner_email AS ownerEmail FROM analyses WHERE archive_state = 'ACTIVE' AND id = ? LIMIT 1").bind(body.analysisId).first<{payload:string;ownerEmail:string}>();
      if(!row||row.ownerEmail!==user.email&&!user.isAdmin)return Response.json({error:"Анализ не найден в вашем кабинете"},{status:404});
      const analysis=safeJson(row.payload) as AnalysisResult|null;if(!analysis?.sourceManifest)return Response.json({error:"Источники сохранённого анализа недоступны. Создайте новый анализ по выпискам."},{status:409});
      let financingRequest;try{financingRequest=parseFinancingRequest(body.financingRequest,new Date().toISOString());}catch(error){return Response.json({error:error instanceof Error?error.message:'Проверьте параметры'},{status:400});}
      const sourceId='client-request-'+analysis.id;
      const source={sourceId,sourceType:'OTHER' as const,status:'READY' as const,companyInn:analysis.companyInn,sourceName:'Заявленные параметры финансирования',receivedAt:financingRequest.receivedAt,confidence:null,warnings:['CLIENT_DECLARED_NOT_INDEPENDENT_PROOF']};
      const stored=analysisForStorage({...analysis,financingRequestV1:financingRequest,sourceManifest:{...analysis.sourceManifest,external:[...(analysis.sourceManifest?.external??[]).filter(s=>s.sourceId!==sourceId),source]}});
      await db.prepare("UPDATE analyses SET payload = ? WHERE id = ? AND owner_email = ?").bind(JSON.stringify(stored),analysis.id,row.ownerEmail).run();
      return Response.json({saved:true,financingRequest});
    }
    if (body.type === "deal" && body.deal) {
      const item = body.deal;
      const id = String(item.id || crypto.randomUUID());
      const analysisId = String(item.analysisId || "");
      const companyName = String(item.companyName || "").trim();
      const product = String(item.product || "").trim();
      if (!analysisId || !companyName || !product) return Response.json({ error: "Заполните компанию и продукт" }, { status: 400 });
      const ownership = await db.batch([db.prepare("SELECT owner_email AS ownerEmail FROM analyses WHERE archive_state = 'ACTIVE' AND id = ? LIMIT 1").bind(analysisId)]);
      if (String((ownership[0]?.results as Array<{ ownerEmail?: string }>)[0]?.ownerEmail || "") !== user.email && !user.isAdmin) return Response.json({ error: "Нет доступа к анализу" }, { status: 403 });
      const findSaved=async()=>{
        const saved=await db.prepare("SELECT id, analysis_id AS analysisId, product, amount, bank, owner_email AS ownerEmail FROM deals WHERE id = ? LIMIT 1").bind(id).first<{id:string;analysisId:string;product:string;amount:number;bank:string;ownerEmail:string}>();
        if(!saved)return null;
        return saved.ownerEmail===user.email&&saved.analysisId===analysisId&&saved.product===product&&Number(saved.amount)===(Number(item.amount)||0)&&saved.bank===String(item.bank||"")?Response.json({deal:{...item,id},replayed:true}):Response.json({error:"Этот идентификатор уже использован для другой заявки"},{status:409});
      };
      const replay=await findSaved();if(replay)return replay;
      try{await db.batch([
        db.prepare(`INSERT INTO deals
        (id, analysis_id, company_name, product, amount, status, owner, next_action, bank, application_group_id, consent_at, owner_email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, analysisId, companyName, product, Number(item.amount) || 0, String(item.status || "Новая"), String(item.owner || "Не назначен"), String(item.nextAction || "Связаться с клиентом"), String(item.bank || ""), String(item.applicationGroupId || ""), String(item.consentAt || ""), user.email, new Date().toISOString(), new Date().toISOString()),

        db.prepare("INSERT INTO application_status_history (id, application_id, from_status, to_status, actor_role, actor_email, public_comment, created_at) VALUES (?, ?, '', ?, 'CLIENT', ?, 'Создан черновик заявки', ?)").bind(crypto.randomUUID(), id, String(item.status || "Новая"), user.email, new Date().toISOString()),
        db.prepare("INSERT INTO audit_log (id, entity_type, entity_id, action, actor_role, actor_email, metadata, created_at) VALUES (?, 'APPLICATION', ?, 'CREATE', 'CLIENT', ?, ?, ?)").bind(crypto.randomUUID(), id, user.email, JSON.stringify({ product, bank: String(item.bank || "") }), new Date().toISOString()),
      ]);}catch(error){const replay=await findSaved();if(replay)return replay;throw error;}
      try {
        const rows = await db.batch([db.prepare("SELECT company_inn AS companyInn FROM analyses WHERE archive_state = 'ACTIVE' AND id = ? LIMIT 1").bind(analysisId)]);
        const companyInn = String((rows[0]?.results as Array<{ companyInn?: string }> | undefined)?.[0]?.companyInn || "");
        if (companyInn) {
          const leadRows = await db.batch([db.prepare("SELECT id, agent_code AS agentCode FROM agent_leads WHERE company_inn = ? ORDER BY updated_at DESC LIMIT 1").bind(companyInn)]);
          const leadRecord = (leadRows[0]?.results as Array<{ id?: string; agentCode?: string }> | undefined)?.[0];
          const agentCode = String(leadRecord?.agentCode || "AGENT-ANTON-001");
          const foundLead = leadRecord?.id;
          const leadId = foundLead || `client-${companyInn}`;
          const now = new Date().toISOString();
          if (!foundLead) await db.prepare(`INSERT OR IGNORE INTO agent_leads (id, agent_code, company_name, company_inn, contact_name, phone, email, source, status, subscription_status, consent_at, created_at, updated_at) VALUES (?, ?, ?, ?, '', '', '', 'Клиентский кабинет', 'Подготовка заявки', 'Активна', ?, ?, ?)`)
            .bind(leadId, agentCode, companyName, companyInn, String(item.consentAt || now), now, now).run();
          await db.prepare(`INSERT OR REPLACE INTO agent_applications (id, agent_code, lead_id, analysis_id, company_name, bank, product, requested_amount, calculated_limit, reward_rate_bps, status, next_action, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Подготовка заявки', ?, ?, ?)`)
            .bind(id, agentCode, leadId, analysisId, companyName, String(item.bank || "Выбор банка"), product, Number(item.amount) || 0, Number(item.amount) || 0, String(item.nextAction || "Проверить комплект документов"), now, now).run();
        }
      } catch { /* заявка клиента сохранена; синхронизацию брокеру можно повторить */ }
      return Response.json({ deal: { ...item, id } }, { status: 201 });
    }
    if (body.type === "applications" && body.applications?.length) {
      const analysisId = String(body.analysisId || "");
      const companyName = String(body.companyName || "").trim();
      const companyInn = String(body.companyInn || "").replace(/\D/g, "");
      const consentAt = String(body.consentAt || "");
      if (!analysisId || !companyName || !/^(?:\d{10}|\d{12})$/.test(companyInn) || !consentAt || body.applications.length > 12) return Response.json({ error: "Проверьте компанию, согласие и список получателей" }, { status: 400 });
      const ownership = await db.batch([db.prepare("SELECT owner_email AS ownerEmail FROM analyses WHERE archive_state = 'ACTIVE' AND id = ? LIMIT 1").bind(analysisId)]);
      if (String((ownership[0]?.results as Array<{ ownerEmail?: string }>)[0]?.ownerEmail || "") !== user.email && !user.isAdmin) return Response.json({ error: "Нет доступа к анализу" }, { status: 403 });
      const groupId = body.requestId || crypto.randomUUID();
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId))return Response.json({error:"Некорректный идентификатор запроса"},{status:400});
      const requested=[...new Map(body.applications.map(item=>{
        const bank=String(item.bank||"").trim(),product=String(item.product||"").trim(),amount=Math.max(0,Number(item.amount)||0);
        return [JSON.stringify([bank.toLocaleLowerCase('ru-RU'),product,amount]),{bank,product,amount}];
      })).values()].filter(item=>item.bank&&item.product).sort((a,b)=>a.bank.localeCompare(b.bank)||a.product.localeCompare(b.product)||a.amount-b.amount);
      const findGroup=async()=>{
        const rows=await db.batch([db.prepare("SELECT id, analysis_id AS analysisId, company_name AS companyName, product, amount, status, owner, next_action AS nextAction, bank, application_group_id AS applicationGroupId, consent_at AS consentAt, created_at AS createdAt, updated_at AS updatedAt FROM deals WHERE application_group_id = ? AND owner_email = ? ORDER BY bank, product, amount").bind(groupId,user.email)]);
        const deals=rows[0].results as Array<{analysisId:string;bank:string;product:string;amount:number}>;
        if(!deals.length)return null;
        const matches=deals.length===requested.length&&requested.every(item=>deals.some(d=>d.analysisId===analysisId&&d.bank.toLocaleLowerCase('ru-RU')===item.bank.toLocaleLowerCase('ru-RU')&&d.product===item.product&&Number(d.amount)===item.amount));
        return matches?Response.json({groupId,deals,replayed:true}):Response.json({error:"Идентификатор запроса уже использован с другими параметрами"},{status:409});
      };
      const replay=await findGroup();if(replay)return replay;
      const now = new Date().toISOString();
      const leadQuery = await db.batch([db.prepare("SELECT id, agent_code AS agentCode FROM agent_leads WHERE company_inn = ? ORDER BY updated_at DESC LIMIT 1").bind(companyInn)]);
      const leadRecord = (leadQuery[0]?.results as Array<{ id?: string; agentCode?: string }> | undefined)?.[0];
      const agentCode = String(leadRecord?.agentCode || "AGENT-ANTON-001");
      const foundLead = leadRecord?.id;
      const leadId = foundLead || `client-${companyInn}`;
      if (!foundLead) await db.prepare(`INSERT OR IGNORE INTO agent_leads
        (id, agent_code, company_name, company_inn, contact_name, phone, email, source, status, subscription_status, consent_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, '', '', '', 'Клиентский кабинет', 'Подготовка заявки', 'Активна', ?, ?, ?)`)
        .bind(leadId, agentCode, companyName, companyInn, consentAt, now, now).run();
      const created = requested.map((item,index) => {
        const id = groupId+'-'+index;
        const bank = String(item.bank || "").trim();
        const product = String(item.product || "").trim();
        const amount = Math.max(0, Number(item.amount) || 0);
        return { id, analysisId, companyName, product, amount, status: "Подготовка документов", owner: "Брокер", nextAction: "Проверить документы и согласие перед отправкой", bank, applicationGroupId: groupId, consentAt, createdAt: now, updatedAt: now };
      }).filter((item) => item.bank && item.product);
      if (!created.length) return Response.json({ error: "Не выбраны получатели" }, { status: 400 });
      try{await db.batch(created.flatMap((item) => [
        db.prepare(`INSERT INTO deals (id, analysis_id, company_name, product, amount, status, owner, next_action, bank, application_group_id, consent_at, owner_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(item.id, item.analysisId, item.companyName, item.product, item.amount, item.status, item.owner, item.nextAction, item.bank, item.applicationGroupId, item.consentAt, user.email, now, now),
        db.prepare(`INSERT OR REPLACE INTO agent_applications (id, agent_code, lead_id, analysis_id, company_name, bank, product, requested_amount, calculated_limit, reward_rate_bps, status, next_action, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`)
          .bind(item.id, agentCode, leadId, analysisId, companyName, item.bank, item.product, item.amount, item.amount, "Подготовка заявки", item.nextAction, now, now),
        db.prepare("INSERT INTO application_status_history (id, application_id, from_status, to_status, actor_role, actor_email, public_comment, created_at) VALUES (?, ?, '', ?, 'CLIENT', ?, 'Заявка создана по выбранному маршруту', ?)").bind(crypto.randomUUID(), item.id, item.status, user.email, now),
        db.prepare("INSERT INTO audit_log (id, entity_type, entity_id, action, actor_role, actor_email, metadata, created_at) VALUES (?, 'APPLICATION', ?, 'CREATE', 'CLIENT', ?, ?, ?)").bind(crypto.randomUUID(), item.id, user.email, JSON.stringify({ bank: item.bank, product: item.product }), now),
      ]));}catch(error){const replay=await findGroup();if(replay)return replay;throw error;}
      return Response.json({ groupId, deals: created }, { status: 201 });
    }
    return Response.json({ error: "Неизвестный тип операции" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: safeErrorText(error, "Не удалось сохранить данные") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  try {
    const db = await getDatabase();
    await ensureSchema(db);
    const body = await request.json() as { id?: string; status?: string };
    if (!body.id || !body.status) return Response.json({ error: "Нужны id и status" }, { status: 400 });
    if (body.status !== "Отменена клиентом") return Response.json({ error: "Статус меняет брокер или администратор; клиент может только отменить заявку" }, { status: 403 });
    const currentRows = await db.batch([db.prepare("SELECT status FROM deals WHERE id = ? AND owner_email = ? LIMIT 1").bind(body.id, user.email)]);
    const current = String((currentRows[0]?.results as Array<{ status?: string }>)[0]?.status || "");
    if (!current) return Response.json({ error: "Заявка не найдена" }, { status: 404 });
    if (["Выдана", "Закрыта", "Отклонена", "Отменена клиентом"].includes(current)) return Response.json({ error: "Завершённую заявку нельзя отменить" }, { status: 409 });
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE deals SET status = ?, next_action = 'Заявка отменена клиентом', updated_at = ? WHERE id = ? AND owner_email = ?").bind(body.status, now, body.id, user.email),
      db.prepare("UPDATE agent_applications SET status = ?, next_action = 'Заявка отменена клиентом', updated_at = ? WHERE id = ?").bind(body.status, now, body.id),
      db.prepare("INSERT INTO application_status_history (id, application_id, from_status, to_status, actor_role, actor_email, public_comment, created_at) VALUES (?, ?, ?, ?, 'CLIENT', ?, 'Клиент отменил заявку', ?)").bind(crypto.randomUUID(), body.id, current, body.status, user.email, now),
      db.prepare("INSERT INTO audit_log (id, entity_type, entity_id, action, actor_role, actor_email, metadata, created_at) VALUES (?, 'APPLICATION', ?, 'CANCEL', 'CLIENT', ?, '{}', ?)").bind(crypto.randomUUID(), body.id, user.email, now),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: safeErrorText(error, "Не удалось обновить заявку") }, { status: 500 });
  }
}
