# Credit Lab issue #2 — contract audit (staging)

Base: cbe7af0072006e40d02acba1e3978421f2ed0cc4.
Authorization: https://github.com/Teddy1-blip/Prescore-v1.1/issues/2#issuecomment-5764382377

## 022: identity, evidence, knowledge

Old expectation, preserved for audit only:
`op >= 12000000 && op <= 12001000`.
It excluded legitimate isolation. The approved replacement requires a partial report,
one unresolved conflict, two unique evidence versions, retained source references,
11,800,000 RUB undisputed subtotal, UNKNOWN/null full receipts and dependent capacity
and scenarios. No first/last/min/max/average selection. The independent BigInt oracle
reads supplied TXT records without production parsing/classification imports.

`PRESCORE-TX-CONFLICT-1` is an additive source/metrics evidence contract. An operation
requires company INN + company account + bank document + date + currency + direction
+ both payer/recipient accounts. Amount is a version value, not identity. Purpose and
party INNs are also version values. Missing identity cannot produce a confident match.
All conflict evidence observations are cloned and preserved in unique version groups.
The established deduplication API still annotates its freshly normalized records;
source TXT and saved caller inputs remain unchanged. Exact
copies do not create a new version or an economic operation. Normalized retained
transactions exclude all unresolved versions. Only an explicit matching version and
nonempty confirmation reference may resolve a conflict in the pure calculation API;
no production route/UI, real-dossier mutation or database write is added.

Bank metrics retain the existing base version to keep compatible Golden contracts.
The optional versioned `conflicts` extension carries subtotal, original evidence,
and exact affected month fields. Monthly amounts can be null only with validated
conflict provenance; existing positive/date/period/lineage checks remain in force.
Category totals and dependent ratios/trends lose knowledge only where affected.
Unchanged outgoing debt payments and independent portfolio evidence remain available.
No subtotal is used as a full total or capacity basis. DebtCapacity carries a separate
optional bankConflict presentation summary. Existing claim/value bindings expose it
in the existing report, with exact upstream lineage. No credit weights or thresholds
change; no new lower-bound capacity method.

## 010: coverage of supplied accounts

SourceEnvelope optionally carries accountCoverage populated from original account
sections and their dates. Calendar coverage is calculated per account, then combined.
FULL requires each supplied account to cover the complete month. Same-account overlap
remains OVERLAP; different complete accounts are not duplicate sources. Missing periods
of any supplied account remain PARTIAL/MISSING; observed zero transactions do not erase
declared coverage. Common days are the intersection of covered days, not the minimum
of unrelated day counts. Inputs without account evidence keep the previous conservative
source-based behavior. No assertion that all real company accounts were supplied. A supplied account absent
for part of the company window invalidates a representative full-month operating
average/trend (UNOBSERVED_ACCOUNT_PERIOD), rather than interpreting unobserved
account months as zeros. This preserves the unchanged strict case 011 expectation.

## 013: explicit BKI history provenance

CreditObligation optionally carries fieldProvenance (origin, value, source reference).
The source parser records confirmed zero only after explicit bureau history codes/count.
The synthetic reported-field JSON boundary records actual own numeric fields, without
changing the original ZIP/JSON. The common BKI adapter consumes this provenance for all
callers (orchestration, portfolio and risk); a bare/default/estimated/conflicted zero,
null, missing value or mismatching provenance stays UNKNOWN. Current overdue is never
used to infer historical duration. Existing explicit confirmedZeroFields context remains
supported when no contradictory field provenance exists.

## Acceptance

Permanent regressions: tests/credit-lab-issue2.test.mjs.
Strict business oracles: npm run credit-lab:business -- <new output directory>.
HTTP/storage: tests/credit-lab-runtime.test.mjs (disposable PGlite only).
Original 31 Golden, 100 DRAFT, source archives and fingerprints must remain unchanged.
Build/test/lint/artifact and strict business command are required before staging delivery.
Results and live verification are recorded separately in the final acceptance report.

NOT_RUN remains: caller-controlled historical cutoff/future-source exclusion, real BKI
PDF extraction and live providers. Synthetic PASS share is not scoring accuracy.

Related consistency regression: canonical-period-integration previously asserted OVERLAP
for two distinct accounts on a one-day boundary month. Corrected to PARTIAL for that
month and strengthened with FULL for the next month and overlapMonths=0, as required
by the approved 010 account contract. Its source-window, UNKNOWN, and invalid-period
rejection assertions are unchanged. This is not a Golden pack or a business-oracle edit.
