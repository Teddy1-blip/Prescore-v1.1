# Recovery package 3: financial number signs and row boundaries

Date: 2026-10-22. Parent: `f358ee85af79a6cbc00ac7de67fd68ac6ff6c120`.
Working branch: `prescore-live-product-recovery-v1`.
Status: locally tested code candidate; not deployed; not complete product acceptance.

## Reproduced failures

The shared BFO/interim text parser turned `(1234)`, `(12345,67)` and Unicode-minus amounts into positive source values. A missing profit value could be filled with the next labelled row's net-assets amount. Label fallback could delete an amount merely because its digits resembled a reporting-row code. Incomplete accounting parentheses could also lose their negative meaning.

## Scope of correction

- Preserve signs on ungrouped/grouped accounting parentheses, Unicode numeric minus and thin/non-breaking grouping spaces.
- Keep incomplete parentheses unknown rather than publishing a positive amount.
- Follow wrapped numeric values, but stop at the next labelled financial row.
- Remove only the expected standalone row code in label fallback, never an unrelated code-shaped net-assets amount.
- Preserve the existing standalone-dash convention and expense-magnitude normalization. Do not change financial ratio formulas, risk thresholds, index weights, provider configuration, entitlements or database contents.

The production edit is limited to `lib/quarterly-report.ts`. Existing bank/date/balance and workspace-diagnostic changes are retained through the current parent tree, not copied from an older source bundle.

## Executed evidence

Command: `node --experimental-strip-types --test tests/financial-number-sign-recovery.test.mjs`.
Environment: Node 22.16.0; actual parser, financial adapter, normalizer and financial engine. No parser or engine mocks. Synthetic text fixtures and JSON round-trips; no client documents or credentials.

- Exact original parser blob `0f60d61d9ab987f44f6bd849a46ee7fe67c211b8`: 44 tests, 11 passed, 33 failed.
- Patched parser blob `3fe91585451817f07cf5bbcb5dc3005142013bce`: 44 tests, 44 passed, 0 failed, 0 skipped.
- Test blob `df0d148f286c96ab4969f146236a7357641bcf40`.
- 12 positive control fixtures (annual/interim, RUB/thousand/million, coded/labelled rows) retain the original full parsed result, excluding random ID and extraction timestamp.
- Parser and runtime financial dependencies used by the suite were checked against the current GitHub blob hashes. The older local bundle was only a source retrieval bootstrap; it is not the remote commit parent.
- Changed file transpiles without syntax diagnostics under installed TypeScript 5.8.3. This is not a project-wide typecheck or the locked TypeScript 5.9.3 build.

Tests cover source raw values, scaled normalized values, negative net margin, negative capital/net assets, original expense-sign provenance, missing scale, wrapped rows, missing versus zero, company mismatch and serialization without input mutation.

## Boundaries and remaining work

No full locked-dependency install or Next.js build: registry.npmjs.org still does not resolve in the execution environment. No authenticated staging test, browser review, original PDF/XLSX byte extraction, live Checko request, BKI regression or all-19-block acceptance is claimed by this package.

No staging/main/production update, deployment, GitHub Actions run, environment change, payment activation, database write, archive or deletion. Staging was read as `7aa6b167b696e8cc4073f623036081c8602fc7a1`.

Historical saved financial snapshots are not silently rewritten. Any repair of them needs complete original documents and separate controlled recalculation. General multi-column/multi-year layout handling and ambiguous standalone code/amount collisions are not solved by this patch.

This fixes demonstrated financial input corruption; it does not establish the cause of the user's blank live analysis. Build, source extraction, authenticated diagnosis and the complete source-to-screen path remain acceptance gates.
