import {getRuntime} from "../../../lib/platform/runtime";
import { requireApiUser, unauthorized } from "../api-auth";

type Statement = { bind: (...values: unknown[]) => Statement; run: () => Promise<unknown>; first: <T = unknown>() => Promise<T | null> };
type Database = { prepare: (query: string) => Statement };

async function database() { const env = getRuntime(); return env.DB as unknown as Database; }
async function ensure(db: Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, payer_type TEXT NOT NULL, payer_inn TEXT NOT NULL DEFAULT '',
    payer_name TEXT NOT NULL, company_inn TEXT NOT NULL, company_name TEXT NOT NULL, user_email TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 6500, days INTEGER NOT NULL DEFAULT 30, status TEXT NOT NULL DEFAULT 'Ожидает оплаты',
    analysis_id TEXT NOT NULL DEFAULT '', product_type TEXT NOT NULL DEFAULT 'FULL_ANALYSIS',
    offer_accepted_at TEXT NOT NULL, privacy_accepted_at TEXT NOT NULL, authority_confirmed_at TEXT NOT NULL,
    receipt_requested_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  try { await db.prepare("ALTER TABLE payment_orders ADD COLUMN analysis_id TEXT NOT NULL DEFAULT ''").run(); } catch { /* migrated */ }
  try { await db.prepare("ALTER TABLE payment_orders ADD COLUMN product_type TEXT NOT NULL DEFAULT 'FULL_ANALYSIS'").run(); } catch { /* migrated */ }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const payerType = body.payerType === "person" ? "Физическое лицо" : "Организация или ИП";
    const payerInn = String(body.payerInn || "").replace(/\D/g, "");
    const payerName = String(body.payerName || "").trim().slice(0, 200);
    const companyInn = String(body.companyInn || "").replace(/\D/g, "");
    const companyName = String(body.companyName || "").trim().slice(0, 200);
    const userEmail = String(body.userEmail || "").trim().toLowerCase().slice(0, 254);
    const analysisId = String(body.analysisId || "").trim().slice(0, 100);
    if (!payerName || !companyName || !/^(?:\d{10}|\d{12})$/.test(companyInn) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) return Response.json({ error: "Проверьте плательщика, клиента, ИНН и email" }, { status: 400 });
    if (payerType !== "Физическое лицо" && !/^(?:\d{10}|\d{12})$/.test(payerInn)) return Response.json({ error: "Для организации или ИП нужен корректный ИНН плательщика" }, { status: 400 });
    if (![body.offerAccepted, body.privacyAccepted, body.authorityConfirmed, body.receiptRequested].every((value) => value === true)) return Response.json({ error: "Нужно подтвердить оферту и отдельные согласия" }, { status: 400 });
    const db = await database(); await ensure(db);
    if (analysisId) {
      const analysis = await db.prepare("SELECT company_inn AS companyInn, company_name AS companyName, owner_email AS ownerEmail FROM analyses WHERE id = ? LIMIT 1").bind(analysisId).first<{ companyInn?: string; companyName?: string; ownerEmail?: string }>();
      if (!analysis || analysis.ownerEmail?.toLowerCase() !== userEmail || analysis.companyInn !== companyInn) return Response.json({ error: "Выбранный анализ не принадлежит указанному кабинету или ИНН" }, { status: 403 });
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const orderNumber = `PS-${now.slice(0, 10).replace(/-/g, "")}-${id.slice(0, 8).toUpperCase()}`;
    await db.prepare(`INSERT INTO payment_orders (id, order_number, payer_type, payer_inn, payer_name, company_inn, company_name, user_email, amount, days, status, analysis_id, product_type, offer_accepted_at, privacy_accepted_at, authority_confirmed_at, receipt_requested_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 6500, 0, 'Ожидает оплаты', ?, 'FULL_ANALYSIS', ?, ?, ?, ?, ?, ?)`)
      .bind(id, orderNumber, payerType, payerInn, payerName, companyInn, companyName, userEmail, analysisId, now, now, now, now, now, now).run();
    return Response.json({ order: { id, orderNumber, status: "Ожидает оплаты", amount: 6500, analysisId, productType: "FULL_ANALYSIS" }, nextStep: payerType === "Физическое лицо" ? "Реквизиты для оплаты и чек будут направлены после проверки заказа." : "Счёт для безналичной оплаты будет сформирован после проверки реквизитов." }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось создать заказ" }, { status: 500 });
  }
}

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (!user.isAdmin) return Response.json({ error: "Доступ только администратору" }, { status: 403 });
  const db = await database(); await ensure(db);
  const rows = await db.prepare("SELECT COUNT(*) AS count FROM payment_orders").first();
  return Response.json(rows || { count: 0 });
}
