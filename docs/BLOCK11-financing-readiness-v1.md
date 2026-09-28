# Block 11 — Financing Readiness Engine v1

## Purpose and architecture

Readiness is an internal SHADOW classification of current analytical financing readiness. Its only inputs are approved `PrescoreIndexV1`, `RiskAssessmentV1`, `ContextAssessmentV1` and explicit `asOfDate`. Risk identifies risks, Context explains them, Index provides the numerical analytical basis, and Readiness classifies that supplied state. It is not another score, a lender decision, approval probability, PD, Credit Assessment, Debt Capacity, Product Selection or Recommendations.

The engine never calls the Index builder, recalculates its points, applies another Risk penalty or repeats a Context modifier. No AnalysisResult or legacy score/grade/readiness/limits are read. No public API, upload, conclusion, database, UI, PDF or AI flow is wired to this module.

Files: `contracts/readiness.ts` contains contracts; `readiness/policy.ts` owns policy; `common.ts` provides deterministic helpers; `validation.ts` validates canonical inputs; `constraints.ts` extracts constraints/explanations; `case.ts` extracts informational case definition; `engine.ts` resolves and summarizes readiness; `integration.ts` provides the pure shadow wrapper. Separate fixtures, Golden runner and dedicated tests are under tests/fixtures/readiness and tests/financing-readiness-v1.test.mjs.

## Versions and policy

- `PRESCORE-FINANCING-READINESS-1.0.0-SHADOW`
- `PRESCORE-READINESS-POLICY-1.0.0-PRE-CALIBRATION`
- `PRESCORE_ANALYTICAL_FINANCING_READINESS_V1`
- Mode SHADOW. No empirical calibration claim.

ReadinessPolicyV1 centrally contains thresholds, caps, material severities, global-stop behavior, status mapping, case-definition fields and partial-confidence ceiling. It is validated, deeply frozen and deterministically fingerprinted. Changing policy configuration changes the fingerprint; unsupported methodology changes are rejected.

## Status versus level

| Index status | Readiness status | Base level |
|---|---|---|
| CALCULATED | ASSESSED | Supplied Index band |
| PARTIAL, numeric | PARTIAL | Supplied Index band |
| INSUFFICIENT_DATA | INSUFFICIENT_DATA | UNKNOWN |
| NOT_RATABLE_GLOBAL_STOP | NOT_RATABLE_GLOBAL_STOP | NOT_READY |

Readiness levels are HIGH, MEDIUM, LOW, NOT_READY and UNKNOWN. Assessment status is distinct from borrower quality. A numeric zero is LOW; a missing Index is UNKNOWN; a global stop is NOT_READY, never a fabricated zero.

| Supplied Index | Base readiness |
|---|---|
| 850–1000 | HIGH |
| 700–849 | MEDIUM |
| 0–699 | LOW |

These thresholds align with approved Index ceilings: MEDIUM credit risk at 849 cannot reach HIGH, HIGH at 699 cannot reach MEDIUM, CRITICAL at 549 remains LOW. LOW credit risk can still permit HIGH. No additional numerical credit-risk penalty exists.

## Uncertainty, confidence and comparability

A PARTIAL Index caps HIGH to MEDIUM. LOW or UNKNOWN Index confidence also caps HIGH to MEDIUM. Neither cap improves MEDIUM/LOW. The supplied Index value remains unchanged. The result preserves baseLevel, final level, uncertaintyCapApplied and explicit reasons: INDEX_PARTIAL, LOW_INDEX_CONFIDENCE, UNKNOWN_INDEX_CONFIDENCE, DATA_REVIEW_REQUIRED, MATERIAL_CONTEXT_REVIEW and INDEX_COVERAGE_LIMITED where applicable. Reasons remain visible even if an already lower level is unchanged; the applied flag records an actual level reduction.

DATA_REVIEW, material Context review or non-adequate component coverage can make an otherwise ASSESSED readiness assessment PARTIAL. Low confidence alone caps a HIGH level without rewriting the Index status.

Confidence starts at Index confidence and takes the weakest applicable component-coverage and relevant constraint confidence; PARTIAL is capped at MEDIUM confidence. It is never promoted above Index. Comparable is true only for ASSESSED readiness and comparable Index. PARTIAL, INSUFFICIENT_DATA and GLOBAL_STOP are not comparable.

## Global stop, insufficient data and constraints

Consistent confirmed Risk/Index global stop produces NOT_RATABLE_GLOBAL_STOP / NOT_READY. IDs, codes, reasons and evidence are preserved. Inconsistent stop state fails safely instead of being repaired. Insufficient Index core yields INSUFFICIENT_DATA / UNKNOWN; absence of adverse findings or client declarations cannot fill the missing evidence.

| Constraint kind | Impact | Semantics |
|---|---|---|
| GLOBAL_STOP | BLOCKS_READINESS | Confirmed analytical stop, not a particular bank decision |
| CREDIT_RISK | REFLECTED_IN_INDEX | Existing constraint, no second penalty |
| DATA_REVIEW | LIMITS_ASSESSMENT | Data limitation, not borrower weakness |
| CONTEXT_REVIEW | LIMITS_ASSESSMENT | Review requirement, not a new risk |

Every constraint has a deterministic ID, source ID/code, Risk finding IDs, Context relation IDs, optional subject, severity, confidence, evidence, reasons, basis, warnings and relevance flag. Ordering is kind → severity → code → subject → deterministic ID. Duplicate source identities are rejected. CRITICAL/HIGH/MEDIUM credit constraints count as material; LOW is retained and separately counted. Counts are explanatory and carry no numerical weights.

All REQUIRES_REVIEW Context relations remain visible. Material CREDIT_RISK targets make the review relevant to additional readiness uncertainty. Untargeted optional Context review remains visible but does not independently prevent healthy complete readiness. This avoids treating an absent financing case or missing optional context as borrower weakness. An upstream PARTIAL Index remains authoritative regardless of why it is partial.

MITIGATES, CORROBORATES, EXPLAINS and NEUTRAL remain informational Context explanations. Qualifying numeric effects have already been handled by Index. CLIENT_DECLARED explanations cannot create another bonus.

## Financing case definition and downstream boundaries

Required informational facts: CASE_requestedAmount, CASE_requestedTermMonths, CASE_financingPurpose, CASE_requestedProduct and CASE_urgency. Contract reference, collateral information and client explanation are optional.

DEFINED means all five required facts are KNOWN and meaningful. PARTIAL means some information is supplied but required facts are missing. NOT_PROVIDED means none is usable. Null, empty text and UNKNOWN enum values do not establish a definition; explicit known numeric zero stays known. Duplicate case semantic codes fail safely. Values, knowledge, provenance and evidence are retained in copied canonical case facts.

Case completeness never changes credit readiness or confidence. A request for one billion rubles is not checked for affordability. A requested overdraft, factoring, guarantee or term loan is not a product recommendation. Age, OKVED, region and similar Context facts are not universal lender rules.

There is no loan limit, capacity range, approval probability, PD, lender decision, action plan, days-to-apply or recommendation output. HIGH means high analytical readiness, not an instruction to apply. Future Block 12 may consume Risk, Context, Index and Readiness for structured Credit Assessment. Block 12 is not implemented and no analyst prose is produced.

## Validation and immutability

Checks include company/cutoff equality; supported Risk, Context and Index versions, Index policy version/fingerprint; Index status/value and comparability; component/coverage shape; non-finite values; duplicate sources; absent contribution or Context targets; future evidence; and consistent global-stop state. The approved Risk/Context input validator is reused without calling an upstream calculation engine. Future contractual dates known at cutoff remain permissible values; future information-availability dates are rejected.

No hidden clock, random ID, network or database is used. Input RiskAssessment, ContextAssessment and PrescoreIndex remain deeply unchanged. Output evidence/case facts are copied. Stable sorting of constraints, evidence, references and explanations gives byte-identical output for the same inputs/cutoff/policy and for reordered semantically unordered inputs.

## Shadow, privacy and legacy behavior

`buildFinancingReadinessShadow` returns financingReadinessV1 when available and financingReadinessWarnings. A failure returns FINANCING_READINESS_SHADOW_UNAVAILABLE, optionally with a validated input diagnostic; arbitrary private exception details are not exposed. It does not alter authoritative outputs. Internal/FULL callers can explicitly compose the result later. FREE projection and normal legacy responses are unchanged.

The legacy parity anchor is 872 / A / Высокая готовность / 1,283,000–2,636,000 RUB. It is a regression anchor only, not a target for the new methodology.

## Golden methodology and limitations

The independently authored synthetic pack contains RDY-RU-001–040 plus RDY-RU-DEFECT-001. Boundary fixtures explicitly supply canonical Index scalar values to exercise consumer bands; they do not claim those exact boundary scalars were recalculated from incidental Risk fixtures. Other fixtures consume existing Index Goldens or canonical source → Risk → Context → Index outputs. No readiness output is copied into expected labels. Case fingerprints and expectations were preserved during environment recovery.

Assertions cover status, level, base level, confidence, comparability, caps/reasons, constraints/impacts, summary counts, case definition, invariants and pairwise relationships. HARD mismatches yield FAIL, review-only mismatches REVIEW, and no mismatches PASS. Golden execution checks upstream immutability. Existing Blocks 8–10 fingerprints/expectations remain unchanged.

Cases 034/035 inherit Index 1000 / PARTIAL / UNKNOWN from upstream data review for newly detected contingent obligations. Their independently specified result is MEDIUM under the mandatory uncertainty cap, with no CREDIT_RISK constraint. Guarantees and guarantorship do not become funded debt or numerical credit penalties.

The permanent historical-zero overdue regression chain is explicitly checked at Credit Lab, Context, Index and Readiness. Current overdue >0 with KNOWN historical maximum 0 never manufactures DELINQUENCY_1_29, DELINQUENCY_30_59 or DELINQUENCY_60_PLUS.

Limitations: pre-calibration classification; structurally validated supplied Index trusted without arithmetic recomputation; no lender policy, affordability, product-fit evaluation, outcome calibration, production integration, persistent observation store, notification service, credit memo or recommendations.

## Golden cases

| ID | Scenario | Result |
|---|---|---|
| RDY-RU-001 | Complete Index 1000 | PASS |
| RDY-RU-002 | LOW risk Index 949 | PASS |
| RDY-RU-003 | 850 HIGH boundary | PASS |
| RDY-RU-004 | 849 MEDIUM boundary | PASS |
| RDY-RU-005 | 700 MEDIUM boundary | PASS |
| RDY-RU-006 | 699 LOW boundary | PASS |
| RDY-RU-007 | CRITICAL Index 549 | PASS |
| RDY-RU-008 | Confirmed global stop | PASS |
| RDY-RU-009 | Insufficient core | PASS |
| RDY-RU-010 | Partial 1000 uncertainty cap | PASS |
| RDY-RU-011 | Partial 800 | PASS |
| RDY-RU-012 | Partial 600 | PASS |
| RDY-RU-013 | LOW confidence caps HIGH | PASS |
| RDY-RU-014 | UNKNOWN confidence caps HIGH | PASS |
| RDY-RU-015 | Data review only | PASS |
| RDY-RU-016 | Missing source | PASS |
| RDY-RU-017 | Stale source | PASS |
| RDY-RU-018 | Reconciliation conflict | PASS |
| RDY-RU-019 | Missing bank month | PASS |
| RDY-RU-020 | Material Context review | PASS |
| RDY-RU-021 | MITIGATES not applied twice | PASS |
| RDY-RU-022 | CORROBORATES not applied twice | PASS |
| RDY-RU-023 | EXPLAINS has no second effect | PASS |
| RDY-RU-024 | Client declaration not a bonus | PASS |
| RDY-RU-025 | Six month company age is neutral | PASS |
| RDY-RU-026 | OKVED is not lender policy | PASS |
| RDY-RU-027 | Region is not lender policy | PASS |
| RDY-RU-028 | No financing case | PASS |
| RDY-RU-029 | Partial financing case | PASS |
| RDY-RU-030 | Defined financing case | PASS |
| RDY-RU-031 | Huge requested amount is not capacity | PASS |
| RDY-RU-032 | Requested overdraft is not product fit | PASS |
| RDY-RU-033 | Owner personal BKI excluded | PASS |
| RDY-RU-034 | Guarantorship remains contingent | PASS |
| RDY-RU-035 | Bank guarantee remains contingent | PASS |
| RDY-RU-036 | Current overdue with zero historical days | PASS |
| RDY-RU-037 | Reordered multi-risk input | PASS |
| RDY-RU-038 | Immutable upstream inputs | PASS |
| RDY-RU-039 | Malformed company fails safely | PASS |
| RDY-RU-040 | Real canonical multi-risk pipeline | PASS |
| RDY-RU-DEFECT-001 | Permanent historical-zero overdue regression chain | PASS |

## Final recovery validation

All final gates were rerun after environment recovery; interrupted-session exit codes were not used as acceptance evidence.

| Gate | Result |
|---|---|
| Dedicated Block 11 | 284 passed / 0 failed |
| Full regression (baseline 1,898 + Block 11 284) | 2,182 passed / 0 failed |
| Readiness Golden | 41 PASS / 0 REVIEW / 0 FAIL |
| Block 8 / Block 9 / Block 10 Golden | 31 / 31 / 41 PASS |
| Permanent CL → CTX → IDX → RDY defect chain | PASS; no fabricated delinquency bands |
| Build, lint, artifact validation | PASS |
| Strict Block 11 typecheck | PASS |
| Repository TS baseline / current / new | 30 / 30 / 0 |
| Git diff whitespace | PASS |
| Determinism, immutability, monotonicity | PASS |
| Legacy parity | 872 / A / Высокая готовность / 1,283,000–2,636,000 RUB |
| Prior-block defects | NONE |

Performance (milliseconds; informational, no arbitrary timing gate): 1,000 Readiness evaluations measured by phase: validation 699.39, constraint extraction 115.57, case extraction 4.21, level/status 3.23, finalization 25.77; 200 complete source → Risk → Context → Index → Readiness pipelines 691.82; 1,000 Golden expectation checks 1.38; 1,000 comparisons 0.16. Timing varies by machine and load.

Delivery: 14 additive files only, no approved Block 1–10 changes. The reviewed baseline is exactly `15a2173f946b5136b5abc8129a20b15129409ffb`, message `Build Prescore Index v1`. A sparse local review uses the exact approved Git objects; 13 unmaterialized binary font/PDF baseline artifacts remain unchanged tree entries, not candidate deletions. No generated output, log, credential, environment file or temporary review artifact is included.

Candidate message: `Build Financing Readiness v1`; one parent, the approved Block 10 commit above. No main promotion, merge, force, deployment or Block 12 work.
