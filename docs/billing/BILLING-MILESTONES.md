# Billing V1 work journal

Baseline remote HEAD: a03c94be9d129183ae650bb60481dfe98f5d2875, confirmed before work. No deployment/live calls/external migrations. Each stage records targeted verification and commit SHA; the SHA is added in the following commit because a commit cannot contain its own hash.

## Milestone 1
Domain, migration 0006, constraints, catalog/storage projection and historical read-only compatibility policy. Targeted domain/migration tests.

Milestone 1 SHA: `1927bc3702d0c2d489223dab7ca9bb4cd8874163`. Tests 2/2.

## Milestone 2
Providers, authenticated checkout, signature/mapping checks, idempotent payment processing and safe unknown-result reservation. Targeted 5/5.
