# Overview Fragment: repair the complete routing contract

Date: 2026-10-26. Recovery parent: `ecdc68461ff387beec15788105be5d1e2c6a6e46`.
Staging before promotion: `e3af67046c0bf08b4c47f07f439a7795eeceef8c`.
Reported Amvera revision: `22c90e019ea487108f696d6c695f5e412c1ce572`.
Scope: tests and this report only. No production source or baseline changes.

## Reproduced cause

The previous patch fixed the model guard expectation but did not execute the entire credit-conclusion guard test. Its separate `return <ExecutiveOverview` source regexp rejects the existing FULL Fragment containing ExecutiveOverview and ClientDecisionRoute. This expectation is not a credit-engine invariant. Do not remove the decision route or rewrite production JSX to satisfy it.

## Repair

Replace the two source-format assertions for ClientOverview with a shared, isolated element-routing contract. It transpiles and executes the actual exported ClientOverview function. JSX creation and imported child components are explicit stand-ins; child rendering, React lifecycle, DOM and APIs are not involved.

The contract checks four missing/null FULL cases (including an entitled user with unavailable results) route to FreeOverview with the original model and retry callback. A present FULL model must return exactly one ExecutiveOverview and one ClientDecisionRoute, in order, with the identical unmodified model and original callbacks. Equivalent wrapper markup is accepted. No index, amount, source or entitlement is calculated by this helper.

Existing guards against legacy scoring/side effects, routing to the analysis component with `&&model&&`, historical purge scripts and mutating health endpoints remain. The existing full-source React/PostgreSQL integration test is unchanged. All canonical hashes, production components, Docker and deployment configuration are unchanged.

## Executed evidence

Node 22.16.0, installed TypeScript 5.8.3, not the locked TypeScript 5.9.3 toolchain. Target source files copied from supplied archives or fetched source were checked against Git blob hashes before use; only these verified files were used, not an assumed current historical checkout.

- Both standalone guard test bodies from tests/credit-conclusion.test.mjs were selected with TypeScript's parser and executed unchanged by a local probe. Before repair: 1 passed / 1 failed, reproducing the exact `return <ExecutiveOverview` error. After repair: 2 passed / 0 failed.
- `NODE_PATH=$(npm root -g) node --test tests/client-overview-routing.test.mjs tests/client-navigation-recovery.test.mjs`: 47 passed, 0 failed, 0 skipped.
- Of those, 17 are overview contract checks: actual Fragment, an equivalent wrapper, and 15 deliberately broken implementations that must be rejected (missing/reversed guard, absent/duplicated children, comments instead of rendered content, model substitution, lost callbacks, input mutation).
- The other 30 are existing isolated ClientWorkspace selection/navigation regressions; React hooks and child components are explicitly stubbed in that suite.
- `node --check` passed on all three changed/new JavaScript test files.

The first credit-conclusion React/PostgreSQL integration test was NOT run locally. React, React DOM and PGlite are not installed in this local environment; a registry probe returned EAI_AGAIN. No full current Next build, complete test suite, lint, PDF extraction, browser acceptance, authorized live analysis, database or provider operation is claimed.

## Acceptance still required

Promote these test-only changes through the existing staging webhook. Work must collect the final outcome of the mandatory Docker gate, not treat the first printed failure as the final test total. On failure do not activate an image, bypass tests, edit runtime settings or repeatedly restart; capture all reported failures and the gate stage reached. On success verify the active revision, health, ready and authenticated dashboard separately. Production, DNS and payments remain outside this patch.
