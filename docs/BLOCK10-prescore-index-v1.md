# Block 10 — Prescore Index Engine v1

## Purpose and boundaries

PrescoreIndexV1 is the first separate canonical 0–1000 analytical Index consuming only RiskAssessmentV1 and ContextAssessmentV1. It is not the legacy score, finding count, PD, ML prediction, bank approval probability, readiness, Bank Policy, debt capacity or product fit. Legacy score 872 is a parity anchor only; the new Index is not forced to match it.

- Version: PRESCORE-INDEX-1.0.0-SHADOW
- Policy: PRESCORE-INDEX-POLICY-1.0.0-PRE-CALIBRATION
- Methodology: PRESCORE_INDEX_RISK_CONTEXT_V1
- Mode: SHADOW

The policy constants are explicitly supplied pre-calibration methodology, not empirically optimized weights. Synthetic Golden results verify implementation consistency, not predictive accuracy. No production score/readiness/UI path is changed.

## Scale and components

Higher Index means stronger observed analytical credit position. 1000 means no modeled adverse CREDIT_RISK finding is reducing the Index under adequate core evidence; it is not guaranteed approval or zero risk. Zero is not 100% bankruptcy probability.

| Component | Maximum | Canonical finding domain |
|---|---:|---|
| FINANCIAL_STRENGTH | 400 | FINANCIAL |
| OPERATING_BEHAVIOR | 300 | CASH_FLOW |
| DEBT_CREDIT | 200 | DEBT_SERVICE, CREDIT_HISTORY, CREDIT_PORTFOLIO |
| LEGAL_CORPORATE | 100 | LEGAL |

Routing first checks the exact `IndexPolicyV1.findingCodeComponentOverrides` registry, then falls back to the generic domain mapping. The registered canonical exception is `RISK-CF-DEBT-SERVICE-BURDEN → DEBT_CREDIT`; its approved upstream CASH_FLOW domain remains unchanged. Ordinary CASH_FLOW findings stay OPERATING_BEHAVIOR. Explicit DEBT_SERVICE, CREDIT_HISTORY and CREDIT_PORTFOLIO domains stay DEBT_CREDIT. No substring inference is used. Policy validation rejects malformed registries, unknown canonical codes and invalid components. The deeply frozen registry is part of the versioned policy and policy fingerprint. RECONCILIATION and DATA_QUALITY have no generic scoring route.

Only CREDIT_RISK scope can contribute penalties. INFORMATION and DATA_REVIEW never remove points or apply severity ceilings. The engine does not inspect metrics to create new adverse findings. Distinct obligations can accumulate; duplicate finding IDs or rule/subject identities are rejected. Stable ordering is component → risk code → subject → findingId → contributionId.

## Severity policy, contributions and caps

| Severity | Base penalty ratio | Overall Index ceiling |
|---|---:|---:|
| CRITICAL | 0.60 | 549 |
| HIGH | 0.35 | 699 |
| MEDIUM | 0.18 | 849 |
| LOW | 0.08 | 949 |
| INFO | 0.00 | 1000 |
| NONE | — | 1000 |

Base penalty = component maximum × severity ratio. Each scored finding produces IndexContributionV1 with its identity/code, component, severity/scope, base penalty, context modifier percent, adjustment/final penalty, qualifying relation IDs, evidence confidence, reason codes, basis and warnings. There is no invisible scoring or direct positive bonus.

Contributions remain individually auditable even when their component saturates. Component basePenalty and finalPenalty are capped separately at its maximum. Component contextAdjustment is the difference between those capped amounts; individual unabsorbed adjustments remain visible in contributions. COMPONENT_PENALTY_CAPPED warns of saturation. Component scorePoints = maximum − capped finalPenalty.

The severity ceiling is applied after summing component points, from the highest mapped scored CREDIT_RISK severity. It is a ceiling, not another penalty. rawValueBeforeRiskCeiling, riskCeiling, riskCeilingApplied and final value are all retained.

A ceiling can mask the final-number effect of context. For example, an isolated HIGH financial penalty leaves raw 860 and final 699; a valid 10% mitigation leaves raw 874 but still final 699. The penalty and raw-value improvement remain explicit. Strict paired Golden comparisons use an otherwise identical compound profile below the ceiling, where the final difference is observable. No policy constants were tuned to satisfy Golden expectations.

## Context adjustment

Each qualifying CORROBORATES relation adds 10% of the target penalty; each qualifying MITIGATES subtracts 10%. The aggregate per-finding modifier is clamped to −15%…+15%. EXPLAINS, NEUTRAL and REQUIRES_REVIEW never change penalty points. No relation can create independent positive points.

Qualification requires the exact existing CREDIT_RISK target, compatible company/cutoff/version, temporally eligible referenced facts and evidence, relation confidence at least MEDIUM, known underlying facts with at least MEDIUM confidence and actual evidence. Any CLIENT_DECLARED dependency or evidence excludes the numeric modifier, even if a malformed relation label claims HIGH MITIGATES. LOW/UNKNOWN confidence, partial/unknown facts and missing evidence do not qualify. Unsupported source classes or dangling lineage are rejected. Qualifying relation and material evidence confidence cannot be promoted.

Client explanations, healthy age, region, OKVED, contract explanations, zero overdue and high cash do not yield bonuses. Approved Risk and Context inputs remain deeply unchanged.

## Rounding order

The frozen policy declares two decimals for points and zero decimals for final Index. Base contribution penalty is rounded to cents; aggregate context multiplier is bounded; adjusted contribution penalty is rounded to cents; adjustment is adjusted minus base. Contributions sum to component totals, rounded to cents before/after cap. Raw component sum is retained to cents. The ceiling is applied, then final integer rounding occurs once. No repeated intermediate integer rounding or binary drift accumulation is used.

## Coverage and status

Coverage is provider-independent. No OKB, SPARK, Kontur or other commercial provider is mandatory. It consumes existing canonical statuses, confidence, evidence and periods rather than recreating source integrity.

RiskFacts are the primary coverage view; ContextFacts may fill a missing code only when they are not CLIENT_DECLARED. A present unknown RiskFact cannot be overridden by a supposedly better Context duplicate. A code counts as known only when unique, KNOWN/non-null, confidence/evidence at least MEDIUM, actual evidence exists and no material stale/not-ready/conflict warning is present. Operating coverage also requires an explicit period from/to.

| Component | Required canonical facts | Minimum for numeric Index | ADEQUATE |
|---|---|---:|---:|
| Financial | FIN_EQUITY, FIN_CURRENT_RATIO, FIN_ANNUAL_REVENUE, FIN_ANNUAL_NET_PROFIT | 2 | 4 |
| Operating | BANK_OPERATING_TREND, BANK_TOP1, BANK_COVERAGE_ADEQUATE | 1 | 3 and coverage value=true |
| Debt/credit | BANK_DEBT_SERVICE_RATIO | 1 | 1 |
| Legal | LEGAL_LIFECYCLE | 1 | 1 |

These minimum counts are explicit pre-calibration evidence policy, not credit penalties. BKI and portfolio are optional enrichment for the core product. Missing entire financial core yields INSUFFICIENT_DATA/null. Incomplete supplied bank coverage limits adequacy without inventing zero turnover or adding penalty points.

| Status | Meaning/value | Comparable |
|---|---|---|
| CALCULATED | Adequate core evidence and no material review/global-stop uncertainty | true |
| PARTIAL | All components reach minimum core; some limited coverage, Risk DATA_REVIEW, targeted Context review or uncertain global-stop applicability | false |
| INSUFFICIENT_DATA | Any component lacks minimum core; value=null | false |
| NOT_RATABLE_GLOBAL_STOP | Confirmed global stop; value=null | false |

Untargeted explanatory/review context about optional enrichment does not by itself invalidate adequate core coverage. Targeted Context review and Risk DATA_REVIEW can make the result PARTIAL without changing points. Non-ratable component diagnostics are labelled explicitly and are not a normal overall score.

## Global stop and data quality

TRIGGERED globalStopStatus produces NOT_RATABLE_GLOBAL_STOP/null, not zero. Global stop finding IDs, evidence and reason codes are retained. No normal contributions are scored for this state. Inconsistent global-stop summary vs actual stop findings is rejected. INSUFFICIENT_DATA global-stop applicability never yields CALCULATED.

Missing/stale sources, incomplete bank periods and reconciliation conflicts are not borrower-risk penalties. They affect status, coverage, confidence, comparability and warnings. A separately supported genuine CREDIT_RISK finding remains scoreable. Personal BKI exclusion cannot coexist with borrower BKI penalties in a valid input. Guarantorship and bank guarantees are not inferred to be funded debt. No raw bureau or transaction rescan exists.

CL-RU-DEFECT-001 / IDX-RU-DEFECT-001 preserve current overdue with historical days=0: MEDIUM current overdue contribution, CURRENT_OVERDUE, no fabricated historical delinquency contribution.

## Confidence

Confidence is separate from credit quality. The result uses the weakest relevant Risk summary, core/component and numerically used Context evidence confidence. PARTIAL is capped at MEDIUM, not promoted to it. Optional data absence never removes borrower points. A high numeric Index with limited evidence must be read together with its status, coverage and confidence; it is not equivalent to a well-supported complete observation.

## Validation, determinism and policy governance

Validation rejects incompatible company/cutoff/version/mode, malformed facts/findings, impossible null/status combinations, non-finite values, duplicate IDs or semantic identities, unsupported context provenance, orphan references and future evidence periods. Contractual future values such as maturity are permitted when their metadata establishes current knowledge. Future availability/evidence metadata is never backcast.

Policy is centralized, deeply frozen and fingerprinted. The result records its version and fingerprint. There is no runtime mutable methodology switch in the shadow integration. Low-level pure phase exports accept a policy for explicit internal experiments, with a separate policy validator. Production/shadow build always uses the approved initial policy. No clock, randomness, network or database is used.

## Integration and future Readiness seam

`buildPrescoreIndexShadow` accepts only RiskAssessment, ContextAssessment and explicit asOfDate. It returns optional prescoreIndexV1 plus warnings and isolates invalid input/errors. It requires no AnalysisResult for scoring. Internal/FULL callers can compose its output; FREE remains unchanged through the existing allowlist. No upload, conclusion API, public endpoint, DB, dashboard, PDF, AI, product or recommendation integration is changed.

Block 11 can later consume Index + Risk + Context to construct Financing Readiness. No apply/wait/ready decision is implemented here. No deployment is performed.

## Golden Lab and limitations

The separate Index pack contains 40 original scenarios plus IDX-RU-DEFECT-001. Independent expectations support status, exact/ranged score, component points/ranges, required/forbidden contributions, modifier range, ceiling, confidence, coverage, pairwise ordering and invariants. HARD/REVIEW mismatch handling and fingerprint checks are internal-only. Invalid-input cases PASS by demonstrating the expected rejection, not by receiving a score.

Approved Block 8 and Block 9 Golden fixtures/expectations/fingerprints remain frozen. Tests cover monotonic severity/adverse additions, component isolation, bounded context, immutability, input ordering, non-scoreable scopes, data review, global stops, source independence boundaries, FREE/FULL and authoritative legacy parity.

No real-outcome fitting, statistical validation, ROC/AUC/Gini/KS, PD estimation or predictive accuracy claim exists. Future real-outcome analysis can join versioned Index results to Block 8 outcome observations as labels only; no outcome enters this scoring input. Synthetic cases must never be used to optimize weights or call their PASS fraction model accuracy. No prior-block methodology is silently repaired.

## Index Golden cases

| ID | Scenario | Result |
|---|---|---|
| IDX-RU-001 | Healthy adequate core | PASS |
| IDX-RU-002 | Single LOW financial finding | PASS |
| IDX-RU-003 | Single MEDIUM financial finding | PASS |
| IDX-RU-004 | Single HIGH financial finding | PASS |
| IDX-RU-005 | Single CRITICAL financial finding | PASS |
| IDX-RU-006 | Medium cash-flow risk | PASS |
| IDX-RU-007 | Canonical CASH_FLOW debt-service burden routes to DEBT_CREDIT | PASS |
| IDX-RU-008 | Critical company current BKI overdue | PASS |
| IDX-RU-009 | Historical company BKI delinquency | PASS |
| IDX-RU-010 | Legal credit risk | PASS |
| IDX-RU-011 | Global stop TERMINATED | PASS |
| IDX-RU-012 | Global stop LIQUIDATION | PASS |
| IDX-RU-013 | Global stop BANKRUPTCY | PASS |
| IDX-RU-014 | BANKRUPTCY-MESSAGES data review only | PASS |
| IDX-RU-015 | SOURCE-MISSING data review only | PASS |
| IDX-RU-016 | RECONCILIATION-CONFLICT data review only | PASS |
| IDX-RU-017 | SOURCE-STALE data review only | PASS |
| IDX-RU-018 | Decline corroborated in profile below ceiling | PASS |
| IDX-RU-019 | Same compound profile without corroboration | PASS |
| IDX-RU-020 | Decline mitigated in same compound profile | PASS |
| IDX-RU-021 | Same compound profile without mitigation | PASS |
| IDX-RU-022 | Explanation is not numeric mitigation | PASS |
| IDX-RU-023 | Forged client-declared HIGH mitigation ignored | PASS |
| IDX-RU-024 | LOW confidence mitigation ignored | PASS |
| IDX-RU-025 | Financial component cap | PASS |
| IDX-RU-026 | Separate BKI obligations accumulate to cap | PASS |
| IDX-RU-027 | Cross-domain compound risks | PASS |
| IDX-RU-028 | Duplicate finding rejected | PASS |
| IDX-RU-029 | Dangling Context target rejected | PASS |
| IDX-RU-030 | Future Context evidence rejected | PASS |
| IDX-RU-031 | Personal owner BKI excluded | PASS |
| IDX-RU-032 | Guarantorship is not funded debt | PASS |
| IDX-RU-033 | Bank guarantee is not funded principal | PASS |
| IDX-RU-034 | Missing bank coverage reduces adequacy not points | PASS |
| IDX-RU-035 | Insufficient financial core | PASS |
| IDX-RU-036 | Unknown global stop applicability cannot be complete | PASS |
| IDX-RU-037 | Reordered compound input | PASS |
| IDX-RU-038 | Higher severity cannot improve Index | PASS |
| IDX-RU-039 | Multiple independent modifiers bounded | PASS |
| IDX-RU-040 | Real canonical multi-risk pipeline | PASS |
| IDX-RU-DEFECT-001 | Current overdue with reported historical zero | PASS |

## Validation and delivery

Dedicated suite: 303 passed / 0 failed. Full repository regression: 1,898 passed / 0 failed (approved baseline 1,595 plus 303). Index Golden: 41 PASS / 0 REVIEW / 0 FAIL; approved Block 8 and Block 9 Golden packs: 31 PASS each. Monotonicity, immutable Risk/Context inputs, the historical-zero overdue regression, and FREE/FULL parity pass. Build and artifact validation pass. Strict new-module typecheck passes. Repository TypeScript diagnostics: baseline 30, current 30, new 0. Lint passes without code warnings. Git whitespace checks pass.

Representative timings in milliseconds, not performance gates: 1,000 Index runs: validation 773.39, coverage 26.84, contributions 19.16, context adjustments 20.44, components 9.47, ceiling 1.30, summary 50.30; 200 complete source → Risk → Context → Index runs 926.04; 1,000 expectation evaluations 2.06; 1,000 run comparisons 0.21. Results vary by machine/load.

Authoritative legacy parity remains 872 / A / Высокая готовность / 1,283,000–2,636,000 RUB. No approved existing file was changed. Prior-block defects found: NONE.

Delivery is one candidate commit with message `Build Prescore Index v1`, directly on `afe09faebc626750b62b00166a2b8d50fe76eef0`. The candidate is not promoted to main. No deployment, force, merge, or Block 11 work.

## Component routing correction

IDX-RU-007 revision 2 is independently specified from canonical bank debt-service ratio 0.5 through approved Risk and Context engines. The Risk finding remains CASH_FLOW / HIGH. The DEBT_CREDIT penalty is 70 (200 × 0.35), operating penalty is 0, and HIGH ceiling/final value is 699. Only this Golden case fingerprint was revised; all other Golden expectations and fingerprints remain unchanged. Thirteen added regressions cover actual pipeline routing, component isolation, ordinary CASH_FLOW fallbacks, exact override precedence, invalid override configuration, fingerprint sensitivity, frozen registry and canonical threshold monotonicity. Existing explicit DEBT_SERVICE/CREDIT_HISTORY/CREDIT_PORTFOLIO tests remain green. This is a Block 10 correction, not a prior-block defect.
