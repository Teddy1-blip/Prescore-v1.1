# Live product recovery V1

Starting product commit: `277400d858968b774eaf967ae8de918408dcd663`.
Starting tree: `682e381772c2c0c161175dd4e3893b3e15178089`; all 721 blobs verified against GitHub.
Only `prescore-live-product-recovery-v1` receives product changes. No production mutation or deployment has been performed by this recovery task.

## M1 — existing presentation inventory and consolidation

The active CLIENT already uses `client.tsx`, `client-insights`, `client-analysis`, `client-financials`, `client-documents`, `banking-ledger`, `source-operations`, and `financing-request`. BROKER `canonical-dossier` shares these same analytical components. Preserve this route and component graph.

Compared with the retired presentations:

- `credit-conclusion`: retain its conclusion-first hierarchy, financial/portfolio previews and progressive disclosure; do not reactivate its competing report route or its unknown-value hero cards.
- `client-overview`: recover the banking-first summary from the existing `WorkspaceModelV1` facts, including period/accounts/banks, rather than hiding it behind FULL availability.
- `client-credit-sections`: preserve factor → action → evidence relationships and Expertise coverage; use the active `FactorRows`, `ActionItem` and existing Analysis V3 financing presentation.
- `client-source-sections`: its financial/reconciliation formatting and provenance are already consolidated in `client-financials`; keep the latter's newer source history and trend limitations.
- `explanation-library`: restore its searchable, source-linked evidence library inside the existing active analysis Sources section. Both CLIENT and BROKER reach the same component.
- `credit-depth`: retain per-value knowledge, origin, verification, confidence and dates; do not replace dated balances with invented current debt.
- `report-v2`: retain the existing print route and source appendix, and consolidate its presentation vocabulary with the active profile during subsequent milestones.

Confirmed defects: CLIENT implicitly chooses `data.analyses[0]`; ExecutiveOverview gives unknown credit metrics priority over available banking facts; detailed financial data and explanation search are absent from the first-level conclusion. Existing BFO/BKI/quarterly upload and canonical persistence must be exercised, not rewritten.

Required earlier specifications were reviewed: production-client-rebuild, complete-client-coverage, credit-conclusion-acceptance, and the five Polish acceptance/state/defect/milestone documents. Their prior test claims are historical evidence, not live recovery acceptance.

M1 commit: `b320bb3b0f6ad56fc086aebeb19ee94c7f819855`. Typecheck: zero diagnostics.

## Pending gates

M2 reversible archive and explicit selection/onboarding; M3 bank-first conclusion; M4 progressive enrichment; M5 BROKER/AI/PDF equality; M6 visual/copy review; M7 full fresh-source acceptance. No PASS until same-SHA repository gates and fresh live flow, restart and backup pass.

Archive cutover must be an explicit UTC timestamp with preview IDs/count and fingerprint. Never infer the archive set from company names. Snapshot confirmation and a reviewed preview are mandatory before execution. No deletion, startup cleanup or HTTP maintenance endpoint.

## M2 — reversible archive and explicit onboarding

Migration 0009 adds archive state, timestamp/batch identity and an auditable reversible batch registry. Existing payloads, users, roles, agent accounts, settings and entitlements are untouched. Active CLIENT lists, deep links, source writes, document association and broker dossiers exclude archived analyses. ADMIN has an explicit archive filter and labelled read-only dossier.

CLI: `npm run analysis:archive -- preview <ISO-UTC-cutover> <private-plan.json>` works before migration 0009, after verifying existing migration checksums. Review count, IDs and boundary against the confirmed snapshot. After reviewed migration: `PRESCORE_ARCHIVE_CONFIRM=SNAPSHOT_CONFIRMED_PREVIEW_REVIEWED npm run analysis:archive -- execute <private-plan.json>`, then `npm run analysis:archive -- verify <private-plan.json>`. An altered population aborts. Restore is explicit: `PRESCORE_ARCHIVE_CONFIRM=RESTORE_REVIEWED_BATCH npm run analysis:archive -- restore <batch-hash>`. Never run automatically or through HTTP.

No cutover is inferred or executed in production by this milestone. Preview and execute lock/check the exact reviewed population; records at or after the boundary remain active. Restore preserves batch audit metadata. CLI logs only counts/status/hashes, never database credentials or analysis payloads.

CLIENT now opens the start screen without an explicit ID, offers recent active versions for explicit selection, and describes the useful first statement result, supported BFO/BKI formats and privacy. Invalid/archived links do not fall back to another company.

Validation: typecheck zero diagnostics; targeted model/authorization/ADMIN/CLIENT tests 22/22; archive/source/CLIENT checks 14/14. Archive integration proves boundary exclusion, idempotence, unchanged payload and entitlements, ADMIN-only archived reading, active broker filtering, changed-preview rollback and reversible restore. These are isolated tests, not live acceptance.

M2 commit: `8071b7541feb14262ef4f2c92ef8ff2c303efbe5`.

## M3 — useful bank-first conclusion

The existing BankingLedger formatting now serves the executive overview as BankingSnapshot: confirmed period, banks/accounts, receipts/payments, balances, liquidity, taxes, debt payments and concentration. Unknown facts remain available in a closed disclosure, never converted to zero. Existing monthly series remains visible. CLIENT and BROKER reuse ExecutiveOverview.

CreditSummary renders only available canonical outputs, including known zero. One compact assessment explanation links to the missing accounting/credit source or to the existing analysis evidence. No formulas or entitlement rules changed. Validation: typecheck zero diagnostics; client presentation tests 12/12, including unknown-value suppression, known zero and canonical immutability. Live visual/source acceptance remains pending.

M3 commit: `2a2e36685b50fc45f075d53b53fb2be0f219f4a3`.

## M4 — progressive source enrichment

Recovered the financial and portfolio previews from the existing credit-conclusion presentation into the shared active overview. Latest annual and interim periods remain separate; period-specific quality, assets/equity/debt and ratios are retained. The portfolio distinguishes reported dated principal from unconfirmed current principal, contract payment, limit, overdue, next date and maturity. Existing upload/parser/normalization/persistence contracts remain in use.

Validation: zero type diagnostics; source and shared overview checks 21/21. Actual CSV/XLSX/PDF BFO bytes and corporate BKI PDF pass real API handlers; replacement, missing values, partial status, rejected/foreign upload, concurrent-save conflict, quarterly preservation, CLIENT/BROKER equality, reload and analysis isolation are checked. These isolated API/component checks are not the required fresh live browser acceptance.

M4 commit: `0fa53ec4cda9f0777410efadfd83d27e55b49a6c`.

## M5 — shared BROKER, AI and print snapshot

The actual protected print page now loads WorkspaceModelV1 and passes its full.report directly to the existing PrintReport. The same access and entitlement boundary excludes archived analyses. AI source-enrichment answers explicitly distinguish current facts from unavailable numerical before/after comparisons; no previous score is invented. Context fingerprints continue to isolate conversations after any source change.

Broker filtering also preserves a new post-cutover lead for a company with only archived history, without linking its old dossier. Archive records and new leads are independent.

Validation: zero type diagnostics; AI/archive/client tests 32/32; real source-enrichment tests 10/10 including current-context AI reset, local mode, identical CLIENT/BROKER print output and A/B isolation; updated archive checks 2/2 including fresh same-company lead. PDF rendering is component-level evidence here, not completed live PDF/visual acceptance.
