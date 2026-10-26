# Workspace diagnostics harness: lint naming repair

Date: 2026-10-26.
Recovery parent: `d36ab76e06fc103673f7790f0ba59cc85208f658`.
Staging before repair: `79d966a3010908e530680a0ed1beb4f65789813a`.
Scope: one existing test file and this report; no application or configuration changes.

## Observed build result

Issue #11 comment 6419500981 reports Amvera revision `42afd7e72f694007216425da3bc33076a678710f`: 6662/6662 regression checks and 24/24 Credit Lab cases passed, then ESLint stopped the build. Artifact validation and PDF runtime extraction were not reached. This is evidence for the preceding revision, not a result for this patch.

## Changes

- Rename the test loader's local `module` binding to `loadedModule`. The CommonJS function parameter string `module` is preserved for transpiled target code; cache and exports behavior are unchanged.
- Remove the unused `input` parameter from the explicitly stubbed canonical-engine function.
- Give the hook harness render callback an explicit custom-hook name, `useHarnessRender`, while preserving its external `render` property. The real `useWorkspaceModel` call stays unconditional in that callback. Stubbed React scheduling remains explicit; this is not a production React renderer.

No ESLint rule is disabled, no file is excluded, and no assertion or expectation is removed. No scoring/parsing/HTTP transport/baseline, package lock, Docker gate, migration, environment, production, domain or payment changes.

## Executed checks

The original test bytes match Git blob `b38c6b842081f3ad7dd14e03a6ee3858eaea1420`. Its locally used service, model, diagnostics, diagnostic-view, hook and portfolio/common modules were checked against current Git blob identities. Engine/React/DB boundaries remain the test's existing explicit stand-ins.

Node 22.16.0 and locally installed TypeScript 5.8.3:
- `node --test tests/workspace-recovery-diagnostics.test.mjs` with global TypeScript resolution: 29 passed before, 29 passed after; 0 failed/skipped.
- `node --check tests/workspace-recovery-diagnostics.test.mjs`: passed.
- A local TypeScript AST audit verifies removal of the forbidden variable binding, the enclosing named hook callback and unused stub argument, and exact preservation of all 93 assertion-call texts and 25 test-registration texts (loops expand these into 29 cases). This audit is NOT ESLint.

The uploaded replacement blob matches the tested bytes: `f658ce42bf93a4b631c276d38eae76a89a7d5b45`.
Full ESLint is not installed locally; the registry probe returned `EAI_AGAIN`. No local full-project lint, build, complete regression or live acceptance is claimed. The unchanged mandatory Amvera gate must rerun all stages and confirm lint, artifact and PDF checks.

## Delivery and acceptance

Deliver through the existing recovery -> staging -> Amvera webhook, preserving both parent histories and using non-forced ref updates. Skip paid Actions. Work should inspect the new imported revision without a duplicate rebuild, record all final gate outcomes, then verify active source, health/ready and authenticated dashboard only after success. If another failure occurs, collect all diagnostics from that stage; do not disable checks, alter runtime settings or activate a failed image. Production, DNS, database and real payments remain untouched.
