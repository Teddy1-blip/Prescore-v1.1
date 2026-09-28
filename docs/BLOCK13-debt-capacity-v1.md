# Block 13 — Debt Capacity Engine v1

## Purpose and boundaries

Debt Capacity measures observed cash-flow serviceability. Its primary result is
additional monthly debt-service headroom, not an approved or recommended loan limit.
Credit quality, financing readiness, serviceability, bank policy, product selection
and approval remain separate. A low Index/Readiness does not multiply capacity down;
a high one does not create a bonus. Data review affects reliability and completeness,
not a monetary haircut. Legacy estimated limits are regression checks only.

Versions:

- `PRESCORE-DEBT-CAPACITY-1.0.0-SHADOW`
- `PRESCORE-DEBT-CAPACITY-POLICY-1.0.0-PRE-CALIBRATION`
- `PRESCORE_CASHFLOW_DEBT_SERVICE_CAPACITY_V1`

The engine is pre-calibration and SHADOW. No empirical calibration or bank-policy
claim is made. No current market rate, Central Bank rate or provider call is embedded.

## Architecture and inputs

Canonical Risk → Context → Index → Readiness → Credit Assessment accompanies direct
Block 4 BankStatementMetricsV2, explicit asOfDate, optional CreditPortfolioV1 and
optional explicit scenarios. Core code does not rebuild any upstream engine, read
AnalysisResult, scan transactions or invoke classification, network, database or AI.

`contracts/debt-capacity.ts` defines contracts. `policy.ts` owns deep-frozen,
fingerprinted methodology. `validation.ts` validates input contracts and lineage.
`operating-basis`, `debt-service`, `portfolio`, `scenarios` calculate separate factual
bases. `engine.ts` builds views and finalizes the result. `integration.ts` supplies
only an opt-in failure-isolated `buildDebtCapacityShadow` wrapper.

No approved Block 1–12 file is modified. The Bank Metrics contract has no company ID;
company linkage is the caller's canonical assembly responsibility. Core checks all
company IDs that actually exist and exact upstream assessment references. It does
not fabricate an identity field or claim cryptographic provenance authentication.

## Eligible history and operating basis

Only FULL months are eligible. Dates and rows are validated, sorted chronologically
and checked against the bank period and cutoff. PARTIAL, MISSING and OVERLAP do not
enter averages; missing is not zero. Malformed, duplicate and future months fail
closed. Partial month totals are not annualized.

Policy: fewer than 6 FULL months gives INSUFFICIENT_DATA; 6–11 permits numeric PARTIAL;
12+ permits CALCULATED only when other completeness conditions hold. Remaining
partial/missing/overlap months make the history incomplete even with 12 eligible rows.

Central basis = min(canonical fullMonthOperatingAverage, eligible-month median).
Conservative basis = min(central, average of the latest three FULL months). Fewer than
three uses central with a warning; the six-month rule still prevents normal capacity.
The canonical average is checked against its monthly lineage to cent precision.

Only operating receipts are used. Owner funding, bank loans, factoring inflows, asset
sales, tax refunds and gross external inflow cannot raise the operating basis. No
seasonality, future-growth or liquidity multiplier exists. Liquidity is copied only
as supporting diagnostics, with upstream warnings retained.

## Existing service and portfolio

ObservedMonthlyDebtService is the average of monthly.debtService across eligible FULL
months, supported by the canonical BSM-DEBT-005 status/confidence. Missing/weak support
produces UNKNOWN, not an inferred zero. Unsplit debt service can count as observed
cash outflow but never implies principal reduction. Principal outstanding is not
subtracted from principal equivalents.

Portfolio schedule is independent: known adequately supported PAYMENT_DUE amounts
for ACTIVE company obligations with FUNDED_DEBT or LEASE exposure, due strictly after
cutoff and through day 30 inclusive. Day 31 is excluded. Calendar evidence for an
outside-window event remains visible. A known maturity balloon is included only when
it is a PAYMENT_DUE; a MATURITY date alone does not invent a payment.

BANK_GUARANTEE, GUARANTORSHIP, CONTINGENT and FACTORING are excluded. CREDIT_LIMIT and
other exposure classes do not automatically become ordinary funded term debt. Leasing
payments are included explicitly. Rates, balances and guarantee amounts are not monthly
payments. No fake multi-month schedule is extrapolated from one next-payment fact.

Absent Portfolio is allowed with adequate bank evidence and an explicit warning.
A supplied portfolio with unsupported schedules is PARTIAL; schedule value remains
null when no supported amount/calendar is available. Known amounts from an incomplete
schedule are retained as a labelled lower bound, not discarded: they can conservatively
raise the anchor while status stays PARTIAL. The unknown remainder is not assumed zero.
Calendar completeness describes supplied eligible obligations, not proof that all
company bank accounts, debts or future amendments are represented.

## Capacity views and policy

Recurring anchor = observed monthly service. Near-term anchor = max(observed service,
known portfolio 30d schedule). If only one is usable, that value is used with an explicit
basis/warning. The recurring view uses central operating basis; the near-term view uses
conservative operating basis. This exposes both ordinary observed serviceability and
known imminent payments/declining recent receipts.

For each view:

- Prudential total monthly service = operating basis × 20%.
- Maximum-policy total monthly service = operating basis × 25%.
- Incremental headroom = max(0, total service − existing anchor).

Twenty percent is an analytical buffer. Twenty-five percent aligns with the approved
Block 7 debt-service-burden boundary; it is not a bank approval promise. No ratios are
optimized on Golden fixtures. Policy parameters, eligible exposures, history, window,
minimum supporting confidence, annuity method and rounding are centralized.

Headline takes the minimum available recurring/near-term prudential amounts and the
minimum maximum-policy amounts. It never selects the optimistic view. State is
POSITIVE, ZERO or UNKNOWN. ZERO means no additional headroom under this methodology,
not a bank decline. Optional annualization is monthly payment headroom × 12, not annual
loan principal.

Monetary calculations floor to RUB cents at documented amount boundaries. Average
and median aggregation use ordinary finite numeric arithmetic before that rounding.
Non-finite inputs/results are rejected; a zero remains explicit known zero when the
upstream Assessment permits a numeric result.

## Status, confidence and comparability

GLOBAL_STOP Assessment gives NOT_RATABLE_GLOBAL_STOP with null capacity/principal.
INSUFFICIENT_DATA Assessment gives INSUFFICIENT_DATA regardless of isolated bank facts.
PARTIAL Assessment caps Debt Capacity at PARTIAL. COMPLETE Assessment can produce
CALCULATED only when capacity-specific evidence is complete; it can be downgraded.

Confidence cannot exceed Assessment or the weakest operating, observed-service and
numerically used schedule evidence. Scenario confidence additionally includes explicit
scenario provenance and known requested amount/term provenance. Missing scenario
confidence remains UNKNOWN, rather than inventing a HIGH-confidence assumption.

Comparable requires CALCULATED, comparable Assessment and complete capacity history.
PARTIAL, INSUFFICIENT and GLOBAL_STOP are never comparable. Data review reason codes
remain visible without subtracting money.

## Explicit scenarios and requested amount

No scenario means no principal conversion. ANNUITY/MONTHLY requires a finite nonnegative
annualRatePercent and a positive integer termMonths. No defaults supply either value.

With r = annualRatePercent / 100 / 12, n = termMonths:

- Positive r: principalEquivalent = payment × (1 − (1+r)^−n) / r.
- Zero r: principalEquivalent = payment × n.

The implementation uses log1p/expm1 for numerical stability at small nonzero rates.
Results retain assumptions, provenance, reference IDs and structured warnings:
SCENARIO_ASSUMPTION_REQUIRED, NOT_BANK_APPROVAL, NOT_PRODUCT_RECOMMENDATION.

KNOWN requested amount can be compared to explicit scenario equivalents:
WITHIN_PRUDENTIAL_CAPACITY / WITHIN_MAXIMUM_POLICY_CAPACITY /
ABOVE_MODELED_CAPACITY / UNKNOWN. Known requested term must equal scenario term;
otherwise coverage is UNKNOWN with SCENARIO_TERM_MISMATCH. Amount and term references
point back to exact Financing Case evidence. A requested overdraft, guarantee,
factoring product or revolver does not transform an annuity result into that product's
limit. Generic cash headroom is invariant to requested product and amount.

## Lineage, temporal safety and failure isolation

Validation checks supported versions/fingerprints, company/cutoff, upstream state,
driver/contribution/constraint and Context references, case facts, duplicate IDs,
monthly concepts/counts/values, portfolio event identities, scenario validity,
non-finite/negative impossible amounts and future availability. It does not silently
repair inputs. Future contractual due dates are allowed if known by cutoff; future
observedAt/receivedAt/asOf/evidenceAsOf is not.

Evidence paths identify exact metrics, months, obligations, scheduled events, scenario
and financing-case facts. Output order is deterministic and caller objects stay
unchanged. There is no hidden clock, random UUID, network, database or external service.
The wrapper returns DEBT_CAPACITY_SHADOW_UNAVAILABLE without authoritative mutation or
private error disclosure. FREE projection is unchanged; FULL may carry opt-in shadow
output. No production endpoint, UI/PDF, DB migration or scoring integration exists.

## Golden methodology and discovered fixture boundaries

The pack has CAP-RU-001…054 plus CAP-RU-DEFECT-001. Expectations are independently
specified from formulas and methodology. Annuity Golden verification independently
sums discounted future payments, rather than copying engine output. Fingerprints guard
fixture/expectation changes; HARD and REVIEW assertions and pairwise comparisons are
separate. Existing Golden packs and fingerprints remain untouched.

Canonical pipeline cases run approved source → Risk → Context → Index → Readiness →
Assessment → Capacity. Controlled consumer-boundary cases hold a valid rated upstream
contract fixed while varying independently authored canonical bank inputs. These do
not claim the altered bank profile generated that fixed assessment.

This distinction matters: approved Block 7 requires a fully covered period for its
debt-service ratio; an actual gapped/partial period can therefore make Index/Assessment
INSUFFICIENT even when Block 13 has six usable rows. Also zero receipts leave the
upstream ratio undefined. Block 13 must preserve upstream insufficiency. Tests cover
both that real pipeline behavior and numeric zero/month-policy behavior at a rated
consumer boundary. No upstream methodology or Golden expectation is weakened.

The permanent CL → CTX → IDX → RDY → CAS → CAP regression retains current overdue >0
with KNOWN historical delinquency zero: no fabricated delinquency band and no invented
extra debt-service amount.

## Tests, performance and future seam

Run `node --experimental-strip-types --test tests/debt-capacity-v1.test.mjs` from repo
root. Full suite uses existing `npm test`. Tests cover contract rejection, history,
operating bases, service anchors, contingent exclusions, scenario calculations,
monotonicity, determinism, immutability, pairwise quality independence, prior Golden
packs, FREE/FULL and authoritative parity.

Benchmarks measure 1,000 capacity evaluations, 200 full canonical pipelines, 1,000
scenario calculations, 1,000 Golden expectation checks and 1,000 view comparisons.
Validation, operating basis, debt service, portfolio, views, scenarios and finalization
are measured separately. No arbitrary milliseconds gate is imposed.

Limitations: observations can omit company accounts/obligations; unknown schedules
remain incomplete; no income forecast, available-bank-balance bonus, borrower-quality
haircut, product-specific revolving mechanics, lender policy, approval probability,
PD, recommended limit, product selection or action plan. Strong company provenance for
the company-less Block 4 contract is the upstream assembly's responsibility.

Future Block 14 may consume Capacity with Assessment, Readiness, Risk, Context,
Portfolio and Financing Case to evaluate product mechanics. Block 14 is not implemented.

Git delivery is one candidate `Build Debt Capacity v1` directly on
`575826eed95356eacd37dea558ec96cc6a93763f`. Main remains unchanged; no merge, force or
deployment. Exact final counts and candidate SHA are reported after validation.

## Golden case catalog

| ID | Scenario |
|---|---|
| CAP-RU-001 | Twelve full stable months |
| CAP-RU-002 | Six full months numeric partial |
| CAP-RU-003 | Five full months insufficient |
| CAP-RU-004 | Missing month is not zero |
| CAP-RU-005 | Partial spike excluded |
| CAP-RU-006 | Future month rejected |
| CAP-RU-007 | Median limits one-off spike |
| CAP-RU-008 | Recent receipts decline |
| CAP-RU-009 | Recent growth not extrapolated |
| CAP-RU-010 | Owner funding excluded |
| CAP-RU-011 | Bank loan inflow excluded |
| CAP-RU-012 | Factoring inflow excluded |
| CAP-RU-013 | Asset sale excluded |
| CAP-RU-014 | Known zero operating receipts |
| CAP-RU-015 | Observed service below prudential ceiling |
| CAP-RU-016 | Existing service between twenty and twenty-five percent |
| CAP-RU-017 | Exactly twenty-five percent existing service |
| CAP-RU-018 | Above twenty-five percent never negative |
| CAP-RU-019 | Partial debt-service spike excluded |
| CAP-RU-020 | Schedule lower than observed anchor |
| CAP-RU-021 | Schedule higher than observed anchor |
| CAP-RU-022 | Known maturity balloon payment within thirty days |
| CAP-RU-023 | Day thirty-one outside near-term window |
| CAP-RU-024 | Closed obligation excluded |
| CAP-RU-025 | Bank guarantee payment excluded |
| CAP-RU-026 | Guarantorship excluded |
| CAP-RU-027 | Contingent amount is not monthly service |
| CAP-RU-028 | Leasing payment included |
| CAP-RU-029 | Factoring not automatic funded debt |
| CAP-RU-030 | Unsplit payment counts only as observed cash service |
| CAP-RU-031 | No portfolio with strong bank evidence |
| CAP-RU-032 | Unknown supplied schedule is not zero |
| CAP-RU-033 | Partial Assessment caps completeness |
| CAP-RU-034 | Insufficient Assessment has no normal capacity |
| CAP-RU-035 | Global stop no headline or principal |
| CAP-RU-036 | Low Readiness positive headroom |
| CAP-RU-037 | High Readiness zero headroom |
| CAP-RU-038 | High Index has no capacity bonus |
| CAP-RU-039 | Low Index has no capacity haircut |
| CAP-RU-040 | Data review is not monetary penalty |
| CAP-RU-041 | Explicit annuity discounted cash flows |
| CAP-RU-042 | Zero-rate principal equals payment times term |
| CAP-RU-043 | Higher rate lower equivalent |
| CAP-RU-044 | Longer term larger equivalent |
| CAP-RU-045 | Duplicate scenario rejected |
| CAP-RU-046 | Request within prudential modeled capacity |
| CAP-RU-047 | Request between prudential and maximum |
| CAP-RU-048 | Request above modeled capacity |
| CAP-RU-049 | Requested term mismatch remains unknown |
| CAP-RU-050 | Requested overdraft does not change annuity mechanics |
| CAP-RU-051 | Personal BKI does not penalize company capacity |
| CAP-RU-052 | Historical zero overdue preserved |
| CAP-RU-053 | Reordered inputs byte identical |
| CAP-RU-054 | Canonical source, multi-risk and portfolio pipeline |
| CAP-RU-DEFECT-001 | Permanent historical-zero current-overdue chain |

## Recorded final validation

- Dedicated: 425 PASS / 0 FAIL.
- Full regression: 2,940 PASS / 0 FAIL (2,515 baseline + 425).
- Capacity Golden: 55 PASS / 0 REVIEW / 0 FAIL.
- Blocks 8/9/10/11/12 Golden: 31 / 31 / 41 / 41 / 46 PASS.
- Build, lint, artifact validation, strict new-module typecheck: PASS.
- Repository TypeScript: 30 baseline / 30 current / 0 new.
- git diff --check: PASS; approved source files unchanged.
- Legacy parity: 872 / A / Высокая готовность / 1,283,000–2,636,000 RUB.
- FREE/FULL, immutability, determinism and monotonicity: PASS.
- Prior-block defects: NONE.

The first npm test log did not contain a final test count and was not accepted as
regression evidence. A complete sequential TAP run verified all 2,940 tests.

| Benchmark phase | Iterations | Total ms |
|---|---:|---:|
| validation | 1000 | 5753.73 |
| operatingBasis | 1000 | 77.00 |
| debtServiceBasis | 1000 | 59.91 |
| portfolioSchedule | 1000 | 11.98 |
| capacityViews | 1000 | 292.95 |
| scenarioConversion | 1000 | 15.89 |
| finalization | 1000 | 44.21 |
| capacity1000 | 1000 | 6342.40 |
| sourcePipeline200 | 200 | 3088.85 |
| goldenExpectations | 1000 | 5.49 |
| viewComparisons | 1000 | 0.11 |

These are environment-dependent measurements, not hard gates.
