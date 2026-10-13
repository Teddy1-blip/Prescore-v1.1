# Polish defect ledger

| ID | Severity | Reproduction/root cause | Fix | Regression | Status |
|---|---|---|---|---|---|
| P001 | RELEASE_BLOCKER | CLIENT documents has BKI/quarterly forms but no BFO; route rejects BFO | Existing upload accepts annual BFO, normalized through existing financial engine | CSV/XLSX/PDF actual bytes; CLIENT source browser | Implemented; browser pending |
| P002 | HIGH | Add another financial period: single manifest source filters previous snapshot out; same-period updates accumulate stale snapshots | Explicit active upload provenance; preserve other periods, replace matching period | Two years + updated year + quarterly; reload | Local regression passes |
| P003 | HIGH | Concurrent source requests read same payload then overwrite each other | Conditional payload update; conflict preserves both prior data and retry opportunity | Concurrent BFO/quarterly save and retry | Targeted check |
| P004 | HIGH | Financial normalization failure acknowledges upload while clearing financial snapshots | Reject failed normalization before persistence | Source route validation and existing financial failure tests | Implemented |

No scoring formulas, economics or entitlement rules changed. Milestone commit recorded in POLISH-MILESTONES.md in the next commit (no self-referential SHA).
