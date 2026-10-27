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
- Initial full regression was superseded by the reproduced defects below; no complete PASS is claimed. The packet 2 full run was locally stopped after another reproduced defect; no Amvera build was cancelled. A clean build and the unchanged full gate subsequently passed for packet 3; final evidence is below.
- Local Next build compiled and generated routes but returned exit 1 with `SecurityFatalError` for Next 16.4.0. This is NOT build PASS; dependency advisory was subsequently verified and addressed in packet 2. Docker executable is unavailable locally. Required Docker/recovery gates are unchanged.

## Status rules

PASS means the named layer was executed and checked on the integrated candidate, not merely found in source. Engine/canonical/tests PASS below refers to the completed 6,754-test regression, 24 business cases and isolated B/handler checks on code candidate 88966d3. It is bounded by those supported formats and synthetic cases, not proof of every possible real document or live workflow. API PASS means actual handler/permission tests, with synthetic auth identities and isolated PGlite. CLIENT/BROKER/Report cells remain BLOCKED for browser/visual acceptance even where static renders pass. AI PASS is the deterministic provider-free and mocked-provider contract only. BLOCKED means verification/input/environment is outstanding. PARTIAL identifies an evidenced missing integration. No live acceptance is inherited from old documents or an older active revision.

| Block | Engine | Canonical | API | CLIENT | BROKER | Report/AI | Tests | Live |
|---|---|---|---|---|---|---|---|---|
| 01 Source Integrity | PASS | PASS | PARTIAL | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 02 Normalization | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 03 Classification | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 04 Banking Metrics | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 05 Financial Analysis | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 06 Reconciliation | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 6.5 Credit Portfolio Foundation | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 07 Risk / Stops | PASS | PASS | PARTIAL | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 08 Credit Lab | PASS | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | PASS | NOT_APPLICABLE |
| 09 Context | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 10 Prescore Index | PASS | PASS | PARTIAL | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 11 Financing Readiness | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 12 Credit Assessment | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 13 Debt Capacity | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 14 Product Selection | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 15 Recommendations | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 16 Action Plan | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 17 Explainability | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 18 Client Report | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 19 AI Analyst | PASS | PASS | PASS | BLOCKED | BLOCKED | PASS | PASS | BLOCKED |

## Exact verification seams and exit criteria

Engine/canonical/test gates now pass for the stated synthetic and supported-source scope. API PARTIAL for 01/07/10 identifies the missing trusted provider-independent legal-document intake, not a failing current Checko/profile adapter. UI/BROKER/Report BLOCKED cells require an available real browser and visual/ordinary-role acceptance, beyond tested static renders and handler role isolation. Every Live cell requires a successfully identified candidate, real HTTP health/ready, and authorized browser verification. An unchanged old deployment does not satisfy them.

| Blocks | Existing locations / outstanding criterion |
|---|---|
| 01–04 | `lib/prescore.ts`, `lib/credit-engine/source-foundation.ts`, `normalization/`, `classification/`, `metrics/`; `app/api/analysis/route.ts`; `lib/workspace/model.ts`; `banking-ledger.tsx`. Verify actual statement bytes → screening → full-population canonical metrics → saved analysis → API and screen; matching independent monthly totals, known zero vs missing, wrong INN and period rejection. |
| 05–06 | `financial-analysis/source-selection.ts`, `financial-analysis/engine.ts`, `reconciliation/engine.ts`; `app/api/source-documents/route.ts`; `client-financials.tsx`. Verify annual/interim units/dates, precedence, conflicts and replacement through real upload handlers; no quarterly annualization. |
| 6.5, 13 | `credit-portfolio/resolver.ts`, `credit-portfolio/bki-adapter.ts`, `debt-capacity/portfolio.ts`, `debt-capacity/engine.ts`; `client-analysis.tsx`, `credit-coverage-guidance.ts`. Per-obligation canonical exclusion copy added and tested offline; live QA A 9,000/date/unknown-principal parity and responsive rendering remain outstanding. |
| 07, 09–12 | `production/orchestrator.ts` calls `risk`, `context`, `index`, `readiness`, `credit-assessment` engines. `lib/workspace/financing-request.ts` and form now carry urgency; five fields, backward compatibility and persistence tested. Saved-request cutoff defect is fixed in packet 3 below; no policy/weight change. Verify legal lifecycle only from explicitly sourced applicable facts; no fabricated ACTIVE in QA A. |
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

Targeted evidence: integration B plus original canonical provenance/fingerprint checks 25/25 PASS; financing persistence 5/5 PASS; existing source-authority/full-response/completion checks 25/25 PASS. Original business Credit Lab 24/24 PASS, fingerprints unchanged. Full serial gate for packet 2 was superseded by the dated-declaration fix below; these counts are separate commands, not an invented aggregate.

### Outstanding, evidenced limitations

- Before packet 3, a later saved financing request (2026-07-02) against B sources dated 2026-06-30 reproduced `CAPACITY / FUTURE_OR_INVALID_AVAILABILITY`. `canonicalAsOf` omits the saved declaration receipt date. Packet 3 includes this recorded knowledge date and preserves historical vs current principal semantics; source dates and availability validation remain unchanged.
- Local Docker executable is absent. Docker image checks remain mandatory and BLOCKED; no Dockerfile gate is disabled.
- `npx playwright install chromium` failed extracting the downloaded Chromium 151.0.7922.34 archive: “End of central directory record signature not found.” Browser QA and visual PDF acceptance remain BLOCKED, not passed by static renders.
- No trusted free legal-evidence upload/review workflow has been implemented here. Adapter-level offline provenance proves independence from a provider, not independent verification of arbitrary user declarations. Live sufficient-data acceptance requires an explicitly authorized trusted-source path.
- No staging candidate has been promoted, no live acceptance claimed, no QA A/production/DB/configuration changed.

## Packet 3 — saved declaration cutoff and real isolated routes

Parent packet 2: `860e977836faab3c9f05330cd17ca67b3c1fb726`, tree `92c0f93709fdce86bdbe439532ca6ba4688282e0`, issue comment 6446232862.

`canonicalAsOf` now considers `financingRequestV1.receivedAt`, a saved observation date. It does not consult the wall clock, rewrite any source date, extend history, or refresh a debt balance. Regression demonstrates 02.07 declaration against 30.06 sources: all five CLIENT_DECLARED facts are DEFINED, full history remains 12 months, the 15.07 scheduled payment remains 100,000, and 1,500,000 principal stays dated evidence while current principal is UNKNOWN/null. Invalid receipt dates are rejected. Repeated builds of the same input are identical.

Targeted integration B + unchanged provenance/fingerprints + real financing persistence: **31 PASS / 0 FAIL / 0 skipped**. Fresh typecheck and Next standalone build PASS. The full unmodified recovery-build-gate subsequently passed after that build; final evidence is below.

An additional read of real API handlers in isolated PGlite used synthetic B only. CLIENT, assigned BROKER and ADMIN canonical and report objects were identical; BROKER/ADMIN readonly flags true; stranger received HTTP 404. This exercises handler/permission integration, not production login or live authorization.

| Local route | HTTP | Elapsed ms | Response bytes |
|---|---|---|---|
| workspace?projection=summary | 200 | 594 | 335 |
| modules | 200 | 19 | 10,540 |
| workspace-model, first | 200 READY_FULL | 1,017 | 940,016 |
| workspace-model, repeat 1 | 200 READY_FULL | 819 | 940,016 |
| workspace-model, repeat 2 | 200 READY_FULL | 795 | 940,016 |

No before/after performance improvement is claimed. Service still builds canonical results after each authorized FULL read; use-model binds fetching to analysis/revision/endpoint rather than section selection. A future result cache cannot be keyed only by analysis ID: it must include actual current source/profile/declaration content and policy versions, while authorization and entitlement must still run on every read. No cache was introduced without invalidation and browser evidence. Time to visible UI, section latency, network request count and real client-file parsing remain BLOCKED by browser/input availability.

Mandatory Docker and real browser/live acceptance remain open; do not turn them into PASS or promote by bypassing them.

## Final local gate evidence and delivery state

Test subject: recovery code commit **`88966d3ce75e6c53cea358d0a7973b4c772df852`**, exact tree **`55095af98e45776b18ed1961c2960b07fb7f2b4a`**. Local index matched that tree and worktree was clean before recording this result. This subsequent ledger-only commit does not change executable code; the tests are attributed to 88966d3, not silently relabeled to another SHA.

Environment: Node 24.22.1 / npm 11.9.0. Docker's Node 22 image was NOT executed locally.

| Mandatory command/stage | Observed result |
|---|---|
| npm ci | PASS, 473 packages, dependency lock unchanged during final build/gate |
| npm run typecheck | PASS, no TypeScript diagnostics |
| npm run build | PASS, Next 16.4.1 webpack and standalone routes |
| node scripts/release/package-runtime.mjs | PASS |
| node scripts/qa/recovery-build-gate.mjs --build-only | PASS, exit 0, all five mandatory stages |
| Full serial tests, concurrency 1 | 6,754 PASS / 0 FAIL / 0 skipped; 837,297 ms |
| Credit Lab business | 24 cases / 24 returned models / 24 PASS / 0 FAIL; original corpus/fingerprints unchanged |
| npm run lint | PASS, exit 0 |
| validate:artifact | VALID; standalone true; 12 runtime assets; schema 0009_analysis_archive.sql |
| PDF artifact smoke | PASS: DOMMatrix, native canvas, worker and text extraction |
| Docker build/runtime checks | BLOCKED: no Docker executable |
| Applicable scripts/qa browser suites | BLOCKED: no Chromium binary; standard install downloaded an invalid ZIP |
| Visual PDF pagination / long-table review | BLOCKED: extraction smoke is not visual report acceptance |
| New candidate Amvera / health / ready / QA A | BLOCKED: candidate not promoted, no new-version HTTP/browser proof |

Final build-verification manifest: version PRESCORE-RECOVERY-BUILD-GATE-1; scope BUILD_REGRESSION_ONLY; status PASSED; REGRESSION/CREDIT_LAB/LINT/ARTIFACT/PDF_RUNTIME each exit 0. It explicitly retains browserAccepted=false and liveAccepted=false. Lock SHA-256: `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`.

The first complete regression also passed 6,754/6,754 (877,588 ms), but its following Credit Lab command failed before calculations with EEXIST at scripts/credit-lab-business.mjs:7:84: the output directory already existed. That FAILED result was not called PASS. The previous local output and failed manifest were preserved separately, then the **entire unchanged gate** was rerun once with a fresh output directory. No check was skipped, no gate code altered, and no Amvera build restarted or cancelled.

Latest checked GitHub staging remains `783bfdf9977d6a1aaa899cddcb757ffc637df4b6`; product remains `e798d4654f2b0cf7eb96b291ff2c6135c84dcfa8`. Last observed active Amvera revision is `574c42b929b3116dac4bf3b99ec012d9d0aa60ba`; observed failed build a02e4c6 is described above. No newer activation is claimed. No Actions, staging push, production/DNS/configuration change or live database write was performed. QA A was preserved.

The current implementation already warns above “Добавить в досье” and after saving that attachments do not enter the credit calculation automatically. This was checked in source/static coverage; its appearance in a live browser remains unverified. The original owner's real statement file was not available, so synthetic 1C/PDF test success does not establish support for that specific file or arbitrary bank PDF/XLSX formats.

Remaining execution, in order: obtain the existing permitted Docker/browser execution environment; run unchanged Docker build and applicable CLIENT/BROKER/ADMIN/print browser suites on the exact candidate; implement and test the trusted legal intake described below without overwriting QA A; reassess all gates if code changes; then prepare one reviewed staging candidate, prove GitHub-to-Amvera source identity, obtain real health/ready and ordinary-role E2E evidence. Only after those gates is there a basis for a separate commercial/production decision. Real payments, production domain and external paid providers remain outside this delivery.

## Provider-independent legal lifecycle: verified source and remaining implementation

Official FNS service documentation, checked 2026-10-27: https://egrul.nalog.ru/about.html and https://www.nalog.gov.ru/rn77/related_activities/registries/egrul_egrip/ . FNS supplies a free electronic registry extract signed with a qualified electronic signature. This is a source option, not a claim that Prescore already verifies such PDFs.

Engineering conclusion: existing `risk/adapters/legal.ts` accepts sourced CompanyProfileData with an applicable READY company envelope, matching INN, observation date/freshness and explicit source confidence. It does not require Checko as a provider; B proves the OTHER source seam offline. A production intake must verify the original document/signature or independently authenticated source, preserve original hash/issuer/effective and receipt dates, and project only explicitly established fields. A PDF's visual signature stamp or client-entered ACTIVE is insufficient. Unknown address, enforcement and other facts must remain unknown; a lifecycle extract does not establish that all other legal risks are absent.

Concrete missing integration: a trusted intake/review path into the existing profile/source contract, including malformed/altered signature, foreign INN, stale/future observation, ambiguous/unsupported status and duplicate/replacement tests, then ordinary-role browser acceptance. Do not label an arbitrary attachment READY/HIGH or alter QA A. No new credit engine, commercial provider dependency or legal-status override was introduced.


## Trusted legal intake — 2026-10-27, new package 1

Historical 6,754/6,754 regression, 24/24 Credit Lab, build/lint/standalone/PDF runtime PASS remains evidence for **88966d3ce75e6c53cea358d0a7973b4c772df852**, not an inherited result for this change. Base remote HEAD: `69472ec39831198395582f2c49c2770467f07826`.

Implemented an owner-only multipart `/api/legal-source` and ordinary Documents form. No migration or provider credential is introduced. The uploaded PDF is parsed server-side; only an explicit, unambiguous labelled lifecycle, unique matching corporate INN and valid information date are eligible. The server independently retrieves the same bytes from the narrowly allowlisted FNS generated-download path `https://egrul.nalog.ru/vyp-download/<hex-token>` over normal TLS and compares SHA-256. Redirects, arbitrary hosts/paths, credentials and query strings are refused; 8 MB/100-page/12-second budgets apply. This is **independent official retrieval, NOT cryptographic signature verification**. No manual trust checkbox, ACTIVE default or test trust configuration exists.

Receipt stores INN, document hash, locator hash (not the download token), information/receipt/check dates, server verifier/version/method, origin, applicability reasons and replacement lineage. Unconfirmed/stale/future/ambiguous submissions remain non-applicable. Failed attempts cannot overwrite confirmed evidence. Verified conflicting statuses on the same date invalidate selection. Metadata/history persists in the existing analysis payload; original PDF is not retained. Existing legal adapter supplies only LEGAL_LIFECYCLE; other legal risks are not declared absent. Workspace/report consumers use the existing canonical path. Existing QA A is untouched.

New evidence layer: `node --experimental-strip-types --test tests/legal-registry-intake.test.mjs tests/integration-b-chain.test.mjs` → **22 PASS / 0 FAIL / 0 skipped**; `npm run typecheck` → exit 0, no diagnostics. Actual multipart route + native PDF extraction + isolated PGlite + CLIENT/BROKER/ADMIN read parity were executed. All outbound official-source responses are controlled test doubles in this isolated suite; neither a real FNS download nor ordinary browser E2E is claimed. Foreign INN, corrupt PDF, wrong URL, unconfirmed origin, forged client flags, tampering, old/future dates, ambiguous status, duplicates, replacement/history, conflicting sources, forbidden writers and stranger reads are covered. Synthetic source data has no accepted production trust key/host/flag; only the test process replaces outbound fetch.

Matrix delta for blocks 01/07/10: the previously missing API intake is implemented and **PASS for the isolated handler/adapter scope**. Their end-to-end/live cells remain BLOCKED until the actual official-source path and browser form are exercised. The existing matrix above retains the historical baseline, not a blanket PASS for future changes.

Environment checked once: no Docker executable; local Playwright Chromium executable absent (previous installation had invalid ZIP; no repeated installation attempted). Work browser is available. Official egrul.nalog.ru retrieval returned HTTP 503 from the executor and connection timeout in Work browser. Therefore real FNS origin/format compatibility remains **BLOCKED**, not PASS. Parsing is deliberately narrow; unsupported extracts, multiple corporate INNs, missing explicit status or unsupported dates do not become confirmed facts. No paid query, live database change, production/DNS/configuration change or staging build has been made in this package. The existing Amvera Docker gate remains required and unchanged for the single eventual staging candidate.


### New candidate evidence and pre-transfer check

Package 1 code commit: `9822cebb8adb18980bcf214e2f8a8ccae56ac423`; tree `3e25f43fd50e0a8d5f0ad7d3d285fa6285f8b01a`. `npm run build` exited 0 (Next 16.4.1, 0 type diagnostics); `node scripts/release/package-runtime.mjs` exited 0. Full `node scripts/qa/recovery-build-gate.mjs --build-only` is in progress; no new full PASS yet. Prior `.next/recovery-credit-lab` output is preserved separately before the required fresh gate, not reused as evidence. Lock SHA-256 remains `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`; Node 24.22.1 / npm 11.9.0. No Docker/recovery gate changes.

Recomputed `integrationB()` through `buildCanonicalCreditAnalysis` on this code: index **1000/PARTIAL**, confidence **UNKNOWN**, four ADEQUATE core components, no missing required core codes. Data review: `RISK-DATA-DEBT-PAYMENT-UNMATCHED` / `DEBT_PAYMENT_UNMATCHED`; `RISK-DATA-NEW-OBLIGATION-DETECTED` / `NEW_OBLIGATION_REQUIRES_REVIEW`. Readiness **MEDIUM/PARTIAL**, caps `DATA_REVIEW_REQUIRED`, `INDEX_PARTIAL`, `UNKNOWN_INDEX_CONFIDENCE`; additional context review `CTX-UNMATCHED-PAYMENTS_SUPPORTED`. Capacity **PARTIAL**, 12 full months, observed and scheduled service each 100,000 RUB, headroom 100,000/150,000 RUB. Its limitations include `ACCOUNT_COVERAGE_NOT_PROVEN`, `ASSESSMENT_NOT_COMPLETE`, `CAPACITY_NOT_COMPLETE`, both debt-review reasons and `UNSPLIT_PAYMENT_NOT_PRINCIPAL_REDUCTION`, in addition to shadow/pre-calibration/not-bank-decision notices. This remains adapter/synthetic evidence with the original B profile, not a live trusted-source upload or fully confirmed index.

Pre-transfer GitHub HEADs: recovery `9822cebb8adb18980bcf214e2f8a8ccae56ac423`; staging `783bfdf9977d6a1aaa899cddcb757ffc637df4b6`. Recursive Git tree comparison: 36 changed/added paths, zero deletions. Merge ancestry diverges (13 ahead / 24 behind); staging's nine independent changes were already integrated in the prior locally checked recovery package and remain present. The five existing public-financing changes are preserved and covered by unchanged public-entry tests. No main/production/configuration/migration file is newly changed by this package. Transfer must use both existing parents and the checked candidate tree, with a compare-and-swap staging update; no force push.

Amvera pre-transfer read: active built and stored image `574c42b929b3116dac4bf3b99ec012d9d0aa60ba`; latest failed image remains `a02e4c61aa05048b64883c0633e3cf5c1803f93d`. Version menu exposes rollback (disabled for the already-active version), so the intended return path is this retained version via Control Versions after a later activation. No rollback or retention-setting change was performed. Git fallback source is the unchanged staging SHA above. Actual rollback execution is not claimed as tested.


### Reproduced test-environment failure before delivery

The first new full regression run failed two unchanged `tests/billing-admin.test.mjs` assertions: line 3 column 1333, grossMinor `0 !== 650000`; line 4 column 802, newPaidCompanies `0 !== 1`. Both reproduced in the isolated file. At `2026-10-27T16:54:43Z`, PGlite reported `TimeZone=Etc/GMT-8`, `current_date=2026-10-28`, while the application query used UTC range `2026-09-28..2026-10-27`. On the identical synthetic ledger, changing ONLY the disposable test database session to UTC changed grossMinor from 0 to 650000. This proves a previously time-dependent fixture problem, not a legal-intake or payment-data failure.

Minimal correction: initialize the isolated `tests/fixtures/workspace-runtime.mjs` PGlite session with `SET TIME ZONE 'UTC'`. Original billing assertions, real payment code, tariffs, live database/configuration and recovery gates are untouched. The first full run is superseded/FAILED, not PASS; a fresh complete gate on the resulting final test environment is required. This correction does not certify billing date behavior for an arbitrarily configured non-UTC live PostgreSQL session.


The first full gate completed: **6,740 PASS / 3 FAIL / 0 skipped**, 837,409.987 ms, REGRESSION exit 1; later gates correctly did not run. In addition to both billing failures, a focused presentation harness failed before registering its cases: `Error: UNEXPECTED_IMPORT:../legal-registry.ts` at `tests/live-source-presentation-recovery.test.mjs:28`, called while loading `lib/workspace/model.ts`. The explicit test loader was extended to load the real legal receipt projection and new child presentation component. No assertions, Golden cases or production fallback were removed. First failed output and manifest are preserved; no staging build or runtime was cancelled/restarted.
