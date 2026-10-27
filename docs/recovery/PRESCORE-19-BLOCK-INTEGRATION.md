# Prescore 19-block integration — acceptance ledger

Updated 2026-10-27. Scope: existing recovery branch; no production, database, DNS, paid provider, webhook or configuration changes. QA A `992ab9e3-672e-4adf-955e-9a2c40e3ece3` remains unchanged.

## Baseline and packet 1

- Recovery base: `2a4f981eee08c97b4ce5099c02235d5d0366f04b`, tree `4bed0546f53ffbeedcb4a8ea4e528b0ae8791792`.
- Staging: `783bfdf9977d6a1aaa899cddcb757ffc637df4b6`, tree `731e58e64ca36353bab63ae955035f2917922054`.
- Product: `e798d4654f2b0cf7eb96b291ff2c6135c84dcfa8`.
- Exact recovery snapshot restored by verified Git blobs; local `git write-tree` equals its remote tree.
- Compared both directions against common ancestor `e3cd54403310e74be988c4f5001c3c7dd52bd76b`. Staging changes nine paths; recovery independently changes five public-financing paths. Sets are disjoint. Nine staging paths integrated without rewriting history or changing the five public-financing files.
- Amvera terminal revision `a02e4c61aa05048b64883c0633e3cf5c1803f93d`: build FAIL, 6,733 PASS / 5 FAIL / 0 skipped. Last UI line 27.10.2026 15:43:09, “Docker build watcher application completed”; exit 1. Source parent/tree identity has NOT been independently established from the Amvera merge label.
- Active revision remains `574c42b929b3116dac4bf3b99ec012d9d0aa60ba` (Used and Built check marks). No restart or repeated build.
- All five failures reproduced locally in `tests/live-source-full-response.test.mjs`: `TypeError: Cannot read properties of undefined (reading 'components')` at `IndexEvidenceGaps`. The isolated service stub supplied only `prescoreIndex: {value:null}`; the real required Index contract includes coverage. Fixture now supplies legal/operating missing facts; assertions additionally require both explanations. No production fallback, scoring change, skip, or Golden update.
- Node 24.22.1, npm 11.9.0: clean `npm ci` PASS (473 packages); `npm run typecheck` PASS (0 diagnostics).
- Targeted packet checks: 30 PASS / 0 FAIL / 0 skipped across full-source-response, quick-entry authorization, coverage guidance and preserved public financing.
- Full serial regression is running; its result must be recorded before promotion.
- Local Next build compiled and generated routes but returned exit 1 with `SecurityFatalError` for Next 16.4.0. This is NOT build PASS; dependency advisory requires verification. Docker executable is unavailable locally. Required Docker/recovery gates are unchanged.

## Status rules

PASS means the named layer was executed and checked on the integrated candidate, not merely found in source. BLOCKED means verification/input/environment is outstanding. PARTIAL identifies an evidenced missing integration. No live acceptance is inherited from old documents or an older active revision.

| Block | Engine | Canonical | API | CLIENT | BROKER | Report/AI | Tests | Live |
|---|---|---|---|---|---|---|---|---|
| 01 Source Integrity | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 02 Normalization | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 03 Classification | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 04 Banking Metrics | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 05 Financial Analysis | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 06 Reconciliation | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 6.5 Credit Portfolio Foundation | BLOCKED | BLOCKED | BLOCKED | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED |
| 07 Risk / Stops | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 08 Credit Lab | BLOCKED | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | BLOCKED | NOT_APPLICABLE |
| 09 Context | BLOCKED | PARTIAL | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 10 Prescore Index | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 11 Financing Readiness | BLOCKED | PARTIAL | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 12 Credit Assessment | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 13 Debt Capacity | BLOCKED | BLOCKED | BLOCKED | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED |
| 14 Product Selection | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 15 Recommendations | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 16 Action Plan | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 17 Explainability | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 18 Client Report | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 19 AI Analyst | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |

## Exact verification seams and exit criteria

All BLOCKED engine/canonical/test cells below require the current serial suite plus sufficient and insufficient synthetic integration scenarios; all API/UI/BROKER cells require real authorized route/component acceptance and role isolation. Every Live cell requires a successfully identified candidate, real HTTP health/ready, and authorized browser verification. An unchanged old deployment does not satisfy them.

| Blocks | Existing locations / outstanding criterion |
|---|---|
| 01–04 | `lib/prescore.ts`, `lib/credit-engine/source-foundation.ts`, `normalization/`, `classification/`, `metrics/`; `app/api/analysis/route.ts`; `lib/workspace/model.ts`; `banking-ledger.tsx`. Verify actual statement bytes → screening → full-population canonical metrics → saved analysis → API and screen; matching independent monthly totals, known zero vs missing, wrong INN and period rejection. |
| 05–06 | `financial-analysis/source-selection.ts`, `financial-analysis/engine.ts`, `reconciliation/engine.ts`; `app/api/source-documents/route.ts`; `client-financials.tsx`. Verify annual/interim units/dates, precedence, conflicts and replacement through real upload handlers; no quarterly annualization. |
| 6.5, 13 | `credit-portfolio/resolver.ts`, `credit-portfolio/bki-adapter.ts`, `debt-capacity/portfolio.ts`, `debt-capacity/engine.ts`; `client-analysis.tsx`, `credit-coverage-guidance.ts`. Current screen exposes excluded count but not per-obligation reason. Add display of canonical exclusion basis without including CREDIT_LIMIT by assumption; preserve dated 9,000 and unknown current principal. |
| 07, 09–12 | `production/orchestrator.ts` calls `risk`, `context`, `index`, `readiness`, `credit-assessment` engines. `lib/workspace/financing-request.ts` hard-codes `urgency: field(null)`; form has no urgency input. Complete that existing contract and prove all five CASE fields, no changed policy/weights. Verify legal lifecycle only from explicitly sourced applicable facts; no fabricated ACTIVE in QA A. |
| 08 | `scripts/credit-lab-business.mjs`, `credit-lab/business-corpus.mjs`, existing 24-case corpus/fingerprints. Run all 24 and unchanged fingerprint tests. Internal QA only. |
| 14–16 | Orchestrator `productSelection → recommendationSet → actionPlan`; `client-analysis.tsx` FinancingProducts/ActionPlan. Verify canonical factor → supported product/recommendation → ordered action links and honest unknown conditions, shared read-only dossier. |
| 17 | `explainability/engine.ts`, `client-insights.tsx` Why, `explanation-library.tsx`. Verify real claim/source IDs, search, navigation, provenance and no independent UI math. |
| 18 | `client-report/adapter.ts`, `production/public-model.ts`, `app/dashboard/report-v2`, `canonical-dossier.tsx`. Same WorkspaceModel report for CLIENT/BROKER/print; PDF packaging smoke and actual artifact content/long tables are required. |
| 19 | `app/api/ai-analyst/route.ts`, `lib/ai`, `app/dashboard/ai-analyst.tsx`. Verify provider-free authorized current snapshot, context reset on changed source, no cross-company facts or invented score. No paid calls. |

## Actual data flow

`analysis POST → source screening → normalization/classification → BankStatementMetricsV2 → saved AnalysisResult`

`saved analysis + current financial sources + dated BKI + cached sourced profile + declared financing case → buildCanonicalCreditAnalysis`

Inside the existing orchestrator: financial analysis and portfolio, then reconciliation, risk, context, index, readiness, assessment, capacity, products, recommendations, plan, explainability and client report.

`loadWorkspaceModelV1` separately checks access and entitlement, projects BASIC, and publishes canonical FULL/report. CLIENT and read-only CanonicalDossier share components. Print and AI must consume the authorized snapshot. Credit Lab independently verifies the engine.

## Next packet

Complete the fifth financing-case field through existing form → validated API → saved input → context/readiness, with backward-compatible UNKNOWN for older analyses. Build isolated synthetic fixture B from actual source inputs and prove numeric and insufficient cases. Continue with per-obligation schedule explanations; do not change capacity eligibility methodology.

