# Future live integration checklist (no live activation in this task)

## Required owner settings
- Merchant legal entity/INN and T-Bank internet-acquiring agreement; terminal, password via secret environment only.
- Confirm one-stage hosted-form payment setting, enabled payment methods, server HTTPS origin and callback/success/fail URLs.
- Publish existing offer/privacy documents; provide immutable current BILLING_OFFER_VERSION/BILLING_PRIVACY_VERSION. No legal texts created by this task, no recurring consent.
- Confirm tax system, VAT, payment method/object, receipt contact, receipt requirement, cash-register/fiscalization scheme and whether fiscalization is external. Current adapter requires separately approved fiscalization; no guessed Receipt payload.
- Bank test-terminal/environment choice, IP allowlist where required, official test acceptance outside CI/local task. No keys or card data in fixtures/artifacts.

## Partner payouts
T-Bank acquiring does not itself establish a partner-payout contract. Obtain official payout/split agreement, allowed beneficiary types, recipient onboarding/tokenization/KYC, request/status/callback/idempotency/retry contract and refund/chargeback policy. Then implement provider behind PartnerSettlementProvider; do not invent requests. Until then Disabled/ACCRUAL_ONLY and truthful accrued/held/pending states. SPLIT_PAYMENT unavailable. No ADMIN approval is needed by the durable dispatch policy after verified onboarding.

## Operational prerequisites before a future release
Apply registered migration0006 using existing runner after normal backup/review; no external migration was performed here. Schedule bounded payout-worker command, monitor pending/review/lease/backoff. Default provider Disabled, no public Fake success endpoint. Fake opt-in isolated tests only; all QA routes live only in scripts/qa harness. Configure secrets securely; live-enabled guard is off by default and CI always excludes T-Bank.

Reconcile UNKNOWN_REVIEW Init via signed callback or official CheckOrder plus GetState, never repeat a potentially successful Init. Signed ambiguous partial-refund callback is retained for reconciliation rather than guessing cumulative refund from Amount. Before live rollout, validate the exact terminal Cancel/GetState refund response schema and fiscal receipts; unknown results remain review. No blind repeat Cancel after timeout. Refund/reversal/period adjustments are fully tested with Fake cumulative confirmation.

No deployment, recurring payments, live acquiring calls, live payouts, external migrations, main/staging changes, DNS or Amvera changes are part of this task.
