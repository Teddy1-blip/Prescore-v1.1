# Workspace recovery package 1: diagnostics and bounded staging access

Date: 2026-10-21. Parent: `744e64212604a849ee5718e59592be31fb023a0e`.
Working branch: `prescore-live-product-recovery-v1`.
Staging remains `7aa6b167b696e8cc4073f623036081c8602fc7a1`.
Status: CODE CANDIDATE; not deployed; not a 19-block acceptance.

## Implemented

Reuse canonical safe diagnostics in the actual workspace service. Distinguish saved JSON/identity/shape, BASIC projection, entitlement read, profile read, canonical stage and public projection failures. Keep usable BASIC facts on FULL failure. Missing BASIC bank metrics now have an explicit diagnostic. No invented values, legacy metric fallback, scoring changes or data writes.

Ownership precedes input parsing/diagnostics. FREE does not invoke the FULL chain or read the profile. The optional diagnostic contains only an allowlisted stage/reason/correlation ID. Russian explanations are shown without exception text, SQL, stacks, secrets, documents or amounts. Same-analysis results survive temporary refresh failures; HTTP 401/403/404 clears previous results. Switching analyses clears old diagnostics. Existing navigation/source-upload and read-only/module guards remain.

Test FULL recognizes both explicitly approved staging origins and requires BOTH `PRESCORE_STAGING_FREE_FULL=1` and `PRESCORE_RUNTIME_MODE=release-candidate`. Production/other modes, other domains, embedded credentials, query/fragment, non-root paths and unexpected ports fail closed. Owner checks and payment persistence are unchanged. No environment flag was set.

## Executed evidence

Node 22.16.0, installed TypeScript 5.8.3; the exact locked dependency set (including TypeScript 5.9.3) was not installed.

Command:
`node --experimental-strip-types --test tests/workspace-recovery-diagnostics.test.mjs tests/client-navigation-recovery.test.mjs tests/staging-access.test.mjs tests/staging-origin-recovery.test.mjs`

**88 passed, 0 failed, 0 skipped.**

- Service/hook contracts: 29. Real fetched target source; engine, financial-source selector, React hooks, HTTP and database dependencies explicitly stubbed.
- Navigation branches: 30, including the previous 27 and 3 diagnostic/guard cases. Hooks and child components stubbed.
- Staging/access/checkout: 29. Actual origin gate and entitlement resolver; database, Next.js/auth and JSX runtime explicitly stubbed.
- Differential run of the 29 workspace tests against original fetched service/hook/diagnostic sources: 7 passed, 22 failed. The new display-only helper was supplied to both runners.
- Changed production files transpiled without syntax diagnostics. This is not a project-wide TypeScript check.

Target originals and native utility dependencies were checked against GitHub blob SHAs. An older local source bundle was used only to bootstrap verified file copies, never as the remote commit parent. Remote changes must be restricted to this patch's files on the current working tree.

## Not executed or claimed

No full dependency install/build, full scoring suite, real React/browser run, authenticated staging diagnostic, live source upload or deployment. This environment cannot resolve registry.npmjs.org. Do not promote based only on isolated checks.

No environment change, live Checko request, token/webhook change, archive execution, database cleanup/reset, production mutation, payment activation or GitHub Actions run.

## Remaining acceptance register

| ID | Required result | Status |
|---|---|---|
| R1 | Safe diagnostic of an authorized live analysis | Code/tests complete; build/live pending |
| R2 | Owned FULL on the current staging origin | Gate fixed; live flag/access not inspected or changed |
| R3 | Actual Next.js navigation and source uploads | Isolated regression passed; browser pending |
| R4 | Explain and repair blank bank figures using actual sources | Pending live diagnosis and source-to-saved-to-UI comparison |
| R5 | Checko runtime policy/provider availability | Not changed |
| R6 | Identify historical QA analyses including Vivoline | No records changed or claimed archived |
| R7 | BFO/BKI/quarterly, 19 blocks + 6.5, CLIENT/BROKER/PDF/AI | Existing implementations preserved; acceptance pending |
| R8 | Legacy checkout versus billing contract | Not changed; real payments out of scope |
