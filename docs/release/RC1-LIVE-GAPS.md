# Expected post-RC live launch gaps

RC1 installation/recovery/E2E uses isolated Fake/Disabled interfaces. No live payment, payout, deployment, external migration, DNS, hosting move or Amvera operation occurs in this task.

Owner must select production hosting/PostgreSQL, persistent storage and privileged encrypted backup destination/credentials; configure DNS/TLS, real SMTP acceptance and secrets management; define retention/incident ownership and optional external monitoring. Production uses HTTPS/strong secrets and rejects Fake. Runtime/image/migration/backup commands are portable.

T-Bank merchant credentials/agreement, callback registration, actual terminal Init/GetState/Cancel/refund reconciliation acceptance and fiscalization/tax/receipt settings remain external prerequisites. Unknown Init/ambiguous partial refund remain review until official reconciliation is connected; never blind-retry potentially accepted monetary requests. Acquiring does not imply a partner-payout agreement. Real payout/split contract, allowed recipient types/onboarding/KYC/status/idempotency/chargeback policy and provider adapter must be supplied before live payouts. Until then truthful accrued/held/pending, never fake PAID. See docs/billing/LIVE-INTEGRATION-CHECKLIST.md.

These external live agreements do not block RC1 when portable real-PostgreSQL installation, actual Fake E2E, worker recovery and verified restore pass. Internal technical failures of those gates do block RC1 and must be reported, not reclassified as expected live gaps.
