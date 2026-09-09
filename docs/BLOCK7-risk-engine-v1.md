# Block 7 — Stop Factors / Risk Engine v1

## Purpose and boundaries

Block 7 adds a lender-independent factual risk layer in SHADOW mode. Available canonical evidence produces four separate scopes: `GLOBAL_STOP`, `CREDIT_RISK`, `DATA_REVIEW`, and `INFORMATION`. Risk, bank eligibility policy, data confidence and product fit remain separate. Only GLOBAL_STOP can have BLOCKING impact. Severity does not change any authoritative score or decision.

Engine: `PRESCORE-RISK-ENGINE-1.0.0-SHADOW`.
Registry: `PRESCORE-RISK-RULES-1.0.0-PRE-CALIBRATION`.
Economic methodology: `PRESCORE_ANALYTICAL_PRE_CREDIT_LAB_V1`.

## Architecture and files

- `contracts/risk.ts`: RiskFact, RiskEvidenceRef, RiskRule, RiskRuleEvaluation, RiskFinding, RiskAssessmentV1, RiskComparisonSummary and optional integration contracts.
- `risk/adapters/`: separate bank, financial, legal, BKI, portfolio, reconciliation and integrity adapters.
- `risk/facts.ts`: pure orchestration of canonical adapters.
- `risk/rules/`: versioned registry, factories and legal, financial, cash-flow, credit-history and data rules. Portfolio/reconciliation data rules live in `data.ts`.
- `risk/engine.ts`: indexed facts, deterministic evaluations, suppression, ordering and summary; exported summary function also supports separate measurement.
- `risk/common.ts`: deterministic primitives, units, confidence and explicit freshness safeguards.
- `risk/legacy-comparison.ts`: terminology/methodology comparisons without changing legacy factors.
- `risk/integration.ts`: pure `buildRiskShadow({analysis, companyProfile?, asOfDate})` with failure isolation.
- `tests/risk-engine-v1.test.mjs`: dedicated boundaries, real canonical adapters, integration, regression and benchmark.

The core consumes RiskFacts, never Checko response shapes or raw bank transactions. No network, database, machine clock, random IDs, OCR or LLM is used in the core. Identical inputs and explicit asOfDate give identical output. Data is indexed by semantic code; BKI evaluations additionally use the obligation context. No repeated whole-analysis serialization per rule.

## Facts and evidence

RiskFact preserves company, semantic code, period, unit, knowledge (`KNOWN`, `PARTIAL`, `UNKNOWN`, `NOT_APPLICABLE`), origin (`REPORTED`, `DERIVED`, `PROXY`), confidence, sources, metric/finding references, evidence, calculation basis and warnings. Explicit zero/false can be KNOWN. Missing data remains UNKNOWN. Non-finite and incompatible units/types cannot enter numerical comparisons. Future/invalid periods are not current evidence. Duplicate conflicting fact IDs fail shadow safely; ambiguous multiple facts for a semantic key cannot silently clear a rule.

RiskEvidenceRef carries the source, metric/fact, actual value/unit, period, confidence, optional canonical obligation or reconciliation finding and raw reference. BKI source-local `subjectKey` is distinct from a real `portfolioObligationId`; a bureau row is never represented as a fabricated portfolio identity. Portfolio value evidence retains its original source references. Data-state count evidence explicitly proves only the presence of a canonical state, not the accuracy of an uncertain debt amount. Derived confidence cannot exceed the weakest dependency or evidence.

Every rule returns TRIGGERED, NOT_TRIGGERED, INSUFFICIENT_DATA or NOT_APPLICABLE. Missing input does not mean NOT_TRIGGERED. Findings are separate from the complete evaluation audit. Summary reports scope/severity counts, evidence confidence, coverage families and an explicit unknown global-stop state. It contains no risk score, PD, score penalty or approval recommendation.

## Rule registry and calibration

There are 40 versioned rule definitions. Repeated BKI evaluations retain a separate context per borrower obligation. `FACTUAL` marks direct factual signs/lifecycle observations; `PRE_CREDIT_LAB` marks analytical numerical thresholds; `DATA_QUALITY` marks completeness, integrity and consistency observations. Thresholds expose operator, value and methodology. Calibration is not claimed.

| Domain | Conditions and results |
| --- | --- |
| Legal lifecycle | Explicit current confirmed TERMINATED, LIQUIDATION or BANKRUPTCY_ACTIVE, with HIGH confidence: CRITICAL GLOBAL_STOP. Unknown/other status: INSUFFICIENT_DATA. |
| Address | Explicit unreliable address: MEDIUM CREDIT_RISK. Unconfirmed default false is UNKNOWN. |
| Enforcement | Detailed active amount / positive applicable annual revenue: >=5% HIGH, >=1% MEDIUM CREDIT_RISK; smaller amount LOW INFORMATION. Missing denominator: INFORMATION, no blanket stop. |
| Court/registry/inspection | Defendant claims and explicit inspection violations are INFORMATION. Bankruptcy/registry review messages are DATA_REVIEW; counts alone never establish active bankruptcy. A court claim is not confirmed liability. |
| Equity | Negative: CRITICAL CREDIT_RISK; zero: HIGH CREDIT_RISK. Never GLOBAL_STOP. |
| Net assets | Reported negative: CRITICAL CREDIT_RISK. Negative equity proxy: HIGH with PROXY origin only when usable reported net assets are unavailable. |
| Liquidity/capital | Current ratio <0.8 HIGH, 0.8–<1 MEDIUM. Negative working capital MEDIUM; deficit/current assets >=20% HIGH only with known positive current assets. |
| Profit/trends | Latest annual net loss HIGH; two consecutive comparable annual losses CRITICAL. Annual YoY revenue <=−25% HIGH, <=−10% MEDIUM. Interest coverage <1 HIGH, 1–<1.5 MEDIUM. |
| Debt service | Block 4 debt-service/operating-receipts ratio >40% HIGH; >25%–40% MEDIUM. Exactly 25% does not trigger, consistent with the explicit <=25% no-finding requirement. |
| Operating receipts | Compatible Block 4 PERCENT trend <=−25% HIGH, <=−10% MEDIUM. Canonical full-month and trend availability safeguards remain. |
| Concentration | Direct Top-1 >=50% HIGH, >=35% MEDIUM, only with concentration and identity coverage >=80%; majority intermediary flow prevents direct-customer interpretation. |
| Traceability | Unknown inflow and unclear cash/individual share >=20% HIGH DATA_REVIEW; >=10% MEDIUM DATA_REVIEW. No fraud claim. |
| Reconstructed liquidity | Negative reconstructed days: HIGH DATA_REVIEW. Adequately reconstructed low-liquidity share >=20% HIGH, >=10% MEDIUM CREDIT_RISK. |
| BKI current overdue | Known positive company-borrower overdue; reported maximum delinquency >=60 days CRITICAL, 30–59 HIGH, otherwise MEDIUM. Missing days do not erase known overdue. |
| BKI historical delinquency | >=60 days HIGH, 30–59 MEDIUM CREDIT_RISK; 1–29 LOW INFORMATION. Explicit zero only clears the applicable rule. |
| Portfolio | Unresolved obligation/conflict HIGH DATA_REVIEW; unknown funded principal MEDIUM (multiple HIGH); new obligation, unmatched debt payment and unsplit service MEDIUM DATA_REVIEW. |
| Reconciliation | Canonical identity conflict CRITICAL DATA_REVIEW, same-fact BFO/quarterly conflict HIGH DATA_REVIEW. Agreements/tolerance and cash-versus-accrual or stock relationships do not become adverse credit facts. |
| Sources | Missing/stale source MEDIUM DATA_REVIEW; failed source HIGH. Partial month MEDIUM, missing/overlap HIGH. Integrity confidence <50 HIGH DATA_REVIEW, 50–<70 MEDIUM. |

## Adapter methodology

### Legal

The adapter consumes current canonical CompanyProfileData fields and detailed legal records, not `profile.signals` or FinancialAssessment factors. Lifecycle normalization uses an exact conservative allowlist. Historical liquidation/bankruptcy messages cannot match active lifecycle by substring. Provider-source readiness, company identity, explicit source date and confidence gate lifecycle decisions. Default/unknown address false is not confirmed absence. Unknown or future active enforcement rows prevent a fake zero total. Inspection count alone is not an adverse fact.

### Financial

Financial Analysis v2 is authoritative for new financial facts; legacy profile finances are not substituted. Annual flow trends require the existing COMPARABLE_ANNUAL_YOY result. Interim reports are not annualized or compared with FY as YoY. Historical prior annual profit remains evidence with its actual amount; the latest annual report must meet current applicability. Reported net assets remain separate from equity proxy. Canonical unknown interest-coverage denominators stay unknown. Conflicting known same-period financial metrics retain both evidence sets and do not silently become a selected current value.

### Bank

Only BankStatementMetricsV2 is used. No raw transaction rescans and no changes to normalization, classification or Block 4 formulas. Economic period-dependent rules require a full supplied period without missing, partial or unresolved overlapping months. Full supplied coverage does not prove that all company bank accounts were provided.

Measured PARTIAL identity/concentration coverage can be used at >=80% with adequate confidence. A partial Top-1 above the threshold is a supported lower-bound adverse observation; a partial Top-1 below it cannot clear the rule. Marketplace/acquiring/platform flows remain outside direct customer concentration.

Liquidity share uses `max(lowLiquidityDays, nearZeroBalanceDays)` divided by inclusive reconstructed period days. These are nested day sets in Block 4, so they are not added. Both counts must be known, nonnegative, within the denominator and adequately confident. Full coverage and no reconciliation mismatch/incompleteness are required; the existing 740-day reconstruction cap is respected. Negative reconstructed balances remain data review, not a claim of reported bank overdraft.

### Credit history and portfolio

BKI uses the unchanged UploadedBkiAdapter and company-scope guard. Current overdue requires READY source and the existing 90-day freshness window. A valid older READY/STALE report can retain known historical delinquency with its original asOf, HISTORICAL_BKI_SOURCE_STALE warning and confidence capped at MEDIUM; an existing LOW remains LOW. Failed, invalid, future or wrong-company reports cannot establish historical borrower risk. Unknown fields and ambiguous zero remain unknown. Old READY BKI also contributes to separate SOURCE_STALE data review. Owner, director and third-party guarantor reports cannot seed borrower risk. Ambiguous legacy zero stays UNKNOWN. Bureau score, inquiry count and self-ban are not generically thresholded. Historical maximum delinquency is labeled as historical evidence; it is not invented as current overdue days.

CreditPortfolioV1 supplies current data states without rerunning identity/payment matching. Funded principal, contingent guarantee exposure, available limit and rate remain separate facts. Leasing/factoring/guarantorship are not added to funded principal. Current source evidence is preserved. Missing compact payment observations cannot become known zero unmatched/unsplit payments. Unsplit payment presence is conservatively exposed as data review without estimating principal or an invented materiality amount. Rates, free limits and near maturity do not trigger refinancing/product conclusions. Historical resolved conflicts do not by themselves establish current conflicted values.

### Reconciliation and source quality

Reconciliation evidence retains each finding.evidenceConfidence; aggregate confidence is the weakest included value (HIGH + MEDIUM becomes MEDIUM). LOW evidence remains LOW and the unchanged rule adequacy gate may return INSUFFICIENT_DATA. Reconciliation consumes existing outcomes; it does not recompute Block 6 comparisons or call portfolio-versus-seeding-BKI agreement independent confirmation. Identity conflict is data review, not wrongdoing. Source availability and integrity facts remain separate from economic facts. Readiness/status and explicit source dates are both respected.

Explicit freshness safeguards (days): legal 30, bank/BKI 90, annual financial 550, interim 270, new-obligation review window 90. These are visible data applicability constants, not calibrated borrower-risk thresholds. Older evidence is retained where historical semantics require it; it cannot establish a current lifecycle/current overdue. Portfolio current facts require portfolio.asOfDate to equal the requested asOfDate. Unsupported legal semantics and stale facts remain insufficient.

## Suppression and legacy comparison

Repeated annual loss suppresses the current-loss presentation while preserving its TRIGGERED evaluation and `suppressedBy`. Stronger current overdue suppresses historical delinquency only for the same obligation context. Different loans are never cross-suppressed. Stable finding ordering uses scope, severity, code and deterministic ID.

RiskComparisonSummary reports legacy factor/signal counts and explicit definition differences: bank policy excluded; data quality separated; UNKNOWN preserved; negative equity not a universal stop; BKI subject scope refined; guarantees separate; reconciliation conflicts data review; portfolio current facts separate. It neither labels legacy behavior wrong nor rewrites legacy factors.

## Integration, FREE/FULL and failure isolation

Only three existing files gain additive integration:

1. `lib/prescore.ts`: optional RiskShadowFields on AnalysisResult; build shadow after existing source/metrics/reconciliation/portfolio enrichment.
2. `app/api/source-documents/route.ts`: refresh risk after existing source/BKI/quarterly updates; persist optional shadow fields.
3. `app/api/conclusion/route.ts`: where analysis and profile already coexist, attach enriched shadow under the existing FULL gate. Existing risk context remains authoritative and unchanged.

No second Checko storage pipeline is created. Old analyses load without optional fields. FULL can return detail; the existing FREE allowlist remains byte-for-byte unchanged and drops all new risk detail. No UI/PDF is added. Pure helper catches adapter/rule errors and returns undefined assessment/comparison plus `RISK_ENGINE_SHADOW_UNAVAILABLE`; legacy outputs are not mutated to compensate.

## Verification and performance

Verification results are recorded below after final gates. Dedicated tests exercise real Block 4/5/6/6.5 outputs, boundary thresholds, missing versus zero, proxy/period/unit safeguards, source failures, company scope, suppression, evidence confidence, immutable inputs, FREE/FULL, serialization, shadow errors and authoritative parity.

Representative benchmark: 1,000 distinct companies, each with BankStatementMetricsV2, three financial periods, BKI, 12 portfolio obligations, 20 reconciliation findings and 116 RiskFacts. Full registry produces 62 contextual evaluations per company. Fixture cloning is outside phase timers. Rule evaluation timing includes its summary; summary is also measured separately, not subtracted to claim false precision. No hard millisecond acceptance gate.

## Limitations and future boundaries

No Bank Policy Registry, bank-specific stops, sector benchmarks, calibrated PD, statistical risk model, risk score or score penalty. Analytical thresholds are PRE_CREDIT_LAB. No Prescore Index, readiness, debt-capacity, limits, product selection or recommendation changes. No OCR, live OKB, covenant-breach engine or new tax-arrears provider. Legal registry semantics may be incomplete. Court claim does not equal liability; a provided bank account set may be incomplete. Missing source is not an adverse fact; unknown portfolio debt is not zero. Credit Lab may later calibrate versioned rules; future bank policies stay a distinct layer. Block 8 is not implemented.

## Git delivery

One commit-object directly on approved parent `99de1bbcf2d87287fec0d0eda7d15ed571ef92a9`, message `Build Stop Factors and Risk Engine`. No merge or cleanup commit, no branch update, no force and no production deployment. Remote main must remain at that parent. The final response provides the created SHA; the commit does not embed its own SHA.

### Final gate results

- Dedicated Block 7: **304 passed, 0 failed**.
- Full `npm test`: **1,054 passed, 0 failed** (750 existing + 304 Block 7); verified build included and successful.
- Lint: successful, no errors or warnings.
- Artifact validation: successful; ESM Worker `default.fetch` and hosting manifest present.
- Strict new-module TypeScript check: successful.
- Repository TypeScript diagnostics: **baseline 30 / current 30 / new 0**; unrelated diagnostics unchanged.
- `git diff --check`, including separate whitespace checks of every new file: successful.
- Authoritative parity: **872 / A / Высокая готовность / 1 283 000–2 636 000 ₽**.
- Final dedicated benchmark: **116,000 facts, 62,000 evaluations**; adaptation **2,078.76 ms**, evaluation including summary **625.17 ms**, separately measured summary **19.54 ms** for all 1,000 companies. Hardware/process-load dependent, not a latency guarantee.
- Existing-file diff: only the three additive integration files above. Existing Blocks 1–6.5 core modules, legacy tests, scoring, entitlements and UI remain unchanged.

### Final correction review

The replacement contains only the requested confidence propagation and BKI current/history applicability corrections, their regression tests and this documentation update. The integrity adapter recognizes old READY BKI as stale for the existing separate data-review rule. No rule registry, thresholds, contracts, scoring or Blocks 1–6.5 code changes. Twenty-four new dedicated regressions cover HIGH/MEDIUM/LOW and mixed reconciliation evidence; fresh/old/invalid/failed/wrong-subject BKI; ambiguous zero; historical confidence/date retention; unchanged fresh same-obligation suppression; and the exact 90-day boundary.

The full corrected Block 7 is delivered as one replacement commit directly on `99de1bbcf2d87287fec0d0eda7d15ed571ef92a9`, not as a child of candidate `cc7cc4b28eb3aa51dfe255988a7f50c4f70ce21f`. Remote main remains unchanged.
