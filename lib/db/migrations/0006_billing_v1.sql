-- Canonical billing V1. Legacy payment tables remain untouched/read-only.
CREATE TABLE billing_orders (
 id text PRIMARY KEY, order_number text NOT NULL UNIQUE, owner_email text NOT NULL,
 company_inn text NOT NULL CHECK(company_inn ~ '^([0-9]{10}|[0-9]{12})$'), company_name text NOT NULL,
 analysis_id text NOT NULL REFERENCES analyses(id), plan_code text NOT NULL, plan_version text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor > 0), currency text NOT NULL CHECK(currency='RUB'),
 status text NOT NULL, source_channel text NOT NULL, attribution_status text NOT NULL,
 broker_code text, curator_code text, offer_version text NOT NULL, privacy_version text NOT NULL,
 accepted_at timestamptz NOT NULL, created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 idempotency_key text NOT NULL, UNIQUE(owner_email,idempotency_key)
);
CREATE UNIQUE INDEX billing_one_open_checkout ON billing_orders(owner_email,company_inn) WHERE status IN ('CREATED','PAYMENT_PENDING','UNKNOWN_REVIEW');
CREATE INDEX billing_order_owner ON billing_orders(owner_email,created_at);
CREATE TABLE billing_payments (
 id text PRIMARY KEY, order_id text NOT NULL UNIQUE REFERENCES billing_orders(id), provider text NOT NULL,
 provider_payment_id text, raw_status text NOT NULL, status text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0), currency text NOT NULL CHECK(currency='RUB'), payment_url text,
 confirmed_at timestamptz, failed_at timestamptz, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 refunded_minor bigint NOT NULL DEFAULT 0 CHECK(refunded_minor>=0 AND refunded_minor<=amount_minor),
 provider_fee_minor bigint CHECK(provider_fee_minor>=0), idempotency_key text NOT NULL UNIQUE,
 receipt_status text NOT NULL DEFAULT 'NOT_CONFIGURED', receipt_reference text,
 UNIQUE(provider,provider_payment_id)
);
CREATE TABLE billing_events (
 id text PRIMARY KEY, provider text NOT NULL, provider_payment_id text, fingerprint text NOT NULL UNIQUE,
 raw_status text NOT NULL, safe_payload text NOT NULL, received_at timestamptz NOT NULL,
 processed_at timestamptz, result text NOT NULL
);
CREATE TABLE billing_subscriptions (
 id text PRIMARY KEY, owner_email text NOT NULL, company_inn text NOT NULL, company_name text NOT NULL,
 plan_code text NOT NULL, status text NOT NULL, access_from timestamptz, access_until timestamptz,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, UNIQUE(owner_email,company_inn)
);
CREATE TABLE billing_periods (
 id text PRIMARY KEY, subscription_id text NOT NULL REFERENCES billing_subscriptions(id),
 payment_id text NOT NULL UNIQUE REFERENCES billing_payments(id), order_id text NOT NULL UNIQUE REFERENCES billing_orders(id),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>=starts_at), original_ends_at timestamptz NOT NULL,
 status text NOT NULL, refunded_minor bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL
);
CREATE INDEX billing_subscription_access ON billing_subscriptions(owner_email,company_inn,access_until);
CREATE TABLE billing_payout_profiles (
 beneficiary_code text PRIMARY KEY, beneficiary_type text NOT NULL, recipient_id text,
 verification_status text NOT NULL CHECK(verification_status IN ('NOT_REGISTERED','PENDING_VERIFICATION','VERIFIED','BLOCKED','REQUIRES_UPDATE')),
 masked_destination text, compliance_hold boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE billing_commissions (
 id text PRIMARY KEY, payment_id text NOT NULL REFERENCES billing_payments(id), order_id text NOT NULL REFERENCES billing_orders(id),
 role text NOT NULL CHECK(role IN ('BROKER','CURATOR')), beneficiary_code text NOT NULL,
 rate_bps bigint NOT NULL CHECK(rate_bps IN (3000,1000)), gross_basis_minor bigint NOT NULL CHECK(gross_basis_minor>0),
 amount_minor bigint NOT NULL CHECK(amount_minor>=0), status text NOT NULL,
 reversal_minor bigint NOT NULL DEFAULT 0 CHECK(reversal_minor>=0 AND reversal_minor<=amount_minor),
 adjustment_minor bigint NOT NULL DEFAULT 0, hold_reason text, policy_version text NOT NULL,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, idempotency_key text NOT NULL UNIQUE,
 UNIQUE(payment_id,beneficiary_code,role,policy_version)
);
CREATE INDEX billing_commission_beneficiary ON billing_commissions(beneficiary_code,created_at);
CREATE TABLE billing_payouts (
 id text PRIMARY KEY, commission_id text NOT NULL UNIQUE REFERENCES billing_commissions(id), beneficiary_code text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>=0), currency text NOT NULL CHECK(currency='RUB'), provider text NOT NULL,
 provider_payout_id text, status text NOT NULL, attempt bigint NOT NULL DEFAULT 0,
 failure_code text, next_retry_at timestamptz, created_at timestamptz NOT NULL, completed_at timestamptz,
 idempotency_key text NOT NULL UNIQUE, UNIQUE(provider,provider_payout_id)
);
CREATE TABLE billing_refunds (
 id text PRIMARY KEY, payment_id text NOT NULL REFERENCES billing_payments(id), amount_minor bigint NOT NULL CHECK(amount_minor>0),
 cumulative_minor bigint, status text NOT NULL, provider_refund_id text, reason text NOT NULL,
 created_at timestamptz NOT NULL, confirmed_at timestamptz, idempotency_key text NOT NULL UNIQUE
);
CREATE TABLE billing_ledger (
 id text PRIMARY KEY, kind text NOT NULL, payment_id text REFERENCES billing_payments(id),
 beneficiary_code text, amount_minor bigint NOT NULL, currency text NOT NULL CHECK(currency='RUB'),
 reference_id text NOT NULL, idempotency_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL
);
CREATE TABLE billing_outbox (
 id text PRIMARY KEY, event_type text NOT NULL, aggregate_id text NOT NULL, payload text NOT NULL,
 status text NOT NULL, attempts bigint NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL, processed_at timestamptz, idempotency_key text NOT NULL UNIQUE
);
CREATE INDEX billing_outbox_ready ON billing_outbox(status,next_attempt_at);
CREATE TABLE billing_funnel (
 id text PRIMARY KEY, owner_email text NOT NULL, company_inn text NOT NULL, order_id text,
 event_type text NOT NULL, created_at timestamptz NOT NULL, idempotency_key text NOT NULL UNIQUE
);
-- Immutable historical attribution and append-only ledger, enforced in storage.
CREATE FUNCTION billing_immutable_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.owner_email,NEW.company_inn,NEW.analysis_id,NEW.amount_minor,NEW.currency,NEW.plan_code,NEW.plan_version,NEW.broker_code,NEW.curator_code,NEW.source_channel,NEW.attribution_status,NEW.offer_version,NEW.privacy_version,NEW.accepted_at)
 IS DISTINCT FROM (OLD.owner_email,OLD.company_inn,OLD.analysis_id,OLD.amount_minor,OLD.currency,OLD.plan_code,OLD.plan_version,OLD.broker_code,OLD.curator_code,OLD.source_channel,OLD.attribution_status,OLD.offer_version,OLD.privacy_version,OLD.accepted_at) THEN RAISE EXCEPTION 'BILLING_ORDER_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER billing_order_immutable BEFORE UPDATE ON billing_orders FOR EACH ROW EXECUTE FUNCTION billing_immutable_order();
CREATE FUNCTION billing_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'BILLING_LEDGER_APPEND_ONLY'; END $$;
CREATE TRIGGER billing_ledger_append_only BEFORE UPDATE OR DELETE ON billing_ledger FOR EACH ROW EXECUTE FUNCTION billing_append_only();
