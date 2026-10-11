# Canonical billing V1

One server plan: PRESCORE_COMPANY_30D v1, RUB 650000 minor units, one authenticated owner + one stored company INN, 30 UTC calendar days. Manual renewal only. All money is integer minor units; commission/reversal rounds down using BigInt with cumulative rounding to avoid drift.

Migration 0006 registers orders, payments, notifications, company subscriptions, individual payment periods, commissions, tokenized payout profiles, payouts, refunds, append-only ledger, durable outbox and server funnel. Unique keys protect provider IDs, owner checkout keys, one active checkout per owner/INN, one period per payment, commissions by payment/role/policy and one payout per commission. Immutable attribution and append-only ledger enforced by database triggers. Use existing migration runner, never request DDL; no external migrations in this task.

Compatibility policy B: subscriptions/payments/payment_orders are historical read-only sources. New orders/payments/periods use only billing_* tables. Existing explicit analysis_entitlements retain manual/legacy grant semantics. No automatic transformation of legacy active subscriptions into perpetual entitlements. Legacy records are never described as live T-Bank transactions. No legacy data removed.

Milestones and final evidence: BILLING-MILESTONES.md.

## Access precedence and periods
Privileged ADMIN/assigned BROKER FULL and explicit existing analysis grants remain. Staging access opt-in remains unchanged. Then active canonical owner+INN subscription with a currently valid paid period resolves FULL; dated legacy active subscriptions are read-only compatibility. Everything else BASIC. New paid access never writes permanent per-analysis entitlement. Expiry evaluated on every request; no cron needed for access expiry. Saved analysis/engine outputs remain intact.

First period starts at server confirmation; early renewal starts at existing end; expired renewal starts at confirmation. Each period is unique per payment. Server confirmation+period+gross ledger+funnel event is atomic. Redirect is observational.

## API and product
Authenticated /api/billing POST = owned analysis + versioned acceptance + server attribution/plan checkout. GET analysisId = company subscription/history; GET orderId = owner-isolated state with bounded server provider polling. Existing /api/orders delegates to this boundary and no longer writes insecure legacy orders. /api/billing/notification validates signed provider callbacks without user session and commits payment/period/commissions/outbox before OK. /api/billing/partner exposes only current account's commissions/profile and own broker sales; curator rows contain no client identity.

/api/billing/admin requires ADMIN, paginated limit1–50, validated dates/status/search, <=366-day window. Resources sales/subscriptions/commissions/payouts/orders/payments/refunds/anomalies. CSV payments/subscriptions/commissions/payouts/refunds honors filters, max10000 (rejects excess), audit, formula escaping. Safe hold/release/retry/adjustment require reason; provider success cannot be entered manually. Refund requests are audited and confirmed, never activated from redirect.

Sales use append-only ledger for gross/refunds/commissions/reversals/payouts. Provider fees remain null until known. New/renewal follows payment periods; no entitlement/order as revenue. Chart active counts use current period boundaries (refund-adjusted), not fabricated historic snapshots. Funnel is unique owner/INN counts in a time window, explicitly not a cohort conversion; latency is real confirmed order timing. Unknowns null. Legacy accounting remains labeled separate and is never attributed to live T-Bank.
