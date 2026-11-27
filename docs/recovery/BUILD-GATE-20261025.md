# Recovery: verification inside the existing Docker build

Date: 2026-10-25. Parent: `7fa2593c441bf3586b608e0c7ebbf5b0682f3844`.
Branch: `prescore-live-product-recovery-v1`.
Status: tested build-gate candidate; full application build and live acceptance NOT completed.

## Purpose and scope

Use the existing Docker build as an execution path for verification, without relying on paid GitHub Actions minutes or introducing a new application/provider. This change prepares that path; it does not start an Amvera build and is not a deployment.

After the existing `npm ci`, Next build and standalone packaging, the build stage installs the same native PDF libraries already present in the runtime image and invokes:

`node scripts/qa/recovery-build-gate.mjs --build-only`

Mandatory sequential stages:

1. All top-level `tests/*.test.mjs`, using the repository's installed dependencies and Node's test runner with concurrency 1.
2. Existing Credit Lab business suite with evidence in a disposable `.next` build directory.
3. Existing ESLint command.
4. Existing standalone artifact validator.
5. Existing PDF extraction smoke against the packaged PDF engine.

A nonzero exit, missing executable or termination signal stops the build. There is no continue-on-error, skip flag or substitution of a successful result. A build-verification manifest records the dependency-lock fingerprint and each completed stage. It explicitly states that browser and authenticated live acceptance are still false. That manifest is evidence of these checks only, not proof that every credit output is correct.

The gate requires a built Next artifact and refuses production/RC runtime mode, live provider flags and supplied database/provider/auth/mail credentials. It is not wired into app startup, migration or worker commands. Synthetic test databases remain permitted inside the disposable build. No live database access is added.

The complete runtime stage of Dockerfile is byte-for-byte unchanged. No ports, healthcheck, startup command, runtime packages, environment values, deployment webhook, lockfile, scoring formulas, parser logic or persisted data are changed by this patch. The extra native libraries are confined to the build stage.

## Executed evidence

Node 22.16.0, no downloaded packages required for the gate's own tests.

`node --test tests/recovery-build-gate.test.mjs`

20 tests passed, 0 failed, 0 skipped. Tests cover explicit build invocation, production and credential rejection, artifact prerequisites, deterministic selection of the complete top-level test suite, serial execution, real child-process exit failures, termination/missing-command failures, mandatory Docker wiring, and CLI report creation in synthetic temporary projects. CLI fixtures deliberately contain synthetic commands; they do not pretend to build or validate Prescore.

The original Dockerfile was checked against Git blob `1ea873e7ba988c34ef457e8acb7c4d86b771062d`; its runtime section was compared byte-for-byte after editing. Both changed JavaScript files pass `node --check`.

Not executed: Docker build, npm ci, complete current application regression, browser acceptance, authenticated inspection of the user's analysis, Amvera deployment, or database backup/restore. The local environment still lacks working npm DNS and a Docker executable. No account/tariff/budget settings were changed.

## Execution boundary for the next operator

Continue from the current recovery branch HEAD, not from a historical archive. Inspect its exact SHA and retain all existing repair commits. Do not run paid Actions, create another project, alter production, change tokens/webhooks/DATABASE_URL, erase data, or force-update branches.

For the existing Amvera staging application, first inspect the saved integration, active revision and available rollback path through an authorized browser/session. No runtime settings need to be changed for this build gate. Promotion and build start require applicable user authorization; this document is not such authorization. A successful build still requires authenticated upload-to-result and client/broker/report checks before any production release.

At a failing build stage, capture the exact error without secrets. Fix its reproduced cause in the recovery branch, keep the lockfile/version constraints unless a demonstrated dependency problem requires a reviewed correction, and run again. Do not disable the gate to obtain a green build. Long build duration, resource limits and provider-side errors must be reported as observed, not guessed or treated as credit-engine defects.
