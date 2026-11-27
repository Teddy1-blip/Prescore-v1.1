# Environment contract

Validation runs before app/worker; errors report variable names and stable codes only. Start from .env.example (production HTTPS) or .env.rc.example (explicit isolated loopback RC); never commit instantiated environment files.

| Category | Variables / requirement |
|---|---|
| REQUIRED | DATABASE_URL PostgreSQL URL; AUTH_SECRET >=32 chars with varied entropy; PRESCORE_BASE_URL origin; normalized absolute PRESCORE_STORAGE_ROOT; NODE_ENV production for RC/production; PRESCORE_RUNTIME_MODE |
| SECRET | DATABASE_URL credentials, AUTH_SECRET, SMTP_PASSWORD, TBANK_PASSWORD/TERMINAL_KEY, BILLING_FAKE_SECRET, optional AI/Checko keys |
| RC-ONLY | PRESCORE_ALLOW_RC_FAKE=true; BILLING_FAKE_SECRET; MAIL_PROVIDER=POSTGRES_FAKE; AI_PROVIDER=local; RC_TEST_DATABASE=true only for guarded CI scenarios |
| PROVIDER CONFIG | BILLING_PROVIDER DISABLED/FAKE/TBANK; BILLING_SETTLEMENT_PROVIDER DISABLED/FAKE; PARTNER_SETTLEMENT_MODE ACCRUAL_ONLY/PAYOUT_API; current live payout implementation unavailable |
| FEATURE FLAG | BILLING_LIVE_ENABLED false in RC; PRESCORE_BOOTSTRAP_ADMIN_ENABLED explicit one-time CLI permission; PRESCORE_INTERNAL_REPORT_PREVIEW optional existing flag |
| LEGAL | BILLING_OFFER_VERSION/BILLING_PRIVACY_VERSION required for checkout; publish existing accepted legal versions, no recurring consent |
| MAIL | Real SMTP_HOST/FROM, TLS mode/port and complete optional USER/PASSWORD pair; implicit465 or required STARTTLS587; certificates verified; RC fake mailbox is private DB-only |
| OPTIONAL | PORT/HOSTNAME; WORKER_INTERVAL_MS bounded100–60000; WORKER_BATCH_SIZE1–50; PRESCORE_WORKER_ID stable per process; SOURCE_SHA/BUILD_TIMESTAMP build metadata |
| BACKUP | PRESCORE_BACKUP_QUIESCED=true after stopped-write window; PRESCORE_RESTORE_CONFIRM=EMPTY_DATABASE_AND_STORAGE for a fresh target; protected external destination mount |

Production Fake, RC external provider keys/modes, unsupported settlement config, malformed SMTP, weak auth, invalid DB/origin/storage fail closed. RC permits HTTP only on explicit localhost/127.0.0.1; production requires HTTPS and Secure cookies. DB/storage are not ephemeral app files. Proxy defaults do not trust forwarding headers for rate-limit identity. Anonymous abuse bucket is shared; authenticated identity is verified user ID. No secrets in version endpoints or reports. Missing external merchant/payout configuration keeps billing controlled unavailable; it is never labelled live success.
