// Portable storage projection. Existing analytical schema semantics retained.
import { sql } from "drizzle-orm";
import { bigint, boolean, timestamp, doublePrecision, pgTable, text } from "drizzle-orm/pg-core";

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

// ADMIN observations cache published outputs; credit math remains in the canonical engine.
export const adminAnalysisObservations = pgTable("admin_analysis_observations", {
 analysisId: text("analysis_id").primaryKey().references(()=>analyses.id),
 inputFingerprint: text("input_fingerprint").notNull(),
 canonicalVersion: text("canonical_version").notNull(),
 canonicalState: text("canonical_state").notNull(),
 sourceState: text("source_state").notNull(),
 completeness: doublePrecision("completeness"),
 indexValue: doublePrecision("index_value"),
 readiness: text("readiness"),
 assessment: text("assessment"),
 debtCapacityStatus: text("debt_capacity_status"),
 criticalCount: bigint("critical_count", {mode:"number"}),
 observedAt: text("observed_at").notNull(),
});

// Billing migrations own foreign keys, uniqueness and immutable ledger constraints.
export const billingOrders = pgTable("billing_orders", {
 id: text("id").primaryKey(),
 orderNumber: text("order_number"),
 ownerEmail: text("owner_email"),
 companyInn: text("company_inn"),
 companyName: text("company_name"),
 analysisId: text("analysis_id"),
 planCode: text("plan_code"),
 planVersion: text("plan_version"),
 amountMinor: bigint("amount_minor", { mode: "number" }),
 currency: text("currency"),
 status: text("status"),
 sourceChannel: text("source_channel"),
 attributionStatus: text("attribution_status"),
 brokerCode: text("broker_code"),
 curatorCode: text("curator_code"),
 offerVersion: text("offer_version"),
 privacyVersion: text("privacy_version"),
 acceptedAt: timestamp("accepted_at", {withTimezone:true,mode:"string"}),
 createdAt: timestamp("created_at", {withTimezone:true,mode:"string"}),
 expiresAt: timestamp("expires_at", {withTimezone:true,mode:"string"}),
 updatedAt: timestamp("updated_at", {withTimezone:true,mode:"string"}),
 idempotencyKey: text("idempotency_key"),
});
export const billingPayments = pgTable("billing_payments", {
 id: text("id").primaryKey(),
 orderId: text("order_id"),
 provider: text("provider"),
 providerPaymentId: text("provider_payment_id"),
 rawStatus: text("raw_status"),
 status: text("status"),
 amountMinor: bigint("amount_minor", { mode: "number" }),
 currency: text("currency"),
 paymentUrl: text("payment_url"),
 confirmedAt: timestamp("confirmed_at", {withTimezone:true,mode:"string"}),
 failedAt: timestamp("failed_at", {withTimezone:true,mode:"string"}),
 createdAt: timestamp("created_at", {withTimezone:true,mode:"string"}),
 updatedAt: timestamp("updated_at", {withTimezone:true,mode:"string"}),
 refundedMinor: bigint("refunded_minor", { mode: "number" }),
 providerFeeMinor: bigint("provider_fee_minor", { mode: "number" }),
 idempotencyKey: text("idempotency_key"),
 receiptStatus: text("receipt_status"),
 receiptReference: text("receipt_reference"),
});
export const billingEvents = pgTable("billing_events", {
 id: text("id").primaryKey(),
 provider: text("provider"),
 providerPaymentId: text("provider_payment_id"),
 fingerprint: text("fingerprint"),
 rawStatus: text("raw_status"),
 safePayload: text("safe_payload"),
 receivedAt: timestamp("received_at", {withTimezone:true,mode:"string"}),
 processedAt: timestamp("processed_at", {withTimezone:true,mode:"string"}),
 result: text("result"),
});
export const billingSubscriptions = pgTable("billing_subscriptions", {
 id: text("id").primaryKey(),
 ownerEmail: text("owner_email"),
 companyInn: text("company_inn"),
 companyName: text("company_name"),
 planCode: text("plan_code"),
 status: text("status"),
 accessFrom: timestamp("access_from", {withTimezone:true,mode:"string"}),
 accessUntil: timestamp("access_until", {withTimezone:true,mode:"string"}),
 createdAt: timestamp("created_at", {withTimezone:true,mode:"string"}),
 updatedAt: timestamp("updated_at", {withTimezone:true,mode:"string"}),
});
export const billingPeriods = pgTable("billing_periods", {
 id: text("id").primaryKey(),
 subscriptionId: text("subscription_id"),
 paymentId: text("payment_id"),
 orderId: text("order_id"),
 startsAt: timestamp("starts_at", {withTimezone:true,mode:"string"}),
 endsAt: timestamp("ends_at", {withTimezone:true,mode:"string"}),
 originalEndsAt: timestamp("original_ends_at", {withTimezone:true,mode:"string"}),
 status: text("status"),
 refundedMinor: bigint("refunded_minor", { mode: "number" }),
 createdAt: timestamp("created_at", {withTimezone:true,mode:"string"}),
});
export const billingPayoutProfiles = pgTable("billing_payout_profiles", {
 beneficiaryCode: text("beneficiary_code").primaryKey(),
 beneficiaryType: text("beneficiary_type"),
 recipientId: text("recipient_id"),
 verificationStatus: text("verification_status"),
 maskedDestination: text("masked_destination"),
 complianceHold: boolean("compliance_hold"),
 createdAt: timestamp("created_at", {withTimezone:true,mode:"string"}),
 updatedAt: timestamp("updated_at", {withTimezone:true,mode:"string"}),
});
export const billingCommissions = pgTable("billing_commissions", {
 id: text("id").primaryKey(),
 paymentId: text("payment_id"),
 orderId: text("order_id"),
 role: text("role"),
 beneficiaryCode: text("beneficiary_code"),
 rateBps: bigint("rate_bps", { mode: "number" }),
 grossBasisMinor: bigint("gross_basis_minor", { mode: "number" }),
 amountMinor: bigint("amount_minor", { mode: "number" }),
 status: text("status"),
 reversalMinor: bigint("reversal_minor", { mode: "number" }),
 adjustmentMinor: bigint("adjustment_minor", { mode: "number" }),
 holdReason: text("hold_reason"),
 policyVersion: text("policy_version"),
 createdAt: timestamp("created_at", {withTimezone:true,mode:"string"}),
 updatedAt: timestamp("updated_at", {withTimezone:true,mode:"string"}),
 idempotencyKey: text("idempotency_key"),
});
export const billingPayouts = pgTable("billing_payouts", {
 id: text("id").primaryKey(),
 commissionId: text("commission_id"),
 beneficiaryCode: text("beneficiary_code"),
 amountMinor: bigint("amount_minor", { mode: "number" }),
 currency: text("currency"),
 provider: text("provider"),
 providerPayoutId: text("provider_payout_id"),
 status: text("status"),
 attempt: bigint("attempt", { mode: "number" }),
 failureCode: text("failure_code"),
 nextRetryAt: timestamp("next_retry_at", {withTimezone:true,mode:"string"}),
 createdAt: timestamp("created_at", {withTimezone:true,mode:"string"}),
 completedAt: timestamp("completed_at", {withTimezone:true,mode:"string"}),
 idempotencyKey: text("idempotency_key"),
});
export const billingRefunds = pgTable("billing_refunds", {
 id: text("id").primaryKey(),
 paymentId: text("payment_id"),
 amountMinor: bigint("amount_minor", { mode: "number" }),
 cumulativeMinor: bigint("cumulative_minor", { mode: "number" }),
 status: text("status"),
 providerRefundId: text("provider_refund_id"),
 reason: text("reason"),
 createdAt: timestamp("created_at", {withTimezone:true,mode:"string"}),
 confirmedAt: timestamp("confirmed_at", {withTimezone:true,mode:"string"}),
 idempotencyKey: text("idempotency_key"),
});
export const billingLedger = pgTable("billing_ledger", {
 id: text("id").primaryKey(),
 kind: text("kind"),
 paymentId: text("payment_id"),
 beneficiaryCode: text("beneficiary_code"),
 amountMinor: bigint("amount_minor", { mode: "number" }),
 currency: text("currency"),
 referenceId: text("reference_id"),
 idempotencyKey: text("idempotency_key"),
 createdAt: timestamp("created_at", {withTimezone:true,mode:"string"}),
});
export const billingOutbox = pgTable("billing_outbox", {
 id: text("id").primaryKey(),
 eventType: text("event_type"),
 aggregateId: text("aggregate_id"),
 payload: text("payload"),
 status: text("status"),
 attempts: bigint("attempts", { mode: "number" }),
 nextAttemptAt: timestamp("next_attempt_at", {withTimezone:true,mode:"string"}),
 createdAt: timestamp("created_at", {withTimezone:true,mode:"string"}),
 processedAt: timestamp("processed_at", {withTimezone:true,mode:"string"}),
 idempotencyKey: text("idempotency_key"),
});
export const billingFunnel = pgTable("billing_funnel", {
 id: text("id").primaryKey(),
 ownerEmail: text("owner_email"),
 companyInn: text("company_inn"),
 orderId: text("order_id"),
 eventType: text("event_type"),
 createdAt: timestamp("created_at", {withTimezone:true,mode:"string"}),
 idempotencyKey: text("idempotency_key"),
});
