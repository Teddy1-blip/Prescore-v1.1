# Architecture Sync V1 — application and runtime schema audit

Baseline: `ee793aeb32f57e3513f02d0510eee53b96447d35`
Branch: `architecture-sync-v1`

This note records existing storage behavior for Architecture Sync V1. It does not change tables, routes, application rules, or runtime schema handling.

## Workspace data boundary

`WorkspaceModelV1` is a read-only presentation projection. `/api/workspace-model` authenticates first, then uses the existing `readableAnalysis` owner, assigned-agent, and admin authorization paths. The saved payload is parsed only after authorization. BASIC projects an explicit allowlist of bank, source-coverage, document, and application facts. FULL calls the existing production canonical orchestrator and public Client Report projection. No analysis row or entitlement is written by the read endpoint.

The endpoint preserves the current tier rule: owners receive their saved entitlement; the existing canonical-report rule gives an assigned agent privileged FULL access; admins use the existing privileged path. Assigned-agent access is read-only in this contract. BASIC does not load Checko profile data or canonical analysis inputs.

## Application domain duplication

The application domain currently stores related workflow data in both `deals` and `agent_applications`. These are separate records with overlapping IDs, analysis IDs, requested amounts, statuses, and next actions. Statuses can differ between the two rows because each table serves a different client or agent view.

| Writer | `deals` | `agent_applications` | Notes |
| --- | --- | --- | --- |
| `app/api/workspace/route.ts` | Client-created applications and selected-recipient applications; client cancellation/status updates | Best-effort client-to-agent sync and selected-recipient applications; cancellation/status updates | In the selected-recipient path, `amount`, `requested_amount`, and `calculated_limit` are set from the requested amount. |
| `app/api/agent/route.ts` | Broker-created applications; status updates | Broker-created applications; status updates | The manual broker path accepts `calculatedLimit` from request input. It is not sourced from canonical Debt Capacity. The generated guarantee draft sets both requested and calculated amount from the guarantee amount. |
| `app/api/agent/prospects/route.ts` | Prospect-to-guarantee draft | Prospect-to-guarantee draft | Both amount fields are set from the requested guarantee amount. |

The database columns `deals.amount`, `agent_applications.requested_amount`, and `agent_applications.calculated_limit` describe an application request or legacy forecast input. They must not be read as Prescore Index, Financing Readiness, Debt Capacity, or a bank-approved limit. The existing agent forecast multiplies `calculated_limit` by a commission rate; this is a workflow forecast, not an analytical result.

The write APIs and their status/history behavior remain unchanged in this phase. Consolidating these records requires a separate application-domain migration and compatibility plan.

## Runtime DDL debt

Runtime route code still contains `CREATE TABLE IF NOT EXISTS` and/or additive `ALTER TABLE ... ADD COLUMN` calls. In the current PostgreSQL runtime, `PortableDatabase` intercepts supported calls as migration/catalog assertions and does not send request-time DDL to PostgreSQL. The schema is provisioned by checked-in migrations.

| Runtime code | Tables/columns it asserts |
| --- | --- |
| `app/api/analysis/route.ts` | `analyses`, `analyses.owner_email` |
| `app/api/workspace/route.ts` | `analyses`, `deals`, `agent_leads`, `agent_applications`, `agent_accounts`, `application_status_history`, `audit_log`; `deals.bank/application_group_id/consent_at/owner_email`; `analyses.owner_email` |
| `app/api/agent/route.ts` | `agent_leads`, `agent_applications`, `agent_partners`, `agent_accounts`, `deals`, `application_status_history`, `audit_log`, `module_settings`, `payment_orders`, `agent_prospects`; the same additive `deals` columns |
| `app/api/agent/prospects/route.ts` | `agent_accounts`, `agent_leads`, `agent_applications`, `deals`, `agent_prospects`, `audit_log`, `module_settings` |
| `app/api/documents/route.ts` | `client_documents`, `agent_accounts`, `agent_applications`, `agent_leads`; `client_documents.owner_email` |
| `app/api/communications/route.ts` | `application_messages`, `agent_accounts`, `agent_applications` |
| `app/api/checko/route.ts` | `checko_profiles`, `checko_profiles.raw_payload` |
| `app/api/orders/route.ts` | `payment_orders`, `payment_orders.analysis_id/product_type` |
| `app/api/admin/route.ts` | `module_settings`, `subscriptions`, `payments`, `payment_orders`, `client_documents`, `application_messages`, `ai_usage`, `audit_log`, `agent_leads`; `payment_orders.analysis_id/product_type` |
| `app/api/ai-analyst/route.ts` | `ai_conversations`, `ai_messages`, `ai_usage` |
| `app/api/modules/route.ts` and `lib/admin-controls.ts` | `module_settings`, `control_settings` |
| `lib/entitlements.ts` | `analysis_entitlements` |

Migration coverage is in `lib/db/migrations/0001_product.sql` for these tables and additive columns, with supporting indexes in `0003_runtime_indexes.sql`. `lib/db/catalog.json` and the platform database tests check registered columns and legacy table compatibility. The migrations are additive; Architecture Sync V1 adds no schema migration.

After production and staging migration state is verified for every supported deployment, a later cleanup can remove duplicate route-local schema declarations and legacy `ALTER` try/catch blocks. Keep migration-led schema provisioning, catalog assertions, and the database tests as the deployment guard.

## Read-path restrictions

- The Workspace API performs `SELECT` reads only and sends `Cache-Control: private, no-store`.
- A missing operational table or unknown fact remains `UNKNOWN`/null; it is not returned as an empty or zero result.
- BASIC returns no score, grade, legacy readiness, estimated limit, BKI conclusion, legal conclusion, canonical FULL field, raw statement, source hash, or source reference.
- FULL values are reused from the canonical production result and its public Client Report projection. The service contains no formula, engine fork, or frontend calculation.
- The service does not use Credit Lab fixtures in runtime.
