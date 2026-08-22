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
  const { env } = await import("cloudflare:workers");
  return env.DB as unknown as RuntimeDatabase;
}

async function ensureSchema(db: RuntimeDatabase) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS client_documents (
      id TEXT PRIMARY KEY, company_inn TEXT NOT NULL, analysis_id TEXT NOT NULL DEFAULT '',
      application_id TEXT NOT NULL DEFAULT '', category TEXT NOT NULL, file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream', size_bytes INTEGER NOT NULL DEFAULT 0,
      content_base64 TEXT NOT NULL, uploaded_by TEXT NOT NULL DEFAULT 'Клиент',
      status TEXT NOT NULL DEFAULT 'Загружен', storage_key TEXT NOT NULL DEFAULT '',
      owner_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_accounts (user_email TEXT PRIMARY KEY, agent_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_applications (id TEXT PRIMARY KEY, agent_code TEXT NOT NULL, lead_id TEXT NOT NULL, analysis_id TEXT NOT NULL DEFAULT '', company_name TEXT NOT NULL, bank TEXT NOT NULL, product TEXT NOT NULL, requested_amount INTEGER NOT NULL DEFAULT 0, calculated_limit INTEGER NOT NULL DEFAULT 0, reward_rate_bps INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Подготовка', next_action TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_leads (id TEXT PRIMARY KEY, agent_code TEXT NOT NULL, company_name TEXT NOT NULL, company_inn TEXT NOT NULL DEFAULT '', contact_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '', subscription_status TEXT NOT NULL DEFAULT '', consent_at TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare("CREATE INDEX IF NOT EXISTS client_documents_inn_idx ON client_documents (company_inn, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS client_documents_app_idx ON client_documents (application_id, created_at)"),
  ]);
  try { await db.prepare("ALTER TABLE client_documents ADD COLUMN owner_email TEXT NOT NULL DEFAULT ''").run(); } catch { /* already migrated */ }
}

const MAX_BYTES = 1_250_000;

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  try {
    const url = new URL(request.url);
    const db = await database();
    await ensureSchema(db);
    const downloadId = url.searchParams.get("download")?.trim();
    if (downloadId) {
      const result = await db.batch([db.prepare(user.isAdmin ? "SELECT file_name AS fileName, mime_type AS mimeType, content_base64 AS contentBase64 FROM client_documents WHERE id = ? LIMIT 1" : `SELECT d.file_name AS fileName, d.mime_type AS mimeType, d.content_base64 AS contentBase64 FROM client_documents d
        WHERE d.id = ? AND (d.owner_email = ? OR EXISTS (SELECT 1 FROM agent_applications a JOIN agent_accounts u ON u.agent_code = a.agent_code WHERE a.id = d.application_id AND u.user_email = ?) OR EXISTS (SELECT 1 FROM agent_leads l JOIN agent_accounts u ON u.agent_code = l.agent_code WHERE l.company_inn = d.company_inn AND u.user_email = ?)) LIMIT 1`).bind(...(user.isAdmin ? [downloadId] : [downloadId, user.email, user.email, user.email]))]);
      const file = (result[0]?.results as Array<{ fileName: string; mimeType: string; contentBase64: string }> | undefined)?.[0];
      if (!file) return Response.json({ error: "Документ не найден" }, { status: 404 });
      const binary = atob(file.contentBase64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new Response(bytes, { headers: { "Content-Type": file.mimeType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`, "Cache-Control": "private, no-store" } });
    }
    const inn = (url.searchParams.get("inn") || "").replace(/\D/g, "");
    const applicationId = url.searchParams.get("applicationId")?.trim() || "";
    if (!inn && !applicationId) return Response.json({ error: "Укажите ИНН или заявку" }, { status: 400 });
    const query = applicationId
      ? db.prepare(user.isAdmin ? `SELECT id, company_inn AS companyInn, analysis_id AS analysisId, application_id AS applicationId, category, file_name AS fileName, mime_type AS mimeType, size_bytes AS sizeBytes, uploaded_by AS uploadedBy, status, created_at AS createdAt FROM client_documents WHERE application_id = ? ORDER BY created_at DESC` : `SELECT d.id, d.company_inn AS companyInn, d.analysis_id AS analysisId, d.application_id AS applicationId, d.category, d.file_name AS fileName, d.mime_type AS mimeType, d.size_bytes AS sizeBytes, d.uploaded_by AS uploadedBy, d.status, d.created_at AS createdAt FROM client_documents d WHERE d.application_id = ? AND (d.owner_email = ? OR EXISTS (SELECT 1 FROM agent_applications a JOIN agent_accounts u ON u.agent_code = a.agent_code WHERE a.id = d.application_id AND u.user_email = ?)) ORDER BY d.created_at DESC`).bind(...(user.isAdmin ? [applicationId] : [applicationId, user.email, user.email]))
      : db.prepare(user.isAdmin ? `SELECT id, company_inn AS companyInn, analysis_id AS analysisId, application_id AS applicationId, category, file_name AS fileName, mime_type AS mimeType, size_bytes AS sizeBytes, uploaded_by AS uploadedBy, status, created_at AS createdAt FROM client_documents WHERE company_inn = ? ORDER BY created_at DESC` : `SELECT d.id, d.company_inn AS companyInn, d.analysis_id AS analysisId, d.application_id AS applicationId, d.category, d.file_name AS fileName, d.mime_type AS mimeType, d.size_bytes AS sizeBytes, d.uploaded_by AS uploadedBy, d.status, d.created_at AS createdAt FROM client_documents d WHERE d.company_inn = ? AND (d.owner_email = ? OR EXISTS (SELECT 1 FROM agent_leads l JOIN agent_accounts u ON u.agent_code = l.agent_code WHERE l.company_inn = d.company_inn AND u.user_email = ?)) ORDER BY d.created_at DESC`).bind(...(user.isAdmin ? [inn] : [inn, user.email, user.email]));
    const result = await db.batch([query]);
    return Response.json({ documents: result[0]?.results ?? [], maxBytes: MAX_BYTES, storage: "Пилотное защищённое хранилище" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить документы" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json() as { companyInn?: string; analysisId?: string; applicationId?: string; category?: string; fileName?: string; mimeType?: string; sizeBytes?: number; contentBase64?: string; uploadedBy?: string };
    const companyInn = String(body.companyInn || "").replace(/\D/g, "");
    const fileName = String(body.fileName || "").trim().slice(0, 240);
    const sizeBytes = Number(body.sizeBytes) || 0;
    const contentBase64 = String(body.contentBase64 || "");
    if (!/^(?:\d{10}|\d{12})$/.test(companyInn) || !fileName || sizeBytes <= 0 || sizeBytes > MAX_BYTES || !contentBase64) return Response.json({ error: `Файл должен быть до ${Math.round(MAX_BYTES / 1000)} КБ и привязан к корректному ИНН` }, { status: 400 });
    if (contentBase64.length > Math.ceil(MAX_BYTES * 4 / 3) + 16) return Response.json({ error: "Размер содержимого превышен" }, { status: 400 });
    const allowed = /\.(pdf|xlsx?|csv|txt|docx?)$/i;
    if (!allowed.test(fileName)) return Response.json({ error: "Допустимы PDF, Excel, CSV, TXT, DOC и DOCX" }, { status: 400 });
    const db = await database();
    await ensureSchema(db);
    const analysisId = String(body.analysisId || "");
    const applicationId = String(body.applicationId || "");
    if (!user.isAdmin) {
      const accessQuery = analysisId
        ? db.prepare("SELECT id FROM analyses WHERE id = ? AND owner_email = ? LIMIT 1").bind(analysisId, user.email)
        : db.prepare(`SELECT d.id FROM deals d WHERE d.id = ? AND d.owner_email = ?
          UNION SELECT a.id FROM agent_applications a JOIN agent_accounts u ON u.agent_code = a.agent_code WHERE a.id = ? AND u.user_email = ? LIMIT 1`).bind(applicationId, user.email, applicationId, user.email);
      const access = await db.batch([accessQuery]);
      if (!access[0]?.results?.length) return Response.json({ error: "Нет доступа к досье" }, { status: 403 });
    }
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const storageKey = `pilot/${companyInn}/${body.applicationId || "dossier"}/${id}`;
    await db.prepare(`INSERT INTO client_documents (id, company_inn, analysis_id, application_id, category, file_name, mime_type, size_bytes, content_base64, uploaded_by, status, storage_key, owner_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Загружен', ?, ?, ?)`)
      .bind(id, companyInn, analysisId, applicationId, String(body.category || "Прочее").slice(0, 80), fileName, String(body.mimeType || "application/octet-stream"), sizeBytes, contentBase64, String(body.uploadedBy || "Клиент").slice(0, 80), storageKey, user.email, createdAt).run();
    return Response.json({ document: { id, companyInn, analysisId: body.analysisId || "", applicationId: body.applicationId || "", category: body.category || "Прочее", fileName, mimeType: body.mimeType || "application/octet-stream", sizeBytes, uploadedBy: body.uploadedBy || "Клиент", status: "Загружен", createdAt } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить документ" }, { status: 500 });
  }
}
