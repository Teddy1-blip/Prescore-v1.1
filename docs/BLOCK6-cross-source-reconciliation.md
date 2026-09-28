# Block 6 — Cross-source Reconciliation Engine

Version: `PRESCORE-CROSS-SOURCE-RECONCILIATION-1.0.0-SHADOW`.
Mode: SHADOW. Parent: `bf4e9d6814c3852abb24c07ec3d2063481db48a5`.
Commit message: `Build Cross-source Reconciliation Engine`.

## A–C. Architecture and canonical facts

Canonical Block 4 metrics, Block 5 snapshots/analysis and the existing BKI report
enter independent fact adapters. The engine executes a registry of six rules over
provider-independent facts. It never parses source documents or requests provider data.
Reconciliation is factual evidence; no finding changes scoring or underwriting.

New files:

- `lib/credit-engine/contracts/reconciliation.ts`: versioned contracts and optional attachments.
- `lib/credit-engine/reconciliation/facts.ts`: bank, financial and BKI fact adapters.
- `periods.ts`, `alignment.ts`, `common.ts`: dates, calendar alignment, confidence and findings.
- `rules/identity.ts`, `financial-same-fact.ts`, `bank-vs-revenue.ts`, `bank-vs-cash.ts`,
  `bki-vs-borrowings.ts`, `bki-vs-debt-service.ts`: independent registered rules.
- `engine.ts`, `legacy-comparison.ts`, `integration.ts`: execution, comparison and fail-closed attachment.
- `tests/reconciliation-v1.test.mjs`: dedicated methodological and integration regressions.
- This document.

Only three existing files receive wiring: `lib/prescore.ts`,
`app/api/source-documents/route.ts`, and `app/api/conclusion/route.ts`.
Blocks 1–5 modules, Checko calculations, quarterly/BKI parsers, legacy comparisons,
risk context, UI, PDF and AI source files remain byte-identical to the prior baseline.

Facts retain semantic code, numeric/text value, unit, knowledge status, evidence
confidence, company/subject INNs, entity scope, debt applicability, source IDs and
flow/snapshot/identity dates. Financial rawCode/rawLabel are preserved distinctly.
Bank facts retain source metric code; derived facts list dependencyFactIds and formula.
BKI facts identify the summary field and knownValues confirmation. Guarantee exposure
is a separate fact and is never added to principal.

## D–E. Period and subject alignment

Accounting flows require identical from/to; balance facts require identical asOf.
Q1 standalone and 3M YTD can match when exact Jan–Mar boundaries coincide. Annual,
9M, 6M and standalone Q2 are never rescaled to manufacture comparability.

Bank operating flows use only Block 4 monthly.operatingReceipts for the exact expected
calendar months. Every month must exist once and be FULL; complete month boundaries
are required. PARTIAL, MISSING, OVERLAP, duplicates and unavailable amounts prevent
complete-flow comparison. A wider bank history is subset without extrapolation.
Calendar utility bounds malformed spans at 1,200 months; this is a defensive input
bound, not financial policy.

SourceEnvelope company INN is checked against the dossier. Canonical snapshot identity
is also checked. A genuine known company mismatch is CONFLICT requiring data review;
failed/unknown source identity is insufficient evidence.

BKI scope comes from subjectInn, relationshipToCompany and affectsCompanyDebt.
Only company/IP borrower reports with a matching known INN and explicit true debt
applicability enter company debt relationships. Owners, guarantors and directors
are not silently converted to company borrowers. Personal INNs do not create false
company identity conflicts merely because they differ from the dossier.

## F, L. Same accounting facts

REC-FIN compares REPORTED BFO and quarterly balance/income fields, including reported
net assets, only on an aligned economic basis. Equity proxies are excluded.
Exact equal values give AGREES. Technical tolerance is:

`max(2 * max(sourceScaleA, sourceScaleB, 1), 0.001 * max(abs(a), abs(b), 1))`.

Differences within tolerance give WITHIN_TOLERANCE; larger same-fact differences give
CONFLICT with requiresDataReview. This neither assigns blame nor alleges fraud.
Missing versus reported zero is insufficient data. Two unavailable fields are omitted.
Unaligned fields generate one diagnostic per source-period pair, preserving an example
of the actually unaligned fact. Comparable balance facts can coexist with unaligned flows.

## G–H, M. Cash/accrual and cash-stock relationships

REC-REV compares aligned operating cash receipts with accounting revenue. Financing,
factoring, owner funding, refunds, internal transfers and unknown inflows cannot replace
the Block 4 operating definition. Marketplace and acquiring settlements remain included
according to Block 4. The outcome is RELATIONSHIP_OBSERVED even when values differ greatly.
Reasons describe cash/accrual, VAT/presentation, advances, receivable timing and the
unproven completeness of the company-wide bank account set.

REC-CASH compares ending bank balance with canonical CASH (RAS 1250) only on identical
dates. It is a STOCK_VS_STOCK relationship, not an accounting conflict. Cash equivalents,
non-bank cash and account-scope differences are explicit reasons.

Differences are absolute magnitudes, with a separate signed direction. Relative
difference uses the absolute right denominator; ratio uses a strictly positive right
denominator. A zero denominator leaves ratio null; overflow leaves the derived numeric
result null with NON_FINITE_RESULT. Unknown never becomes a synthetic zero.

## I–J. BKI relationships

REC-BKI-1 compares known outstandingPrincipal to canonical total borrowings (1410 + 1510;
both required). It selects the nearest financial asOf, with deterministic tie-breaking.
Zero-day gap is EXACT_ASOF; 1–45 days is NEAR_ASOF; larger gaps are not comparable.
The 45-day constant is temporal comparability only. Non-bureau and non-bank borrowing
definitions remain explicit reasons; even exact-date differences are not conflicts.

REC-BKI-2 requires a known current payment, known report date and 3–6 complete FULL
bank months with no missing, partial or overlapping month. Bank end must be within
45 days of report date. Observed monthly loan service is
`(loanPrincipalPaid + interestPaid + unsplitDebtService) / fullMonths`.
Every component must be known and cover the bank period. Leasing and factoring fees
are excluded. Unsplit service is disclosed and caps relationship confidence at MEDIUM.
Seven/twelve-month averages are not compared with a current schedule; no recent slice
is invented without canonical monthly loan-only components. A payment not observed
in provided accounts does not prove absence of a loan.

## K, N–O. Confidence, legacy comparison and extension

Confidence cannot exceed the weakest required fact/source/parser. Numerical source
confidence is mapped conservatively to UNKNOWN for absent/non-finite, HIGH at 80+,
MEDIUM at 60–79, otherwise LOW, and remains bounded by existing canonical confidence.
STALE caps at MEDIUM (existing LOW stays LOW); unavailable sources are UNKNOWN.
Different cash/accrual values do not reduce source fact confidence by themselves.
Comparability, evidence confidence and source-family availability remain separate.

Legacy comparison retains the existing annualized bank-flow estimate and debt-payment
amount alongside period-aligned reconciliation amounts/ratios and explicit methodology
reason codes. It does not replace buildCombinedInsights or creditPortfolioComparison.

`reconcileFacts(dataset, rules)` accepts a rule registry; semanticCode is open and EIS
remains a SourceType. An external future adapter can supply canonical procurement facts
and a rule without changing existing rules or adding provider dependencies to the core.

## Integration and entitlement boundary

Bank analysis rebuild and quarterly/BKI upload rebuild the optional attachment.
The helper filters financial snapshots against current source IDs/content hashes and
uses current source status, so replaced quarterly versions cannot leak into findings.
Exceptions clear prior optional results and emit RECONCILIATION_SHADOW_UNAVAILABLE.
Authoritative calculations still succeed.

BFO remains on CompanyProfileData. The existing FULL-only conclusion API combines
profile and analysis in memory on every request, after independent legacy evaluation.
It does not persist duplicate BFO data or feed reconciliation into risk decisions.
The analysis FREE allowlist omits all reconciliation fields; FULL and JSON storage
can retain them. Old serialized analyses continue to load without new fields.

## P–X. Verification

- Dedicated Block 6: 167 passed, 0 failed, including real Block 4 classification-output cases.
- Full suite: 525 passed, 0 failed (all 358 existing tests retained).
- Build: PASS via the existing verified build used by npm test.
- Lint: PASS, zero errors/warnings on the final run.
- Artifact validation: PASS, ESM Worker default.fetch and hosting manifest verified.
- Strict new-module TypeScript check: PASS.
- Repository-wide TypeScript diagnostics: 30 baseline / 30 current, identical; zero new.
- Tracked/new-file whitespace validation: PASS.
- Representative workload: 100 companies with bank metrics, five annual BFO snapshots,
  one quarterly snapshot and BKI; 4,200 findings; 483.2 ms in the final full-suite run.
  Measurement only, no time threshold. No transaction rescanning in the reconciliation core.
- Approved parity: 872 / A / Высокая готовность; limits 1,283,000–2,636,000 RUB.
  Authoritative fields remain unchanged by shadow attachment.

## Y–Z. Limitations and delivery

Provided bank statements do not prove completeness of all company bank accounts.
Old BKI summaries without knownValues fail closed for unproven amounts. No new OCR,
provider APIs, EIS integration, bank policies, benchmarks or risk verdicts are included.
BFO joins are transient at the existing FULL endpoint; bank-only persisted attachments
do not claim to have already incorporated a profile refreshed elsewhere.
Tests are offline canonical/integration regressions, not production uploads or live
provider verification. The global TypeScript baseline has the 30 pre-existing diagnostics
described above. Unchanged binary assets are preserved in the approved GitHub base tree.

Deliver one commit directly on approved Block 5. Remote main remains at Block 5;
no branch update, force push, production deployment or Block 7 work is authorized here.
