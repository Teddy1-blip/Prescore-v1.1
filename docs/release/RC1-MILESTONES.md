# RC1 work journal

Starting local and remote HEAD `37c4078189a09248dedb513e3d77e9ccbe9889f7`, confirmed 2026-10-12. Work only on prescore-product-v1. No deployment, external migrations, live payments/payouts or Amvera. Commit SHAs are recorded in the following commit because a commit cannot contain its own SHA.

## M1
Removed baseline diagnostic tolerance and Next ignoreBuildErrors. Corrected SQL interface variance and two legacy presentation type errors without modifying canonical calculations. Removed login-time ADMIN escalation. Added explicit idempotent audited bootstrap, ordered/checksummed/locked transactional migration status/migrate/verify and fail-closed catalog checks. Runtime environment modes and explicit isolated RC Fake policy. Migration0007 adds operational state/indexes only.

M1 SHA: `a6b24d980a241864b26157a3c46c4d776508094b`. Typecheck 0, targeted 15/15, lint 0 errors.

## M2
One standalone image, non-root app/worker commands, persistent volume, production-like RC mode, startup verification, process health/separate readiness, worker heartbeat and bounded SIGTERM. Docker is unavailable locally; real container smoke is delegated to the dedicated CI job, no local PASS claimed.

M2 SHA: `98464e9ba484cbe4213f4f450f8413d74a024d4b`. Strict production build PASS, targeted 6/6, lint 0 errors.

## M3
Real-PostgreSQL clean and pre-billing upgrade scenarios; catalog/auth/legacy preservation checks. Persistent RC Fake providers use the official interfaces and PostgreSQL, shared by app/worker and surviving process restarts. RC mail transport stores verification mail only in isolated DB; no public test endpoints.

M3 SHA: `3a1c2d6b34a1207f14c09fd9bb14aec257ebbbfd`. Targeted 8/8; typecheck 0; real PostgreSQL scenarios pending dedicated CI.

## M4
Actual separate-worker kill-after-acceptance, lease recovery, concurrent workers, provider replay, retries/max attempts/manual retry, heartbeat and SIGTERM scenarios. Provider state remains persistent, no business economics changes.

M4 SHA: `4e07ae884a7d687b48ce58cb48f509c29e389a43`. Targeted settlement/provider/runtime 8/8; actual process concurrency/restart queued for PostgreSQL CI.

## M5
Atomic fsync/rename document persistence, read-only reconciliation, standard pg_dump/pg_restore custom-format backup, bounded checksum-verified storage archive and privileged empty-target restore. Coordinated set requires stopped app/workers; interrupted incomplete sets cannot verify or restore. Full real restore drill is a dedicated CI gate.

M5 SHA: `6f08a64d565b2f52860323a832a993ddc8a55b7b`. Targeted 12/12; typecheck 0. pg_dump/restore/container drill pending real CI.

## M6
Central CSRF with cryptographically verified callback exemption, nonce CSP/security headers, PostgreSQL multi-instance limiter, actual streamed input bounds, error/log sanitization and safe diagnostic IDs. Fixed chat role spoofing/document association and whitespace CSV injection. Exact dependency versions + production audit gate; operational summaries and bounded stable Broker/partner paging.

M6 SHA: `e9338a659454529ce5a8e2d42bdc5aee6c2efd59`. Product/auth/security targeted 33/33, zero diagnostics, strict build PASS and full lint clean.

## M7
Full RC E2E through real standalone HTTP/auth/uploads/callbacks and a separate worker, synthetic bank/BKI/quarterly source documents, billing/privacy/application/chat/local-AI/restart, clean DB/storage restore and equality/performance assertions. No QA bypass routes or preset scoring models. Actual real-PostgreSQL execution is gated by RC CI, not claimed from local contract tests.

M7 SHA: `0130904e2b927f3a4185a41bb5197e470ef433bd`. Local PDF/archive/E2E contract/storage tests 4/4, lint clean. Production-like execution pending RC gates.

## M8
Dedicated RC workflow: static/audit, reuse exact-SHA Product regression, independent real PostgreSQL clean+upgrade+worker jobs, container smoke, coordinated restore and artifact aggregation. Deterministic release manifest plus CycloneDX SBOM; all operational docs. Actions updated to verified official pinned current commits to remove obsolete Node runtime warnings. No live/deployment steps.

M8 SHA: `21fe25f184e4f94d3076ed1f901c59f6b71cd657`. Local diagnostics0/lint clean/manifest+SBOM generated. First real PostgreSQL worker job passed kill/lease/concurrency/retry/manual-retry/SIGTERM. Other full RC gates are running; no premature PASS. Follow-up moves environment validation before pool creation and strengthens drift detection/evidence.

First RC run: worker PASS; clean/upgrade E2E hit signup rate limits (test now respects windows), container PDF smoke passed app/worker but used wrong artifact root (fixed), dependency audit blocked on real critical/high issues (patched within supported major). Added migration0008 lookup/drift checks, startup config-before-pool and persistent Init crash/late-callback/storage crash proof. Targeted RC+billing30/30; final CI is rerun after corrections.

Follow-up candidate: dependency critical/high0, patched runtime esbuild0.28.2, RC+billing targeted30/30, diagnostics0, strict Next16.4 build PASS. Migration0008 and actual upload/Init crash gates supplement the first-run corrections. Security-derived document actor replaces caller label. Final exact-SHA Product/RC validation is mandatory.

Follow-up SHA: `409fc5046ab36915c21e84b04b5bf34421408d1f`. Real CI static, container and worker PASS; clean/upgrade migrations PASS. Product suite exposed six strict test-loader import omissions after security hardening: loaders now import the actual security module, targeted168/168 including Credit Lab24/24. Real HTTP browser gate exposed missing browser assets in the standalone package outside Docker; package-runtime now copies static/public assets for every launch path. No scoring or access rules changed. Exact final CI rerun remains required.

Standalone/harness correction SHA: `717450a184edc627764481b68e2d1c46cbad6079`. Targeted168/168, diagnostics0, lint clean. Final recovery coverage additionally kills a real pg_dump backup process group while a fixture ledger lock prevents completion, checks unpublished manifest/verification rejection and then creates a fresh complete set before restore. Only isolated CI fixture DB locks are used; no source rows are modified.

Recovery drill candidate SHA: `4f2655213287b10bf1bdb823bdfdaafa3fc13231`. Local full6360/6360, Credit Lab24/24, diagnostics0, lint/artifact/PDF PASS. Exact-SHA CI ADMIN125 and Billing browser gates, static, worker and container PASS. Standalone browser gate reached hydrated app but its global alert count included the framework's empty screen-reader route announcer. Assertion now targets application main alerts and retains screenshot/error/overflow checks; it does not ignore application failures. Final all-gate rerun required.

Browser-scope correction SHA: `e09a7fcff5190727aaaca8e45891fe1349bf01c3`. Actual standalone CLIENT/BROKER/ADMIN browser five widths + nonce hydration PASS; app SIGKILL after Init/replay/late signed callback, restart equality, downloads/chat/access/ledger invariants PASS in both real clean and upgrade jobs. Backup interruption synchronization expected file creation before locks, but pg_dump waits for table locks first. It now observes the actual pg_dump lock wait blocked by the fixture transaction through pg_stat_activity/pg_blocking_pids, then kills the real process group. Final complete restore/CI rerun mandatory.

Native lock synchronization SHA: `908d30768057205b599e400a7dd1d3cdada5cfc2`. Backup drill still blocked before native dump: schema constraint deparsing can acquire relation locks during preflight. The test now holds the existing backup advisory lock first, waits until CLI completes preflight and reaches that gate, then locks only the fixture ledger and releases the gate. Actual pg_dump lock wait triggers SIGKILL. Safe child exit codes are surfaced immediately rather than masked by timeout. No operational backup behavior is changed.

Pre-final acceptance candidate SHA: `563e7ab33c0f3d0475a66c66678990b32444780e`. Real PostgreSQL clean-install E2E26/26 and pre-billing upgrade E2E26/26 PASS, including actual backup SIGKILL/rejection, fresh coordinated backup, empty DB/storage restore, post-restore real auth/download/application/chat/access/canonical equality and ledger invariants. Worker and container PASS, static typecheck/build/lint/artifact/PDF/audit PASS; critical/high0. Product browser gates: CLIENT112, BROKER73, ADMIN125, Billing134, Analysis V3 five widths/print/native200% zoom PASS. Full local6360/6360 with no skips; exact-SHA CI full suite and final artifact aggregation remain mandatory.

Final review removes redundant advisory unlock so the backup drill emits no avoidable PostgreSQL warning, strengthens public-report equality for BROKER as well as CLIENT/ADMIN (targeted7/7), and publishes machine-readable status/check counts per evidence report in the release manifest. Generator/SBOM and lint checks PASS. The final released source SHA and exact green run IDs are recorded in the release manifest and delivery report; no deployment/live operation is authorized or performed.

Complete pre-final CI for `563e7ab33c0f3d0475a66c66678990b32444780e`: Product QA https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/38305568242 — all4 jobs PASS, full6360/6360, Credit Lab24/24, no skips. RC1 https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/38305568245 — all7 jobs PASS, release manifest and CycloneDX SBOM produced after actual clean/upgrade/worker/container/recovery gates. Final evidence review additionally verifies that a FAIL report rejects manifest generation (`RC_EVIDENCE_NOT_GREEN`); successful generator/SBOM and strengthened canonical equality targeted7/7 pass. The final commit must independently pass these same exact-SHA workflows before delivery.
