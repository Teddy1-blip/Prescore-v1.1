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

Milestone 5 SHA: `3a93d542b5d4bc37054b90b5d01ae3fa0d8338e7`. CLIENT/BROKER/authorization targeted tests 22/22; typecheck 0 new.

## Milestone 6
ADMIN sales/subscriptions/commissions/payouts, ledger analytics, anomalies, filtered audited CSV and reason-required safe operations. Billing targeted 7/7. Server payment polling and confirmed refund callbacks integrated.

Milestone 6 SHA: `8fee3abd060064ef7d002d162b2d4d60d51c8915`. Billing tests 7/7, targeted lint clean, typecheck 0 new.

## Milestone 7
Billing browser lifecycle + five viewport matrix, existing regressions, official live checklist, full final CI. No live API calls.

Milestone 7 SHA: `441676380bc063ec49788848c47bd395214277eb`. Initial billing browser 134/134, existing ADMIN 125/125. Follow-up refines sales cohort/channel/renewal charts and adds refund/renewal race and rejected-refund regression tests; final exact HEAD CI will be checked after this commit. Billing targeted now 18/18.

Follow-up implementation SHA: `d1af69fc6184b6bf6827711861aff961779b8727`. Targeted billing 18/18, typecheck 0 new (10 pre-existing diagnostics). Follow-up preview calculation moved to the server after React purity lint found Date.now in render; subscription tests 3/3 and targeted lint then passed. Final validation is run on the subsequent documentation HEAD and reported with its exact SHA/Actions URL in the delivery result.

Journal documentation SHA: `8d21abc7d32ca25030bc5727dd82c9322f366369`. Final server period-preview correction is checked by the exact subsequent HEAD workflow; no deployment or live calls.

Server preview SHA: `265aa20afa7a037aec5a0acb94cab3cdbe0b287a`. Final reconciliation visibility correction: ambiguous refund notifications appear explicitly in ADMIN anomalies; rejected Cancel responds FAILED consistently with persisted state.
