# Migration contract

`db:status`, `db:migrate`, `db:verify` are the supported commands. Migrate validates the applied ordered prefix/checksums under PostgreSQL advisory transaction lock6419818 and commits all pending SQL plus catalog verification atomically. No reset/down/purge. Failed transactions release locks; repeat is safe. Unknown future versions, checksum mismatch or missing columns/ledger guards fail closed. App/worker startup requires the full current registry. Request-time legacy CREATE strings are intercepted as schema assertions by PortableDatabase; they do not execute DDL.

RC1 migration0007 adds operational tables and necessary indexed scans only. Initial RC1 runtime requires0007, so rolling back to an older RC image with a smaller registry is intentionally blocked. Use a forward fix or an explicitly compatible image. Never delete ledger/payment/audit history for rollback. Migration rollout needs a reviewed maintenance window and verified backup.

CI builds pre-billing state from real migrations0001–0005, inserts representative records, applies current migrations and compares original rows byte-for-byte. Clean install starts from empty real PostgreSQL; no harness-created tables. Failure injection, concurrent migrators, checksum mismatch and future registry tests complement the E2E.

Migration0008 adds measured-predicate lookup indexes for owner/company, assignment, documents, audit and confirmed-payment ranges. Compatibility also checks critical indexes, uniqueness and foreign-key presence, not just column names. Missing-index fault injection fails closed.
