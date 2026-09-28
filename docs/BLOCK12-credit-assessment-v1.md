# Block 12 — Credit Assessment Engine v1

## Purpose and boundary

Credit Assessment is a structured, deterministic synthesis of approved Risk, Context,
Index and Financing Readiness outputs. It supplies facts and exact analytical lineage
for a later narrative or Debt Capacity consumer. It is not a new score, underwriting
verdict, lender policy, probability of approval, PD, product selector, recommendation,
action plan or generated narrative. There is no production API, upload, UI, PDF or
normal-analysis integration. Only an opt-in shadow wrapper is supplied.

Versions:

- `PRESCORE-CREDIT-ASSESSMENT-1.0.0-SHADOW`
- `PRESCORE-CREDIT-ASSESSMENT-POLICY-1.0.0-PRE-CALIBRATION`
- methodology `PRESCORE_STRUCTURED_CREDIT_ASSESSMENT_V1`

## Contracts and architecture

`contracts/credit-assessment.ts` defines the input and output. Inputs are the four
canonical assessments plus explicit `asOfDate`. No legacy AnalysisResult data is read.
`policy.ts` centralizes and fingerprints presentation/materiality/status policy.
`validation.ts` checks the upstream contracts and cross-output lineage without running
upstream engines. `drivers`, `context`, `limitations`, `dimensions` and `case` assemble
independent structured sections. `engine.ts` joins these sections. `integration.ts`
contains failures and returns `CREDIT_ASSESSMENT_SHADOW_UNAVAILABLE`.

Readiness `ASSESSED` becomes Assessment `COMPLETE`. `PARTIAL`, `INSUFFICIENT_DATA` and
`NOT_RATABLE_GLOBAL_STOP` are preserved. Index values and Readiness levels are copied,
never recalculated. Missing coverage is not a borrower penalty. Insufficient data has
no primary driver ranking. Partial profiles retain known drivers and explicit limits.

## Dimensions

Four scored dimensions copy the supplied Index components: FINANCIAL_STRENGTH,
OPERATING_BEHAVIOR, DEBT_CREDIT, LEGAL_CORPORATE. Maximum points, score points, final
component penalty, confidence and coverage remain exact. DATA_QUALITY and
FINANCING_CASE are non-scoring with null numeric fields, not zero scores. Dimensions
provide IDs/counts linking drivers, Context and Readiness constraints.

The canonical `RISK-CF-DEBT-SERVICE-BURDEN` remains DEBT_CREDIT through the approved
Index routing policy. Ordinary CASH_FLOW retains OPERATING_BEHAVIOR. Assessment does
not change Risk domains or define an alternative numeric routing policy.

## Drivers, materiality and primary ranking

Every scored CREDIT_RISK finding has exactly one driver referencing its Index
contribution and Readiness constraint. Base penalty, Context modifier and final penalty
are copied from that contribution. The component cap does not delete underlying
drivers or rewrite their individual penalties. CRITICAL/HIGH/MEDIUM are material;
LOW/INFO are other risks under the existing Readiness materiality policy. INFORMATION
is retained by an unscored finding reference rather than invented as a scoring driver.

At most five primary IDs are selected for presentation. All drivers remain available.
Order: copied final penalty descending, severity, dimension order, canonical code,
subject key, deterministic driver ID. No additional score is computed. Global stops
have separate drivers with null penalty fields and preserved evidence. Under global
stop, only those stops can be primary; normal credit-driver ranking is suppressed.

## Context and limitations

Relations retain exact target finding IDs, Context fact IDs, source classes, evidence,
confidence and subject. MITIGATES, CORROBORATES, EXPLAINS, NEUTRAL and REQUIRES_REVIEW
remain separate. Eligible numeric effects have already occurred in Index. Assessment
records the contributing Index IDs and never reapplies them. Client-declared or
low-confidence Context is not elevated into confirmed mitigation; its upstream effect
label is preserved, with a qualification warning and no invented applied contribution.

No relation is transferred from one loan to another merely because a creditor or code
matches. Explicit mismatching subjects are rejected. Canonical company-level targets
remain valid where the approved Context engine permits them.

DATA_REVIEW, CONTEXT_REVIEW, COVERAGE_LIMITATION and SOURCE_LIMITATION retain source
IDs, reason codes and confidence. These constrain interpretation and actionability;
they are not borrower weaknesses or additional Index penalties. No strengths are
invented from an absence of negative findings.

## Financing case, confidence and comparability

Case definition is copied as DEFINED/PARTIAL/NOT_PROVIDED with original canonical
facts, knowledge states, provenance and evidence. UNKNOWN is not zero. Requested
amount, term, product, purpose, urgency, contract, collateral and client explanation
remain informational. A billion-ruble request does not establish capacity; requested
overdraft does not select a product. Age, OKVED and region do not become bank policy.

Assessment confidence cannot exceed Index, Readiness or its weakest material/stop
driver. Source confidence is preserved, not promoted. A COMPLETE result is comparable
only when both Index and Readiness are comparable. Known facts in partial/insufficient
profiles stay visible without claiming full comparability.

## Validation, immutability and determinism

Validation checks company, cutoff, versions, policy fingerprints, status combinations,
finite values, unique IDs, missing references, contribution code/severity/component,
Context eligibility and target identity, Readiness evidence/reason/subject links,
case facts, duplicated summary state, and evidence availability after cutoff. Future
contractual dates are allowed when the facts were available at the cutoff. Invalid
lineage fails closed; the engine does not silently repair an upstream assessment.

Numeric upstream values are trusted after contract validation and copied, not
independently rescored. This is structural lineage validation, not a cryptographic
attestation of an arbitrary caller's entire upstream computation.

All output evidence is copied. Input array reordering produces byte-identical output;
primary order is deliberately policy-defined. Stable IDs depend on canonical data.
There is no hidden clock, randomness, network, database, OCR or LLM dependency.

## Golden governance

The pack contains 45 original scenarios plus CAS-RU-DEFECT-001. Expectations are
authored from methodology, never generated by running Assessment. Fingerprints guard
accidental fixture changes. The expectation runner supports required/forbidden
drivers, dimensions, Context linkage, limitations, ordered primary IDs, status,
confidence, summaries, pairwise comparisons, HARD/REVIEW checks and invariants.

During initial authoring, CAS-RU-024 incorrectly expected PARTIAL despite its fixture
having wholly absent bank coverage and insufficient upstream Index/Readiness. The
expectation was corrected to INSUFFICIENT_DATA under the mandatory status-copy rule;
the missing-bank limitation assertion was retained. No upstream rule was changed.

The permanent CL → CTX → IDX → RDY → CAS defect chain retains current overdue > 0
and KNOWN historical maximum = 0: MEDIUM current-overdue risk, CURRENT_OVERDUE, no
fabricated delinquency band, no historical-delinquency finding.

## Validation and performance

Run the dedicated suite from the repository root:
`node --experimental-strip-types --test tests/credit-assessment-v1.test.mjs`.
Full regression uses `npm test`; artifact/lint use existing repository scripts.
Strict checking targets the new integration entry, transitively including the core.
Repository diagnostic comparison excludes only new Block 12 modules from the
baseline and requires zero newly introduced diagnostics. Approved file hashes and
Git tree entries are compared against the exact parent.

The suite measures 1,000 assessments, validation and assembly phases, 200 complete
source-to-assessment pipelines, 1,000 expectation evaluations and 1,000 primary sorts.
There is no arbitrary milliseconds acceptance threshold. The final delivery report
records measured counts, timings and gate outcomes.

## Compatibility, limitations and future seam

FREE projection stays identical; an explicitly assembled FULL object may carry the
shadow result. No existing AnalysisResult contract or authoritative integration is
modified. Shadow exceptions do not mutate upstream outputs or expose private errors.

Limitations: pre-calibration structured assessment only; no narrative generation,
production integration, permanent assessment storage, lender policy, approvals, PD,
limits, serviceable debt estimates, product selection or recommendations. A valid
upstream output is required; Assessment is not a replacement for source ingestion.

Future Block 13 can consume this contract alongside Risk, Context, Index, Readiness,
CreditPortfolio and FinancingCaseInput. No Block 13 calculation is implemented here.

## Git delivery

One candidate commit: `Build Credit Assessment v1`, directly on
`f780366ae3d70644cce07260f844cebbf520d8a8`. No main move, merge, force or deployment.
The final report identifies the candidate SHA after all gates pass.

## Golden case catalog

| ID | Scenario |
|---|---|
| CAS-RU-001 | Healthy complete analytical profile |
| CAS-RU-002 | LOW financial risk |
| CAS-RU-003 | MEDIUM financial risk |
| CAS-RU-004 | HIGH operating risk |
| CAS-RU-005 | CRITICAL risk |
| CAS-RU-006 | Financial dimension routing |
| CAS-RU-007 | Operating dimension routing |
| CAS-RU-008 | Canonical debt-service override |
| CAS-RU-009 | BKI debt dimension |
| CAS-RU-010 | Legal credit dimension |
| CAS-RU-011 | Multiple risks within capped component |
| CAS-RU-012 | Multiple components |
| CAS-RU-013 | Primary ranking by copied Index penalty |
| CAS-RU-014 | Tie breaks by risk code |
| CAS-RU-015 | All six drivers retained, five primary |
| CAS-RU-016 | Terminated global stop |
| CAS-RU-017 | Liquidation global stop |
| CAS-RU-018 | Bankruptcy global stop |
| CAS-RU-019 | Insufficient Index and Readiness |
| CAS-RU-020 | Partial assessment |
| CAS-RU-021 | Missing source data review |
| CAS-RU-022 | Stale BKI limitation |
| CAS-RU-023 | Reconciliation conflict |
| CAS-RU-024 | Missing bank period |
| CAS-RU-025 | Exact mitigation linkage |
| CAS-RU-026 | Exact corroboration linkage |
| CAS-RU-027 | Explanation is not numeric adjustment |
| CAS-RU-028 | Context review limitation |
| CAS-RU-029 | Company age neutral |
| CAS-RU-030 | OKVED neutral |
| CAS-RU-031 | Region neutral |
| CAS-RU-032 | Marketplace model explanation |
| CAS-RU-033 | Contract-backed concentration keeps risk |
| CAS-RU-034 | Client seasonality declaration is explanation |
| CAS-RU-035 | No financing case |
| CAS-RU-036 | Partial financing case |
| CAS-RU-037 | Defined financing case |
| CAS-RU-038 | Billion-ruble request is context only |
| CAS-RU-039 | Requested overdraft is not recommendation |
| CAS-RU-040 | Personal BKI not company debt |
| CAS-RU-041 | Guarantorship remains contingent |
| CAS-RU-042 | Bank guarantee remains contingent |
| CAS-RU-043 | Current overdue and historical zero |
| CAS-RU-044 | Input reordering byte identical |
| CAS-RU-045 | Real canonical multi-risk pipeline |
| CAS-RU-DEFECT-001 | Permanent five-block historical-zero overdue chain |

## Recorded delivery validation

- Dedicated: 333 passed, 0 failed. Full regression: 2,515 passed, 0 failed
  (approved baseline 2,182 plus 333).
- Assessment Golden: 46 PASS / 0 REVIEW / 0 FAIL.
- Upstream Golden: Credit Lab 31, Context 31, Index 41, Readiness 41 PASS.
- Build, lint, artifact validation and strict new-module typecheck passed.
- Repository TypeScript: 30 baseline / 30 current / 0 new diagnostics.
- Authoritative parity: 872 / A / Высокая готовность / 1,283,000–2,636,000 RUB.
- FREE projection equality and opt-in FULL shadow availability passed.
- Prior-block defects: NONE.

Representative dedicated run on this environment (milliseconds):

| Phase | Iterations | Total ms |
|---|---:|---:|
| Validation | 1,000 | 1,940.77 |
| Drivers | 1,000 | 136.49 |
| Context | 1,000 | 1,530.44 |
| Limitations | 1,000 | 10.89 |
| Dimensions | 1,000 | 19.71 |
| Case | 1,000 | 1.39 |
| Complete Assessment | 1,000 | 3,301.10 |
| Source → Risk → Context → Index → Readiness → Assessment | 200 | 1,530.75 |
| Expectations | 1,000 | 3.59 |
| Primary sorting | 1,000 | 0.30 |

Measurements include ordinary environment variability and are not credit policy or
hard performance gates. Phase measurements are separate calls, not additive totals.
