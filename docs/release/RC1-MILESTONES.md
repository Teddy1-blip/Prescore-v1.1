# RC1 work journal

Starting local and remote HEAD `37c4078189a09248dedb513e3d77e9ccbe9889f7`, confirmed 2026-10-12. Work only on prescore-product-v1. No deployment, external migrations, live payments/payouts or Amvera. Commit SHAs are recorded in the following commit because a commit cannot contain its own SHA.

## M1
Removed baseline diagnostic tolerance and Next ignoreBuildErrors. Corrected SQL interface variance and two legacy presentation type errors without modifying canonical calculations. Removed login-time ADMIN escalation. Added explicit idempotent audited bootstrap, ordered/checksummed/locked transactional migration status/migrate/verify and fail-closed catalog checks. Runtime environment modes and explicit isolated RC Fake policy. Migration0007 adds operational state/indexes only.

M1 SHA: `a6b24d980a241864b26157a3c46c4d776508094b`. Typecheck 0, targeted 15/15, lint 0 errors.

## M2
One standalone image, non-root app/worker commands, persistent volume, production-like RC mode, startup verification, process health/separate readiness, worker heartbeat and bounded SIGTERM. Docker is unavailable locally; real container smoke is delegated to the dedicated CI job, no local PASS claimed.
