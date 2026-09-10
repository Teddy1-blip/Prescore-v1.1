# Block 9 — Context / Case Engine v1

## Purpose and boundaries

Context is a factual overlay on an existing RiskAssessmentV1. It describes the business surrounding an observed risk and the financing case the company is trying to solve. It does not recalculate Risk, Index, readiness, affordability, limits, products or recommendations. A relation identifies its contextual facts, target finding IDs/codes, effect and basis. No risk finding is removed, suppressed, reclassified or rewritten.

Versions:

- PRESCORE-CONTEXT-ENGINE-1.0.0-SHADOW
- PRESCORE-CONTEXT-RULES-1.0.0-PRE-INDEX
- PRESCORE_CONTEXT_PRE_INDEX_V1

Mode is SHADOW. Block 1–8 versions and implementations remain unchanged. Company age, region and OKVED are factual context, never a bank's acceptance policy. Requested product is the client's request, never a recommendation. No Context Score, PD, approval probability, financing limit or score contribution exists.

## Architecture and contracts

`contracts/context.ts` defines ContextFactV1, ContextRelationV1, ContextRule, ContextRuleEvaluation, ContextAssessmentV1, ContextShadowInput/Fields and FinancingCaseInputV1. The pure flow is validation → canonical fact adaptation and availability checks → rule evaluation → relation construction → summary. These stages are exported separately for tests and measurement.

Domains: BUSINESS_PROFILE, OPERATING_PATTERN, SEASONALITY, CUSTOMER_STRUCTURE, CONTRACTS, CASH_FLOW, WORKING_CAPITAL, DEBT_STRUCTURE, CREDIT_HISTORY, LEGAL, DATA_QUALITY and FINANCING_CASE.

Knowledge/status KNOWN/PARTIAL/UNKNOWN/NOT_APPLICABLE is separate from HIGH/MEDIUM/LOW/UNKNOWN evidence confidence and CANONICAL_OBSERVED/DOCUMENT_REPORTED/CLIENT_DECLARED/DERIVED_RELATIONSHIP source class. Missing is not zero; UNKNOWN has null value. Non-finite values cannot become known numeric facts. Explicit zero remains zero.

Facts retain source IDs, metric codes, upstream RiskFact IDs, portfolio obligation IDs, reconciliation finding IDs, evidence, periods, calculation basis and warnings. Facts are deterministically identified from their canonical identity and content. No transaction scan or additional classifier exists. Legacy score, grade, readiness, legacy financial assessment, limits and recommendations are not read.

## Relation effects

| Effect | Meaning |
|---|---|
| CORROBORATES | Independent context supports an existing concern. |
| MITIGATES | Evidence limits persistence/current relevance; original risk severity and finding remain. |
| EXPLAINS | A factual or declared mechanism adds explanation without a positive risk judgment. |
| NEUTRAL | Business, financing-case or contractual context without credit direction. |
| REQUIRES_REVIEW | Evidence limitations require human interpretation, not a borrower-risk conclusion. |

Rules return SUPPORTED, NOT_SUPPORTED, INSUFFICIENT_DATA or NOT_APPLICABLE. Absent target risk yields NOT_APPLICABLE. Missing/ambiguous required input yields INSUFFICIENT_DATA. Only SUPPORTED evaluations create relations. Distinct bureau obligations are evaluated by subject; different loans cannot supply each other's overdue/history evidence. Portfolio references are not rematched.

Summary counts relations by effect and distinct risk findings with/without context. Summary confidence is the weakest relation confidence, not credit quality.

## Confidence and independence

Fact confidence cannot exceed the weakest provided evidence confidence. No evidence means UNKNOWN confidence. Canonical source envelope confidence is conservatively mapped: >=80 HIGH, >=50 MEDIUM, otherwise LOW; absent metadata UNKNOWN. This mapping is evidence handling, not a credit threshold. Business/document context is capped at MEDIUM. Name-only contract/customer correspondence is LOW and explanatory only.

CORROBORATES/MITIGATES require at least MEDIUM known material context. LOW evidence may support a LOW neutral/explanatory/review relation but is never promoted. Relation confidence also respects target finding confidence. Unknown/partial values do not support directional rules. Pure client declarations cannot mitigate risk.

Annual-vs-bank relations require nonempty disjoint source IDs and a bank period beginning after the annual period ends. Only the sign of already canonical trends is interpreted; there is no new risk threshold. Declining annual revenue plus a later positive bank trend mitigates persistence interpretation, not the historic annual decline itself. Balance-sheet liquidity and cash pressure remain separate concepts. Cash mitigation requires complete supplied bank coverage, positive canonical average cash, zero canonical low-liquidity share and a later bank period. It is not proof of adequate future liquidity or all company accounts.

## Operating, financial and business facts

RiskAssessment's canonical facts carry financial profitability, interest coverage, annual trends, capital, reported net assets/proxy distinctions, bank concentration, cash pressure and source state. Additional Block 4 fields provide volatility, operating/gross inflow, full and monthly coverage, owner contributions/loans/withdrawals, factoring, supplier concentration, tax-payment continuity and cash balance. Missing or partial monthly entries remain UNKNOWN rather than zero.

Marketplace/acquiring share describes an intermediary model. It does not make a platform the ultimate direct customer. Owner and factoring funding remain distinct from operating revenue. Tax continuity describes observed payment months, not tax compliance.

Company registration, completed calendar age in months, region, primary OKVED and lifecycle are neutral. Profile and contract facts require eligible company-scoped source metadata. Failed/missing methods do not silently become reliable zero activity.

## Seasonality

The engine consumes Block 4 seasonalityEligibility. Eligibility=1 permits a neutral statement that historical coverage is eligible for review. Eligibility=0 or unavailable produces INSUFFICIENT_DATA. This does not prove recurring seasonality, assign a seasonal pattern or accept a client explanation as its cause. No new seasonality detection heuristic is introduced. The eligible Golden material includes twelve explicit supplied months.

## Contracts and financing case

FinancingCaseInputV1 records case/company/cutoff, requested amount and integer term, purpose, requested product, urgency and optional contract reference, collateral information and client explanation. Each field preserves source, status, confidence, evidenceAsOf and warnings. Normalization is pure, validates enums/numbers/company/cutoff, caps client confidence at MEDIUM and excludes unavailable declarations with explicit warnings.

A case input cannot certify its own documentary origin: supplied fields remain CLIENT_DECLARED. Independent confirmation is a separate CASE_CONTRACT_MATCH fact from eligible canonical company contract data. Contract-number normalization removes the leading number sign before Unicode normalization, normalizes whitespace and case, but does not fuzzy-match similar numbers. Exactly one matching canonical number supports DOCUMENT_REPORTED context. Multiple matches stay unknown/ambiguous. No match remains unverified. Existing canonical contract items do not contain a stable counterparty INN, so documentary confirmation is capped at MEDIUM. Names alone never become HIGH proof.

An active canonical contract corresponding to a direct customer's name may explain concentration at LOW confidence; it never removes concentration risk. Contract activity totals are not used when their population contains future documents. Active status recognition is deliberately restricted to explicit supported active labels; no active contract is inferred from a future execution date alone.

## BKI and portfolio

Only eligible company borrower BKI facts are used. Owner/director/personal guarantor reports are excluded. Historical delinquency plus fresh reported current overdue zero may mitigate current relevance for the same obligation; historical finding remains. Current overdue with reported history zero explains the absence of a reported historical band and does not manufacture delinquency. Stale historical evidence remains historical; current-state interpretation requires review under the approved Risk semantics.

Portfolio facts remain canonical. Funded, contingent guarantorship and bank guarantees are distinct. Maturity/schedules, unmatched payments, unresolved identities and unsplit debt service remain factual. No principal is inferred from unsplit payments; no obligation/payment rematching occurs. Portfolio outputs are not treated as independent confirmation of the bureau source that seeded them.

## Reconciliation and data quality

Canonical CONFLICT yields REQUIRES_REVIEW; neither source is secretly selected. RELATIONSHIP_OBSERVED yields EXPLAINS, never a conflict. Missing/stale sources, missing bank months, unknown inflow and weak confidence describe data limitations, not borrower weakness. Context rule INSUFFICIENT_DATA remains visible even when no relation can safely be constructed.

## Temporal safety and determinism

All APIs require explicit asOfDate. Future RiskFact periods/evidence and future source availability are excluded and diagnosed. Source receipts, fetched/observed/requested dates and financing-field evidenceAsOf are availability dates. Eligible source IDs are tracked when filtering upstream RiskFacts. Future portfolio/BKI snapshots cannot supply current context. Future financial/reconciliation sources are excluded. Unknown case availability is not proof of historical availability.

Maturity, schedule due dates and contract execution dates can be future when the document was already known at cutoff. These are contractual dates, not future knowledge. No clock, network, database or random IDs exist in the core. Stable ordering is domain → rule → effect → subject → deterministic ID; semantically irrelevant input order does not change output.

## Integration and FREE/FULL

`buildContextShadow(input)` is a pure optional integration seam after RiskAssessment exists. Missing/malformed risk, wrong company or inconsistent cutoff returns CONTEXT_RISK_INPUT_UNAVAILABLE or CONTEXT_INPUT_MISMATCH. Unexpected failures return CONTEXT_SHADOW_UNAVAILABLE. No authoritative result is mutated or compensated. ContextShadowFields may be composed with internal/FULL analysis values; no production upload/conclusion/API path is changed in this block. No AnalysisResult contract rewrite is required.

Existing FREE allowlist remains unchanged and excludes Context payload. FULL can retain an attached shadow assessment. Tests compare FREE projection before/after attachment, and assert authoritative score/grade/readiness/limits unchanged. No endpoint, database migration, UI, PDF, AI or deployment change is included.

## Credit Lab, Golden governance and invariants

The approved Block 8 pack and fingerprints are frozen. Its existing 31 cases must remain PASS. The separate Context pack contains 30 methodology-authored scenarios plus CTX-RU-DEFECT-001. Expectations are authored without importing the Context evaluator. Fingerprints cover material and expectations. The internal harness supports required/forbidden relations, fact values/status/source/confidence, evaluation statuses, effect, target risk code, confidence, reason codes, summary and invariants, with HARD/REVIEW mismatches and PASS/REVIEW/FAIL. It does not rewrite Block 8 contracts or labels.

Tested invariants include Risk deep immutability, no scores/PD/probability/policy/products/capacity, UNKNOWN != zero, no future context, declaration != hard proof, personal BKI exclusion, contingent != funded, relationship != conflict, missing source != borrower risk and weakest confidence. The hotfix scenario retains MEDIUM current overdue, CURRENT_OVERDUE only and no historical finding when history=0.

Any genuine prior-block defect must stop delivery with PRIOR_BLOCK_DEFECT_FOUND. New Context defects are corrected within this block without tuning approved Risk methodology.

## Limitations and future Block 10 seam

This is pre-Index contextual methodology, not calibrated scoring. There is no causal claim that bank recovery eliminates annual decline, no seasonality detector, no full-account completeness guarantee, no new document parser, no OCR/LLM, no live bureau/bank provider, no persistent financing-case workflow and no public UI. Contract confirmation is limited by canonical provider coverage and absent stable counterparty IDs. Internal synthetic cases are not statistical model validation.

Future Block 10 can consume RiskAssessmentV1 alongside ContextAssessmentV1. No weighting, Index calculation or calibration is implemented now. Remote main remains the approved Block 8 commit until separately authorized.

## Rule registry

| Code | Domain | Effect | Required inputs |
|---|---|---|---|
| CTX-BUSINESS-PROFILE | BUSINESS_PROFILE | NEUTRAL | COMPANY_AGE_MONTHS, COMPANY_REGION, COMPANY_OKVED, COMPANY_STATUS |
| CTX-GROSS-OPERATING | CASH_FLOW | EXPLAINS | GROSS_INFLOW, OPERATING_RECEIPTS |
| CTX-OWNER-FUNDING | CASH_FLOW | EXPLAINS | OWNER_FUNDING |
| CTX-OWNER-LOANS | CASH_FLOW | EXPLAINS | OWNER_LOANS |
| CTX-OWNER-WITHDRAWALS | CASH_FLOW | NEUTRAL | OWNER_WITHDRAWALS |
| CTX-CONTRACT-ACTIVITY | CONTRACTS | NEUTRAL | ACTIVE_CONTRACT_COUNT, ACTIVE_CONTRACT_AMOUNT |
| CTX-BKI-CURRENT-CLEAR | CREDIT_HISTORY | MITIGATES | BKI_HISTORY_DAYS, BKI_OVERDUE |
| CTX-BKI-STALE | CREDIT_HISTORY | REQUIRES_REVIEW | BKI_HISTORY_DAYS |
| CTX-BKI-ZERO-HISTORY | CREDIT_HISTORY | EXPLAINS | BKI_HISTORY_DAYS, BKI_OVERDUE |
| CTX-CONCENTRATION-CONTRACT | CUSTOMER_STRUCTURE | EXPLAINS | CONCENTRATION_CONTRACT_CONTEXT |
| CTX-MARKETPLACE-MODEL | CUSTOMER_STRUCTURE | EXPLAINS | BANK_INTERMEDIATED_SHARE |
| CTX-SUPPLIER-STRUCTURE | CUSTOMER_STRUCTURE | NEUTRAL | SUPPLIER_TOP1 |
| CTX-BANK-COVERAGE | DATA_QUALITY | REQUIRES_REVIEW | BANK_COVERAGE_ADEQUATE |
| CTX-CASH-ACCRUAL | DATA_QUALITY | EXPLAINS | RECON_OUTCOME |
| CTX-MISSING-SOURCES | DATA_QUALITY | REQUIRES_REVIEW | SOURCE_MISSING_COUNT |
| CTX-RECON-CONFLICT | DATA_QUALITY | REQUIRES_REVIEW | RECON_OUTCOME |
| CTX-SOURCE-CONFIDENCE | DATA_QUALITY | REQUIRES_REVIEW | CONTEXT_LOW_CONFIDENCE_COUNT |
| CTX-UNKNOWN-INFLOWS | DATA_QUALITY | REQUIRES_REVIEW | BANK_UNKNOWN_INFLOW_SHARE |
| CTX-CONTINGENT-BANK-GUARANTEE | DEBT_STRUCTURE | NEUTRAL | OBLIGATION_TYPE |
| CTX-CONTINGENT-GUARANTORSHIP | DEBT_STRUCTURE | NEUTRAL | OBLIGATION_TYPE |
| CTX-DEBT-SERVICE-PORTFOLIO | DEBT_STRUCTURE | EXPLAINS | PORTFOLIO_FUNDED_PRINCIPAL |
| CTX-FACTORING-FLOWS | DEBT_STRUCTURE | EXPLAINS | FACTORING_INFLOW |
| CTX-MATURITY | DEBT_STRUCTURE | NEUTRAL | OBLIGATION_MATURITY |
| CTX-UNMATCHED-PAYMENTS | DEBT_STRUCTURE | REQUIRES_REVIEW | PORTFOLIO_UNMATCHED |
| CTX-UNRESOLVED-DEBT | DEBT_STRUCTURE | REQUIRES_REVIEW | PORTFOLIO_UNRESOLVED |
| CTX-UNSPLIT-PAYMENTS | DEBT_STRUCTURE | EXPLAINS | PORTFOLIO_UNSPLIT |
| CTX-CASE-CONFIRMED-CONTRACT | FINANCING_CASE | NEUTRAL | CASE_CONTRACT_MATCH |
| CTX-CASE-EXPLANATION | FINANCING_CASE | EXPLAINS | CASE_clientExplanation |
| CTX-CASE-REQUEST | FINANCING_CASE | NEUTRAL | CASE_requestedAmount, CASE_requestedTermMonths, CASE_financingPurpose, CASE_requestedProduct, CASE_urgency |
| CTX-CASE-UNMATCHED-CONTRACT | FINANCING_CASE | REQUIRES_REVIEW | CASE_CONTRACT_MATCH |
| CTX-OPERATING-TREND | OPERATING_PATTERN | NEUTRAL | BANK_OPERATING_TREND, BANK_COVERAGE_ADEQUATE |
| CTX-TAX-CONTINUITY | OPERATING_PATTERN | NEUTRAL | TAX_PAYMENT_CONTINUITY |
| CTX-VOLATILITY | OPERATING_PATTERN | NEUTRAL | OPERATING_VOLATILITY |
| CTX-SEASONALITY-ELIGIBILITY | SEASONALITY | NEUTRAL | SEASONALITY_ELIGIBILITY |
| CTX-CAPITAL | WORKING_CAPITAL | NEUTRAL | FIN_EQUITY, FIN_WORKING_CAPITAL |
| CTX-LIQUIDITY-CORROBORATION | WORKING_CAPITAL | CORROBORATES | FIN_CURRENT_RATIO, BANK_LOW_LIQUIDITY_SHARE, BANK_COVERAGE_ADEQUATE |
| CTX-LIQUIDITY-CURRENT-CASH | WORKING_CAPITAL | MITIGATES | FIN_CURRENT_RATIO, BANK_LOW_LIQUIDITY_SHARE, CASH_AVERAGE_BALANCE, BANK_COVERAGE_ADEQUATE |
| CTX-PROFITABILITY | WORKING_CAPITAL | NEUTRAL | FIN_ANNUAL_NET_PROFIT, FIN_INTEREST_COVERAGE |
| CTX-REVENUE-CORROBORATION | WORKING_CAPITAL | CORROBORATES | FIN_ANNUAL_REVENUE_CHANGE, BANK_OPERATING_TREND, BANK_COVERAGE_ADEQUATE |
| CTX-REVENUE-RECOVERY | WORKING_CAPITAL | MITIGATES | FIN_ANNUAL_REVENUE_CHANGE, BANK_OPERATING_TREND, BANK_COVERAGE_ADEQUATE |

## Golden Context cases

| ID | Scenario | Result |
|---|---|---|
| CTX-RU-001 | Healthy stable context | PASS |
| CTX-RU-002 | Annual decline and recent operating decline | PASS |
| CTX-RU-003 | Annual decline and subsequent recovery | PASS |
| CTX-RU-004 | Financial weakness with bank cash stress | PASS |
| CTX-RU-005 | Financial weakness with complete current cash coverage | PASS |
| CTX-RU-006 | Concentration without documentary contract | PASS |
| CTX-RU-007 | Concentration with active customer contract | PASS |
| CTX-RU-008 | Marketplace model not ultimate customer | PASS |
| CTX-RU-009 | Canonical seasonality eligibility | PASS |
| CTX-RU-010 | Insufficient seasonality history | PASS |
| CTX-RU-011 | Debt service with known funded portfolio | PASS |
| CTX-RU-012 | Debt service with unresolved new obligation | PASS |
| CTX-RU-013 | Guarantorship separate from funded debt | PASS |
| CTX-RU-014 | Bank guarantee separate from funded principal | PASS |
| CTX-RU-015 | Historical delinquency with explicit current zero | PASS |
| CTX-RU-016 | Current overdue and explicit historical zero | PASS |
| CTX-RU-017 | Stale bureau current-state limitation | PASS |
| CTX-RU-018 | Personal owner BKI excluded | PASS |
| CTX-RU-019 | Same-fact accounting conflict | PASS |
| CTX-RU-020 | Cash-accrual relationship not conflict | PASS |
| CTX-RU-021 | Missing supplied bank month | PASS |
| CTX-RU-022 | Owner funding is not revenue | PASS |
| CTX-RU-023 | Factoring financing flow | PASS |
| CTX-RU-024 | Company age neutral calendar fact | PASS |
| CTX-RU-025 | Industry neutral | PASS |
| CTX-RU-026 | Region neutral | PASS |
| CTX-RU-027 | Exact canonical financing contract | PASS |
| CTX-RU-028 | Declared contract unmatched | PASS |
| CTX-RU-029 | Client seasonality claim is not proof | PASS |
| CTX-RU-030 | Multiple risks and independent contexts | PASS |
| CTX-RU-DEFECT-001 | Permanent CL-RU-DEFECT-001 semantics | PASS |

## Validation record

- Dedicated Context suite: 271 passed / 0 failed.
- Full regression: 1,595 passed / 0 failed (1,324 approved baseline + 271 Context tests).
- Existing Credit Lab tests: all 261 preserved and green in full regression.
- Existing Risk Golden: 31 PASS / 0 REVIEW / 0 FAIL; fingerprints unchanged.
- New Context Golden: 31 PASS / 0 REVIEW / 0 FAIL.
- Build, lint, artifact validation, strict Context typecheck: PASS.
- Repository TypeScript diagnostics: baseline 30 / current 30 / new 0.
- Candidate git diff --check: PASS.
- Approved source files unchanged by SHA-256 comparison; only new Context implementation/test/documentation files are delivered.
- Authoritative parity: 872 / A / Высокая готовность / 1,283,000–2,636,000 RUB.
- Additional prior-block defects: NONE.

## Representative performance

No hard millisecond acceptance gate. Local measurements are operational timings, not model accuracy.

| Workload/stage | Count | Milliseconds |
|---|---:|---:|
| Context fact adaptation | 1,000 | 968.24 |
| Rule evaluation | 1,000 | 77.36 |
| Relation construction | 1,000 | 81.35 |
| Summary | 1,000 | 3.17 |
| Canonical SOURCE_SNAPSHOT → Risk → Context | 200 | 438.50 |
| Financing-case normalization + Context | 1,000 | 1,241.89 |
| Repeated Context construction + stable comparison | 100 | 434.11 |

## Git delivery

One candidate commit, message `Build Context and Case Engine`, parent `bece6bc669106d304a6c92ba595e041c2ac77079`. No merge, force, additional lineage commits or unrelated cleanup. Remote main remains Block 8. No deployment and no Block 10 implementation.
