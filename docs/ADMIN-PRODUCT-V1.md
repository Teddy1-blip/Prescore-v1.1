# ADMIN Product V1

## Navigation

`/admin?view=overview|companies|brokers|analyses|applications|documents|access|product|system`

Deep links preserve search, filters, pagination and detail context. Company detail uses `id=INN`, application detail uses `id=applicationId`; canonical dossier uses `analysisId` and `dossierView`. Access tabs separate `tab=orders|payments`; system tabs separate `tab=audit|ai`. Invalid view returns to Overview with a visible notice.

The shared CLIENT/BROKER Product V1 shell, typography, controls, status elements and canonical presentation are reused. Tables scroll locally; the whole page must fit the viewport. ADMIN contains exactly one logout link.

## API

All resources require server-verified ADMIN. Anonymous receives 401; CLIENT and BROKER receive 403. Responses are private/no-store and vary by authentication. SQL filter values are bound parameters; resource and enum values are validated. Page >= 1; limit 1–50, default 20. Search <=120 characters; IDs/filters <=180. Invalid inputs receive 400, missing entities 404, backend failure a safe 503.

| Resource | Contract |
| --- | --- |
| overview | Metadata counts, 30-day analyses, actual payments, logical application statuses, product usage, BASIC/FULL, source/canonical observation distributions |
| companies | Companies grouped by INN; name/INN/owner search; tier, broker, analysis/application existence, source/canonical filters; four sorts; pagination |
| company&id=INN | Company metadata and paginated analysis versions, applications, documents and audit |
| brokers | Real agent_accounts, account search, actual assignment/application/referral counts, stored hierarchy and separate forecast/unknown accrual |
| analyses | Version metadata, period, owner, tier, source/canonical observation and published canonical summary; paginated |
| canonical&analysisId=ID | Existing authorized WorkspaceModelV1, unchanged canonical/report objects, ADMIN read-only access envelope |
| applications | Logical applications; same-ID deal/agent mirror deduplicated; deal is the current operational status authority |
| application&id=ID | Current application, paginated status history/messages/documents; observation only |
| documents | Metadata-only registry; company/category/uploader/analysis/application/orphan filters; no file content or storage keys |
| access | Existing analysis_entitlements; BASIC/FULL, grant/revoke provenance, order link, missing/revoked/current states |
| orders | payment_orders, current order status and independently determined access state |
| payments | Actual payments, confirmation status and existing reference ID; no forecasts |
| product | Safe consumed UI module flags; current canonical policies/risk registry read-only; real code-owned BROKER route catalog |
| audit | Date/entity/actor/action/search filters; paginated allowlisted and bounded metadata |
| ai | Aggregate provider/model/request/success/failure/token/latency/date data; no conversations or secrets |
| system | DB reachability, actual schema/trigger compatibility, optional build SHA, configured AI, storage metadata and recorded AI failures |

POST `/api/admin` supports only `type=access` (existing analysis ID, boolean enabled) and `type=module` (allowlisted consumed UI flag, boolean enabled). Each change and its audit event commit atomically. Grant/revoke never changes owner or creates a payment. Old control, bulk control, subscription, assignment and destructive actions are rejected. Orders and payments remain observational; there is no new payment/subscription lifecycle.

## Canonical and source observations

No ADMIN scoring engine exists. CLIENT, BROKER and ADMIN share `loadWorkspaceModelV1` and the canonical orchestrator. ADMIN uses the same ExecutiveOverview, FullCreditAnalysis, BankingLedger, FinancialStatements, DebtPortfolio, FinancingProducts and DocumentSources.

A canonical summary is calculated only when an administrator opens a specific dossier. The derived observation caches published output fields, canonical version, saved-input fingerprint and timestamp. List filters use matching fingerprints; unobserved/changed versions are UNKNOWN. Overview reads metadata observations without loading financial payloads or calculating portfolio reports. Cache invalidation triggers clear only derived observations when saved analysis/profile inputs change. Unknown numerical values remain null, never fabricated zero.

Migrations 0004 and 0005 are prepared, tested on isolated PostgreSQL-compatible fixtures, and must be applied through the existing migration runner before later release. They were not applied to any external database in this task. No payment schema changes.

## Domain gaps deliberately retained

- Assignment is read-only. Any matching agent_lead currently grants broker access by INN, while applications separately retain agent_code. No atomic reassignment/cascade contract exists for all historical leads, applications and authorization relations. A partial reassignment would be unsafe.
- Operational routes are code-owned and shown read-only. A versioned admin-editing/governance contract is absent. Legacy control_settings is not presented as canonical policy governance.
- Confirmed broker accrual/payout lifecycle is absent; values remain unknown. Stored forecast is explicitly separate.
- Storage state describes recorded metadata/inline presence, not an unperformed physical storage health probe. Build SHA stays unknown unless supplied. No fake uptime.
- No subscription 6500 ₽ / 30 days, no deployment, no Amvera, no database cleanup or entity-deletion tools.

## Verification

`tests/admin-product.test.mjs` verifies authorization, bounded queries, metadata privacy, version/company pagination, all canonical equality fields, complete report/source equality, observation invalidation, logical application deduplication, safe documents, audited entitlement/flag persistence, order/payment separation and rollback when audit fails.

`scripts/qa/admin-product-browser.mjs` uses production components and handlers with synthetic data. It covers all nine views and details at 1440/1024/768/390/360, six dossier sections, filters/pagination/deep links/reload persistence, empty states, unavailable DB retry, canonical unavailable and role authorization.

`.github/workflows/prescore-product-qa.yml` retains full build/tests/Credit Lab/lint/artifact/PDF plus CLIENT, BROKER and Analysis V3 browser/print gates and adds ADMIN browser QA. It deploys nothing.

The work journal records milestone commits and validation evidence. Final CI evidence is linked in the delivery; no unfinished route is counted as PASS.

## Changed files

- `.github/workflows/prescore-product-qa.yml`
- `app/admin/admin-dashboard.tsx`, `app/admin/admin.css`, `app/api/admin/route.ts`
- `app/components/workspace/canonical-dossier.tsx`, `client-shell.tsx`, `use-model.ts`
- `lib/admin/companies.ts`, `governance.ts`, `observations.ts`, `operations.ts`, `resources.ts`
- `lib/db/catalog.json`, `lib/db/schema.ts`, `lib/db/migrations/0004_admin_observations.sql`, `0005_admin_cache_invalidation.sql`
- `scripts/qa/admin-product-browser.mjs`, `scripts/qa/workspace-harness.mjs`
- `tests/admin-product.test.mjs`, `tests/fixtures/workspace-runtime.mjs`
- `docs/ADMIN-PRODUCT-V1.md`, `docs/ADMIN-PRODUCT-V1-JOURNAL.md`

Existing credit-engine files and CLIENT/BROKER application handlers were not changed. Shared shell defaults and the standard workspace-model endpoint remain compatible; ADMIN supplies explicit navigation and its own server-authorized canonical URL.
