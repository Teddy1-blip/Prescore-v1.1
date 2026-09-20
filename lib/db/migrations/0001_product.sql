-- Explicit additive migration. No destructive D1 operation.
CREATE TABLE IF NOT EXISTS "agent_accounts" (
  "user_email" text PRIMARY KEY NOT NULL,
  "agent_code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "created_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  "updated_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "agent_applications" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_code" text NOT NULL,
  "lead_id" text NOT NULL,
  "analysis_id" text NOT NULL DEFAULT '',
  "company_name" text NOT NULL,
  "bank" text NOT NULL,
  "product" text NOT NULL,
  "requested_amount" bigint NOT NULL DEFAULT 0,
  "calculated_limit" bigint NOT NULL DEFAULT 0,
  "reward_rate_bps" bigint NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'Подготовка',
  "next_action" text NOT NULL DEFAULT 'Проверить комплект документов',
  "created_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  "updated_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "agent_leads" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_code" text NOT NULL,
  "company_name" text NOT NULL,
  "company_inn" text NOT NULL DEFAULT '',
  "contact_name" text NOT NULL DEFAULT '',
  "phone" text NOT NULL DEFAULT '',
  "email" text NOT NULL DEFAULT '',
  "source" text NOT NULL DEFAULT 'Реферальная ссылка',
  "status" text NOT NULL DEFAULT 'Новый клиент',
  "subscription_status" text NOT NULL DEFAULT 'Ожидает оплаты',
  "consent_at" text NOT NULL,
  "created_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  "updated_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "agent_partners" (
  "agent_code" text PRIMARY KEY NOT NULL,
  "curator_code" text NOT NULL,
  "name" text NOT NULL,
  "agency" text NOT NULL DEFAULT '',
  "city" text NOT NULL DEFAULT '',
  "phone" text NOT NULL DEFAULT '',
  "email" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'Активен',
  "consent_at" text NOT NULL,
  "created_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  "updated_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "agent_prospects" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_code" text NOT NULL,
  "source_file" text NOT NULL,
  "notice_number" text NOT NULL,
  "company_name" text NOT NULL,
  "company_inn" text NOT NULL,
  "region" text NOT NULL DEFAULT '',
  "contract_price" bigint NOT NULL DEFAULT 0,
  "guarantee_amount" bigint NOT NULL DEFAULT 0,
  "protocol_date" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'new',
  "reject_reason" text NOT NULL DEFAULT '',
  "lead_id" text NOT NULL DEFAULT '',
  "application_id" text NOT NULL DEFAULT '',
  "data_json" text NOT NULL,
  "imported_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" text PRIMARY KEY NOT NULL,
  "analysis_id" text NOT NULL,
  "owner_email" text NOT NULL,
  "analysis_version" text NOT NULL,
  "prompt_version" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "conversation_id" text NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_usage" (
  "id" text PRIMARY KEY NOT NULL,
  "conversation_id" text NOT NULL,
  "owner_email" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "input_tokens" bigint,
  "output_tokens" bigint,
  "latency_ms" bigint NOT NULL,
  "success" bigint NOT NULL,
  "error_type" text,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "analyses" (
  "id" text PRIMARY KEY NOT NULL,
  "company_name" text NOT NULL,
  "company_inn" text NOT NULL DEFAULT '',
  "file_name" text NOT NULL,
  "period_from" text NOT NULL,
  "period_to" text NOT NULL,
  "score" bigint NOT NULL,
  "grade" text NOT NULL,
  "readiness" text NOT NULL,
  "payload" text NOT NULL,
  "owner_email" text NOT NULL DEFAULT '',
  "created_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "analysis_entitlements" (
  "analysis_id" text PRIMARY KEY NOT NULL,
  "user_email" text NOT NULL DEFAULT '',
  "company_inn" text NOT NULL DEFAULT '',
  "tier" text NOT NULL DEFAULT 'FREE',
  "payment_order_id" text NOT NULL DEFAULT '',
  "granted_by" text NOT NULL DEFAULT 'SYSTEM',
  "granted_at" text NOT NULL DEFAULT '',
  "revoked_at" text NOT NULL DEFAULT '',
  "updated_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "application_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "application_id" text NOT NULL,
  "author_role" text NOT NULL,
  "author_name" text NOT NULL,
  "message" text NOT NULL DEFAULT '',
  "document_id" text NOT NULL DEFAULT '',
  "created_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "application_status_history" (
  "id" text PRIMARY KEY NOT NULL,
  "application_id" text NOT NULL,
  "from_status" text NOT NULL DEFAULT '',
  "to_status" text NOT NULL,
  "actor_role" text NOT NULL,
  "actor_email" text NOT NULL DEFAULT '',
  "public_comment" text NOT NULL DEFAULT '',
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "action" text NOT NULL,
  "actor_role" text NOT NULL,
  "actor_email" text NOT NULL DEFAULT '',
  "metadata" text NOT NULL DEFAULT '{}',
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "checko_profiles" (
  "inn" text PRIMARY KEY NOT NULL,
  "payload" text NOT NULL,
  "raw_payload" text,
  "fetched_at" text NOT NULL,
  "updated_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "client_documents" (
  "id" text PRIMARY KEY NOT NULL,
  "company_inn" text NOT NULL,
  "analysis_id" text NOT NULL DEFAULT '',
  "application_id" text NOT NULL DEFAULT '',
  "category" text NOT NULL,
  "file_name" text NOT NULL,
  "mime_type" text NOT NULL DEFAULT 'application/octet-stream',
  "size_bytes" bigint NOT NULL DEFAULT 0,
  "content_base64" text NOT NULL,
  "uploaded_by" text NOT NULL DEFAULT 'Клиент',
  "status" text NOT NULL DEFAULT 'Загружен',
  "storage_key" text NOT NULL DEFAULT '',
  "owner_email" text NOT NULL DEFAULT '',
  "created_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "control_settings" (
  "control_key" text PRIMARY KEY NOT NULL,
  "category" text NOT NULL,
  "label" text NOT NULL,
  "group_name" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "enabled" bigint NOT NULL DEFAULT 1,
  "updated_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "deals" (
  "id" text PRIMARY KEY NOT NULL,
  "analysis_id" text NOT NULL,
  "company_name" text NOT NULL,
  "product" text NOT NULL,
  "amount" bigint NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'Новая',
  "owner" text NOT NULL DEFAULT 'Не назначен',
  "next_action" text NOT NULL DEFAULT 'Связаться с клиентом',
  "bank" text NOT NULL DEFAULT '',
  "application_group_id" text NOT NULL DEFAULT '',
  "consent_at" text NOT NULL DEFAULT '',
  "owner_email" text NOT NULL DEFAULT '',
  "created_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  "updated_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "module_settings" (
  "module_key" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "enabled" bigint NOT NULL DEFAULT 1,
  "updated_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "payment_orders" (
  "id" text PRIMARY KEY NOT NULL,
  "order_number" text NOT NULL UNIQUE,
  "payer_type" text NOT NULL,
  "payer_inn" text NOT NULL DEFAULT '',
  "payer_name" text NOT NULL,
  "company_inn" text NOT NULL,
  "company_name" text NOT NULL,
  "user_email" text NOT NULL,
  "amount" bigint NOT NULL DEFAULT 6500,
  "days" bigint NOT NULL DEFAULT 30,
  "analysis_id" text NOT NULL DEFAULT '',
  "product_type" text NOT NULL DEFAULT 'FULL_ANALYSIS',
  "status" text NOT NULL DEFAULT 'Ожидает оплаты',
  "offer_accepted_at" text NOT NULL,
  "privacy_accepted_at" text NOT NULL,
  "authority_confirmed_at" text NOT NULL,
  "receipt_requested_at" text NOT NULL,
  "created_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  "updated_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "payments" (
  "id" text PRIMARY KEY NOT NULL,
  "subscription_id" text NOT NULL,
  "payer_type" text NOT NULL,
  "payer_inn" text NOT NULL DEFAULT '',
  "amount" bigint NOT NULL,
  "status" text NOT NULL DEFAULT 'Оплачен',
  "paid_at" text NOT NULL,
  "created_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "company_inn" text NOT NULL,
  "company_name" text NOT NULL,
  "user_email" text NOT NULL DEFAULT '',
  "payer_type" text NOT NULL DEFAULT 'Юридическое лицо',
  "payer_inn" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'Активна',
  "access_from" text NOT NULL,
  "access_until" text NOT NULL,
  "days" bigint NOT NULL DEFAULT 30,
  "amount" bigint NOT NULL DEFAULT 6500,
  "created_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  "updated_at" text NOT NULL DEFAULT to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_conversation_owner_analysis ON ai_conversations(analysis_id, owner_email);
