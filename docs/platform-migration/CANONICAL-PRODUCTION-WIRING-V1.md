# Canonical Production Wiring V1 — staging integration

Base staging: `33055ed8a7d8779681bcc31ac4cef785d8f7a583`.
Protected main: `2ea25f26532396f3a90f2ccf6eb4f8dc534ca36c`.
This is orchestration, not a methodology change or a UI redesign.

## A. Observed original call path

Dashboard upload posts statements to `/api/analysis`. The route hashes and screens sources, calls `analyzeBankStatements`, then saves `analysisForStorage(result)` in `analyses.payload`. Actual parsing calls canonical normalization/classification, the compatibility adapter, legacy calculations, then `addSourceFoundation`. The latter calls Bank Metrics v2, reconciliation, portfolio and Risk shadow integrations. `/api/workspace` reads that payload, applies legacy admin controls and `analysisView` FREE/FULL projection. Dashboard renders legacy `AnalysisResult`.

`/api/source-documents` verifies uploaded BKI/quarterly input, stores canonical financial/portfolio/reconciliation/risk additions in the same payload. `/api/checko` stores provider-backed BFO/financial and legal profile in `checko_profiles.payload`. `/api/conclusion` combines legacy `buildUnifiedRiskContext` with separately returned canonical reconciliation/Risk. `/api/ai-analyst` calls the legacy unified context and `buildSanitizedCreditContext(AnalysisResult, CompanyProfileData, UnifiedRiskContext)`.

Before this change `report-v2/page.tsx` only imported `tests/fixtures/client-report/preview-models.json` behind `PRESCORE_INTERNAL_REPORT_PREVIEW`.

## B. Audit matrix before this change

“Yes” refers to actual runtime call paths, not merely engine files. All listed blocks are implemented. Canonical engines retain their approved SHADOW version/mode labels; this wiring does not silently recalibrate or rename them.

| Block | Real inputs | Stored | API exposed | Displayed in real UI | SHADOW/additive | Missing link before change |
|---|---|---|---|---|---|---|
| Source foundation | Yes, upload/Checko | Analysis/profile JSON | Yes, projection dependent | Source/integrity summaries | Additive | Combined report provenance |
| Normalization | Yes, uploaded statements | Masked/truncated transactions + summary | Projection dependent | Legacy-compatible transaction display | Compatibility path | Must not reparse truncated storage |
| Classification | Yes, normalized rows | Classified rows + summary | Projection dependent | Legacy-compatible aggregates | Additive | Canonical downstream composition |
| Bank metrics v2 | Yes, complete upload | Analysis JSON | FULL payload | Legacy metrics dominate | Yes | Context/Index/Capacity consumer |
| Financial analysis v2 | Yes, Checko/quarterly | Profile/analysis JSON | FULL payload | Legacy financial assessment dominates | Yes | Combine current source-backed snapshots |
| Credit portfolio | Yes, payments/BKI | Analysis JSON | FULL payload | Legacy portfolio comparison dominates | Yes | Rebuild at shared observation cutoff |
| Reconciliation | Yes, upload/source/conclusion | Upload/source results; conclusion ephemeral | FULL/conclusion | Legacy conclusion remains primary | Yes | Common downstream Risk input |
| Risk | Yes, upload/source/conclusion | Upload/source results; conclusion ephemeral | FULL/conclusion | Legacy risk context remains primary | Yes | Context and Index not called |
| Context | No production caller | No | No | No | Yes | Real orchestration |
| Prescore Index | No production caller | No | No | No | Yes | Real orchestration |
| Readiness | No production caller | No | No | No | Yes | Real orchestration |
| Credit assessment | No production caller | No | No | No | Yes | Real orchestration |
| Debt Capacity | No production caller | No | No | No | Yes | Real orchestration |
| Product selection | No production caller | No | No | No | Yes | Real orchestration |
| Recommendations | No production caller | No | No | No | Yes | Real orchestration |
| Action plan | No production caller | No | No | No | Yes | Real orchestration |
| Explainability | No production caller | No | No | No | Yes | Real orchestration |
| ClientReportModel | Synthetic preview only | No | No real route | Preview fixtures only | INTERNAL_PREVIEW | Owned FULL server route |

## C–G. New flow and missing evidence

`/dashboard/report-v2?analysisId=<owned-or-authorized-analysis>` → session → unchanged `readableAnalysis` authorization → existing entitlement resolver in read-only mode → stored analysis + cached same-INN profile → `buildCanonicalCreditAnalysis` → presentation-only `ClientReportModelV1` → existing shell/print view.

Server-only orchestrator consumes the already-computed full-population Bank Metrics v2. It never recalculates from stored display transactions. It composes source-backed financial snapshots → portfolio → reconciliation → Risk facts/evaluation → Context → Index → Readiness → Credit Assessment → Capacity → Products → Recommendations → Action Plan → Explainability → ClientReportModel. It uses actual engines, not their fail-open shadow wrappers or legacy comparison outputs.

The cutoff is the latest valid recorded source receipt/observation/period date. It is stable for unchanged inputs, does not use the current clock, and keeps original source dates. Invalid dates, reversed periods, mismatched company identity and engine-contract failures stop the report with a safe limitation. Different valid source dates are retained and evaluated by existing freshness/coverage rules.

Missing financial/legal/BKI evidence follows canonical UNKNOWN semantics. Bank-only can correctly yield Index null, Readiness UNKNOWN and Capacity null. This is a valid limited report, not a zero score or rejection. Rates/terms are not guessed; no 12/24/36 principal equivalents are emitted without supplied scenario assumptions.

Access checks precede parsing, profile loading and calculation. FREE gets a gate, not a full model hidden in client CSS. A supplied analysis ID never falls through into fixture loading. Synthetic preview remains an explicit `sample` route behind its original flag. Saved reports are identified as SAVED_ANALYSIS. Internal percentage constants in presentation binding labels are redacted at the server boundary without changing numeric results or claim IDs.

## H. Legacy retained

Original upload, saved payload, dashboard, conclusion, AI, admin controls and payment rules remain available. New report does not use legacy score/readiness/capacity. No auth or role change. A single navigation link opens the separate canonical report for the selected FULL analysis. Other UI is unchanged.

## I–J. Capacity contract and gaps

| Question/field | Existing canonical output |
|---|---|
| Observed monthly service | `debtCapacity.observedDebtServiceBasis` |
| Current recurring service anchor | `debtCapacity.recurringView.existingDebtServiceAnchor` |
| Cautious total monthly service | `debtCapacity.recurringView.prudentialTotalMonthlyDebtService` |
| Maximum-policy total monthly service | `debtCapacity.recurringView.maximumPolicyMonthlyDebtService` |
| Additional monthly service/headroom | `debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity` |
| Near-term scheduled service | `debtCapacity.portfolioScheduledDebtService30d` and `nearTerm30dView` |
| Principal equivalent at 12/24/36 months | `scenarioResults` only when explicitly supplied rate, term and evidence exist |
| Existing exposure | `creditPortfolio` obligations/current positions and summary, preserving exposure classes and knowledge |
| Confidence/limitations | `debtCapacity.confidence`, amount knowledge/references/warnings, Explainability |

The route has no approved persisted financing-case/scenario source yet, so those optional inputs are absent. Multiplying monthly headroom by a term is not a principal estimate. Existing presentation does not offer a dedicated 12/24/36 comparison panel; adding one is a later UI task.

A reproducible integration incompatibility was found: current upload can save `metricsV2.period` as first/last transaction dates while monthly coverage is FULL from statement headers. Capacity rejects this as FULL_MONTH_OUTSIDE_BANK_PERIOD. This change does not rewrite stored metrics, falsify period coverage or weaken the Capacity validator. Such analyses show the safe unavailable state. Fixing/rebuilding those inputs requires a separate source-complete repair, not a fallback to truncated display transactions.

## K. Future client-question mapping

| Client question | Canonical field |
|---|---|
| 1. Where am I now? | `model.hero`, `model.index` |
| 2. Readiness? | `model.readiness` |
| 3. Additional monthly payment? | `model.capacity.headline` / capacity headroom |
| 4. At 12/24/36 months? | Capacity scenario results; absent without explicit assumptions |
| 5. What consumes capacity? | Existing service anchors, portfolio positions, capacity detail claims |
| 6. Positive factors? | `model.contextHighlights`; absence is not fabricated strength |
| 7. Constraints? | `model.primaryFactors`, `model.readiness.constraints` |
| 8. Missing data? | `model.dataQuality`, `model.limitations`, canonical coverage |
| 9. Financing mechanisms? | `model.productFit` |
| 10. Next steps? | `model.recommendations`, plan focus |
| 11. Recheck 7/30/60? | `model.actionPlan.horizons`; checkpoints, not promised deadlines |
| 12. Why? | Presentation claim IDs → Explainability claims/value bindings/source references |

## L. AI status

Existing AI is legacy-backed and is not relabelled “Block 19”. `canonicalExplanationContext` is a future read-only seam for explaining the already-computed canonical presentation. This release neither sends it to a provider nor changes AI decision logic.

## Storage and restrictions

The user's latest instruction prohibits database changes without separate agreement. This release performs no new DB writes and no schema changes/migrations. `resolveAnalysisTier(..., readOnly: true)` preserves its decision order, including staging-owned free-FULL and legacy paid access, without creating/granting entitlements. Existing callers retain prior behavior.

The orchestrator produces a versioned server snapshot, input fingerprint, dated provenance and all canonical outputs, but does not persist it. Current saved evidence is reconstructed per request. Historical snapshot reproducibility across future code/profile changes therefore remains a documented gap. Proposed separately approved persistence: append immutable versioned canonical snapshots/input provenance in the existing analysis JSON using compare-and-swap; never overwrite historical snapshots or raw evidence. No migration is needed for that design, but DB-write authorization is still required.

## M–O. Validation and acceptance

Dedicated deterministic tests cover bank-only/BFO/legal/BKI/full inputs, actual parser→stored projection→report, missing evidence, inconsistent dates, known period defect, no legacy substitution, explicit scenarios, FREE/FULL, authorization-before-input, identity matching, read-only entitlement resolution and public model redaction. Existing SQL authorization tests continue to cover owner/assigned agent/unrelated client/admin.

Final command results and deployment SHAs are recorded in the release report. Real client acceptance requires an authenticated staging client session. Repository access permits code implementation and CI but does not authorize bypassing the application's session checks. No client credentials or raw payloads are included in this document.

Validated locally before staging push: `npm ci`, `npm run build`, `npm test`, `npm run lint`, `npm run validate:artifact` all passed. Tests: 5,685 passed, 0 failed, 0 skipped (24 new wiring tests). TypeScript baseline 30 / current 15 / new 0. Final navigation-only change was followed by another successful build/lint/artifact check; the complete test run rendered the current source. Dockerfile, amvera.yml, workflow, auth, SMTP, main, production, DNS and database schema/configuration were not changed.
