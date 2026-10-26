# RC3 startup failure: safe primary diagnostic details

Date: 2026-10-26. Recovery parent: ae9fc2fd4f75eb7e18847d9797290f4bc9f77ea4.
Staging before change: 915e4cd1785c8a0fba82b69b2d4081c7c22a4bb5.
Observed Amvera runtime: f739f67cb3642cfd0b14b4364be17fcb1aaeadd2.
Status: diagnostic correction tested locally; the deployed failure cause is NOT yet established or repaired.

## Confirmed observation

Issue #11 comment 6424313184 confirms the complete preceding build passed (6662/6662 regression, 24/24 Credit Lab, lint, artifact, PDF, Docker exit 0). The new runtime rejects startup at DATABASE_MIGRATION with OPERATION_FAILED. The original stage covers three module imports, pool creation, registry loading and migration execution; it does not prove an SQL error. Empty application logs and the PostgreSQL maintenance notice do not establish the underlying cause.

## Narrow correction

- Give the existing preflight distinct finite step labels: environment import/validation, DB client import, migrations import, readiness import, pool creation, registry reading, migration execution and readiness.
- Imports become sequential so the reported step is unambiguous. All are still completed before opening the pool. Registry is still read once, migrate is still called once before readiness, and the pool is closed in finally. There is no retry or alternate startup path.
- Extend existing error-code classification with explicit PostgreSQL SQLSTATE/Node transport/module allowlists, bounded wrapped/AggregateError cause traversal and exact code-less pg connection messages. Arbitrary messages are not matched or returned.
- Existing health/ready diagnostics add a fixed version marker, step, whitelisted nativeCode and errorType. Raw error messages, stacks, SQL, hosts, database/table/user names, values and credentials are never included in these new fields.
- Preserve the exact canonical migrate call and all four original startup diagnostic tests, including the existing rc-runtime source contract.
- Keep readiness false and product routes unavailable on failure. Production still exits nonzero rather than hosting the staging diagnostic server.

No SQL, migration files, migration transaction logic, connection options, timeouts, environment settings, dependencies, scoring, client UI, auth, production deployment, DNS or data changes. Do not infer permission to reset or recreate PostgreSQL from this patch. The existing already-authorized startup migration path remains the same.

## Executed verification

Node 22.16.0; built-in modules only. Original startup driver, diagnostic server and existing diagnostic tests were verified against Git blob IDs 5c44938214c05c46ffdeb5e14195379f774e9e56, a6240f5b13d326436655d968ecd825883ef490ba and 868651642a33473e0804ccfebc577fd9cc3705b9. Unchanged supporting artifact scripts/Dockerfile were also checked against their Git blobs.

- Existing 4 startup diagnostic tests plus 28 new tests: 32 passed, 0 failed, 0 skipped.
- Against original startup code, the same new expectations plus original tests: 5 passed / 27 failed. These failures demonstrate the diagnostic gap, not the live root cause.
- Tests exercise real local HTTP health/ready endpoints and execute the actual startup driver in child processes with explicitly synthetic environment/DB/migration modules. Each preflight step can be failed deliberately; no failed probe launches Next. The success probe preserves registry -> migrate -> readiness -> pool close -> Next order.
- Wrapped errors, cyclic causes, specific SQL/transport codes, uncoded errors, secret sentinels and rejection of forged fields are covered. No actual DB or real migration is used in these local probes.
- node --check passes for all three changed/new JavaScript files.

Complete current build/regression/lint/artifact/PDF remain mandatory in Amvera. Local ESLint/dependencies are unavailable; no full lint or full application build is claimed. This patch is diagnostic, not evidence that the live database is repaired.

## Next Work action

Check the newly imported source and all mandatory build stages without a duplicate rebuild. After activation inspect health and ready. On continued rejection capture diagnostic.version (PRESCORE-STARTUP-DIAGNOSTIC-2), stage, step, code, nativeCode and errorType. Record actual values; do not guess or publish raw logs containing secrets. Read the existing DB app status and maintenance information without changing configuration. No reset/purge/manual SQL/token/webhook/DNS changes or repeated restarts. If READY is reached, continue authenticated dashboard acceptance instead of stopping at server readiness. Do not use the prior release ID alone as proof of the new revision.

Code-reference sources: PostgreSQL 17 SQLSTATE appendix https://www.postgresql.org/docs/17/errcodes-appendix.html ; Node errors https://nodejs.org/api/errors.html ; node-postgres client/pool source https://github.com/brianc/node-postgres . These explain code mappings, not this deployment's hidden cause.
