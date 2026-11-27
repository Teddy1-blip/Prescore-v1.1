-- RC1 operational state only; credit rules and commercial economics unchanged.
ALTER TABLE platform_bootstrap ADD COLUMN user_id text REFERENCES "user"(id);
CREATE TABLE rc_provider_state (provider text NOT NULL,id text NOT NULL,idempotency_key text NOT NULL,state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(provider,id),UNIQUE(provider,idempotency_key));
CREATE TABLE rc_mailbox (id text PRIMARY KEY,recipient text NOT NULL,subject text NOT NULL,body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE runtime_workers (id text PRIMARY KEY,heartbeat_at timestamptz NOT NULL,status text NOT NULL,source_sha text NOT NULL,processed bigint NOT NULL DEFAULT 0);
CREATE TABLE runtime_rate_limits (bucket text PRIMARY KEY,count integer NOT NULL,expires_at timestamptz NOT NULL);
CREATE INDEX runtime_rate_expiry ON runtime_rate_limits(expires_at);
CREATE TABLE runtime_operations (id text PRIMARY KEY,event text NOT NULL,result text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX runtime_operations_date ON runtime_operations(created_at);
CREATE INDEX rc_provider_created ON rc_provider_state(created_at);
CREATE INDEX rc_mailbox_date ON rc_mailbox(created_at);
CREATE INDEX billing_ledger_date_kind ON billing_ledger(created_at,kind);
CREATE INDEX billing_events_result_date ON billing_events(result,received_at);
CREATE INDEX billing_refunds_payment_status ON billing_refunds(payment_id,status);
CREATE INDEX billing_periods_subscription_dates ON billing_periods(subscription_id,starts_at,ends_at);
CREATE INDEX billing_payouts_partner_status ON billing_payouts(beneficiary_code,status);
