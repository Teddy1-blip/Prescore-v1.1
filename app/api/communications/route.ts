import {safeErrorText} from '../../../lib/release/security';
import {getRuntime} from "../../../lib/platform/runtime";
import { requireApiUser, unauthorized } from "../api-auth";

type PreparedStatement = {
  bind: (...values: unknown[]) => PreparedStatement;
  run: () => Promise<unknown>;
};

type RuntimeDatabase = {
  prepare: (query: string) => PreparedStatement;
  batch: (statements: PreparedStatement[]) => Promise<Array<{ results: unknown[] }>>;
};

async function database() {
  const env = getRuntime();
  return env.DB as unknown as RuntimeDatabase;
}

async function ensureSchema(db: RuntimeDatabase) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS application_messages (
      id TEXT PRIMARY KEY, application_id TEXT NOT NULL, author_role TEXT NOT NULL,
      author_name TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', document_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_accounts (user_email TEXT PRIMARY KEY, agent_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_applications (id TEXT PRIMARY KEY, agent_code TEXT NOT NULL, lead_id TEXT NOT NULL, analysis_id TEXT NOT NULL DEFAULT '', company_name TEXT NOT NULL, bank TEXT NOT NULL, product TEXT NOT NULL, requested_amount INTEGER NOT NULL DEFAULT 0, calculated_limit INTEGER NOT NULL DEFAULT 0, reward_rate_bps INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Подготовка', next_action TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare("CREATE INDEX IF NOT EXISTS application_messages_app_idx ON application_messages (application_id, created_at)"),
  ]);
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  try {
    const applicationId = new URL(request.url).searchParams.get("applicationId")?.trim() || "";
    if (!applicationId) return Response.json({ error: "Не указана заявка" }, { status: 400 });
    const db = await database();
    await ensureSchema(db);
    if (!user.isAdmin) {
      const access = await db.batch([db.prepare(`SELECT d.id FROM deals d WHERE d.id = ? AND d.owner_email = ?
        UNION SELECT a.id FROM agent_applications a JOIN agent_accounts u ON u.agent_code = a.agent_code WHERE a.id = ? AND u.user_email = ? LIMIT 1`).bind(applicationId, user.email, applicationId, user.email)]);
      if (!access[0]?.results?.length) return Response.json({ error: "Нет доступа к чату заявки" }, { status: 403 });
    }
    const result = await db.batch([db.prepare(`SELECT id, application_id AS applicationId, author_role AS authorRole,
      author_name AS authorName, message, document_id AS documentId, created_at AS createdAt
      FROM application_messages WHERE application_id = ? ORDER BY created_at ASC LIMIT 500`).bind(applicationId)]);
    return Response.json({ messages: result[0]?.results ?? [] });
  } catch (error) {
    return Response.json({ error: safeErrorText(error, "Не удалось загрузить сообщения") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json() as { applicationId?: string; authorRole?: string; authorName?: string; message?: string; documentId?: string };
    const applicationId = String(body.applicationId || "").trim();
    const authorRole = user.isAdmin ? "admin" : user.roles.includes("AGENT") ? "broker" : "client";
    const authorName = String(user.displayName || user.email).trim().slice(0, 120);
    const message = String(body.message || "").trim();if(message.length>4000)return Response.json({error:"MESSAGE_TOO_LONG"},{status:413});
    const documentId = String(body.documentId || "").trim();
    if (!applicationId || (!message && !documentId)) return Response.json({ error: "Введите сообщение или прикрепите документ" }, { status: 400 });
    const db = await database();
    await ensureSchema(db);
    if (!user.isAdmin) {
      const access = await db.batch([db.prepare(`SELECT d.id FROM deals d WHERE d.id = ? AND d.owner_email = ?
        UNION SELECT a.id FROM agent_applications a JOIN agent_accounts u ON u.agent_code = a.agent_code WHERE a.id = ? AND u.user_email = ? LIMIT 1`).bind(applicationId, user.email, applicationId, user.email)]);
      if (!access[0]?.results?.length) return Response.json({ error: "Нет доступа к чату заявки" }, { status: 403 });
    }
    if(documentId){const linked=await db.batch([db.prepare('SELECT id FROM client_documents WHERE id=? AND application_id=?').bind(documentId,applicationId)]);if(!linked[0]?.results.length)return Response.json({error:'DOCUMENT_ASSOCIATION_REQUIRED'},{status:403});}
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await db.prepare(`INSERT INTO application_messages (id, application_id, author_role, author_name, message, document_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, applicationId, authorRole, authorName, message, documentId, createdAt).run();
    return Response.json({ message: { id, applicationId, authorRole, authorName, message, documentId, createdAt } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: safeErrorText(error, "Не удалось отправить сообщение") }, { status: 500 });
  }
}
