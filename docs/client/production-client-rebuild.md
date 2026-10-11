# CLIENT production rebuild — 2026-10-11

Product baseline: `cf4574adf24b39a22d9dc41e12fec38456678680`.
Active branch: `prescore-product-v1`. Acceptance is repository and isolated QA only;
Amvera, live HTTP checks, deployment, migrations and database cleanup are outside this task.

## Product

One `/dashboard` shell: Обзор, Анализ Prescore, Финансы, Обязательства,
Финансирование, Документы, Заявки, Кредитный аналитик. New analysis is an action.
Company, INN, access tier, statement state, period and saved version are header context.

`view=home` is an executive summary; `view=analysis` renders the existing public
canonical report with section navigation for conclusion, factors, capacity, financials, obligations,
financing, reconciliation, action plan and sources; source-linked evidence dialogs; the existing
Analysis V3 capacity/scenario component and canonical Expertise content. No financial
formula or credit decision is computed in React. Formatting percentages and chart
geometry do not change canonical values. `UNKNOWN` remains unknown, including known
zero versus missing values.

`/dashboard/report-v2?analysisId=…` authorizes the real saved analysis and routes to
its single active client presentation. `&print=1` retains the existing print renderer.
Credit Lab remains a separate staging verification surface, outside client navigation.

Retired from active CLIENT routing: CreditConclusion, ClientOverview,
client-credit-sections, client-source-sections, ExplanationLibrary. Those files remain
for regression coverage and safe comparison; they are not new competing routes.
Useful financial/reconciliation rendering was consolidated into client-financials,
with shared FactorRows and evidence dialogs.

Old links remain valid: company/sources → documents; reconciliation/recommendations
→ analysis; report → analysis; credit → obligations; offers → financing; crm →
applications; analyze → upload. Existing server module and read-only gates remain.

## 19-layer traceability

Paths below are repository-relative. Tests execute engines or actual API handlers;
file existence alone is not evidence. Canonical stages 05–17 are orchestrated by
`lib/credit-engine/production/orchestrator.ts:buildCanonicalCreditAnalysis`.

| Block | Actual entry | Input | Canonical output | CLIENT surface | Executable proof |
|---|---|---|---|---|---|
| 01 Source foundation | lib/prescore.ts / bank-statement screening and manifest | Uploaded 1C statement | Source manifest, integrity, coverage | Upload receipt; documents; header | tests/data-integrity.test.mjs; tests/bank-statements.test.mjs |
| 02 Normalization | lib/credit-engine/normalization/transaction-normalizer.ts:normalizeTransaction | Raw bank operation | CanonicalTransaction | Financial facts, without separate menu | tests/transaction-normalization.test.mjs |
| 03 Classification | lib/credit-engine/classification/classifier.ts:classifyEconomicTransaction | Canonical transactions | Economic classification | Flow, taxes, debt service | tests/economic-classification.test.mjs |
| 04 Banking metrics | lib/credit-engine/metrics/engine.ts:buildBankStatementMetricsV2 | Classified full-population transactions | BankStatementMetricsV2 | Overview cash trend; finance ledger | tests/bank-statement-metrics-v2.test.mjs |
| 05 Financial analysis | lib/credit-engine/financial-analysis/engine.ts:buildFinancialAnalysis | BFO and quarterly snapshots | Financial analysis history and trends | Finance; analysis financial-state section | tests/financial-analysis-v2.test.mjs |
| 06 Reconciliation | lib/credit-engine/reconciliation/engine.ts:buildReconciliation | Bank metrics, financials, BKI, manifest | Cross-source findings and comparison values | Analysis → Сопоставление данных | tests/reconciliation-v1.test.mjs |
| 07 Risk and stop factors | lib/credit-engine/risk/engine.ts:evaluateRiskFacts | adaptRiskFacts output | Risk assessment | Analysis risk hierarchy and verdict | tests/risk-engine-v1.test.mjs |
| 08 Credit Lab | lib/credit-engine/credit-lab/business-corpus.mjs; scripts/credit-lab-business.mjs | Synthetic source bundles | Full calculated pipeline acceptance | Staging infrastructure only | tests/credit-lab-business.test.mjs; tests/credit-lab-runtime.test.mjs |
| 09 Context/case | lib/credit-engine/context/engine.ts:buildContextAssessment | Risk, source analysis, financing case | ContextAssessment | Context and limiting factors | tests/context-engine-v1.test.mjs |
| 10 Index | lib/credit-engine/index/engine.ts:buildPrescoreIndex | Risk and context | PrescoreIndex 0–1000 and components | Executive metrics; analysis factors | tests/prescore-index-v1.test.mjs; tests/client-product.test.mjs |
| 11 Readiness | lib/credit-engine/readiness/engine.ts:buildFinancingReadiness | Risk/context/index | FinancingReadiness | Independent metric and explanation | tests/financing-readiness-v1.test.mjs |
| 12 Assessment | lib/credit-engine/credit-assessment/engine.ts:buildCreditAssessment | Readiness and preceding outputs | CreditAssessment | Verdict and expertise | tests/credit-assessment-v1.test.mjs |
| 13 Debt capacity | lib/credit-engine/debt-capacity/engine.ts:buildDebtCapacity | Assessment, portfolio, bank metrics, explicit scenarios | Monthly additional debt-service capacity | Summary; Analysis V3 financing detail | tests/debt-capacity-v1.test.mjs; tests/client-analysis-v3.test.mjs |
| 14 Product selection | lib/credit-engine/product-selection/engine.ts:buildProductSelection | Canonical assessment and capacity | Product candidates and fit | Financing mechanisms | tests/product-selection-v1.test.mjs |
| 15 Recommendations | lib/credit-engine/recommendations/engine.ts:buildRecommendations | Products, assessment, restrictions | RecommendationSet | Next action; full action plan | tests/recommendations-v1.test.mjs |
| 16 Plan | lib/credit-engine/action-plan/engine.ts:buildActionPlan | Recommendations and dependencies | Horizons, focus and rerun conditions | Analysis → План действий | tests/action-plan-v1.test.mjs |
| 17 Explainability | lib/credit-engine/explainability/engine.ts:buildExplainability | Canonical stages and plan | Claims, bindings, source references | Why dialogs and source periods | tests/explainability-v1.test.mjs; browser evidence dialog check |
| 18 CLIENT | lib/workspace/service.ts; public-model.ts; app/components/workspace/client.tsx | Authorized WorkspaceModelV1 | BASIC facts or FULL public report | Eight client sections | tests/client-product.test.mjs; scripts/qa/client-product-browser.mjs |
| 19 AI | lib/ai-credit-analyst.ts; app/api/ai-analyst/route.ts | Authorized current workspace/report | Canonical explanation and persisted chat | Кредитный аналитик | tests/ai-context.test.mjs; tests/workspace-recovery-phase3.test.mjs |

Credit Portfolio Foundation is retained within obligations and capacity; it is covered
by `tests/credit-portfolio-v1.test.mjs`. No missing BKI is interpreted as zero debt.

## Verification scopes

- Targeted integration: real API handlers against isolated PostgreSQL-compatible test
  runtime; upload, persistence, BASIC/FULL separation, broker/stranger authorization.
- Browser: actual client components with the same API handlers and synthetic fixtures,
  widths 1440/1024/768/390/360; all eight sections plus upload, every report section,
  no document overflow, eight menu items, evidence dialog Escape, version reload,
  mobile navigation and no runtime errors.
- Repository suite: all existing tests, with only retired presentation wiring assertions
  updated to the new user path. Canonical engine and authorization tests unchanged.
- Build, lint, standalone validation and standalone PDF extraction.
- `.github/workflows/prescore-product-qa.yml` provides the final repository gate;
  it does not deliver to Amvera.
- Local synthetic checks are not presented as proof of an external provider AI response.
  No deployment or live verification is required or performed for Product V1.

## Safety

No edits to canonical orchestrator, economics, entitlement logic, authentication,
database schema, production, DNS or protected main. No purge/reset/cleanup added.
No messages sent to banks. Recipient form adds an in-flight submission guard.

## Live integration finding: PDF runtime

An authenticated upload of the controlled synthetic BKI PDF failed on the original
staging with `DOMMatrix is not defined`. The production build had bundled PDF.js
without its dynamically required native canvas dependency. `next.config.ts` now keeps
PDF.js/canvas external and explicitly traces the PDF worker and Linux native canvas
package into standalone. A deployment-artifact text-extraction gate exercises those
copied dependencies before delivery. No parser or credit calculation was changed.

## Product V1 completion

The current shell and visual style are retained. `client-analysis` uses one canonical
report and includes the obligations and product surfaces inside the report as well as
in their dedicated cabinet sections. Embedded sections have section headings rather
than competing page titles. Risk factors are deduplicated by claim identity and linked
to existing canonical remedies and the 7/30/60 plan; no recommendation is computed
in React. Evidence dialogs localize enum values and preserve numerical values.

`product-copy.ts` explains product mechanisms and translates existing canonical
support/constraint reason codes. Fit, ordering, purpose alignment, capacity alignment
and missing inputs come from the current server model. Product fit remains explicitly
separate from a bank offer. The server allowlist `analysisV3Presentation` now publishes
maturity with its original knowledge, confidence, origin and observation date; it adds
no calculation and exposes no contract identifiers. A missing maturity stays unknown.

`client-documents.tsx` consolidates source status, period, received date when published,
analytical purpose and the next action. Company identifiers and uploaded-file counts
are taken from the workspace model. The overview describes banking completeness as
banking-field/period coverage, never as completeness of the whole credit assessment.

`use-model` retains the current model while refreshing the same analysis. Selecting a
different analysis never reuses the previous company's model. A failed refresh leaves
the mounted application list and search in place with an explicit stale-data alert and
retry. `Crm` exposes dates/history in read-only mode without create/cancel/chat controls.

Application save retries reuse the same request identity. The existing workspace API
returns a confirmed draft or recipient group on replay, rejects changed parameters,
normalizes duplicate recipients, and creates the draft plus audit/history in one existing
transaction. Concurrent retry acceptance uses real API handlers and the existing test
database, without schema changes. Authentication and ownership checks are retained.

New proof: `tests/client-completion.test.mjs` checks concurrent save/replay, ownership,
parameter mismatch, duplicate recipients, canonical maturity, UNKNOWN versus real zero,
and read-only application rendering. Product browser QA now also covers the new report
sections, source-limited business fixtures, all eight BASIC/unavailable sections,
read-only broker access, retained applications during refresh, failed refresh/recovery,
initial API error and the actionable no-analysis state.

Supported source boundaries remain explicit: banking import accepts TXT
1CClientBankExchange; generic uploaded files are stored, not parsed as statements;
BKI and quarterly inputs use their existing parsers; BFO/company retrieval uses the
existing open-data operation. Missing data receives an explanation/action, never
invented values. Availability of an external data provider remains a runtime condition.
