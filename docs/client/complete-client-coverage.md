# Complete CLIENT credit frontend

Source staging: 6190b1d7b110950fc07e72a7ebe923f8d7f24037.
Protected main: 2ea25f26532396f3a90f2ccf6eb4f8dc534ca36c.

This change is presentation-only. No engines, formulas, persistence, authorization,
entitlements, parsers or provider calls are changed. No live client data is created.

## Engine / public contract / UI

| Engine output | Public contract | CLIENT component |
|---|---|---|
| Bank Statement | basic.bankingFacts, analysis, sources | BankingAnalysis + BankingLedger; executive subset in ClientOverview |
| Financial Analysis | report.financialAnalysis (new allowlist of existing history/trends) | FinancialAnalysisScreen |
| Credit Portfolio | report.analysisV3.portfolio, observations | PortfolioDepth; all published per-value provenance |
| Reconciliation | report.reconciliation (new allowlist) | ReconciliationScreen, linked report limitations |
| Risk | report.primaryFactors, detailedSections, limitations | Factors, CreditAnalysisScreen |
| Context | report.contextHighlights, detailedSections | Factors, CreditAnalysisScreen |
| Prescore Index | canonical.prescoreIndex.value, report.index | IndexPanel; components, maximum, confidence, evidence |
| Readiness | report.readiness | level/text/confidence/constraints, FactCard evidence and linked actions |
| Credit Assessment | report.hero, primaryFactors/contextHighlights | ClientOverview, CreditAnalysisScreen |
| Debt Capacity | canonical headline, report.capacity, analysisV3.financing/scenarios | DebtCapacityPanel |
| Product Selection | report.productFit, canonical candidate fitLevel | ProductFitScreen; grouping copies fit enum, never infers approval |
| Recommendations | report.recommendations.primary/backlog | RecommendationsScreen, ActionCard |
| Action Plan | report.actionPlan | timeline, focus, prerequisites, verification, monitoring, rerun |
| Explainability | canonical.explainability claims/sourceReferences/glossary | Evidence per conclusion and searchable ExplanationLibrary in Sources |
| Expertise | report.expertise.items | ExpertisePanel; knowledge/confidence/asOf/closure/application relevance |
| Analysis V3 | observations/portfolio/financing/scenarios | Sources, PortfolioDepth, DebtCapacityPanel |
| Sources / Integrity | basic.sources + report.sources/dataQuality/limitations | SourcesScreen; bank result is never conditional on extra sources |

## Workspace basic field coverage

- `analysis.id` / model.analysisId: selection scope, deep links, React keys; company name/INN, createdAt, period visible in Overview/context/history.
- `sources.statements`: status via Sources availability and observation, count/bankNames/accountCount/period shown in context/Sources; completeness/missingSources/availability and all availability periods shown.
- All 19 scalar banking facts: BankingLedger shows value, status, confidence and period. Unit is formatted, not recalculated (ratio to percent is display conversion only).
- `topCounterparties`: name, amount and share (stored ratio formatted as percent).
- `monthly`: month, coverage, operatingReceipts, externalInflows, externalOutflows, taxPayments, debtService in table; existing charts retained.
- `operations.documents`: status/count/analysisCount in Overview; Documents Hub retained.
- `operations.applications`: status/count/activeCount/statuses in Overview; existing persisted list/actions retained. Unknown active count is not zero.

## ClientReport field coverage and exclusions

| Field | Treatment |
|---|---|
| hero | headline/summary/status/confidence/globalStop visible; CTA intent is represented by direct screen links rather than internal anchor string |
| index | value/status/confidence/components incl. score and maximum; no policy weights |
| readiness | level/text/confidence and all constraints |
| capacity | headline/status/text/confidence/disclaimer/details, evidence |
| primaryFactors / contextHighlights | title/text/status/tone/confidence/why/impact/metrics/sources/actions/evidence |
| productFit | all primary+other, title (human product family name), fit/purpose/capacity/requested/missing/rank, disclaimer |
| recommendations | all primary/backlog action copy, steps/evidence/recheck/status/group/why/prerequisites |
| actionPlan | all horizon titles/dates/items; focus IDs resolved to priority labels, monitoring IDs resolved to actions, rerun factors |
| dataQuality / limitations | all client-facing factors, independently visible in Sources and credit |
| detailedSections | every user-facing title/factor in Credit, financial subset also in Financial; INDEX_CONTRIBUTION driver diagnostics excluded as internal policy metadata |
| sources | label/asOf/period/confidence; IDs only join evidence |
| expertise | every item, fact/interpretation/impact/limitation/nextStep/closure/knowledge/confidence/asOf/applicationStatus/category; membership sets and creditor lists are references to the same displayed items, not additional conclusions |
| analysisV3 | observations type/status/receivedAt/from/to; all portfolio values/provenance; all financing/scenario fields including upper headroom and assumptions |
| financialAnalysis / reconciliation | typed allowlisted copies of existing outputs, null when absent; no raw snapshots or calculationBasis |
| meta | asOf shown, entitlement handled by existing access UI. Versions/policyFingerprint/methodology/mode remain technical |
| company | same company shown in workspace heading |
| visual | factorActions used to connect factors/actions; capacityScale duplicates the displayed capacity values; componentStates/policyFingerprint are renderer metadata |
| printMeta | belongs to existing print report, not duplicated on every screen |
| technical | claim IDs and upstream versions are internal lineage; not primary client text |

Metric ids, claim IDs, binding codes, source IDs, canonical IDs, recommendation/factor/object IDs and category membership IDs are technical joins. They are not user-facing analytical results. Internal contribution/driver claims, policy weights, penalty bindings, modifier percentages, thresholds, registry versions/fingerprints and calculation formulas are intentionally not displayed. Evidence exposes claim copy, formatted values, source kind, source period/date/confidence, and warnings.

Financial projection excludes rawCode/rawLabel/rawValue, source envelope content hashes, original snapshots, calculationBasis, dependencies and internal metric codes. Snapshot IDs remain technical links between trends and displayed periods. Reconciliation excludes raw identifiers, formulas, policy tolerances and subject INN from BKI; ownership mismatch remains visible as a finding. New finding IDs are presentation-only sequence identifiers. Warning codes without a reviewed human translation are counted as additional source limitations; they are not rendered as purported new conclusions.

## Operations / source entry points

Applications, Documents Hub and AI Analyst retain existing components, endpoints and selected-analysis keys. No paid calls were run. New views reuse existing report/company module gates. Upload aliases and unavailable analysis behavior remain unchanged.

- Statements: existing TXT flow, no parser expansion or fake Excel/PDF banking upload.
- BKI: existing SourceUpload in Portfolio.
- Quarterly: existing SourceUpload in Financial.
- Company/BFO: existing CompanyData flow retained. A separate generic BFO file upload is not implemented; no fake button is introduced.
- History uses existing server company/period/date/banks/BASIC-FULL values. Source completeness is not present in StoredAnalysis; it is shown only for the selected WorkspaceModel, not invented for unselected analyses.

## Validation

`tests/complete-client-frontend.test.mjs`: all 24 business corpus analyses, user-facing report sections, immutable rendering, financial/reconciliation value preservation, FREE redaction, navigation, A→B→A, UNKNOWN versus zero, and four explicit source sets.

Existing Phase 1/2/3, workspace, application, document and AI tests remain required. One old static expectation for the navigation label “Предложения банков” is changed to “Финансирование”, as explicitly required by the new task.

Browser QA / staging deployment is a separate gate. A compilation or static render does not establish responsive visual PASS.

## Local QA evidence — 2026-10-10

- Final `npm test` (including production build): 6293 passed, 0 failed.
- Dedicated new CLIENT coverage: 32 checks/subtests in the full run, including all 24 business cases, four explicit source sets, internal-policy evidence redaction and A→B→A rendering.
- Phase 1/2/3 regression, workspace, application/document and existing AI checks: passed in the full run.
- `npm run lint`: passed.
- `npm run validate:artifact`: passed for the standalone Next artifact.
- Initial full run encountered one local HTTP keep-alive socket failure; the isolated 24-case HTTP rerun and subsequent final full `npm test` both passed. No test was weakened or retry logic added.
- Browser QA at 1440/1024/768/390/360: BLOCKED, Cloud Browser returns `credential_observation_restricted` after navigation to the staging dashboard in a newly created tab. No visual PASS claimed.
- Live staging acceptance / deployment: not performed; staging stays on the source SHA above. No external paid AI calls or real financial documents used.
- Engine/orchestrator/parser/auth/schema/application/document/AI source files match the staging source hashes. Main and DNS/production remain untouched.

Code may be saved as an unreferenced review commit, without moving any branch or triggering deployment. Release status remains BLOCKED until browser QA and staging acceptance pass.
