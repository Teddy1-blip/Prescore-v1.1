# Block 6.5 — Credit Portfolio Foundation

Version: `PRESCORE-CREDIT-PORTFOLIO-1.0.0-SHADOW`. Mode: `SHADOW`.
Approved parent: `923d563f0860ac204f8547d81d590ab0b1f19594`.
This architectural insertion does not renumber the 19 main roadmap blocks. Block 7 is not implemented here.

## A. Product purpose

The company supplies evidence; Prescore assembles a temporal financing portfolio. This foundation supports a future permanent credit workspace rather than requiring the client to maintain a debt spreadsheet manually. It provides financial facts, dates, provenance and uncertainty. It does not make credit decisions.

## B. Architecture and files

`CreditHistoryProviderAdapter` → `CanonicalCreditHistorySnapshot` → `PortfolioObservation[]` → obligation identity index → temporal resolver → `PortfolioObligation[]`.

Canonical debt-document batches enter the same observation boundary. Existing classified bank transactions produce compact `DebtPaymentObservation[]`; the payment matcher links them to obligations and reported schedule events. The resolver builds positions, position checks, limits, events and a factual summary in `CreditPortfolioV1`.

New contract: `lib/credit-engine/contracts/credit-portfolio.ts`.
New modules under `lib/credit-engine/credit-portfolio/`:

| File | Responsibility |
| --- | --- |
| common.ts | Explicit value semantics, dates, confidence, evidence, deterministic IDs, field resolution |
| observations.ts | Canonical bureau and debt-document input boundaries; provider adapter interface |
| bki-adapter.ts | Existing uploaded CreditHistoryReport to independent canonical snapshot |
| obligation-matcher.ts | Creditor/contract/account/composite indexes and safe match outcomes |
| resolver.ts | Portfolio assembly, observations, historical updates, conflicts and events |
| terms.ts | Scalar terms, fees, covenants, reporting and insurance requirements |
| payment-observations.ts | Compact observations from existing canonical classifications |
| payment-matcher.ts | Evidence-based obligation and schedule linkage |
| position.ts | Confirmed-anchor principal derivation, limits and technical position checks |
| schedule.ts | Reported events and observed/partial/full schedule matches |
| events.ts | Deterministic factual events |
| summary.ts | Separate exposure aggregates, rate coverage and dated schedule summaries |
| integration.ts | Fail-isolated optional AnalysisResult shadow integration |

Existing files changed only at integration seams: `lib/prescore.ts` and `app/api/source-documents/route.ts`. Dedicated regression coverage: `tests/credit-portfolio-v1.test.mjs`.

## C. Provider-independent BKI / OKB layer

Providers supported by the contract: OKB, NBKI, SBKI, UPLOADED_FILE, OTHER. The generic adapter interface accepts provider-specific input and returns a canonical snapshot. A future OkbAdapter implements that interface; its raw API schema never enters the portfolio core. A mock canonical OKB path is tested. There are no live bureau requests, credentials, consent checks or billing calls.

## D. CanonicalCreditHistorySnapshot

A snapshot contains deterministic snapshotId, provider, companyInn, subjectInn, relationshipToCompany, affectsCompanyDebt, explicit requestedAt/asOf, sourceId, providerRequestId, rawSourceReference, contentHash, canonical obligations, confidence and warnings. Optional creditHistoryRequestId and consentArtifactId reserve request linkage. Raw provider payloads are not embedded.

UploadedBkiAdapter preserves supported creditor, account, product/status, opening/closing dates, amounts, limit, principal/total outstanding, next payment, monthly payment, rate/rate label, overdue/delinquency, collateral, guarantee and page evidence. A guaranteed obligation's expiry is distinct from loan maturity. A company acting as guarantor is preserved as GUARANTORSHIP / CONTINGENT, distinct from BANK_GUARANTEE. The underlying borrower principal, debt service and rate are not company funded facts or substitutes for guarantee exposure. An unsupported guarantee amount remains UNKNOWN. Report-level owner/director/third-party scope remains excluded. Company seeding requires compatible company/individual entrepreneur subject scope and affectsCompanyDebt=true.

## E. PortfolioObservation

Each immutable scalar observation has an observationId, observationGroupId, company identity hints, fieldCode, value/unit, knowledge, REPORTED origin, observedAt, effective bounds, confidence, evidence and warnings. observationGroupId links fields extracted for one source-local row; it is not canonical obligation identity. Uploaded BKI observationKey includes the source row ID and source content, so repeated weak hints cannot collide. Exact repeated rows deduplicate; duplicate row IDs with differing values retain distinct observations. Repeated weak/composite rows in one snapshot remain AMBIGUOUS before identity resolution, preventing a fabricated single debt. Stable contract/account/external evidence may still resolve genuine duplicates. Historical observations are retained for deterministic replay. Duplicate IDs carrying different content fail closed.

## F. PortfolioValue semantics

Knowledge: KNOWN / PARTIAL / UNKNOWN / NOT_APPLICABLE.
Origin: REPORTED / DERIVED / ESTIMATED / PROXY.
Verification: CONFIRMED / UNCONFIRMED / CONFLICTED.
Confidence: HIGH / MEDIUM / LOW / UNKNOWN.

UNKNOWN is null, never an inferred zero. Explicitly confirmed zero is KNOWN. Legacy BKI zeros require per-field source confirmation through optional adapter context; the old parser and serialized report are unchanged. Unsupported fields remain UNKNOWN. Non-finite values cannot become canonical numeric facts. Derived confidence cannot exceed its weakest dependency. Independent evidence may confirm a derived value without changing its DERIVED origin.

## G. Evidence

Evidence retains source kind/ID, bureau obligation ID (as source provenance only), provider/request ID, raw field/label/value/reference, source date, page hint and document/transaction references. Derived facts retain dependency evidence. Conflicting current facts retain both evidence sets and become CONFLICTED with DATA_CONFLICT events. Current supported replacement facts use their new source evidence; previous evidence remains in snapshots and histories.

## H. Obligation identity

Portfolio identity is `portfolio:<companyInn>`, independent of analysis ID. Obligation IDs use stable external agreement identifiers, creditor plus contract/account, or creditor plus opening date/original amount/known product. Mutable outstanding, rate, payment and utilization are excluded. Legacy BKI row IDs such as sb-1 and nbki-2 are never external agreement identifiers.

Name and INN aliases support later identity enrichment. Contradictory known creditor INNs, contract numbers or account references block automatic merging. Creditor name alone cannot choose between same-bank loans. EXACT_MATCH/STRONG_MATCH with adequate confidence may update an obligation. POSSIBLE_MATCH/AMBIGUOUS remain review candidates in obligationMatches, retaining observation history; they do not merge. Unresolved observations also prevent the summary from claiming a complete exposure total. Weak new identities are marked LOW and require future stronger evidence.

## I. BKI seeding and repeated updates

An initial company snapshot seeds supported obligations. Further snapshots are combined with previousPortfolio and retained observations; matching appends supported positions and changed terms without deleting prior evidence. Snapshots coexist. New obligations produce NEW_OBLIGATION_DETECTED. Absence produces OBLIGATION_ABSENT_NOT_CLOSED, never implicit closure. Reliable explicit closure with adequate identity produces OBLIGATION_CLOSED_OBSERVED. Current UNKNOWN fields do not become zero.

## J. Terms history

Each meaningful term change creates a deterministic terms version. RATE_CHANGED, MATURITY_CHANGED and LIMIT_CHANGED accompany TERMS_CHANGED. A balance-only change does not create a terms version. A later observation of rate 24% does not imply effectiveness from loan opening. An explicit addendum effectiveFrom is preserved separately from observedAt. Historical versions remain available.

Field resolution is date-aware and applied separately to each field. It uses source-supported observations and explicit effective dates, without a global provider ranking such as agreement > bureau > bank. Missing later terms do not erase earlier supported terms. Incompatible adequate-confidence current facts are conflicted instead of silently selecting a provider.

## K. Position history

Reported principal/total/drawn/available/overdue/contingent/next-payment positions have separate as-of snapshots. New bureau positions preserve old snapshots. When a new current view replaces an earlier derived position, the earlier derived view is retained with its origin and evidence. Observation history allows replay; no machine clock is used.

## L. Payment observations and pre-truncation boundary

Only LOAN_PRINCIPAL_PAYMENT, INTEREST_PAYMENT, DEBT_SERVICE_UNSPLIT, LEASING_PAYMENT and FACTORING_FEE produce observations. Generic supplier payments, bank fees and other outflows are not reclassified as debt payments here. Exact duplicate transactions are excluded. Observations retain canonical transaction ID, source, creditor/INN, purpose, contract references, date, amount and classification confidence.

Bank analysis builds compact observations from the complete classified transaction set inside addSourceFoundation, before analysisForStorage projects the transaction list to 10,000 rows. Compact observations are stored independently and survive that projection. Old analyses without observations return PAYMENT_OBSERVATIONS_UNAVAILABLE; the integration never backfills from a potentially truncated transaction list.

## M. Payment matching

Candidate indexes use creditor INN/name and product compatibility. Exact contract or account reference plus creditor evidence can match. Unique compatible creditor-INN obligation plus reported schedule alignment may match. Schedule alignment uses a three-day date window and an amount difference of at most max(1 RUB, 1% of scheduled amount). These are matching heuristics, not risk thresholds. Low classification/identity confidence prevents automatic linkage. Wrong creditor/contract/product is rejected; multiple viable candidates are AMBIGUOUS. Partial and multiple payments can link to the same reported event. Match evidence explains the relationship but never invents principal/interest components.

## N. Principal methodology and position reconciliation

Exact derived principal = confirmed reported anchor minus later adequately classified, matched PRINCIPAL components. Payments on/before the anchor are not subtracted. Interest, leasing and factoring fees do not reduce loan principal. Unsplit debt service makes the current exact principal UNKNOWN while preserving the anchor and observed debt service. The v1 engine does not estimate a split. Negative results are retained with DERIVED_PRINCIPAL_BELOW_ZERO and lower confidence.

A new UNKNOWN principal on asOfDate does not block derivation from an earlier confirmed anchor. An adequate current known report wins, and a CONFLICTED current principal is preserved rather than derived away.

A later bureau principal can be checked against a compatible derived expected principal. Tolerance is max(1,000 RUB, 1% × max(abs(expected), abs(reported), 1)). HIGH confidence, matching dates/concepts, strong identity and confirmed-anchor derivation are required for EXACT_MATCH/WITHIN_TOLERANCE confirmation. Other outcomes are DIFFERENCE_OBSERVED, INSUFFICIENT_DATA or NOT_COMPARABLE. These checks do not inject portfolio facts into Block 6 or count the seeding bureau snapshot as independent confirmation.

## O. Credit-line limits

Credit lines and overdrafts expose creditLimit, drawnAmount and availableLimit separately. Explicit line/overdraft principal semantics may support utilization equivalence. A term-loan original amount is not a free limit. For compatible known bases, available = limit - drawn, DERIVED with weakest confidence. Missing inputs do not create a value. Drawn exceeding limit remains a negative result with DRAWN_AMOUNT_EXCEEDS_LIMIT. Independent matching reported availability may confirm the derived result while retaining its origin.

## P. Leasing, factoring and guarantees

Funded principal includes supported loan/line principal only. Lease exposure is separate; remaining lease payments or reported total exposure do not become loan principal. Factoring remains separate, with recourseType retained and no automatic funded inclusion. Guarantees are contingent; guarantee amount/beneficiary/expiry/fees/collateral can be represented separately. There is no universal sum of loans + leases + factoring + guarantees.

Weighted annual rate uses known current funded outstanding weights, never original amount. Coverage is reported; unknown outstanding prevents a complete coverage claim. Highest known rate and nearest known maturity are factual IDs/dates, not refinancing or risk recommendations.

## Q. Schedule / calendar foundation

One reported BKI next-payment date and amount creates one payment event. No 12-month extrapolation is made. Canonical schedule observations can provide many events. Generic entries require explicit PAYMENT_DUE to count as payments; missing, UNKNOWN or invalid type becomes OTHER and is excluded from 7/30/60 payment totals. BKI next-payment semantics still support one explicit PAYMENT_DUE. Maturity, limit expiry, rate review, reporting, covenants, insurance and guarantee expiry have event types. Known reporting/insurance dates may create events; no invented due dates are generated.

The 7/30/60 summaries use explicit asOfDate and known reported PAYMENT_DUE events, not monthly-payment multiplication. Known subtotals and unknown coverage remain separate. A missing schedule is not confirmed zero; SCHEDULE_INCOMPLETE remains conservative because source coverage is not proven complete. These summaries are reported schedule amounts, not a newly inferred amortization or arrears schedule. A past date never creates an authoritative overdue/default event.

## R. Portfolio events

Deterministic events include detection, explicit closure, changed terms/rate/maturity/limit, reported positions, observed and matched payments, technical reconciliation and data conflicts. Events retain dates, explicit effectiveness, sources, evidence, confidence and warnings. They do not emit HIGH_RISK, STOP, APPROVE, DECLINE, readiness or product-action decisions.

## S. Future document / OCR boundary

DebtDocumentObservationBatch reserves agreement, schedule, leasing, factoring, bank guarantee, addendum, collateral, guarantee, insurance and other document kinds. It includes source/document/company identity, observedAt, obligation hints, observations and parser confidence. Future extraction outputs canonical facts through this seam; the portfolio does not parse files.

Scalar terms use their contract field names. Repeated structures use `schedule.<id>.dueDate/amount/principalDue/interestDue/type`, `fee.<id>.*`, `covenant.<id>.*`, `reporting.<id>.*`, and `insurance.<id>.*`. Tests exercise agreement seeding, multiple schedule entries, explicit addendum effectiveness, collateral evidence and insurance/reporting requirements without OCR or provider-specific parsing.

## T. Consent foundation

CreditHistoryRequest → consentArtifactId → provider request → CanonicalCreditHistorySnapshot can be linked through optional identifiers. ConsentArtifact is a reference contract only. No consent validation, signing, UI, provider submission or production workflow is implemented.

## U. Company-level persistence boundary

buildCreditPortfolio accepts previousPortfolio independently of AnalysisResult and is deterministic for identical canonical input and explicit asOfDate. There is no network, database, LLM, random UUID or implicit current clock in the core. Stable IDs are non-secret deterministic identifiers, not cryptographic authentication tokens. Future company-level storage can persist the output; this block uses the existing analysis JSON only.

## V. AnalysisResult, FREE / FULL and shadow failure

Optional fields: creditPortfolioV1, debtPaymentObservationsV1, creditPortfolioWarnings. Old serialized analyses remain compatible. FULL can contain these details through the existing full projection. FREE uses the existing explicit allowlist unchanged and does not expose obligations, positions, rates, schedules, collateral, matches, histories or evidence.

BKI upload invokes shadow assembly after its unchanged legacy calculation and Block 6 flow, using stored compact payments and previousPortfolio. Failures return undefined creditPortfolioV1 and CREDIT_PORTFOLIO_SHADOW_UNAVAILABLE. They do not rewrite scoring, legacy BKI reports/comparisons/insights, reconciliation or conclusions to compensate.

## W. Verification

Dedicated tests cover value semantics, provider snapshots, company scope, zeros, products, stable identities/reorder/enrichment, ambiguous resolution, histories, explicit closure, conflicts, payment classifications/matching, schedules, principal safety, limits, technical reconciliation, separate exposures, summary coverage, canonical documents, mock OKB, old data, truncation, FREE/FULL, shadow failures, parity and deterministic output.

Final validation results are recorded below. Repository TypeScript comparison uses the approved versions of the two edited existing files and excludes the new module/contract for the baseline, then compares diagnostic file/code/message tuples. Unrelated existing diagnostics are not repaired in this block.

## X. Performance

Representative dedicated test: 100 companies × 20 obligations, five reported position snapshots and five terms versions per obligation, 100 debt-payment observations and 100 schedule events per company. Total: 2,000 obligations and 10,000 each of positions, terms versions, payments and scheduled events. Measured locally with performance.now around the workload; no arbitrary time gate. Candidate indexes avoid blind cross-company matching. Histories remain in memory; this is not a production persistence benchmark.

## Y. Known limitations

- No OCR, arbitrary contract parser, image/PDF AI extraction or LLM document extraction.
- No live OKB API, credentials, bureau billing, recurring BKI refresh or production consent flow.
- No production debt-document upload UI, permanent company portfolio database, bank API or notification service.
- No covenant breach, insurance compliance, collateral haircut/LTV or guarantorship risk engine.
- No refinancing recommendation, Risk Engine, Debt Capacity, Product Selection or Recommendation changes.
- BKI may lack stable contract identifiers. Ambiguous observations remain review candidates; source row numbers are not treated as identity.
- Legacy zero ambiguity is conservative until explicit field evidence is provided to the adapter.
- Unsplit payments do not prove principal reduction; current exact principal may remain UNKNOWN.
- Provided statements may not cover all accounts. Matching and observed payment components do not prove complete company cash-flow coverage.
- Schedule completeness is not inferred from one next payment or monthly amount. The calendar is factual, not a reminder/arrears service.
- Position checks are internal technical checks, not new Block 6 rules or independent confirmation of a portfolio by its own seed.

## Z. Git delivery

One replacement GitHub commit object containing the corrected full Block 6.5 (not a child of candidate ecf51a1aad7f5fdd08368f7d0413272beb913bee), message `Build Credit Portfolio Foundation`, directly on parent `923d563f0860ac204f8547d81d590ab0b1f19594`. No merge/cleanup commit, branch movement, force push or production deployment. The commit's SHA is supplied in the delivery report; it cannot be embedded in its own tree. Main remains at the approved parent. Block 7 is not started.

## Final validation record

| Gate | Result |
| --- | --- |
| Dedicated Block 6.5 suite | 225 passed, 0 failed |
| Full regression (`npm test`, including verified build) | 750 passed, 0 failed |
| Build | PASS |
| Lint | PASS, no ESLint errors or warnings |
| Artifact validation | PASS: ESM Worker default.fetch and hosting manifest |
| Strict new-module TypeScript check | PASS |
| Repository TypeScript diagnostics | Baseline 30; current 30; new 0 (same file/code/message multiset) |
| `git diff --check`, plus new-file whitespace checks | PASS |
| Dedicated representative workload | 5,826 ms total for 100 companies, no hard timing gate |
| Authoritative parity | 872 / A / Высокая готовность / 1 283 000–2 636 000 ₽ |
| Existing-file scope | Only prescore.ts and source-documents/route.ts changed; all other existing lib/app/tests/docs hashes unchanged |

Validation commands:

```sh
node --experimental-strip-types --test tests/credit-portfolio-v1.test.mjs
npm test
npm run lint
npm run validate:artifact
npx tsc --noEmit --skipLibCheck --strict --allowImportingTsExtensions --target ES2022 --module ESNext --moduleResolution bundler lib/credit-engine/credit-portfolio/integration.ts
git diff --check
```

The new-file whitespace checks use `git diff --no-index --check /dev/null <file>`. Authoritative fixture assertions and immutable legacy-object checks run in the dedicated suite; existing Blocks 1–6 tests run in the full suite. The controlled TypeScript baseline host substitutes approved parent versions of the two edited files, omits the new module/contract from baseline root files, and compares diagnostic file/code/message tuples with current sources. Incremental compilation is disabled only for this in-memory diagnostic comparison, not changed in repository configuration.

## Final correction review

The replacement addresses only company-level guarantorship, source-local BKI row grouping and ambiguous composites, unknown generic schedule types, and current UNKNOWN principal derivation. Report/subject scope protections remain unchanged. GUARANTORSHIP is contingent and distinct from BANK_GUARANTEE; borrower principal is never substituted for guarantee exposure. Missing/invalid generic event types use OTHER, never PAYMENT_DUE. A current principal conflict is preserved; an unknown current report may use the established confirmed-anchor methodology.

Correction regression: 225 dedicated tests and 750 full-suite tests pass. Build, lint, artifact validation and strict module typecheck pass; repository diagnostics remain 30 baseline / 30 current / 0 new. Representative workload: 5,826 ms for 100 companies with the previously documented counts. Legacy parity remains 872 / A / Высокая готовность / 1 283 000–2 636 000 ₽.
