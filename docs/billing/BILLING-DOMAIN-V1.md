# Canonical billing V1

One server plan: PRESCORE_COMPANY_30D v1, RUB 650000 minor units, one authenticated owner + one stored company INN, 30 UTC calendar days. Manual renewal only. All money is integer minor units; commission/reversal rounds down using BigInt with cumulative rounding to avoid drift.

Migration 0006 registers orders, payments, notifications, company subscriptions, individual payment periods, commissions, tokenized payout profiles, payouts, refunds, append-only ledger, durable outbox and server funnel. Unique keys protect provider IDs, owner checkout keys, one active checkout per owner/INN, one period per payment, commissions by payment/role/policy and one payout per commission. Immutable attribution and append-only ledger enforced by database triggers. Use existing migration runner, never request DDL; no external migrations in this task.

Compatibility policy B: subscriptions/payments/payment_orders are historical read-only sources. New orders/payments/periods use only billing_* tables. Existing explicit analysis_entitlements retain manual/legacy grant semantics. No automatic transformation of legacy active subscriptions into perpetual entitlements. Legacy records are never described as live T-Bank transactions. No legacy data removed.

Milestones and final evidence: BILLING-MILESTONES.md.

## Access precedence and periods
Privileged ADMIN/assigned BROKER FULL and explicit existing analysis grants remain. Staging access opt-in remains unchanged. Then active canonical owner+INN subscription with a currently valid paid period resolves FULL; dated legacy active subscriptions are read-only compatibility. Everything else BASIC. New paid access never writes permanent per-analysis entitlement. Expiry evaluated on every request; no cron needed for access expiry. Saved analysis/engine outputs remain intact.

First period starts at server confirmation; early renewal starts at existing end; expired renewal starts at confirmation. Each period is unique per payment. Server confirmation+period+gross ledger+funnel event is atomic. Redirect is observational.
