# Active recovery coverage and acceptance boundaries

This maps existing processing to the single active CLIENT/BROKER presentation. It is not a claim of live acceptance. Fresh-source API and component tests are in `tests/polish-source-enrichment.test.mjs`; browser evidence is produced by `scripts/qa/polish-source-browser.mjs`. Production acceptance is pending until all release gates and reviewed rollback/archive preview pass.

| Block | Processing / canonical result | Public model | Active presentation |
|---|---|---|---|
| 01 Source Integrity | screening and source envelope | basic.sources; full.report.analysisV3.observations | Documents, source quality and periods |
| 02 Normalization | normalized transactions and period coverage | basic.bankingFacts; source coverage | BankingLedger monthly table and provenance |
| 03 Classification | categorized external/operating/debt payments | basic.bankingFacts | BankingSnapshot and BankingLedger |
| 04 Banking Metrics | existing Metrics V2 results | basic.bankingFacts including seasonality | Overview, cash trend, liquidity, concentration, counterparties |
| 05 Financial Analysis | period-specific financial results | full.report.financialAnalysis | FinancialSnapshot and FinancialStatements |
| 06 Reconciliation | source comparisons and conflict | full.report.reconciliation | Analysis → source comparison |
| 07 Risk / Stops | findings and critical restrictions | full.report.primaryFactors; canonical.creditAssessment | Overview risks and Analysis factors |
| 08 Credit Lab | independent 24-case validation | QA only | Not a customer section |
| 09 Context | contextual findings | full.report.contextHighlights | Analysis factors and evidence |
| 10 Index | unchanged canonical index | full.canonical.prescoreIndex | Available-only CreditSummary; otherwise compact limitation |
| 11 Readiness | unchanged readiness | full.canonical.financingReadiness | CreditSummary and Analysis readiness |
| 12 Assessment | profile assessment and confidence | full.canonical.creditAssessment; report.hero | Credit conclusion and underlying evidence |
| 13 Capacity | recurring/near-term and scenario results | canonical.debtCapacity; report.analysisV3.financing | CreditSummary and existing Financing section |
| 14 Products | existing candidate fit | canonical.productSelection; report.productFit | FinancingProducts and overview preview |
| 15 Recommendations | existing canonical recommendations | report.recommendations | ActionItem and next-action preview |
| 16 Action Plan | existing ordered tasks | report.actionPlan | ActionPlan and evidence links |
| 17 Explainability | claims/source links | canonical.explainability | Why, Evidence, restored ExplanationLibrary |
| 18 Report | shared public report | full.report | Shared active components in CLIENT/CanonicalDossier; print page loads WorkspaceModelV1 |
| 19 AI Analyst | sanitized current snapshot | allowlisted WorkspaceModelV1 context | AI Analyst; local controlled mode with no separate score |

Known limitations retained deliberately: no contract inference from missing BKI, no zero substitution for missing financial fields, no annualization of quarterly flows, no invented current principal from dated BKI, no numerical before/after claim without a stored prior snapshot, and no claim that payout processing is active. The original engine fingerprints for all 24 cases remain the regression baseline.

Archive requires migration 0009, explicit UTC cutover, private preview count/IDs/hash, a reviewed rollback snapshot, and a matching population at execution. Preview/execute/verify/restore are CLI-only; data is not deleted. Normal CLIENT/BROKER/AI/report reads reject archived analyses. ADMIN archive is explicit. A new lead after cutover is preserved even if its company has archived history.

Deployment remains prohibited while release gates are incomplete. No domain switch, final tag, paid resources, staging start, or live billing activation is part of the current acceptance candidate.
