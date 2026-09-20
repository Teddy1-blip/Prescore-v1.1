// Portable storage projection. Existing analytical schema semantics retained.
import { sql } from "drizzle-orm";
import { bigint, pgTable, text } from "drizzle-orm/pg-core";

export const analyses = pgTable("analyses", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  companyInn: text("company_inn").notNull().default(""),
  fileName: text("file_name").notNull(),
  periodFrom: text("period_from").notNull(),
  periodTo: text("period_to").notNull(),
  score: bigint("score", { mode: "number" }).notNull(),
  grade: text("grade").notNull(),
  readiness: text("readiness").notNull(),
  payload: text("payload").notNull(),
  ownerEmail: text("owner_email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const deals = pgTable("deals", {
  id: text("id").primaryKey(),
  analysisId: text("analysis_id").notNull(),
  companyName: text("company_name").notNull(),
  product: text("product").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull().default(0),
  status: text("status").notNull().default("Новая"),
  owner: text("owner").notNull().default("Не назначен"),
  nextAction: text("next_action").notNull().default("Связаться с клиентом"),
  bank: text("bank").notNull().default(""),
  applicationGroupId: text("application_group_id").notNull().default(""),
  consentAt: text("consent_at").notNull().default(""),
  ownerEmail: text("owner_email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const checkoProfiles = pgTable("checko_profiles", {
  inn: text("inn").primaryKey(),
  payload: text("payload").notNull(),
  rawPayload: text("raw_payload"),
  fetchedAt: text("fetched_at").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const agentLeads = pgTable("agent_leads", {
  id: text("id").primaryKey(),
  agentCode: text("agent_code").notNull(),
  companyName: text("company_name").notNull(),
  companyInn: text("company_inn").notNull().default(""),
  contactName: text("contact_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  source: text("source").notNull().default("Реферальная ссылка"),
  status: text("status").notNull().default("Новый клиент"),
  subscriptionStatus: text("subscription_status").notNull().default("Ожидает оплаты"),
  consentAt: text("consent_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const agentApplications = pgTable("agent_applications", {
  id: text("id").primaryKey(),
  agentCode: text("agent_code").notNull(),
  leadId: text("lead_id").notNull(),
  analysisId: text("analysis_id").notNull().default(""),
  companyName: text("company_name").notNull(),
  bank: text("bank").notNull(),
  product: text("product").notNull(),
  requestedAmount: bigint("requested_amount", { mode: "number" }).notNull().default(0),
  calculatedLimit: bigint("calculated_limit", { mode: "number" }).notNull().default(0),
  rewardRateBps: bigint("reward_rate_bps", { mode: "number" }).notNull().default(0),
  status: text("status").notNull().default("Подготовка"),
  nextAction: text("next_action").notNull().default("Проверить комплект документов"),
  createdAt: text("created_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const agentProspects = pgTable("agent_prospects", {
  id: text("id").primaryKey(),
  agentCode: text("agent_code").notNull(),
  sourceFile: text("source_file").notNull(),
  noticeNumber: text("notice_number").notNull(),
  companyName: text("company_name").notNull(),
  companyInn: text("company_inn").notNull(),
  region: text("region").notNull().default(""),
  contractPrice: bigint("contract_price", { mode: "number" }).notNull().default(0),
  guaranteeAmount: bigint("guarantee_amount", { mode: "number" }).notNull().default(0),
  protocolDate: text("protocol_date").notNull().default(""),
  status: text("status").notNull().default("new"),
  rejectReason: text("reject_reason").notNull().default(""),
  leadId: text("lead_id").notNull().default(""),
  applicationId: text("application_id").notNull().default(""),
  dataJson: text("data_json").notNull(),
  importedAt: text("imported_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const agentPartners = pgTable("agent_partners", {
  agentCode: text("agent_code").primaryKey(),
  curatorCode: text("curator_code").notNull(),
  name: text("name").notNull(),
  agency: text("agency").notNull().default(""),
  city: text("city").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  status: text("status").notNull().default("Активен"),
  consentAt: text("consent_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const applicationMessages = pgTable("application_messages", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull(),
  authorRole: text("author_role").notNull(),
  authorName: text("author_name").notNull(),
  message: text("message").notNull().default(""),
  documentId: text("document_id").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const clientDocuments = pgTable("client_documents", {
  id: text("id").primaryKey(),
  companyInn: text("company_inn").notNull(),
  analysisId: text("analysis_id").notNull().default(""),
  applicationId: text("application_id").notNull().default(""),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
  contentBase64: text("content_base64").notNull(),
  uploadedBy: text("uploaded_by").notNull().default("Клиент"),
  status: text("status").notNull().default("Загружен"),
  storageKey: text("storage_key").notNull().default(""),
  ownerEmail: text("owner_email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const moduleSettings = pgTable("module_settings", {
  moduleKey: text("module_key").primaryKey(),
  label: text("label").notNull(),
  enabled: bigint("enabled", { mode: "number" }).notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const controlSettings = pgTable("control_settings", {
  controlKey: text("control_key").primaryKey(),
  category: text("category").notNull(),
  label: text("label").notNull(),
  groupName: text("group_name").notNull().default(""),
  description: text("description").notNull().default(""),
  enabled: bigint("enabled", { mode: "number" }).notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  companyInn: text("company_inn").notNull(),
  companyName: text("company_name").notNull(),
  userEmail: text("user_email").notNull().default(""),
  payerType: text("payer_type").notNull().default("Юридическое лицо"),
  payerInn: text("payer_inn").notNull().default(""),
  status: text("status").notNull().default("Активна"),
  accessFrom: text("access_from").notNull(),
  accessUntil: text("access_until").notNull(),
  days: bigint("days", { mode: "number" }).notNull().default(30),
  amount: bigint("amount", { mode: "number" }).notNull().default(6500),
  createdAt: text("created_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id").notNull(),
  payerType: text("payer_type").notNull(),
  payerInn: text("payer_inn").notNull().default(""),
  amount: bigint("amount", { mode: "number" }).notNull(),
  status: text("status").notNull().default("Оплачен"),
  paidAt: text("paid_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const paymentOrders = pgTable("payment_orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  payerType: text("payer_type").notNull(),
  payerInn: text("payer_inn").notNull().default(""),
  payerName: text("payer_name").notNull(),
  companyInn: text("company_inn").notNull(),
  companyName: text("company_name").notNull(),
  userEmail: text("user_email").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull().default(6500),
  days: bigint("days", { mode: "number" }).notNull().default(30),
  analysisId: text("analysis_id").notNull().default(""),
  productType: text("product_type").notNull().default("FULL_ANALYSIS"),
  status: text("status").notNull().default("Ожидает оплаты"),
  offerAcceptedAt: text("offer_accepted_at").notNull(),
  privacyAcceptedAt: text("privacy_accepted_at").notNull(),
  authorityConfirmedAt: text("authority_confirmed_at").notNull(),
  receiptRequestedAt: text("receipt_requested_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const analysisEntitlements = pgTable("analysis_entitlements", {
  analysisId: text("analysis_id").primaryKey(),
  userEmail: text("user_email").notNull().default(""),
  companyInn: text("company_inn").notNull().default(""),
  tier: text("tier").notNull().default("FREE"),
  paymentOrderId: text("payment_order_id").notNull().default(""),
  grantedBy: text("granted_by").notNull().default("SYSTEM"),
  grantedAt: text("granted_at").notNull().default(""),
  revokedAt: text("revoked_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const agentAccounts = pgTable("agent_accounts", {
  userEmail: text("user_email").primaryKey(),
  agentCode: text("agent_code").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at").notNull().default(sql`to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const applicationStatusHistory = pgTable("application_status_history", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull(),
  fromStatus: text("from_status").notNull().default(""),
  toStatus: text("to_status").notNull(),
  actorRole: text("actor_role").notNull(),
  actorEmail: text("actor_email").notNull().default(""),
  publicComment: text("public_comment").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  actorRole: text("actor_role").notNull(),
  actorEmail: text("actor_email").notNull().default(""),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const aiConversations = pgTable("ai_conversations", {
  id: text("id").primaryKey(),
  analysisId: text("analysis_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  analysisVersion: text("analysis_version").notNull(),
  promptVersion: text("prompt_version").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const aiMessages = pgTable("ai_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

export const aiUsage = pgTable("ai_usage", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: bigint("input_tokens", { mode: "number" }),
  outputTokens: bigint("output_tokens", { mode: "number" }),
  latencyMs: bigint("latency_ms", { mode: "number" }).notNull(),
  success: bigint("success", { mode: "number" }).notNull(),
  errorType: text("error_type"),
  createdAt: text("created_at").notNull(),
});
