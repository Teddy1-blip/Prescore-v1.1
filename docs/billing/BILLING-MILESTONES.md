# Billing V1 work journal

Baseline remote HEAD: a03c94be9d129183ae650bb60481dfe98f5d2875, confirmed before work. No deployment/live calls/external migrations. Each stage records targeted verification and commit SHA; the SHA is added in the following commit because a commit cannot contain its own hash.

## Milestone 1
Domain, migration 0006, constraints, catalog/storage projection and historical read-only compatibility policy. Targeted domain/migration tests.

Milestone 1 SHA: `1927bc3702d0c2d489223dab7ca9bb4cd8874163`. Tests 2/2.

## Milestone 2
Providers, authenticated checkout, signature/mapping checks, idempotent payment processing and safe unknown-result reservation. Targeted 5/5.

Milestone 2 SHA: `4884eea0f2436b4d2fc140f78e9574dd332e45a5`. Tests 5/5.

## Milestone 3
Company periods, deterministic renewal, owner/INN/time-bound FULL resolver and read-only dated legacy access. Subscription + existing entitlement tests 3/3.

Milestone 3 SHA: `fce6ca39203e9c29a7bdf70d2a86c9ef3e7df68e`. Tests 3/3; typecheck 0 new diagnostics.

## Milestone 4
Atomic commissions/outbox, Fake/Disabled settlement, leased bounded worker, confirmed refund adjustments and negative-balance offset. Targeted settlement 3/3; a concurrency test exposed missing reservation subtraction, fixed before commit.

Milestone 4 SHA: `357eb4eff58624bd562960a391668f35a0958c78`. Settlement tests 3/3; typecheck 0 new diagnostics.

## Milestone 5
CLIENT subscription/consent/history, server-state return page; BROKER sales/commission/payout-profile UI with curator privacy. Authorization and shared product regression tests.
