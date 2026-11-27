> Deployment workflow update (2026-09-20): use the GitHub `staging` branch and
> repository-root Dockerfile. See [GITHUB-STAGING.md](GITHUB-STAGING.md).
> This supersedes the earlier manual source archive procedure. GitHub-to-Amvera
> branch integration still needs one-time setup; this push does not configure it.
> Historical provisioning notes below are not a current infrastructure status check.

# Standalone staging runbook

Status: deployment pending. This is not a production-readiness certificate.

## Reviewed configuration

Separate application `prescore-staging` and managed PostgreSQL `prescore-stage-db`, Moscow-0, one database replica. Approved application tier: Standard, 1 CPU / 2.5 GB RAM / 15 GB included disk, 1,450 RUB per 30 days. Approved database: Initial Plus, 0.5 CPU / 1 GB RAM, 490 RUB per 30 days, plus 5 GB High Performance SSD at 90 RUB per 30 days. Total observed in the account UI: **2,030 RUB per 30 days**, before any optional expansion. Both resources have been created with explicit user spending authorization. PostgreSQL remains 0/1: external Amvera provisioning blocker. Do not recreate it or rotate its password. Application source upload is not complete.

The Docker path uses Node 22, Next 16.2.6 and React 19.2.6. Build: `npm ci`, then `npm run build`. Conventional source checkout launch: `npm run start`; the smaller Docker standalone image launches `node server.js`. `amvera.yml` declares port 3000 and persistent `/data`. No production domain is required. The staging branch integration must be configured once in Amvera.

Configuration follows [Amvera Docker documentation](https://docs.amvera.ru/applications/configuration/docker.html). The application must use the managed PostgreSQL **read/write internal hostname displayed by Amvera**, not a guessed hostname or public database endpoint. See [managed PostgreSQL documentation](https://docs.amvera.ru/databases/postgreSQL.html).

## Secrets and variables

Set through Amvera Secrets: `DATABASE_URL`, `AUTH_SECRET` (random, at least 32 characters), `SMTP_PASSWORD`, `CHECKO_API_KEY`, `DEEPSEEK_API_KEY`. Do not put secret values in YAML, image layers, client JavaScript, logs or screenshots.

Ordinary environment: `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `PRESCORE_BASE_URL` equal to the temporary HTTPS origin, `PRESCORE_STORAGE_ROOT=/data/prescore`, `PRESCORE_INTERNAL_REPORT_PREVIEW=1` for authenticated synthetic report QA only, `PRESCORE_BUILD_VERSION`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_FROM`, `AI_PROVIDER=deepseek`, `DEEPSEEK_BASE_URL=https://api.deepseek.com`, `DEEPSEEK_MODEL=deepseek-flash`, `AI_QUESTIONS_PER_DAY=30`, `AI_QUESTIONS_PER_MINUTE=5`, `NEXT_TELEMETRY_DISABLED=1`.

The requested model remains configuration, not a claim of provider availability. Live provider smoke cannot pass without a configured key/model. SMTP must deliver verification/reset emails before account acceptance. New database credentials must be entered by the account owner through the protected service interface, not posted into chat.

## First start

1. Configure the **separate staging project** to build GitHub branch `staging` directly from source. Follow GITHUB-STAGING.md. Do not move main or configure synchronization back to GitHub.
2. Configure secrets, private database networking, HTTPS origin and writable persistent volume for UID 1000. Never fall back to storing documents in `/app` if mount permissions fail.
3. Only if verification proves a migration is missing, run explicit migration: `node --experimental-strip-types scripts/platform/db-migrate.mjs`. Three additive migrations are checksum-locked and transactional. In a source checkout the equivalent is `npm run db:migrate`. Do not run unreviewed generated Drizzle SQL automatically.
4. Start the app; GET `/api/health` must report `ok` / `connected` without secrets. Verify `prescore_schema_migrations` includes all three files.
5. Register synthetic test accounts using deliverable verification mail. Bootstrap one verified admin using `PRESCORE_BOOTSTRAP_ADMIN_EMAIL` and `node --experimental-strip-types scripts/platform/bootstrap-admin.mjs`. Remove the bootstrap variable afterward. It cannot silently re-run.
6. Validate client, assigned agent, unrelated user and admin in the actual staging service. Use synthetic records only.
7. Run `node --experimental-strip-types scripts/platform/ai-smoke.mjs`; it sends only a synthetic JSON connectivity prompt. No financial documents.
8. Complete every route and responsive/print row below before calling the migration complete.

## Browser acceptance still pending

Widths: 1440×900, 1024×768, 768×1024, 390×844, 360×800. Pages: landing, login/reset/logout, client overview/upload/company, report, BKI, documents, offers, applications/chat, agent/prospects, admin, checkout, legal/consent/referrals.

Report matrix: healthy, partial, insufficient, zero, global stop, permanent overdue defect, nonzero current debt service, FREE. Verify actual A4 print, no sidebar, no clipped tables, no hidden essential facts, no internal codes. Verify single-shot reveals and fully static reduced-motion, keyboard/focus, one primary action, and no page overflow.

## Rollback boundary

No production cutover is part of this work. The existing ChatGPT Site, DNS, production records and approved main remain unchanged. If staging fails, stop its app, retain its synthetic DB/files for diagnosis and correct the working tree. A later production migration requires an independently approved backup, export validation, restore rehearsal and DNS rollback window.

## Remaining operational gates

Managed DB readiness (currently 0/1) and connectivity; SMTP secret configuration and real mail verification; actual managed-PG import/restart/storage checks; live Checko/DeepSeek connectivity; full staging UI/security/print acceptance. Local PGlite tests do not establish these gates.

## Offline configuration gate

Run `npm run env:check` with the intended environment supplied securely. This command performs no network calls, creates no SMTP transport, sends no messages and prints no values. It checks database URL shape, AUTH_SECRET presence/length, HTTPS origin, `/data` path and SMTP configuration. Success is **configuration validation only**, not proof of working credentials, mounted storage or email delivery. No SMTP provider, host or sender has been invented.

SMTP_FROM must be a single bare sender email address; SMTP_HOST a hostname. Port 465 uses `SMTP_SECURE=true`; port 587 uses `SMTP_SECURE=false` and mandatory STARTTLS. Certificate verification remains enabled. Credentials must be both present or both absent (only if the selected relay explicitly supports no-auth). Network timeouts are bounded; logging is disabled. Full contract: ENVIRONMENT-CONTRACT.md.

## Current external blocker

Project `prescore-stage-db`, account `dorogovab`, Moscow-0: 0/1, “Меняем количество реплик”; both DB/system logs empty after explicit queries. Internal RW hostname: `amvera-dorogovab-cnpg-prescore-stage-db-rw`. No password reset, deletion, recreation or forced restart. Check 1/1 before connectivity tests. If the existing password cannot be used securely after readiness, ask the user to enter a new password manually; do not generate or rotate it independently. Support draft: AMVERA-SUPPORT-DRAFT.md.

Normal updates use `git push origin staging` after validation, once the branch integration is connected. The historical archive script is not part of this workflow. Live browser/SMTP acceptance remains a separate gate.
