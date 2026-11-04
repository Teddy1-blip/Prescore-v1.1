# Stage 1: owner-issued broker authority

Continuation of Issue #11 / 6632121779. This is the bounded self-assignment fix, not a new audit or authentication system. The rejected 9231f37197e26278ece488cb4259c0d22bfc62f2 candidate must never be delivered.

## Authority and schema 0009

The existing native login and AGENT account remain. A self-connected broker starts without foreign dossier access. CRM contact fields, INN, email, source and broker-entered consent are not evidence of the dossier owner's permission.

The existing `audit_log` stores append-only `BROKER_AUTHORIZATION_V1` events. Its existing entity/date index supports the lookup. No new table, migration, endpoint, backfill or alternate login is introduced. The existing `/api/workspace` handles owner confirmation, listing and revocation. The owner uses Documents → «Разрешения брокеру» in the existing client UI.

- `GRANT_DOSSIER`: exact analysis ID, current owner native user ID, verified broker native user ID and account code, server time and expiry. It covers that dossier and its associated documents/report/AI/application operations. It does not authorize every analysis with the same INN.
- `GRANT_REFERRAL`: separate explicit owner confirmation for new orders of that owner's company. Scope is owner native user ID + INN. It grants no document access. Curator attribution additionally needs the verified invited broker's own accepted native connection event and the active partner chain.
- `REVOKE`: permanent revocation of a particular grant ID. Regrant requires a new ID. Existing sessions do not cache the permission; every subsequent server request rechecks it.

The authenticated actor must currently own the exact active analysis. ADMIN does not impersonate another owner in this confirmation path. Owner and recipient are looked up server-side and must have verified native identities. A same-origin request and an explicit separate purpose confirmation are required. A bounded expiry (1–365 days) applies to the assignment only; paid product/access periods are unchanged.

Confirmation and creation of a navigable CRM contact commit together. The contact itself still has no authority. Concurrent/replayed IDs cannot change recipient, scope, purpose or duration. Reads join the current native IDs, current verified emails, account code, actual analysis owner and INN, expiry and revocation. Deleted/recycled identities cannot inherit an old grant.

No historical CRM record is promoted automatically. Existing code contains no owner-confirmed dossier assignment contract to migrate. Owner-created application audit events whose recipient was selected automatically from CRM do not establish an explicit owner selection of that broker. Immutable historical billing orders retain their saved attribution.

The event model uses objects already present in 0009. The delivery candidate must retain the exact staging migration files/registry/catalog/schema label. The prepared recovery MFA/0010 work remains separate and unactivated; its restore/migration conditions are unchanged.

## Direct consumers

| Consumer | Applied boundary |
|---|---|
| `readableAnalysis`, WorkspaceModel, report, AI | Exact current owner/grant per request; existing ADMIN, owner and tier checks retained. |
| Agent list/search and prospect matching | No latest-analysis lookup by INN alone; only granted scope. CRM archive filters cannot probe unrelated analyses. |
| Documents/list/download/counts | Same analysis and owner; application relationship also requires current grant. An identical INN is insufficient. |
| Application read/chat/write | Current assignment on linked analysis, including old links and historical forged deal mirrors. Unlinked own CRM drafts retain their existing scope. |
| Client application synchronization | Only one unambiguous confirmed recipient; no default broker and no arbitrary latest CRM contact. |
| Admin assignment labels | Show confirmed assignments rather than treating CRM contacts as permissions. |
| New checkout attribution | Separate confirmed referral; existing ambiguity error retained. No rewrite of existing orders/commissions/ledger. |

## Dependency gate

The original gate was correct: `criticalHigh=2`. The original production audit reported Better Auth critical, Zod high, one low and five moderate dependency entries.

| Package / path | Original cause | Minimal compatible correction |
|---|---|---|
| direct `better-auth@1.7.5` | GHSA-965c-763c-88jm critical, affected >=1.4.0-beta.18 <1.7.7; GHSA-r4xp-prcw-77qf high, affected >=1.5.0-beta.12 <1.7.7 | Pin `better-auth@1.7.16`; associated @better-auth core/adapters/telemetry resolve to 1.7.16. Same patch line, including the official November 3 security release. |
| `better-auth@1.7.5` (audit node `node_modules/better-auth`; advisory concerns its PostgreSQL Drizzle adapter) | GHSA-44jh-23m7-hpcf low, >=1.6.17 <1.7.7 | Updated family version above. |
| `better-auth` → `zod`; `better-auth` → `@better-auth/core` → `zod`; `better-auth` → `better-call` → `zod` | `zod@4.6.5`, GHSA-mrhx-c7xc-m3w5 high, affected <4.6.6 | Existing dependency family resolves to patch 4.6.6 via exact override; lock updated. Tooling also dedupes to 4.6.6. |

The production configuration does not enable OAuth Proxy/Magic Link/Expo; the audit identifies vulnerable installed versions, not proof that every advisory is exploitable in this configuration. The gate was not disabled or given an exception. No `npm audit fix --force` or bulk upgrades were used. Standard `npm ci` succeeds from the lock. Native login, verification, CLIENT→AGENT connection and the existing native 2FA lifecycle have isolated compatibility tests; MFA was not redeveloped.

The corrected existing gate reports `criticalHigh=0`, zero high/critical/low, five moderate entries (esbuild/@esbuild-kit/drizzle-kit and nodemailer). These residual entries are recorded, not hidden. The same unmodified dependency gate is added to the existing staging delivery workflow before delivery.

Official references checked:
- https://better-auth.com/blog/security-release-2026-11-03
- https://github.com/better-auth/better-auth/releases/tag/v1.7.16
- https://github.com/advisories/GHSA-965c-763c-88jm
- https://github.com/advisories/GHSA-r4xp-prcw-77qf
- https://github.com/advisories/GHSA-44jh-23m7-hpcf
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5

## Live exposure and containment

Fresh browser health still identifies the old staging input fingerprint c68d9c34f312c7b903cb22facac70e9b6959a0f8af1eab18da058e1a1a1cb0d9, 711 inputs, lock 8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1, schema 0009. It does not prove the complete Git tree or container digest. Exact staging GitHub source still joins CRM leads by INN to authorize analyses. The live `/ref/AGENT-ANTON-001` contact form is reachable. No form was submitted, account/role changed or foreign dossier requested.

Until a verified fix is activated, the old staging is not considered safe. A concrete existing containment control was observed at Amvera → prescore-staging → Управление → «Заморозить проект». This would make the whole staging application unavailable; it has not been applied. Hiding a UI module would not protect the affected APIs. Production and the staging database service must remain untouched. No support contact, Online IDE check, paid resource, tariff change, data deletion or migration is authorized by this containment proposal.

Final SHA-specific results and the Stage 1 acceptance matrix are recorded in the continuation checkpoint in Issue #11. Local/render/CI results do not substitute for the published ordinary CLIENT/BROKER scenario, real recovery email, live mobile acceptance or gated owner MFA enrollment.
