# PRESCORE RU — launch preparation / status 2026-11-14

This is **readiness preparation**, not authorization to charge customers. Never store merchant secrets or customer files in Git, issues, logs or build artifacts.

## Verified source baseline
- Product ref: `prescore-product-v1` at `74103672bc9d3fbd0de818e22b3de977b9b9820c` before this readiness package.
- Product Actions run `43509686130` passed candidate, validate (build, tests, lint, PDF), presentation, admin and billing (isolated fake) on this exact SHA.
- `staging` was at `f6eae32f0bf50bd40d61223ff4035980e1d89606`; do not assume a running container or isolated staging DB from that ref.
- Live Amvera application/DNS/SSL/prod DB/secrets were **not** verified. No DNS change, release or provider call in this package.

## Requested public structure
1. `prescore.ru` / `www.prescore.ru`: marketing, tariff, offer, privacy, contacts. A separate public frontend is preferred; avoid a second writable connection to the product database.
2. `app.prescore.ru`: canonical authenticated app (`PRESCORE_BASE_URL` and `BILLING_SITE_ORIGIN` here). Client and agent logins, checkout and signed billing callback must use this HTTPS origin.
3. `staging.prescore.ru`: isolated QA with synthetic data. Never point at a production DB, real merchant terminal, or production document storage.

Current Next.js landing and app run in one codebase. The new `NEXT_PUBLIC_PRESCORE_APP_ORIGIN` can route marketing CTAs to the app when configured at **build time**. Leaving it empty retains existing same-origin URLs. This is routing preparation, **not creation of the DNS/application resources**. Ensure origin-specific redirects/auth and separation are verified before exposing two hosts.

## DNS / Amvera (values must come from the account's Domains screen)
- Add `prescore.ru` with HTTPS + own domain. Use the returned **A** record for `@` and **TXT** for `_amvera`.
- Add `app.prescore.ru` with HTTPS + own domain. Use returned **CNAME** for `app` and **TXT** for `_amvera.app`.
- Add `staging.prescore.ru` only when it has a separate safe QA application/DB; returned **CNAME** for `staging` and **TXT** for `_amvera.staging`.
- Check `www.prescore.ru` separately (redirect/alias, verified records) and keep current email DNS (`MX`/`SPF`/`DKIM`/`DMARC`) intact.
- Do not invent A/CNAME/TXT values. Verify DNS, SSL certificate and redirects against the running service; `GET /api/ready` checks runtime DB/storage/schema, but 200 from `/api/health` alone does not prove readiness.

## Release-blocking legal contradiction (verified)
- Executable plan `lib/billing/domain.ts`: `6,500 RUB / one company / 30 days`; no automatic recurring charge.
- Public `app/offer/page.tsx` dated 2026-08-20 explicitly describes a **one-off purchased version of analysis, not a subscription**.
- `app/privacy/page.tsx` and `app/consent/page.tsx` also reference the old one-off service.
- Public legal pages currently name `ООО «СИТИМЭЙТС»` and supply its company identifiers. **Owner must confirm** actual merchant, authority, contract party, support channels and tax/receipt details. Do not assume these identity fields are correct, or replace them with guesses.
- A reviewed, published subscription offer, privacy policy and consent text, with immutable version IDs aligned to the actual checkout, are required **before first real payment**. Any recurring future charge needs separate contract/consent and implementation.

## T-Bank acquiring — deliberate disabled→test→live rollout
- Adapter exists, `BILLING_PROVIDER=DISABLED`, `BILLING_LIVE_ENABLED=false` by default.
- Current checkout uses separate new payments for 30-day extensions. No automatic card rebill is implemented/approved.
- Merchant must supply an approved T-Bank acquiring agreement, terminal ID and password in **Amvera secrets**, never chat/Git; confirm site, callbacks, contact email and fiscal-receipt arrangement.
- Approved origin: `BILLING_SITE_ORIGIN=https://app.prescore.ru`. Payment notification endpoint: `https://app.prescore.ru/api/billing/notification`. Access changes only after confirmed server-side payment state, never browser redirect alone.
- Verify signed successful, failed, refund, duplicate callback, unknown/timeout, second 30-day period and expiry in test terminal before `BILLING_LIVE_ENABLED=true`.
- Real fiscalization must be confirmed; do **not** set `BILLING_FISCALIZATION_APPROVED=true` without a working compliant receipt arrangement.

## Partners
- Existing code accrues 30% to attributed agent and 10% to valid curator on confirmed captured payment, with refund reversals and ledger.
- Start with `PARTNER_SETTLEMENT_MODE=ACCRUAL_ONLY`, `BILLING_SETTLEMENT_PROVIDER=DISABLED` and truthful pending balances; do not enable automatic payouts without payout agreement, recipient verification and tested reconciliation.
- Confirm commercial agreements, tax treatment, commission reporting and procedure for actual partner withdrawals.

## Production data, backups and acceptance
- Confirm independent prod database, access restrictions, schema migrations, point-in-time backup and successful test restore to **nonproduction** before promotion.
- Do not touch the older `prescore-staging` until its isolated DB/backup issues are resolved.
- Confirm new user email verification, login, logout, recovery, role isolation, bank TXT upload → accurate dashboard, BFO, docs, OCR preview, PDF report, and data retention/deletion.
- Confirm separate product/email/analytics origin and TLS; read/write storage and readiness. Test checkout/partner accrual/refund using only test terminal.
- Public CTA → app login → analysis → checkout → confirmed access → partner commission should be accepted end-to-end on a production-equivalent isolated environment.
- Run `node scripts/launch/preflight.mjs .` for static text mismatch, or `node scripts/launch/preflight.mjs . --live` on a secure operator environment. This is **a local diagnostic, not proof of legal compliance or connectivity**. It never prints secret values.

## Known access boundary
There is no authenticated Amvera or registrar write access in this ChatGPT session. Domain creation, DNS changes, secret provisioning, backup/restore and production publication cannot be truthfully marked done without actual provider confirmation. Keep live payment disabled until every gate is verified.
