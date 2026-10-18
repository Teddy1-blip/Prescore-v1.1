# RC1 runbook

Prerequisites: Docker-compatible runtime, Node22 for source tools, PostgreSQL15, protected persistent storage and backup mounts. No hosting vendor required. Generate new secrets, copy appropriate example config; RC is isolated Fake only. Production/live requires separate acceptance listed in RC1-LIVE-GAPS.md.

Build: npm ci -> npm run typecheck (zero) -> npm run build -> node scripts/release/package-runtime.mjs. Docker: docker build with SOURCE_SHA/BUILD_TIMESTAMP -> same prescore:rc1 image for both processes. docker-compose.rc.yml is a local RC composition; configure .env.rc and RC_POSTGRES_PASSWORD. It never contacts real payment services. Composition migration service runs first, app waits for success, worker waits for app readiness. Do not run compose down -v against real data.

Migration: env:check -> db:status -> reviewed db:migrate -> db:verify. No migration from HTTP. Take verified backup before upgrading. Unknown future/checksum mismatch blocks startup; restore original verified registry or forward-fix, do not erase history.

Start app: `node --experimental-strip-types scripts/release/start.mjs` from packaged artifact. Start worker: `worker:billing`; cron alternative `worker:billing:once`. Check /api/health (liveness), /api/ready (configuration/DB/schema/storage/outbox); worker:ready checks persisted recent heartbeat. Configure HTTPS origin/security at hosting boundary for production. Source development remains npm run dev.

ADMIN: create and verify the configured account using actual auth; enable PRESCORE_BOOTSTRAP_ADMIN_ENABLED, set normalized PRESCORE_BOOTSTRAP_ADMIN_EMAIL, run auth:bootstrap-admin explicitly, then disable flag. Repeat same owner is idempotent; another owner is rejected. Login cannot create ADMIN privileges.

Shutdown/restart: SIGTERM stops new worker claims; wait <=25s for bounded batch and DB closure. App wrapper sends SIGTERM to standalone server; forced SIGKILL is a failed graceful smoke. Documents live on mounted storage. Hard-crashed worker jobs recover after2-minute lease using the same provider key/amount. Review exhausted/permanent/unknown provider states; never manually mark paid.

Backup: stop all app/worker instances and drain; mount a privileged backup destination; set PRESCORE_BACKUP_QUIESCED=true; backup:create <new-set>, backup:verify. Keep reports separate from sensitive dump/archive. Restore: fresh empty DB/storage, retain auth/provider configuration separately, explicit EMPTY_DATABASE_AND_STORAGE confirmation -> backup:restore -> db:verify -> storage:verify --strict -> start -> auth/download/equality/billing checks. Interrupted set cannot verify; interrupted restore target stays offline and a new empty target is used. Details in RC1-BACKUP-RESTORE.md.

Application rollback only to an image whose registry accepts this schema. RC1 operational migration requires maintenance; older pre-RC registries intentionally reject it. Prefer forward fix, not destructive down/reset. Do not delete economic/audit history.

Incident checklist: safe request diagnostic ID -> readiness code -> migration checksum/catalog -> storage read-only reconciliation -> worker heartbeat/queue oldest/review -> recorded callbacks/ledger anomalies -> safe provider configuration. Disabled payment returns controlled unavailable, not success. External T-Bank outage does not require taking the whole app offline. Logs exclude provider/request bodies, secrets and financial documents. Restore verification is mandatory before reopening writes.
