# Block 16 — 7 / 30 / 60 Action Plan Engine v1

## Purpose and boundary

The internal SHADOW engine turns emitted atomic Block 15 recommendations into an execution order, bounded focus windows and conditional reassessment checkpoints. It consumes the canonical Risk, Context, Index, Readiness, Credit Assessment, Capacity, Product Selection and RecommendationSet projections. It never runs those engines itself and does not require AnalysisResult.

A subscription can support repeated evidence collection and canonical reassessment. Retention comes from changed facts, not artificial urgency or a mandatory monthly rerun. A task marked done cannot clear a risk, increase capacity or make a company eligible for a bank product. This module accepts no user-completion input. VERIFIED exists only as a future contract state; generated plans never produce it.

Versions:

- `PRESCORE-ACTION-PLAN-1.0.0-SHADOW`
- `PRESCORE-ACTION-PLAN-POLICY-1.0.0-PRE-CALIBRATION`
- `PRESCORE_RECOMMENDATION_SEQUENCING_7_30_60_V1`

## Architecture and files

`contracts/action-plan.ts` defines inputs, output, items, horizons, policy, rerun triggers, deferrals, summary and future completion states. The separate `action-plan/` directory contains policy, common helpers, validation, dependencies, horizons, focus, deferrals, rerun, recheck, engine and integration. Nothing is added to the Recommendation Engine or the production upload/conclusion flow. Fixtures, Golden expectations and benchmarks live in `tests/fixtures/action-plan/`; `scripts/action-plan-lab.mjs` is the internal CLI.

The flow is validation → dependency graph → base horizon assignment → dependency shifts → chronological topological order → focus selection → deferrals → conditional triggers and recheck packs → immutable-source output. All upstream objects remain unchanged; output copies do not alias mutable source arrays.

## Status, confidence and comparability

| RecommendationSet status | Plan status | Meaning |
| --- | --- | --- |
| GENERATED | GENERATED | Complete upstream diagnosis may support a complete plan |
| PARTIAL | PARTIAL | Supported actions retained; no completeness promotion |
| INSUFFICIENT_DATA | INSUFFICIENT_DATA | Evidence, verification and missing case-field collection only |
| NOT_RATABLE_GLOBAL_STOP | NOT_RATABLE_GLOBAL_STOP | Only emitted legal, verification and data actions |

Insufficient plans retain excluded recommendations in the backlog and explicitly defer them; they do not schedule structural remediation. Collecting a missing financing-purpose/amount/term field is information collection, not a financing decision. Global stops do not produce a financing reapplication workflow.

Plan confidence equals RecommendationSet confidence; item confidence equals its source recommendation. No score is calculated. `comparable` requires both GENERATED and upstream `comparable = true`.

## Checkpoint windows and sequencing policy

There are exactly DAY_7, DAY_30 and DAY_60. Dates use the explicit asOfDate plus 7, 30 or 60 UTC calendar days. Month length, leap years and year boundaries are handled by calendar arithmetic. Every item and plan carries `PRESCORE_ANALYTICAL_CHECKPOINT_NOT_LEGAL_DEADLINE`. These are neither legal due dates nor promises of economic repair or bank approval.

DAY_7 focuses on verification, unblocking data, critical evidence and financing-case definition. DAY_30 covers supported implementation and documentation. DAY_60 covers structural evidence and continued observation. Historical delinquency has no fake removal deadline.

The deeply frozen policy contains ordered assignment rules, explicit definition overrides, offsets, caps, categorical ranking orders and trigger mappings. Its fingerprint covers all configuration. No component of Index or amount requested controls sequencing. Policy validation rejects unsupported enums, unknown definition overrides, invalid horizons, dates and excessive focus limits.

Ordered rules evaluate P0, data blockers, monitoring, missing case definition, prerequisites for P0/P1, explicit definition checkpoints, high-priority verification, low-effort high-priority work, structural work, product documents, direct remediation and the ordinary verification checkpoint. An explicit definition table handles the current-overdue chain, working-capital evidence and capital-support checkpoints. It contains no new action text.

Priority, effort and horizon remain separate. A prerequisite can be low priority while needing early attention. Unresolved dependencies move a dependent to the next available window after its latest prerequisite, capped at DAY_60; when both remain DAY_60, sequence and WAITING state still expose unresolved work. This conservative shift is not an assertion that the prerequisite will finish within the earlier window.

## Dependencies and focus

The engine consumes only `prerequisiteRecommendationIds` emitted by Block 15. It does not invent new remediation or split atomic actions. Kahn traversal rejects cycles, duplicate and dangling dependencies. Each edge is visited once in traversal; the ready queue is deterministically sorted for categorical ranking. A second topological traversal orders assigned windows chronologically.

Focus limits are DAY_7 ≤ 7, DAY_30 ≤ 10, DAY_60 ≤ 10. Prerequisites must also be visible in focus before their dependent can be selected. This can leave fewer focus items than the cap, which is preferable to showing execution without its prerequisite. The full assigned lists remain available per horizon, and `items` exposes each scheduled recommendation once. The full `recommendationBacklog` retains every original RecommendationV1, including focused items.

`deferredRecommendationIds` and structured deferrals account for every non-focus recommendation. Deferral does not erase relevance. Scope-excluded actions receive NO_CURRENT_ACTIONABILITY; non-focus dependency actions receive WAITING_FOR_PREREQUISITE; continuing monitoring receives MONITOR_AFTER_CORE_ACTIONS; ordinary overflow receives LOWER_PRIORITY. The next suggested review for a non-focus DAY_7 item is DAY_30, while its original DAY_7 assignment remains visible. The contract also reserves DUPLICATE_OBJECTIVE and OUTSIDE_60_DAY_FOCUS without adding downstream deduplication. Suppressed Block 15 recommendations remain audit IDs only; they are never resurrected.

## Item content, status and continuity

Every item copies the source title, action summary, steps, completion evidence, recheck text and analytical-effect/verification contract. The engine adds ordering, checkpoint reasons, sequence, dependency references, status, continuity and trigger metadata. It preserves Risk/Context/Assessment/Capacity/Product/Portfolio lineage and Block 15 groups.

| Item state | Interpretation |
| --- | --- |
| READY_TO_START | ACTIONABLE with no emitted unresolved prerequisite |
| WAITING_FOR_PREREQUISITE | Prerequisite still emitted and unresolved |
| VERIFY_FIRST | Source verification required, or a conditional action lacks completed verification |
| BLOCKED_BY_DATA | Source says execution is blocked by data |
| MONITORING | Monitoring/non-removable condition after prerequisite handling |

VERIFY_FIRST and BLOCKED_BY_DATA remain visible even when prerequisites also exist. `blockedByPlanItemIds` preserves those prerequisites. Generated completion is NOT_STARTED or VERIFICATION_PENDING, never EVIDENCE_READY or VERIFIED.

Continuity keys use company, definition code, subject and canonical portfolio obligation identity. For identified subjects, replacing a report does not change continuity. For unscoped actions, source IDs are used as the conservative identity fallback to avoid conflating distinct source-specific tasks. These fallback keys may change when the only available source identity changes; no unsupported longitudinal match is asserted. Where the same action/subject occurs with distinct sources, a source-disambiguation warning and source-specific continuity keys prevent merging those tasks. Sequence, checkpoint date and array index are excluded. Plan item IDs reference source recommendation identity and do not depend on focus order.

## Reassessment and subscription loop

Reruns are conditional on new material evidence. A day flag means there are verification criteria attached to that window; it does not mean a refresh is already available or that a scheduler should run. No fixed monthly engagement rule exists.

Controlled trigger types:

- NEW_BANK_STATEMENT_PERIOD
- UPDATED_BKI
- UPDATED_FINANCIAL_STATEMENTS
- UPDATED_PORTFOLIO
- UPDATED_LEGAL_SOURCE
- RECOMMENDATION_EVIDENCE_READY
- FINANCING_CASE_UPDATED
- CONTRACT_DOCUMENTS_ADDED
- CAPACITY_INPUTS_COMPLETED
- MANUAL_REVIEW_COMPLETED

Mappings are centralized by definition and category. Ambiguous generic data refreshes retain RECOMMENDATION_EVIDENCE_READY rather than guessing a provider. Each trigger references source recommendation IDs and required evidence codes. Triggers are aggregated by type and earliest window, retaining later-window groups for actions that cannot be checked earlier. Each recheck pack contains recommendation IDs, verification criteria, source codes, expected analytical effects and triggers for its horizon, including non-focus assigned items.

A DAY_7 rerun may verify corrected data or completed case fields. A DAY_30 rerun may use new documents or creditor evidence. A DAY_60 rerun may use accumulated bank history or updated interim statements. None of these events is assumed to have occurred. Only a later canonical run can establish analytical resolution.

## Domain examples

Current overdue: verify balance/identity, then supported settlement, then creditor posting, then BKI refresh. If an emitted verification prerequisite remains, settlement waits even when its amount is well supported. Standalone ACTIONABLE settlement with no unresolved prerequisite can remain DAY_7. Posting and refresh preserve dependencies; the engine never invents historical delinquency from a known zero maximum.

Working capital: emitted aging and balance reconciliation precede operational collection checkpoints. Actual dependency edges are preserved only when supplied upstream. Negative equity places reconciliation early and the support-of-owners structural checkpoint later, without promising capital restoration. Loss and revenue evidence retains annual/interim meaning from the recommendation; the plan does not recalculate financial metrics.

Cash-flow evidence stays separate from accrued revenue. Customer diversification is not asserted to have happened; monitoring uses later evidence. ZERO capacity prioritizes supplied schedule/service verification and waits for supported restructuring discussion. No new loan limit or positive-capacity promise is produced.

Product packs retain their existing guarantee/factoring/leasing/term-loan semantics. Case purpose, requested amount and term remain client intent; they do not become debt capacity, product selection or approval timing.

## Validation, determinism and privacy

Validation checks canonical upstream identities, versions, policy/registry fingerprints, lineage, chronology, enums, non-finite values, primary IDs, groups, summary counts, recommendation copy, verification criteria and dependencies. Invalid inputs fail rather than being repaired. No future received/observed/report-period evidence enters the plan. Already-known contractual maturity and scheduled dates are allowed.

The engine performs no network, database, OCR, LLM or machine-clock lookup. Same valid inputs and policy produce byte-identical output; recommendation list order does not affect sequencing. Ordered recommendation prose remains ordered prose. Audit fingerprints intentionally change if upstream canonical evidence changes even when the action sequence is unchanged.

All fixtures are synthetic. No real bureau documents, personal contacts, credentials or client payloads are added. `buildActionPlanShadow` catches failures and returns `ACTION_PLAN_SHADOW_UNAVAILABLE` without changing upstream results. FREE returns no plan; FULL may carry the optional SHADOW output. Existing production entitlement projection is unchanged.

## Golden governance and tests

The 71-case pack contains 70 original sequencing scenarios plus PLAN-RU-DEFECT-001. Expectations are authored from sequencing intent, not generated from engine output. Canonical domain cases run approved Risk→Context→Index→Readiness→Assessment→Capacity→Product→Recommendations. Explicit consumer-contract fixtures vary recommendation metadata to cover combinations not necessarily emitted by the current registry; they retain registry-authored copy and are labeled synthetic.

Fingerprints freeze reviewed outputs only after independent expectations and invariants pass; they do not substitute for expectations. Tests check distinct source-copy, dependency, focus, confidence, task-state and reassessment invariants for each case, plus invalid inputs, date boundaries, FREE/FULL, parity, determinism, policy and pairwise behavior. The permanent CL→CTX→IDX→RDY→CAS→CAP→PRD→REC→PLAN defect chain remains in separate unmodified prior packs.

Internal commands:

```sh
node --experimental-strip-types --test tests/action-plan-v1.test.mjs
node --experimental-strip-types scripts/action-plan-lab.mjs
node --experimental-strip-types tests/fixtures/action-plan/benchmark.mjs
node node_modules/typescript/bin/tsc --noEmit --strict --allowImportingTsExtensions --moduleResolution bundler --module esnext --target es2022 --skipLibCheck lib/credit-engine/action-plan/*.ts
```

## Limitations and future seams

No production integration, endpoint, DB migration, UI, PDF, notification service, email, Telegram, automatic scheduler, OCR or AI. No user-completion mutation, progress score, bank policy, score gains, approval probability, application date, new recommendation, financial formula or new limit. No historical plan-comparison engine or persistent portfolio/task database. A checkpoint can arrive before evidence is available; missing evidence never becomes proof of completion. Unscoped continuity has the source-ID limitation described above.

Future Block 17 can consume the complete plan and upstream references to explain findings, actions and reassessment points. A future application layer can persist snapshots and compare continuity keys after canonical reruns. Neither layer is implemented here.

## Git delivery

Approved parent: `0f0b1cc31674b420b835cbd88d61dd70d00d9aee`.
Candidate message: `Build 7 30 60 Action Plan v1`.
Only new Block 16 files are eligible for the candidate. Existing Blocks 1–15, their fingerprints and production behavior remain unchanged. Remote main is not moved. No merge, force, deployment or Block 17 work.

## Golden case inventory

| ID | Independently authored scenario |
| --- | --- |
| PLAN-RU-001 | P1 low effort: immediate focus |
| PLAN-RU-002 | P2 direct medium effort |
| PLAN-RU-003 | High effort indirect structural checkpoint |
| PLAN-RU-004 | Monitoring continues past day 60 |
| PLAN-RU-005 | Bounded focus 7/10/10 |
| PLAN-RU-006 | Overflow retained in backlog |
| PLAN-RU-007 | One source recommendation one horizon |
| PLAN-RU-008 | Explicit calendar dates |
| PLAN-RU-009 | Prerequisite not later than dependent |
| PLAN-RU-010 | Verification then remediation |
| PLAN-RU-011 | Already supported action has no invented dependency |
| PLAN-RU-012 | Dependency cycle rejected |
| PLAN-RU-013 | Dangling dependency rejected |
| PLAN-RU-014 | Data-blocked operational action not ready |
| PLAN-RU-015 | Unverified overdue: verify first |
| PLAN-RU-016 | Verified standalone settlement may be early |
| PLAN-RU-017 | Canonical overdue prerequisite flow |
| PLAN-RU-018 | Posting confirmation follows settlement |
| PLAN-RU-019 | BKI refresh waits for posting |
| PLAN-RU-020 | Historical delinquency has no repair deadline |
| PLAN-RU-021 | Historical known zero is not historical remediation |
| PLAN-RU-022 | Identity reconciliation is early |
| PLAN-RU-023 | Same-fact conflict precedes accounting work |
| PLAN-RU-024 | Missing source collected first |
| PLAN-RU-025 | Missing bank months: single complete-period request |
| PLAN-RU-026 | Partial bank period |
| PLAN-RU-027 | Overlapping statements require reconciliation |
| PLAN-RU-028 | Insufficient capacity prioritizes evidence |
| PLAN-RU-029 | Upstream bank dedupe stays one action |
| PLAN-RU-030 | Negative equity: evidence before structural checkpoint |
| PLAN-RU-031 | Negative reported net assets: professional review |
| PLAN-RU-032 | Liquidity aging before collections |
| PLAN-RU-033 | Working capital reconciliation then operations |
| PLAN-RU-034 | Current annual loss is analyzed, never erased by date |
| PLAN-RU-035 | Repeated losses require new evidence |
| PLAN-RU-036 | Annual revenue decline uses comparable evidence |
| PLAN-RU-037 | Interest coverage expense verification |
| PLAN-RU-038 | Operating receipts decline |
| PLAN-RU-039 | Customer concentration without supporting contract |
| PLAN-RU-040 | Customer concentration with contract: retain monitoring |
| PLAN-RU-041 | Unknown inflows: document before interpreting |
| PLAN-RU-042 | Cash and individual transfers traceability |
| PLAN-RU-043 | Liquidity stress is an evidence-backed gap |
| PLAN-RU-044 | Debt-service burden retained as debt evidence |
| PLAN-RU-045 | Zero capacity: verify schedules before restructuring |
| PLAN-RU-046 | Missing financing purpose |
| PLAN-RU-047 | Requested amount definition |
| PLAN-RU-048 | Requested term definition |
| PLAN-RU-049 | Guarantee document pack |
| PLAN-RU-050 | Factoring receivables evidence |
| PLAN-RU-051 | Leasing asset information |
| PLAN-RU-052 | Explicit term-loan scenario |
| PLAN-RU-053 | Product-specific limit is not invented |
| PLAN-RU-054 | BKI update trigger |
| PLAN-RU-055 | Complete bank period trigger |
| PLAN-RU-056 | Financial statements trigger |
| PLAN-RU-057 | Portfolio update trigger |
| PLAN-RU-058 | Legal source update trigger |
| PLAN-RU-059 | Financing case update trigger |
| PLAN-RU-060 | No day7 item: no forced rerun |
| PLAN-RU-061 | Day30 evidence: conditional rerun |
| PLAN-RU-062 | Structural evidence: later rerun |
| PLAN-RU-063 | Global stop preserves legal/data scope |
| PLAN-RU-064 | Insufficient recommendation diagnosis stays insufficient |
| PLAN-RU-065 | Partial remains partial |
| PLAN-RU-066 | No application instruction |
| PLAN-RU-067 | No score or progress score |
| PLAN-RU-068 | Completion is not analytical resolution |
| PLAN-RU-069 | Input set reorder remains deterministic |
| PLAN-RU-070 | Large real canonical Risk-to-Plan pipeline |
| PLAN-RU-DEFECT-001 | Current overdue > 0, historical maximum = KNOWN zero; no invented historical remediation |

## Final validation results

Policy fingerprint: `action-plan-policy:bf18e1660b260cea0472792e77c6810e`.

| Gate | Final result |
| --- | --- |
| Dedicated Block 16 suite | 674 passed / 0 failed |
| Full repository regression | 4,701 passed / 0 failed (4,027 baseline + 674 new) |
| Action Plan Golden | 71 PASS / 0 REVIEW / 0 FAIL |
| PLAN-RU-DEFECT-001 | PASS; no historical delinquency reasons/remediation from known zero |
| Block 8 Golden | 31 PASS |
| Block 9 Golden | 31 PASS |
| Block 10 Golden | 41 PASS |
| Block 11 Golden | 41 PASS |
| Block 12 Golden | 46 PASS |
| Block 13 Golden | 55 PASS |
| Block 14 Golden | 61 PASS |
| Block 15 Golden | 81 PASS |
| Build | PASS via npm test / verified artifact build |
| Lint | PASS, zero errors and warnings |
| Artifact validation | PASS |
| Strict Block 16 typecheck | PASS |
| git diff --check | PASS |
| Repository TypeScript baseline/current/new | 30 / 30 / 0 |
| Legacy parity | 872 / A / Высокая готовность / 1,283,000–2,636,000 RUB |
| Dependency, continuity, determinism, immutability, pairwise checks | PASS |
| FREE/FULL boundary | PASS |
| Prior-block defects | NONE |

Full regression test time: 83,505.61 ms (build excluded). Dedicated suite was rerun on the final implementation. All 373 materialized approved blobs match the exact parent. Thirteen unmaterialized binary blobs are retained unchanged from its Git tree. No prior Golden expectation or fingerprint was modified.

Development-only fingerprint mismatches were resolved after reviewing the changes in chronological ordering, insufficient-data scope, continuity disambiguation and deferred review windows. Independent Golden expectations remained authoritative; the large insufficient-data case gained explicit forbidden structural actions. The final gates above were rerun after implementation and fixture fingerprints were fixed.

## Performance measurement

Synthetic representative workload: 21 emitted recommendations and 21 plan items. No hard timing gate. Measurements include validation of the complete supplied upstream projections; no upstream engine is rerun by the plan itself. The 200-pipeline measurement explicitly runs the synthetic canonical source/fact fixture through the approved upstream engines before planning.

| Phase | Iterations | Total ms | Mean ms |
| --- | ---: | ---: | ---: |
| validation | 1000 | 75568.22 | 75.56822 |
| dependencyAnalysis | 1000 | 14.21 | 0.01421 |
| horizonAssignment | 1000 | 13.48 | 0.01348 |
| focusSelection | 1000 | 2.50 | 0.00250 |
| deferral | 1000 | 2.69 | 0.00269 |
| rerunTriggerAssembly | 1000 | 53.19 | 0.05319 |
| recheckPackAssembly | 1000 | 247.11 | 0.24711 |
| finalization | 1000 | 5724.98 | 5.72498 |
| actionPlanEngine | 1000 | 83341.23 | 83.34123 |
| canonicalPipeline | 200 | 43723.12 | 218.61560 |
| goldenExpectationChecks | 1000 | 1192.12 | 1.19212 |

Validation dominates the measured runtime; dependency, horizon and focus work are small for this workload. These measurements are environment-specific and do not establish a production latency guarantee. The code and fixtures were unchanged during final measurement.
