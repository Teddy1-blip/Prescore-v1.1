# Prescore Expertise Layer V1

Issue #4; staging only. Contract `PrescoreExpertiseV1`, version
`PRESCORE-EXPERTISE-1.0.0`. Block 19 provider AI remains disconnected.

## Data flow and invariants

Source parsers → unchanged canonical orchestrator → existing public report/V3
projection → deterministic `buildExpertise` → FULL screen and print memo.
The orchestrator does not import Expertise. Thus the full canonical result and
all existing economic hashes remain unchanged. No clock, policy, engine, raw
source document, legacy score/readiness/limit, network or database is used here.

| Canonical source | Expertise output | Restriction |
| --- | --- | --- |
| INDEX_VALUE, READINESS, CAPACITY claims | Credit memo | Partial status and uncertainty remain; no approval score |
| Recurring Debt Capacity POSITIVE headroom state, HIGH confidence, KNOWN debt anchor | Evidence of calculated recurring service ability | Only that basis; not overall readiness or bank approval |
| HIGH POSITIVE_CONTEXT claims | Corroborated strengths | No strength inferred from absence of negative evidence |
| Negative findings and risk data limitations | Attention / creditor review | Data limitations are not financial negatives |
| Independent recurring and near-term capacity claims | Deal structure bases | No recomputation or combining bases |
| Product fit claims | Possible mechanisms | Original fit/missing requirements, no bank-specific prediction |
| Existing numeric scenario claims | Principal equivalents | Only actual scenarios, no default rates/terms; not factoring/guarantee/leasing limits |
| Recommendations, readiness constraints, portfolio gaps | Pre-application questions | Existing evidence and recheck; no invented closure evidence |
| Existing day-7 focus | Next step | Existing action only |

Every item has a stable ID, upstream claim IDs, source reference IDs, affected
objects, independent confidence/knowledge, asOfDate and linked actions/factors.
All model layers must share the analysis asOf; older evidence observations retain
their own dates in the existing source section. No opening-time date is invented.

Validator rejects orphan/mixed-date/unsupported statements, unknown strengths,
bank promises and extra fields. Exact deterministic re-derivation validates the
complete text and lineage, not merely existence of one arbitrary claim ID.

FREE projection removes injected expertise server-side. The renderer also guards
FULL. Auth, ownership and entitlement resolution are unchanged. No new route or
public debug API. No source/Golden/DRAFT/fingerprint changes.

## UI and print

One editorial memo section added to accepted CLIENT Analysis V3. Compact summary,
evidence strengths, attention, expandable creditor view, financing structure and
pre-application questions. Creditor references reuse items rather than copying
facts into four sections. Native disclosure/anchors preserve keyboard use.

The existing print shell remains intact; the same memo is appended, all expert
proofs expanded. No new PDF engine. Tests compare the pre-existing print shell
without the newly requested additive expertise appendix, and separately verify
that every expertise item appears on screen and in print.

## Legacy AI audit (read-only)

`app/api/ai-analyst/route.ts` uses `AnalysisResult` saved payload and Checko profile,
`applyAnalysisControls`, `buildUnifiedRiskContext`, and
`lib/ai-credit-analyst.ts::buildSanitizedCreditContext`. It does not use the canonical
credit orchestrator or Expertise. Current context includes legacy analysis.score,
grade, unified-risk readiness/verdict/confidence, old cashflow metrics, financial
profile fields, BKI summary, stop/review/strength factors, action plan and old
limitMin/limitMax/product. Question keywords select subsets. Request analysis ID
is removed before provider transmission; history/question go through minimization.

The route supports provider/local-rule fallback, ownership/FULL checks and limits.
It calls ensureSchema and persists conversations/messages/usage. These routes were
not invoked or modified in this task. This implementation is not Block 19.

### Safe future seam

`canonicalExpertiseContext(result, publicModel)` rebuilds validated expertise and
returns a fresh clone containing only version/asOf, public expertise, report
version/claim IDs and Explainability version/source-reference IDs. No raw claims,
value bindings, policy fingerprints/thresholds/weights, documents or account/
contract identifiers. It cannot recalculate a decision or mutate its input.
There are no provider imports/calls or links to the legacy AI route.

Future migration requires separate approval: maintain existing ownership/FULL,
load exact canonical result, freeze/version the allowlisted context, remove legacy
context substitution, enforce evidence-only answers and unknown semantics,
validate generated claims before display, keep provider minimization/limits, and
review storage/migrations separately. It is not implemented here.

## Acceptance gates

- Full build/test/lint/artifact gate, TS new diagnostics zero.
- 31 Golden, 100 DRAFT, strict business 24 with unchanged canonical hashes.
- Expertise tests: deterministic immutable outputs, lineage mutation rejection,
  FREE redaction, no legacy substitution, unknown/zero/conflict, escaping,
  no promises, allowlisted future context, matching screen/print statements.
- Existing CI presentation gate: 7 cases × 5 sizes, new memo screenshots,
  keyboard proof disclosure, reduced motion, native browser 200%, 7 print PDFs.
- Authenticated LIVE staging: separate from isolated CI; confirm version marker
  and actual memo content on synthetic reports. CI green alone is not rollout.

Human acceptance remains required. Issue is not closed automatically.
