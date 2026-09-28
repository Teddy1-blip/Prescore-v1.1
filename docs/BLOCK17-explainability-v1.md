# Block 17 — Explainability Engine v1

## Purpose and boundary

A structured, deterministic explanation layer for the financial-credit workspace. It explains supplied canonical results; it does not rerun Risk, Context, Index, Readiness, Assessment, Capacity, Product Selection, Recommendations or Action Plan. Professional financial language is not bank impersonation. No assertion about a bank's decision or rejection cause is inferred.

Parent: `50f1985a6928acba5fc32411c93b756a28ee8026` (`Build 7 30 60 Action Plan v1`). All approved Blocks 1–16 files and Golden packs remain unchanged. One candidate commit, `Build Explainability v1`, is delivered without updating remote main.

## Versions and governance

- `PRESCORE-EXPLAINABILITY-1.0.0-SHADOW`
- `PRESCORE-EXPLAINABILITY-POLICY-1.0.0-PRE-CALIBRATION`
- `PRESCORE-EXPLANATION-TEMPLATE-REGISTRY-1.0.0-PRE-CALIBRATION`
- Methodology: `PRESCORE_STRUCTURED_CREDIT_EXPLAINABILITY_V1`

Mode is SHADOW. Policy, category copy and template registry are deeply frozen. Deterministic fingerprints cover their contents. Policy controls section order, executive limits, display precision, confidence language, section-state mapping, forbidden client phrases and claim ordering. Validation rejects unsupported policy states, excessive executive bounds, invalid precision, duplicate/missing templates, empty explanations and unsupported placeholders. Templates contain copy only, with no executable expressions.

## Contracts and architecture

`ExplainabilityInputV1` consumes the supplied ActionPlan, RecommendationSet, ProductSelection, DebtCapacity, CreditAssessment, FinancingReadiness, PrescoreIndex, RiskAssessment and ContextAssessment plus explicit `asOfDate`, and optional CreditPortfolio. No AnalysisResult is required.

The output contains executive summary, 13 detailed sections, atomic claims, driver explanations, source references, scalar value bindings, glossary, coverage report, upstream fingerprints, confidence, comparability and warnings. It is suitable for future presentation or conversational consumers without implementing either.

Files are isolated under `lib/credit-engine/explainability/`, with the public contract in `contracts/explainability.ts`. Domain modules explain Risk, Context, Index, Readiness, Capacity, Products, Recommendations and Action Plan. `sources.ts` assembles provenance and bindings; `validation.ts` validates inputs and generated output; `engine.ts` assembles the result. Internal tests and CLI do not integrate with production endpoints.

## Claims, source references and bindings

Each claim has a stable ID/code, section, kind, role, severity, status, evidence strength, confidence, source-reference IDs, calculation basis and applicable domain lineage IDs. Paths use stable entity selectors, not array positions. A value binding retains the exact scalar, unit, controlled Russian display and canonical path. Validation reads that path again and rejects a different raw or formatted value. Reported zero stays zero; missing values display as insufficient data.

Source references distinguish bank statements, financial statements, credit history, legal sources, credit portfolio, client declarations, reconciliation, derived analytics and other sources. Unidentified providers are not invented. Canonical source/evidence/metric/fact identifiers and available periods are retained. Raw transactions, bureau rows, provider payloads and raw references are not dumped.

Formatting does not use the host locale. RUB uses spaced groups and the rouble sign; percent uses a decimal comma and percent sign; ratios remain ratios; ISO dates retain raw values while displaying DD.MM.YYYY. Policy permits two display decimals for RUB/percent and three for ratios; raw values never change.

## Evidence language and confidence

HIGH: «Данные показывают»; MEDIUM: «По имеющимся данным»; LOW: «Есть предварительный сигнал; требуется подтверждение»; UNKNOWN: «Недостаточно данных для подтвержденного вывода».

Claim confidence cannot exceed its weakest material source. Overall confidence cannot exceed Assessment, Action Plan, Recommendations, Capacity or Product Selection. Severity is copied independently. CLIENT_DECLARED is explicitly labeled «по данным, заявленным клиентом» and is not independent evidence. Positive context must be supported; absence of a negative finding does not become generic praise.

Status is the most restrictive applicable upstream completeness state: GENERATED, PARTIAL, INSUFFICIENT_DATA or NOT_RATABLE_GLOBAL_STOP. Comparability requires GENERATED plus upstream Assessment and Action Plan comparability.

## Executive and detailed layers

The executive view retains at most five primary factors, three products, five current-focus items, three data limitations and three supported context highlights. Factors follow Assessment primaryDriverIds; products follow primaryCandidateProducts; actions follow the DAY_7 focus order. Detailed sections preserve other supported claims.

The sections are executive summary, credit profile, primary drivers, context, data quality, Index, Readiness, Capacity, Product Fit, Recommendations, Action Plan, recheck/rerun and limitations. Section status distinguishes COMPLETE, PARTIAL, NOT_APPLICABLE and INSUFFICIENT_DATA. Global stop leads with the legal fact and suppresses normal product-fit narrative. Insufficient and partial states stay explicit.

## Domain semantics

### Risk, Context and data quality

All 40 approved Risk codes have explicit titles, observations, why-it-matters text and confidence-language slots. Triggered findings are explained without reevaluation. Current BKI overdue amount is separate from historical maximum delinquency. Known historical zero never acquires a delinquency band. Historical delinquency does not become current overdue.

Negative/zero equity, reported net assets and equity proxy remain distinct; origin is bound to the canonical finding. Bank operating receipts are not accounting revenue. Legal lifecycle facts do not imply fraud or a future-bankruptcy prediction. Every DATA_REVIEW explanation explicitly states that the limitation concerns data quality or completeness, not an independent negative judgment about the company.

Context effects remain CORROBORATES, MITIGATES, EXPLAINS, NEUTRAL or REQUIRES_REVIEW. Explanation does not cancel a finding or apply an Index modifier twice. Assessment driver IDs and exact base penalty, modifier and final penalty are preserved; non-scored findings are not presented as scored contributions.

### Index and Readiness

Exact Index value, status and all four component results are bound to upstream data. Canonical debt-service burden remains in DEBT_CREDIT. No scoring arithmetic is repeated. No improvement/decline is claimed without a prior approved comparison. The glossary describes an analytical index, not a bank rating or probability model.

Readiness level/base level, confidence, caps, constraints and case-definition state are copied. Data/context review and coverage limitations are separate from credit weakness. Uncertainty affects actionability, not Index points.

### Capacity and product mechanics

Capacity binds central/conservative operating bases, full-month count, recurring and near-term anchors, upstream prudential/maximum monthly ceilings, and monthly incremental headroom. It does not calculate a new limit. Explicit annuity scenarios retain rate, term, monthly service capacity, principal equivalents and requested-amount coverage. Without a supplied scenario there is no principal-equivalent claim. ZERO means no additional headroom under the current methodology, not universal bank refusal.

Product family, fit, purpose alignment, capacity relevance/alignment, requirements, requested-product alignment and exposure lineage remain exact. Product ranking is not recalculated. Fit means mechanics fit, not approval probability. Guarantee and guarantorship are separate contingent types; leasing/factoring remain separate. Portfolio facts are explained only when supplied.

### Recommendations and Action Plan

Title, action summary, steps, completion evidence and what Prescore will recheck are copied exactly. Recommendation causes retain canonical lineage. No new advice is authored. Action items preserve their plan IDs, continuity keys, horizon, checkpoint and focus order. DAY_7/DAY_30/DAY_60 are analytical checkpoints, not legal deadlines. Task completion is not analytical resolution.

Rerun explanations come only from supplied ActionPlan triggers. No calendar-driven subscription reminder is invented. Future contractual dates are allowed; future knowledge is rejected by upstream input validation. No NEW/RESOLVED/REGRESSED/IMPROVED comparison state is introduced.

## Safety and integration

Validation rejects missing lineage, unknown claim codes, missing sources, confidence promotion, altered bindings, altered recommendation/plan copy, invalid plan identity and forbidden promise language. A failed build returns only `EXPLAINABILITY_SHADOW_UNAVAILABLE` through `buildExplainabilityShadow`; upstream objects remain untouched.

FREE keeps its existing projection. FULL may carry the optional shadow output. There is no public API, DB migration, upload/conclusion integration, dashboard, PDF, AI, OCR, provider call, deployment or production replacement. No clock, randomness, network or database is used by the core.

## Golden methodology and tests

The initial pack contains EXP-RU-001 through EXP-RU-090 plus EXP-RU-DEFECT-001. Expectations are independently authored; output fingerprints are separate regression locks, not generated expectations. All fixtures are synthetic. Source-pipeline fixtures use the approved engines. Explicit canonical-consumer fixtures cover supplied scalar/metadata contracts without claiming those synthetic overrides were produced by an upstream algorithm. In particular the healthy complete consumer fixture supplies HIGH risk-summary confidence; it does not change the approved empty-finding confidence behavior.

Each case checks semantic expectations, canonical scalar bindings, source references, referential integrity, exact recommendation/plan copy and focus order, confidence/comparability/bounds, immutability and byte determinism. Additional tests cover policy/template governance, source/claim mutation, future knowledge, unknown values, controlled formatting, forbidden language, pairwise isolation, shadow failure, legacy parity and FREE/FULL.

The permanent defect case carries the chain CL → CTX → IDX → RDY → CAS → CAP → PRD → REC → PLAN → EXP: current overdue positive and historical maximum KNOWN zero. Current risk remains MEDIUM; no historical delinquency finding or fabricated delinquency-band narrative appears.

Internal commands:

```
node --experimental-strip-types --test tests/explainability-v1.test.mjs
node --experimental-strip-types scripts/explainability-lab.mjs
node --experimental-strip-types tests/fixtures/explainability/benchmark.mjs
```

## Coverage and performance

Coverage audits all Risk rules, Index components, Readiness states, Capacity states, seven product families, fit levels, recommendation actionability/remediability, horizons, all rerun trigger types and limitation templates. Unmapped codes are a hard failure.

Benchmark runs 1,000 explanation builds, 200 source-to-explanation synthetic pipelines, and 1,000 template resolutions, binding validations, coverage audits and expectation checks. Stage measurements cover validation, sources, claim assembly, drivers, capacity, products, action plan, templates, formatting, sections and finalization. No arbitrary timing gate is imposed.

## Known limitations and future seams

Russian deterministic templates only; no free-form generation. No bank policy, approval probability, outcome calibration, historical comparison, risk resolution, recommendation generation, numerical recalculation or client decision. Unknown source provenance remains unknown. Raw payloads are excluded. Existing pre-Block-17 TypeScript diagnostics are reported separately and not repaired here.

Block 18 may consume this structured explanation for client presentation. Block 19 may answer questions from canonical claims and provenance. Neither block is implemented here.

## Validation and delivery

Final measured results and the complete case inventory are appended after validation. The candidate SHA is reported outside its own immutable commit. Remote main must remain on the approved parent.

## Registry identities

Policy: `explainability-policy:822ac4757a434655f847b9f1142b5ded`

Templates: `explanation-templates:63918afbf8d40784c21d3f9933365a3e`

119 templates; 40 Risk rules, four Index components, seven product families, ten rerun trigger types; no unmapped codes.

## Golden case inventory

| Case | Independently specified scenario |
|---|---|
| EXP-RU-001 | Complete canonical-consumer profile |
| EXP-RU-002 | Partial assessment |
| EXP-RU-003 | Insufficient core data |
| EXP-RU-004 | RISK-LEGAL-ENTITY-TERMINATED |
| EXP-RU-005 | RISK-LEGAL-LIQUIDATION-ACTIVE |
| EXP-RU-006 | RISK-LEGAL-BANKRUPTCY-ACTIVE |
| EXP-RU-007 | No material negative findings |
| EXP-RU-008 | RISK-DATA-SOURCE-MISSING |
| EXP-RU-009 | RISK-FIN-EQUITY-NON-POSITIVE |
| EXP-RU-010 | RISK-FIN-EQUITY-NON-POSITIVE |
| EXP-RU-011 | RISK-FIN-NET-ASSETS-NEGATIVE |
| EXP-RU-012 | RISK-FIN-NET-ASSETS-PROXY-NEGATIVE |
| EXP-RU-013 | RISK-FIN-CURRENT-LIQUIDITY |
| EXP-RU-014 | RISK-FIN-WORKING-CAPITAL |
| EXP-RU-015 | RISK-FIN-NET-LOSS-CURRENT |
| EXP-RU-016 | RISK-FIN-NET-LOSS-REPEATED |
| EXP-RU-017 | RISK-FIN-REVENUE-DECLINE |
| EXP-RU-018 | RISK-FIN-INTEREST-COVERAGE |
| EXP-RU-019 | RISK-CF-DEBT-SERVICE-BURDEN |
| EXP-RU-020 | RISK-CF-DEBT-SERVICE-BURDEN |
| EXP-RU-021 | RISK-CF-OPERATING-RECEIPTS-DECLINE |
| EXP-RU-022 | RISK-CF-CUSTOMER-CONCENTRATION |
| EXP-RU-023 | RISK-CF-CUSTOMER-CONCENTRATION |
| EXP-RU-024 | Marketplace context |
| EXP-RU-025 | RISK-CF-LIQUIDITY-STRESS |
| EXP-RU-026 | RISK-DATA-UNKNOWN-INFLOW-SHARE |
| EXP-RU-027 | RISK-DATA-CASH-INDIVIDUAL-TRACEABILITY |
| EXP-RU-028 | RISK-DATA-BALANCE-RECONSTRUCTION |
| EXP-RU-029 | RISK-BKI-CURRENT-OVERDUE |
| EXP-RU-030 | RISK-BKI-CURRENT-OVERDUE |
| EXP-RU-031 | RISK-BKI-HISTORICAL-DELINQUENCY |
| EXP-RU-032 | Overdue with historical zero |
| EXP-RU-033 | RISK-DATA-PORTFOLIO-OBLIGATION-UNRESOLVED |
| EXP-RU-034 | RISK-DATA-PORTFOLIO-OUTSTANDING-UNKNOWN |
| EXP-RU-035 | RISK-DATA-PORTFOLIO-CONFLICT |
| EXP-RU-036 | RISK-DATA-UNSPLIT-DEBT-SERVICE |
| EXP-RU-037 | Guarantee contingent exposure |
| EXP-RU-038 | Guarantorship not funded principal |
| EXP-RU-039 | RISK-DATA-SOURCE-MISSING |
| EXP-RU-040 | RISK-DATA-SOURCE-STALE |
| EXP-RU-041 | RISK-DATA-SOURCE-FAILED |
| EXP-RU-042 | RISK-DATA-BANK-COVERAGE |
| EXP-RU-043 | Partial bank coverage |
| EXP-RU-044 | RISK-DATA-BANK-COVERAGE |
| EXP-RU-045 | RISK-DATA-COMPANY-IDENTITY-CONFLICT |
| EXP-RU-046 | RISK-DATA-FINANCIAL-SAME-FACT-CONFLICT |
| EXP-RU-047 | RISK-DATA-SOURCE-INTEGRITY |
| EXP-RU-048 | Four index components |
| EXP-RU-049 | RISK-CF-DEBT-SERVICE-BURDEN |
| EXP-RU-050 | Context modifier copied once |
| EXP-RU-051 | No invented modifier |
| EXP-RU-052 | HIGH readiness |
| EXP-RU-053 | MEDIUM readiness |
| EXP-RU-054 | LOW readiness |
| EXP-RU-055 | Partial readiness |
| EXP-RU-056 | Uncertainty cap does not reduce points |
| EXP-RU-057 | Positive headroom |
| EXP-RU-058 | Zero headroom |
| EXP-RU-059 | Partial capacity |
| EXP-RU-060 | Insufficient capacity |
| EXP-RU-061 | Recurring versus near-term anchor |
| EXP-RU-062 | Recent decline conservative operating basis |
| EXP-RU-063 | Explicit annuity |
| EXP-RU-064 | No scenario no principal equivalent |
| EXP-RU-065 | Requested amount above capacity not refusal |
| EXP-RU-066 | Working capital |
| EXP-RU-067 | Liquidity gap |
| EXP-RU-068 | Contract guarantee |
| EXP-RU-069 | Factoring |
| EXP-RU-070 | Equipment |
| EXP-RU-071 | Aligned requested product |
| EXP-RU-072 | Misaligned requested product |
| EXP-RU-073 | Zero headroom constrains fit |
| EXP-RU-074 | Fit is not approval |
| EXP-RU-075 | Recommendation cause |
| EXP-RU-076 | Recommendation copy |
| EXP-RU-077 | DAY_7 checkpoint |
| EXP-RU-078 | DAY_30 checkpoint |
| EXP-RU-079 | DAY_60 checkpoint |
| EXP-RU-080 | Checkpoint not deadline |
| EXP-RU-081 | UPDATED_BKI |
| EXP-RU-082 | NEW_BANK_STATEMENT_PERIOD |
| EXP-RU-083 | UPDATED_FINANCIAL_STATEMENTS |
| EXP-RU-084 | No forced day7 rerun |
| EXP-RU-085 | Completion not resolution |
| EXP-RU-086 | RISK-BKI-CURRENT-OVERDUE |
| EXP-RU-087 | Client declaration label |
| EXP-RU-088 | No invented rejection reason |
| EXP-RU-089 | No approval or growth promise |
| EXP-RU-090 | Unordered set invariance |
| EXP-RU-DEFECT-001 | Permanent overdue/KNOWN-zero-history chain |

## Final verification results

- Dedicated Block 17: **785 passed / 0 failed**.
- Full repository: **5,486 passed / 0 failed** (4,701 approved baseline + 785 new tests).
- Explainability Golden: **91 PASS / 0 REVIEW / 0 FAIL**.
- Blocks 8–16 Golden: **31 / 31 / 41 / 41 / 46 / 55 / 61 / 81 / 71 PASS**, all with zero failed cases.
- Build, lint, artifact validation and strict new-module TypeScript check: PASS.
- Repository TypeScript diagnostics: **30 baseline / 30 current / 0 new**.
- Legacy production parity: **872 / A / Высокая готовность / 1 283 000–2 636 000 ₽**.
- Input immutability, byte determinism, component isolation, exact numerical/copy preservation, FREE/FULL and defect-chain checks: PASS.
- Prior-block defects: **NONE**. No upstream code was changed to satisfy a new expectation.
- Scope audit: 393 materialized baseline blobs byte-identical; 13 unavailable binary blobs retained unchanged through the approved Git base tree.
- No deployment; no main update; no Block 18/19 work.

The two final local review corrections concern only Block 17: preserving portfolio observation dates in source references, and including policy ordering in its fingerprint. Explicit regressions cover both.

## Measured performance

Node 24 in the task workspace; elapsed totals, no hard performance gate. Full upstream contract validation is included in build timings.

Workload: {'claims': 78, 'sourceReferences': 86, 'valueBindings': 114}.

| Stage | Iterations | Total ms |
|---|---:|---:|
| validation | 1000 | 77195.79 |
| sourceReferences | 1000 | 381.4 |
| claimAssembly | 1000 | 489.43 |
| driverExplanation | 1000 | 70.61 |
| capacityExplanation | 1000 | 47.18 |
| productExplanation | 1000 | 89.62 |
| actionPlanExplanation | 1000 | 193.78 |
| templateResolution | 1000 | 0.69 |
| formatting | 1000 | 0.94 |
| sectionAssembly | 1000 | 8.62 |
| finalization | 1000 | 24.65 |
| claimBindingValidation | 1000 | 4299.39 |
| coverageAudit | 1000 | 30.04 |
| expectations | 1000 | 29.4 |
| explainabilityBuilds | 1000 | 133475.82 |
| completePipelines | 200 | 68099.03 |

`git diff --check`: PASS. No new TypeScript diagnostics. All reported validations refer to the final implementation.
