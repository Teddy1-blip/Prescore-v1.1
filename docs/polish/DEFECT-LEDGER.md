# Polish defect ledger

| ID | Severity | Reproduction/root cause | Fix | Regression | Status |
|---|---|---|---|---|---|
| P001 | RELEASE_BLOCKER | CLIENT documents has BKI/quarterly forms but no BFO; route rejects BFO | Existing upload accepts annual BFO, normalized through existing financial engine | CSV/XLSX/PDF actual bytes; CLIENT source browser | Verified local + M1/M4 browser |
| P002 | HIGH | Add another financial period: single manifest source filters previous snapshot out; same-period updates accumulate stale snapshots | Explicit active upload provenance; preserve other periods, replace matching period | Two years + updated year + quarterly; reload | Verified local and source CI |
| P003 | HIGH | Concurrent source requests read same payload then overwrite each other | Conditional payload update; conflict preserves both prior data and retry opportunity | Concurrent BFO/quarterly save and retry | Verified concurrent-save regression |
| P004 | HIGH | Financial normalization failure acknowledges upload while clearing financial snapshots | Reject failed normalization before persistence | Source route validation and existing financial failure tests | Guard implemented; final regression gate |

No scoring formulas, economics or entitlement rules changed. Milestone commit recorded in POLISH-MILESTONES.md in the next commit (no self-referential SHA).

| P005 | HIGH | Cached BFO participates in canonical result but saved manifest alone labels it missing | Use exact canonical source observations for FULL inventory | workspace-product-review | Verified local |
| P006 | HIGH | NBKI same-row PDF fields lose column spacing, dates discarded; missing SB balance defaults to zero | Label-boundary parsing; preserve dates and unknown values | Actual corporate PDF + parser tests | Verified local |
| P007 | HIGH | Historical source balance is unavailable in current-balance projection and absent in CLIENT/AI/print | Expose dated reported balance separately; preserve current UNKNOWN | Source enrichment and print/AI projection | Verified local; final browser gate |
| P008 | HIGH | Upload success is displayed before canonical refresh is confirmed | Await model read, preserve prior result and retry error | Source browser upload failure/retry | M4 browser verified |
| P009 | MEDIUM | Financial cash chart labels all non-full months as partial, no numeric table | Specific coverage labels and accessible table | Product/source browser | Final browser gate |
| P010 | MEDIUM | Broker overview links lose selected dossier section after reload; FULL shown as internal code | Persist section URL and localized entitlement | BROKER browser | Final browser gate |
| P011 | MEDIUM | Source upload forms below generic file checklist; no direct source actions | Direct named BFO/КИ anchors and forms before generic files | Source browser/native zoom | Final browser gate |

Format boundaries (not hidden support): bank analytical upload remains 1C TXT only; no OCR; BFO annual uploads use one explicit period per file. Generic documents are a separate storage flow. No live provider, deployment or production mutation was used to obtain evidence.

| P012 | HIGH | Visual review at 390px: inherited mobile table rules hide headers and force 680px block rows inside scroller; no page overflow but content clipped | Restore semantic table display/headers, wrapping and focusable internal scrolling | Source browser asserts computed table/header display at six sizes; screenshot review | Fix requires final HEAD acceptance |
