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

M1 validation and remote commit SHA are recorded by the next milestone; no self-referential SHA is fabricated.

## Pending gates

M2 reversible archive and explicit selection/onboarding; M3 bank-first conclusion; M4 progressive enrichment; M5 BROKER/AI/PDF equality; M6 visual/copy review; M7 full fresh-source acceptance. No PASS until same-SHA repository gates and fresh live flow, restart and backup pass.

Archive cutover must be an explicit UTC timestamp with preview IDs/count and fingerprint. Never infer the archive set from company names. Snapshot confirmation and a reviewed preview are mandatory before execution. No deletion, startup cleanup or HTTP maintenance endpoint.
