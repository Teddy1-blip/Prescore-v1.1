# CLIENT Analysis V3 — presentation contract and field map

Issue #3. Base staging a4443a00ab3568ab5256ada8d292f3813deb90e1.
No analytical engine, policy, weight, threshold, source fixture or fingerprint changes.
The canonical ClientReportModelV1 version remains compatible. Optional `analysisV3`
uses its own explicit `PRESCORE-CLIENT-ANALYSIS-PRESENTATION-3.0.0` version.
Old fixtures and old print renderer are unchanged. The extension is attached only
at the existing authorized server presentation boundary, after FULL checks, and
is absent for FREE. The pure canonical orchestrator and its model are unchanged.

| Client question | Canonical source | Presentation | Missing / partial |
|---|---|---|---|
| Whose analysis, when? | company, meta.asOfDate, sources.period/asOf; sourceObservations.receivedAt | Identity, fixed analysis cutoff, economic periods separately from received dates | Explicit date/period unavailable; never today() |
| Where do we stand? | index.value/status/confidence, hero | 0–1000 signal and stable value | No numeric curve, no invented zero or approval probability |
| Ready for financing? | readiness.level/text/constraints | Separate readiness area and disclosure | Existing UNKNOWN and constraints |
| How reliable? | hero.confidence, dataQuality, sources.confidence | Separate evidence summary and source cards | Existing missing/partial/conflict, no risk inference |
| Additional monthly payment? | capacity.headline/details; DebtCapacity headlineCapacity | Cautious headline, monthly RUB | UNKNOWN remains unknown; not a principal limit |
| Current debt service / boundaries? | DebtCapacity recurringView and nearTerm30dView, observedDebtServiceBasis, portfolioScheduledDebtService30d | Explicit basis switch, current load/cautious/upper/headroom from same view; independent observed/scheduled values | No mixed view; unknown/global stop suppresses chart; values retain knowledge/confidence |
| What principal at a given term? | DebtCapacity.scenarioResults plus SCENARIO reference provenance | Existing terms/rates/annuity and cautious/upper principal; scenario parameter selection only | No scenarios: request parameters, no default rate; unknown: no bars |
| Why and next action? | primaryFactors/contextHighlights, claim sourceIds/actionIds, visual.factorActions | Fact → explanation → existing impact → sources → linked action | No invented impact, bonus or causal link |
| Which mechanism? | productFit.primary/other | Existing fit/purpose/capacity/missing requirements | No lender offer, rate or approval invented |
| What to do in 7/30/60? | actionPlan.horizons/focusIds/items, recommendations | Canonical order, dependencies, evidence/recheck disclosures | No localStorage completion state or future credit promise |
| Which obligations? | CreditPortfolio.obligations type/exposure, currentTerms/currentPosition | Allowlisted current obligation details; no raw evidence, account/contract numbers | Full knowledge/origin/verification/confidence retained; no mixed exposure total |
| What limits conclusions? | limitations, detailedSections, printMeta | Disclosures and methodology footer | Independent facts remain visible in conflict case 022 |

## Implementation boundaries

`analysis-v3.ts` is a pure server-side projection: copies values, labels only known
synthetic assumption provenance, exposes no raw source payload or internal policy.
Type-only imports are erased from the browser bundle. No analytic imports in UI.
Financial number formatting and SVG geometry only occur in the browser; amounts
and scenario principal equivalents are never recalculated. Scenario results use
the canonical headline (minimum available view), not the interactively selected
individual basis. Both are explained separately on screen.

The existing `visual.capacityScale` is not used to infer a new base: each projected
view carries all of its own values. Missing projection on older fixtures is shown
as unavailable rather than fabricated. Source observation statuses are copied.
Portfolio partial/estimated/conflicted/zero semantics stay separate and visible.

The original print renderer and original CSS are preserved. `?print=1` is the
existing print presentation; V3 links to it with analysisId or allowlisted lab ID.
Real analysis branch still precedes lab; staging gate/auth/ownership/FULL unchanged.
The only legacy dashboard edit is the link label “Новый анализ Prescore · Index 0–1000”.
No replacement of legacy dashboard or Landing; no automatic production cutover.

## Motion and access

Finite first-display SVG strokes/bar reveal and disclosure/view transitions; no
numeric counting, random/live imitation, loops, parallax or scroll hijacking.
System prefers-reduced-motion disables animation/transitions with content intact.
Native buttons/aria-pressed, native disclosures and working in-document links.
A link into a closed action/factor reveals its ancestor disclosures. No persistence
of action progress. Sources and actions highlight with :target. Mobile menu native.
Responsive breakpoints support narrow columns and stacked tables without clipping.
Code/static tests are not a substitute for actual viewport/media browser checks.

## Not implemented in this stage

Saving scenario inputs/rates; lender offers; historical comparisons/snapshots;
AI explanations; new PDF engine; upload/payment workflows; AGENT/ADMIN redesign;
Landing reuse. Missing real-route scenario inputs are explicitly acknowledged.
Live-QA findings and tool-specific NOT_RUN are in the final acceptance protocol.
