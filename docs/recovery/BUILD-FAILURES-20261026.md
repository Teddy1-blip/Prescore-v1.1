# Five staging build failures: exact provenance review

Date: 2026-10-26. Recovery parent: ba10b8d5c557454593ffe9696a8c9ab8efccd3a5.
Failed staging source: 7963e6c0663c84af6f3ca3998a4b2287a5eb9348.
Scope: tests, a reviewed fixture and this report only. No production code changes.
Status: locally reproduced and checked; complete Amvera build/live acceptance still required.

## Root causes

Four failures are two complete-output fingerprint mismatches repeated by the presentation and expertise suites. The bank repair f358ee85 changed source provenance, not the economic results of these two fixtures:

- CL-RU-BUS-010: 32 output-field differences. Supplied-account liquidity includes internal-transfer provenance and a corrected calculation description; derived provenance fingerprints follow that change. All numeric fields, decisions and the entire client report are unchanged. Observed internal legs cancel in this fixture.
- CL-RU-BUS-022: seven output-field differences: input fingerprint and six warning-order positions. The input also preserves the original document date on two conflicting transaction observations. The conflict remains unresolved; unknown totals and capacity stay unknown. All numeric fields, decisions and the entire client report are unchanged.

The exact old and current SHA-256 values were reproduced, including both actual hashes reported in issue #11. Only these two entries in analysis-v3-canonical-hashes.json are updated. The other 22 entries remain unchanged.

canonical-provenance-review-20261026.json preserves every reviewed before/after path and both original complete-output hashes. The new native test restores ONLY those exact metadata fields in a clone and requires the old whole-result hash. It additionally fixes the unchanged whole client-report hash and rejects injected score, conclusion or provenance changes. No wildcard removal of metadata or weakening of comparison is used. Existing full-output fingerprint tests remain active.

The fifth failure is a stale source-pattern assertion: it expected view==='analysis'&&<FullCreditAnalysis, while the guarded JSX uses view==='analysis'&&model&&<FullCreditAnalysis. The assertion now explicitly requires the model guard. All checks against legacy scoring and side effects remain.

## Executed evidence and limits

Node 22.16.0. The local replay starts from the provided historical source bundle and applies the exact current bank metrics, posting-date adapter and normalizer, verified against Git blobs 52771c62a43cd96961b57e55c7010d81ceda5f52, c594b8beee7a9bdaaac4805a6e8b6377a859d00a and 89f5e57506beaf80ef8353ca0debad898053adf4. The original engine reproduces the old two hashes; the current bank implementation reproduces both full hashes from the failed Amvera run. This is an exact-output diagnostic replay, not a complete checkout/build of every current dependency.

Synthetic ZIP sources were extracted with Python. The actual business-input builder verifies each bank file's byte and decoded-text hashes. Parsers and canonical engines were not mocked.

- All 24 replayed business cases match the reviewed complete-output baseline; all 171 existing business assertions pass. The unchanged 22 old fingerprint expectations still pass.
- 14 new native provenance/semantic/mutation tests pass.
- 30 existing isolated ClientWorkspace navigation tests pass using current source blobs. These deliberately stub React hooks and child components; they do not prove browser layout or lifecycle.
- Combined test command: 44 passed, 0 failed, 0 skipped. Local corpus option: PRESCORE_TEST_EXTRACTED_CORPUS points only to the extracted hash-verified synthetic fixtures. With no option, the committed test uses the ordinary business-corpus loader.
- The exact stale JSX assertion fails before repair, passes after repair, and fails again if the model guard is removed. Other credit-conclusion assertions are unchanged. The full React/PostgreSQL credit-conclusion suite was not executed locally.

Full locked-dependency build, full 6,611+ suite, lint, PDF artifact, browser and authorized live analysis checks were not executed here. They remain mandatory in the existing Amvera Docker build and subsequent acceptance. No check is disabled, no workflow is added, and no rebuild success is claimed by this document.

No scoring thresholds, policies, parser behavior, runtime configuration, database, domain, production code or payment settings are changed. No historical analyses are rewritten. Keep the existing GitHub -> staging -> Amvera delivery route and skip paid Actions. Record the next imported revision, exact build result and health/readiness in issue #11; do not equate a push with deployment success.
