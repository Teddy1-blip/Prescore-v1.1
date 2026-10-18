# Prescore Client Launch V1

Status: **ACTIVE LAUNCH CONTRACT**  
Branch: `prescore-live-product-recovery-v1`  
Starting product SHA: `e1f60b4143ccf6763c6aef306ec5dba8789223d8`  
Production changes: **FORBIDDEN until M4 is accepted**

## 1. Launch goal

Launch one complete client journey, not another platform layer:

```text
empty cabinet
→ bank statement
→ useful free result
→ clear paid value
→ full bank-only analysis
→ BFO enrichment
→ BKI enrichment
→ quarterly enrichment
→ one concrete next action
```

Prescore V1 is accepted only when a new client can complete this path without help and understand after every step:

1. what Prescore learned;
2. what changed;
3. why it matters;
4. what to do next.

## 2. Product promise

> Prescore shows whether a business is ready for financing, what debt load it can reasonably service, what may cause a refusal, and what to do next.

Prescore V1 is an explainable pre-credit analysis and financing-readiness product. It must not present itself as a bank approval, a bank offer, or a statistically calibrated probability of default.

## 3. Client states

### S0 — Empty cabinet

Primary action: **Upload bank statement**.

Do not show empty Index, Readiness, Capacity, BFO, BKI, AI, or applications as competing starting actions.

### S1 — Processing

Show the current step and preserve the uploaded file. A temporary open-data failure must not fail the bank-statement analysis.

### S2 — Free bank result

Show real value from statements:

- analyzed period and coverage;
- operating inflow and monthly average;
- inflows, outflows and net cash flow;
- ending, average and minimum balance;
- low-liquidity days;
- customer concentration;
- observed tax and debt-service payments;
- one strongest positive factor;
- one most important risk or limitation;
- data quality and missing sources.

Do not disclose the complete risk set, complete recommendations, product selection, action plan, Capacity, PDF, or full explainability.

Primary action: **Open full analysis — 6,500 RUB / 30 days**.

The paywall must name the result being purchased, not merely say “subscription”.

### S3 — Paid bank-only result

Show a useful credit conclusion even before BFO and BKI:

- confirmed banking facts;
- full bank risks and strengths;
- preliminary assessment;
- honest limitations;
- why Index, Readiness, or Capacity may still be unavailable;
- one ordered next source.

Primary action when BFO is missing: **Add accounting statements**.

### S4 — BFO enrichment

The screen must show a delta, not only a new table:

- what financial facts were added;
- comparison of accounting revenue with bank inflow;
- profit, capital, assets, debt and ratios;
- what changed in Index / Readiness / assessment;
- why the result changed;
- confidence change;
- next missing source.

Primary action when BKI is missing: **Add corporate credit history**.

### S5 — BKI enrichment

Show:

- active obligations;
- current principal and limits;
- monthly payment / schedule when disclosed;
- current and historical delinquency separately;
- reconciliation with statement payments;
- Capacity only when the required facts are reliable;
- what changed and why.

Primary action: add quarterly reporting when it materially improves current-period assessment, otherwise go directly to the result route.

### S6 — Quarterly enrichment

Quarterly data must explain current dynamics:

- latest as-of balance position;
- cumulative-period revenue/profit correctly marked;
- trend versus comparable periods;
- no addition of cumulative Q1 / H1 / 9M values;
- effect on the conclusion and next action.

### S7 — Result route

Every complete result must end in exactly one primary route:

#### READY_FOR_FINANCING

Show indicative amount or payment capacity when valid, suitable product families, missing documents, and key limitations.

Primary action: **Create financing request**.

#### NEEDS_PREPARATION

Show no more than three prioritized measurable tasks, each with reason, target, verification source and recheck date.

Primary action: **Start improvement plan**.

#### INSUFFICIENT_DATA

Show the smallest set of critical missing facts and the single most useful next source.

Primary action: **Add missing data**.

## 4. Free / paid boundary

| Capability | Free | Paid |
| --- | --- | --- |
| Statement upload and bank facts | Yes | Yes |
| Short bank conclusion | Yes | Yes |
| One positive and one risk | Yes | Yes |
| Full risks and strengths | No | Yes |
| Prescore Index when valid | No | Yes |
| Readiness / Assessment | No | Yes |
| Capacity | No | Yes |
| Reconciliation across sources | No | Yes |
| Product selection | No | Yes |
| 7/30/60 action plan | No | Yes |
| PDF and AI explanation | No | Yes |
| Recalculations during access period | No | Yes |
| Financing request | No | Yes |

## 5. UX rules

1. One dominant primary action per state.
2. Missing data must not occupy more visual space than available facts.
3. Never display `UNKNOWN` as zero or as absence of risk/debt.
4. Every important value must retain source, period and as-of date.
5. Every new source enriches the same `analysisId`.
6. After every source upload show **what changed**, not just “document saved”.
7. Detail and evidence are available on demand; they do not lead the first screen.
8. CLIENT, BROKER, PDF and AI read the same canonical result.
9. No direct promise of bank approval or approved amount.
10. No new feature may be added before the launch path is accepted.

## 6. Existing recovery assets

The starting recovery already contains reusable pieces:

- clean empty state and explicit statement upload;
- no automatic selection of the first historical analysis;
- `WorkspaceModelV1` basic/full separation;
- bank facts and statement snapshots;
- entitlement-based BASIC/FULL access;
- checkout entry point;
- BFO, BKI and quarterly uploads into an existing analysis;
- manual open-data request;
- full credit analysis, recommendations and action plan;
- financing request and broker-reviewed applications;
- CLIENT/BROKER use of the canonical model;
- archive migration and recovery tests.

These pieces must be reorganized, not rebuilt.

## 7. Confirmed launch gaps

### G1 — Free result is not yet a deliberate sales screen

The current free overview contains useful bank facts and an upgrade component, but it is not yet constrained to one value story, one positive factor, one risk and one purchase action.

### G2 — Paid overview exposes a product library rather than a guided sequence

The current cabinet has many available sections. The client needs a state-driven overview and one ordered next action before browsing details.

### G3 — No source delta contract

After BFO/BKI/quarterly upload, the UI confirms that the document was saved but does not consistently show before/after assessment, newly confirmed facts, confidence change and reason.

### G4 — Open data is manual

Open data is currently requested by a client button. The launch path requires cache-first automatic enrichment after INN is known, with graceful failure.

### G5 — Action layer is not authoritative

Recommendations, product fit, applications and plans exist, but the dashboard does not yet resolve them into one of the three commercial routes with one primary CTA.

### G6 — Economic golden acceptance is still missing

Green technical tests do not yet prove correct period semantics, source authority and absence of double counting across BFO, quarterly reporting, BKI and statements.

## 8. Delivery milestones

### M0 — Contract and focused audit

Deliverables:

- this launch contract;
- exact current-state gap map;
- one implementation task for M1;
- no production change;
- no full GitHub Actions run.

Status: **IN PROGRESS**.

### M1 — Free → paywall → paid bank-only

Scope:

- make the free result useful and deliberately limited;
- make paid value explicit;
- make the paid bank-only overview coherent;
- enforce one CTA in each state;
- do not change scoring formulas or source engines.

Targeted validation only:

- empty-state browser flow;
- statement upload flow;
- BASIC rendering assertions;
- FULL rendering assertions;
- entitlement regression;
- typecheck/lint for changed files.

### M2 — Progressive enrichment

Scope:

- automatic cache-first open-data enrichment;
- BFO/BKI/quarterly enrich the same analysis;
- source delta after every upload;
- ordered next-source recommendation;
- graceful external-source failure.

### M3 — Action layer

Scope:

- resolve canonical result into READY_FOR_FINANCING / NEEDS_PREPARATION / INSUFFICIENT_DATA;
- one primary CTA;
- financing request or measurable improvement plan;
- no direct automatic bank submission in V1.

### M4 — Golden end-to-end acceptance

One synthetic company through the real UI:

```text
registration
→ statement
→ free result
→ test payment / FULL access
→ BFO
→ BKI
→ quarterly
→ final route
→ same analysis in CLIENT / BROKER / PDF / AI
```

Required semantic assertions:

- annual and cumulative quarterly flows are not added together;
- balance values use the correct as-of date;
- historical BKI balance is not current balance;
- missing value is not zero;
- the same debt payment is not counted twice;
- Checko/open data does not silently override a stronger uploaded source;
- every score movement is traceable to facts and rules.

Run the full suite only after the targeted flow passes.

### M5 — Controlled production release

Only after M4 acceptance:

- final green release gate including runtime startup;
- PostgreSQL 17 logical backup and platform snapshot;
- `/data` backup;
- archive preview and manual review;
- exact-SHA deployment;
- migration `0009`;
- archive execute/verify;
- restart persistence check;
- fresh live analysis;
- `prescore.ru`, SSL and `prescore-v1.0.0` tag.

## 9. Explicitly deferred from V1 launch

- new scoring formulas;
- machine-learning PD model;
- bank approval probabilities;
- direct bank API submission;
- marketplace expansion;
- government procurement features;
- new CRM platform;
- international localization;
- redesign of ADMIN or BROKER beyond consistency with the client result;
- new AI scoring logic.

## 10. Limit-preserving execution policy

- use the existing recovery branch;
- one implementation commit per milestone;
- inspect before editing;
- targeted tests during M1–M3;
- full test suite only after M3 and before production;
- do not upload new GitHub Actions artifacts solely for interim QA;
- do not deploy partial milestones;
- record each accepted SHA and next gap in this document.

## 11. Immediate next task — M1 implementation brief

Work only in the client presentation/access layer unless a proven defect requires a narrower dependency change.

Expected primary files:

- `app/components/workspace/client.tsx`
- `app/components/workspace/client-insights.tsx`
- `app/components/workspace/presentation.tsx`
- `app/components/workspace/client-product.css`
- focused client/entitlement tests

Do not modify:

- score weights or rules;
- canonical engines;
- BFO/BKI parsers;
- migrations;
- production workflows;
- ADMIN/BROKER product scope.

M1 acceptance sentence:

> A new user uploads a statement, understands the free result, understands exactly what 6,500 RUB unlocks, and after FULL access sees a useful bank-only conclusion with one clear next step.
