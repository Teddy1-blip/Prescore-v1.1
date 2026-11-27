# User-entry and credit coverage improvements — 2026-10-27

Input: issue #11 comments 6439838375 (authorized real workspace diagnosis) and 6440192709 (owner URL without analysisId).
Base: staging bff90d15c4c9e350b12e370566fb073d489b0218. Original inspected recovery source e3cd54403310e74be988c4f5001c3c7dd52bd76b has the same five target blobs.
Concurrent recovery branch advanced to 2a4f981eee08c97b4ce5099c02235d5d0366f04b with 8 unrelated public-financing changes. Do NOT merge those changes into staging as part of this bounded patch. Apply these nine scoped files directly on the existing staging tree; leave concurrent recovery branch untouched.
Scope: one owner-scoped lightweight initial listing, explicit no-selection path and display-only canonical evidence explanations. No new platform.

## Changes
- Authenticated GET /api/workspace?projection=summary returns only id/name/INN/period/creation date for max 50 ACTIVE analyses, not their full JSON payloads; no DDL, mutation, entitlement scan, deal/history hydration or credit model calculation in that route. Admin can still see legacy unassigned rows through read-only projection. The original GET /api/workspace and GET ...?client=<id> contracts remain unchanged for operations and agent uses. Selected analysis still uses independently authorized /api/workspace-model; summary never grants full access.
- CLIENT initial entry uses summary except agent and direct applications route. Old analyses remain selectable, no auto-selection or deletion. Opening /dashboard?view=documents with no analysisId explains required selection, the difference between dossié attachment and analytical upload, and starts a new TXT 1C analysis via normal button.
- Workspace FULL response publishes minimum full bank months directly from the existing canonical DEBT_CAPACITY_POLICY. This is metadata, not a recalculated limit or client-side policy duplicate.
- Index panel and conclusion show only missing fact codes actually present in canonical coverage, identifying insufficient legal component as the reason the overall index is unavailable and limited operating trend separately. Capacity panel reads existing month count, assessment status and schedule unknown/excluded IDs; it does not turn zero observed payments, unknown current principal or dated BKI payments into other values.
- The schedule's exclusion of CREDIT_LIMIT from eligible FUNDED_DEBT/LEASE is unchanged. Any future alteration requires separate semantics/credit policy review.

## Verification
- Local Node 22.16 focused pure tests of credit-coverage-guidance: 5/5 pass, including immutability, legal and bank trend split, unknown schedule and non-zero-substitution.
- New isolated route tests execute the actual route through TS transpilation with mocked auth/DB boundaries. They check owner filtering, metadata-only SQL, no request DDL or writes, anonymous rejection and legacy admin history. These need running in the full repository gate.
- Every changed old file was retrieved from the exact recovery ref, single-occurrence anchors verified, and blob SHA recorded. Full npm typecheck/build, complete regression, Credit Lab 24, standalone PDF and authenticated browser acceptance are NOT claimed yet.

## Acceptance for Work, one bounded verification
1. After a single normal staging webhook build succeeds, confirm exact deployed source and READY; don't start a duplicate build or poll continuously. If still building, record one status and finish session without cancelling.
2. Open owner's EXACT initial path /dashboard?view=documents in authorized session. No analysis should be auto-selected; history remains, and prompt clearly explains how to select/create one. Verify the first /api/workspace?projection=summary returns only lightweight metadata, not saved payloads. Record timing/size compared with any trusted earlier baseline; do not invent a performance improvement without measurement.
3. Open existing QA analysis 992ab9e3-672e-4adf-955e-9a2c40e3ece3. Index should identify LEGAL_LIFECYCLE as blocking numeric index and BANK_OPERATING_TREND as incomplete; capacity should identify 1 of policy 6 months and incomplete 30-day graph/excluded obligation. Existing bank/BFO/BKI values and dates must not change.
4. Check entry to Banking, Analysis, Documents, Financing, Obligations and back; missing selection must not be mistaken for data loss. Report actual HTTP errors and slow steps. No repeated uploads, SQL, deletion, Checko calls, production or DNS work.

## Still open
A genuine full numeric-index acceptance needs sufficient banking history and an accepted way to establish legal lifecycle independently of mandatory paid enrichment. A known BKI payment 9,000 RUB remains excluded in this case because its obligation has exposure class CREDIT_LIMIT, not a supported funded-debt/lease classification; this must not be hidden by fake zero/current debt. Historical client parser failures, full-document retention, broker/admin, real PDF parity, latency of FULL canonical rebuild and payment security remain unaccepted.
