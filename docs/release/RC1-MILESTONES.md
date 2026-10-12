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
