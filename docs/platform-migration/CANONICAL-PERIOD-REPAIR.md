# Canonical period integration repair

## Proven integration defect

The statement integrity calendar uses source coverage dates. The upload adapter
previously supplied transaction extrema as the canonical metrics period. A source
can cover a month before its first transaction, producing
`CAPACITY / MONTH_OUTSIDE_BANK_PERIOD`. A full covered month with no operation on
its boundary can instead produce `FULL_MONTH_OUTSIDE_BANK_PERIOD`.

The upload adapter now supplies the union of declared source coverage to the
existing metrics engine. The same period is used for all metric provenance and
daily balance reconstruction. Credit rules, weights and validators are unchanged.
The legacy display period is unchanged. No persisted analysis is rewritten.

## Verification

`tests/canonical-period-integration.test.mjs` uses anonymous multi-account inputs:

- coverage starts in the month before the first transaction;
- the corrected upload passes the canonical orchestrator;
- absent financial evidence remains UNKNOWN/null;
- daily balance includes days without transactions;
- the pre-fix persisted shape still fails with the exact allowlisted condition;
- report access remains read-only and the original input remains unchanged.

The protected FULL report exposes a random diagnostic ID, fixed code version,
allowlisted stage/reason, and a staging-only structural source summary. No raw
exception, SQL, stack, document text, amount, credential or connection string is
logged or published in this diagnostic. Unknown document availability is null,
not zero. Source metadata presence is not proof of stored original bytes.

## Saved-input recovery: plan only, separate approval required

1. Obtain the complete original statement files through the approved secure
   runtime path. First check authorized document metadata and storage. If absent,
   request only these files, not account credentials. Match decoded source hashes
   against the existing manifest and confirm company identity and source coverage.
2. Preserve the exact original analysis row in a protected runtime backup with a
   checksum and restricted access. Never move client payload or runtime database
   credentials into GitHub, CI logs or build artifacts.
3. Calculate a candidate in memory from the full originals with the corrected
   adapter. Do not recalculate from the masked display projection. Compare source
   lineage, coverage, counts and canonical validations. Review only a safe summary.
4. Request explicit approval for a single-analysis replacement, identifying the
   protected backup and rollback procedure. Preserve analysis ID, owner, FULL
   entitlement, roles and assignments. No schema change or migration is needed.
5. Only after approval, replace the intended payload with a conditional update
   that refuses concurrent changes. Re-open the same report and verify the result.
   Rollback restores the preserved payload with the same concurrent-change guard.

No step involving backup writes or database updates is performed by this release.
A successful deployment of the adapter does not repair historical stored metrics.
