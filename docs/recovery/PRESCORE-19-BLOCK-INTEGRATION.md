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
- Initial full regression was superseded by the reproduced defects below; no complete PASS is claimed. A new unchanged recovery build gate is running on packet 2.
- Local Next build compiled and generated routes but returned exit 1 with `SecurityFatalError` for Next 16.4.0. This is NOT build PASS; dependency advisory was subsequently verified and addressed in packet 2. Docker executable is unavailable locally. Required Docker/recovery gates are unchanged.

## Status rules

PASS means the named layer was executed and checked on the integrated candidate, not merely found in source. Tests PASS here is narrowly the packet 2 integrated B/provenance checks described below, not completion of every block acceptance criterion. Engine/canonical remain PARTIAL until the complete suite and source-to-route gates finish. BLOCKED means verification/input/environment is outstanding. PARTIAL identifies an evidenced missing integration. No live acceptance is inherited from old documents or an older active revision.

| Block | Engine | Canonical | API | CLIENT | BROKER | Report/AI | Tests | Live |
|---|---|---|---|---|---|---|---|---|
| 01 Source Integrity | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 02 Normalization | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 03 Classification | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 04 Banking Metrics | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 05 Financial Analysis | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 06 Reconciliation | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 6.5 Credit Portfolio Foundation | BLOCKED | BLOCKED | BLOCKED | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED |
| 07 Risk / Stops | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 08 Credit Lab | PASS | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | PASS | NOT_APPLICABLE |
| 09 Context | PARTIAL | PARTIAL | PARTIAL | PARTIAL | BLOCKED | BLOCKED | PASS | BLOCKED |
| 10 Prescore Index | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 11 Financing Readiness | PARTIAL | PARTIAL | PARTIAL | PARTIAL | BLOCKED | BLOCKED | PASS | BLOCKED |
| 12 Credit Assessment | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 13 Debt Capacity | PARTIAL | PARTIAL | BLOCKED | PARTIAL | PARTIAL | BLOCKED | PASS | BLOCKED |
| 14 Product Selection | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 15 Recommendations | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 16 Action Plan | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 17 Explainability | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 18 Client Report | PARTIAL | PARTIAL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 19 AI Analyst | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |

## Exact verification seams and exit criteria

All BLOCKED engine/canonical/test cells below require the current serial suite plus sufficient and insufficient synthetic integration scenarios; all API/UI/BROKER cells require real authorized route/component acceptance and role isolation. Every Live cell requires a successfully identified candidate, real HTTP health/ready, and authorized browser verification. An unchanged old deployment does not satisfy them.

| Blocks | Existing locations / outstanding criterion |
|---|---|
| 01–04 | `lib/prescore.ts`, `lib/credit-engine/source-foundation.ts`, `normalization/`, `classification/`, `metrics/`; `app/api/analysis/route.ts`; `lib/workspace/model.ts`; `banking-ledger.tsx`. Verify actual statement bytes → screening → full-population canonical metrics → saved analysis → API and screen; matching independent monthly totals, known zero vs missing, wrong INN and period rejection. |
| 05–06 | `financial-analysis/source-selection.ts`, `financial-analysis/engine.ts`, `reconciliation/engine.ts`; `app/api/source-documents/route.ts`; `client-financials.tsx`. Verify annual/interim units/dates, precedence, conflicts and replacement through real upload handlers; no quarterly annualization. |
| 6.5, 13 | `credit-portfolio/resolver.ts`, `credit-portfolio/bki-adapter.ts`, `debt-capacity/portfolio.ts`, `debt-capacity/engine.ts`; `client-analysis.tsx`, `credit-coverage-guidance.ts`. Per-obligation canonical exclusion copy added and tested offline; live QA A 9,000/date/unknown-principal parity and responsive rendering remain outstanding. |
| 07, 09–12 | `production/orchestrator.ts` calls `risk`, `context`, `index`, `readiness`, `credit-assessment` engines. `lib/workspace/financing-request.ts` and form now carry urgency; five fields, backward compatibility and persistence tested. Saved-request cutoff defect remains open below; no policy/weight change. Verify legal lifecycle only from explicitly sourced applicable facts; no fabricated ACTIVE in QA A. |
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

## Packet 2 — completed fixes and isolated evidence

Parent: `5240822d240fa9635284b5e4346ff0f2b0301057` (packet 1; issue comment 6445678934). Remote packet SHA is recorded in #11 after creation.

- Completed the fifth financing field, urgency, through existing form, validated POST, persisted payload and canonical CLIENT_DECLARED fact. Old records remain UNKNOWN. Invalid enum is rejected. Isolated real API/PGlite persistence, readonly rendering and print parity: 5/5 PASS.
- Reproduced `ACTION_PLAN_INPUT_INVALID:CAPACITY_REFERENCE` at `action-plan/validation.ts:21`: a valid recommendation referenced a capacity scenario omitted from the allowlist. Added existing scenario references, retaining rejection of forged references. No formulas/policy changed.
- Reconciliation was receiving only the authority-selected financial snapshot, hiding competing current evidence. It now receives current snapshots; Financial Analysis still selects one source per economic period. Conflict variant yields explicit data-review findings, without duplicate financial history.
- DebtPortfolio displays canonical schedule membership for each obligation. CREDIT_LIMIT exclusion is explained without including its payment by assumption; dated payment remains displayed. QA A has not been edited or refreshed by this packet.
- Next 16.4.0 build failed after compilation with SecurityFatalError. Official advisory https://nextjs.org/blog/nextjs-security-update-october-14-2026 identifies 16.4.1 as fixed. Pinned Next and eslint-config-next to 16.4.1; clean npm ci PASS, typecheck/Next standalone build PASS (exit 0). No runtime environment change.

### Separate synthetic B

`tests/fixtures/integration-b/manifest.json` records SHA-256 of raw sources and independently derived expected values. Actual 1C statement bytes pass screen/analyze/storage; BFO/interim JSON is passed through the real normalizer, BKI through the real adapter, and the production orchestrator runs through report generation. Financial/BKI/legal JSON are adapter-input fixtures, not proof of binary upload parsing. Legal source is explicitly OTHER/SYNTHETIC_OFFLINE_REGISTRY_FIXTURE_NOT_EXTERNAL_VERIFICATION; no paid provider or real company is used.

| Check | Verified result |
|---|---|
| 12 full months | Receipts 12,000,000 RUB; outflows 10,320,000; opening 10,000,000 → closing 11,680,000 |
| Operating / debt service | 1,000,000 monthly operating basis; 100,000 observed and 100,000 scheduled service |
| Annual vs interim | 12,000,000 annual revenue and 6,000,000 for six months, distinct periods |
| Index | 1,000; four ADEQUATE components; status PARTIAL, not a claim of complete verification |
| Readiness | MEDIUM, with explicit review/uncertainty constraints; all five CASE fields DEFINED |
| Capacity | PARTIAL; additional monthly prudential 100,000 / maximumPolicy 150,000 RUB |
| Explicit zero-rate, 12-month scenario | Principal equivalents 1,200,000 / 1,800,000 RUB, not a bank limit |
| 1/5/6-month boundaries | No numeric capacity at 1/5; 6 permits the existing PARTIAL numeric result |
| Missing/failed legal source | Null Index, UNKNOWN readiness and null numeric capacity; never fabricated ACTIVE |
| Unknown principal | Null remains null; separately evidenced 100,000 payment retained |
| CREDIT_LIMIT | Excluded schedule remains null; known dated 100,000 payment and reason retained |
| Conflict / foreign identity | Financial conflict reaches risk review; foreign profile/invalid INN rejected |

Targeted evidence: integration B plus original canonical provenance/fingerprint checks 25/25 PASS; financing persistence 5/5 PASS; existing source-authority/full-response/completion checks 25/25 PASS. Original business Credit Lab 24/24 PASS, fingerprints unchanged. Full serial gate remains pending; these counts are separate commands, not an invented aggregate.

### Outstanding, evidenced limitations

- A later saved financing request (2026-07-02) against B sources dated 2026-06-30 reproduces `CAPACITY / FUTURE_OR_INVALID_AVAILABILITY`. `canonicalAsOf` omits the saved declaration receipt date. Next packet must include this recorded knowledge date and preserve historical vs current principal semantics; do not move source dates or weaken availability validation.
- Local Docker executable is absent. Docker image checks remain mandatory and BLOCKED; no Dockerfile gate is disabled.
- `npx playwright install chromium` failed extracting the downloaded Chromium 151.0.7922.34 archive: “End of central directory record signature not found.” Browser QA and visual PDF acceptance remain BLOCKED, not passed by static renders.
- No trusted free legal-evidence upload/review workflow has been implemented here. Adapter-level offline provenance proves independence from a provider, not independent verification of arbitrary user declarations. Live sufficient-data acceptance requires an explicitly authorized trusted-source path.
- No staging candidate has been promoted, no live acceptance claimed, no QA A/production/DB/configuration changed.

Next concrete packet: repair the demonstrated saved-request cutoff defect, rerun the same mandatory gates, then persist the exact result. Only a verified unified candidate may be considered for staging; never bypass outstanding mandatory gates.
