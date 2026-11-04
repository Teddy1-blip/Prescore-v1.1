# Prescore 19-block integration — acceptance ledger

## Current checkpoint — Stage 1 finish, 2026-11-04

Latest authority: owner attachment `Prescore_Stage_1_Finish_Work.txt` and Issue #11 comment 6627365595. Continued from recovery `cc6fc4b8f9a3a78738dea7ef23e92cea11c7c57f`; no newer recovery/staging head was overwritten. **Stage 1 remains BLOCKED, not presented as technically complete. Stage 2 not started.**

The owner now authorizes the bounded staging MFA rollout, subject to verified post-deletion backup/isolated restore and a compatible checked artifact. This replaces the previous missing-permission blocker; do not ask for that permission again. “Версия анализа” is untouched. The existing MFA implementation from `d36a39528c5c9c41a7548fec6c1a4e43172cd8f8` is reused, not rewritten.

The owner-provided SELECT result dated 2026-11-04 is `database_name=prescorestaging`, `old_left=0`, `qa_left=3`. It is **owner evidence**, not Work SQL verification or proof of complete dependent-table cleanup. No repeat deletion, archival or restore of the 11 records was run. The old archive blocker/commands in historical checkpoints are superseded and must not be executed.

### Published result retained and narrowly rechecked

GitHub staging remains **`8b0809bd5eb22223fc80d73739eaab4d05d2782d`**; existing Amvera code revision **`558be82bea4a078b6672086e917ef877f41c0e98`**, application running 1/1. The previous activation proof is retained; no new build, restart or status-poll loop occurred. Fresh health at **2026-11-04T10:24:24.946Z (13:24:24 Moscow)**: alive=true, schema label `0009_analysis_archive.sql`; immediately preceding ready read reports READY, database REACHABLE, schema COMPATIBLE, storage READ_WRITE, outbox ACCESSIBLE. These browser JSON observations do not assert a separately measured HTTP status or SQL catalog inspection.

The live source-input fingerprint remains `c68d9c34f312c7b903cb22facac70e9b6959a0f8af1eab18da058e1a1a1cb0d9`, `PRESCORE-SOURCE-INPUTS-1`, 711 files, lock `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`. Full checkout tree and running/published image digests remain UNVERIFIED, not inferred from scoped inputs.

Ordinary `/dashboard` with no analysisId and reload show **0 ordinary history entries, 3 QA separately**. After viewing a protected QA, known removed ID `4f95b8fa-d933-46d4-893b-992385b5d893` shows the unavailable-analysis error with generic company context, no substituted old/foreign model. Existing accepted New analysis / Documents / reload / logout-return / internal admin / old-admin-404 checks remain attached to the original staging SHA; they were not reset or relabelled as new-role/MFA acceptance.

All three current QA financial projection hashes match the 2026-11-03 baseline using the same browser projection/serialization algorithm:

| QA ID | SHA-256 |
|---|---|
| `36527dc1-d7db-4fef-bd47-719a451b4d58` | `cccefaa81dd3cad8358b14f07cd53f2c1c34d409591632ca6d697c7d7c48e43a` |
| `992ab9e3-672e-4adf-955e-9a2c40e3ece3` | `9f4f7df5bb872c6bf7ff9689199b4be0d4e73bfe79a8686c008ce3e74d2e7c08` |
| `7ec7daeb-dfef-4f1f-9c9d-15ea86fe864c` | `bdf72efab952c374c2eda5de7a331b0e8b89cf05c95453c6565f448b2235330b` |

### A–G acceptance, live result separate from local tests

| Condition | Status | Evidence and precise remainder |
|---|---|---|
| A — independent CLIENT registration/login | **BLOCKED** | Existing native auth/authorization tests pass locally; live browser still uses owner ADMIN. Two controlled test email values have not yet been supplied. Current Work browser exposes no independent cookie contexts; separate tabs are not accepted as separate profiles. No accounts/real roles changed. |
| B — assigned BROKER, foreign denial/revocation | **BLOCKED** | Local role/API fixtures retained; no permitted live dedicated BROKER identity or independent profile. Need owner-controlled broker test address, normal account registration and scoped test assignment/revocation through existing controls. |
| C — received reset email and changed test password | **BLOCKED** | No designated test recipient/account yet; connected mail tool unavailable. No owner reset was requested. Once the test account exists, owner privately receives/opens the real email and changes its password in the existing flow; local mailbox/SMTP acceptance is not receipt. |
| D — ADMIN MFA required/new login/recovery | **BLOCKED** | Prepared native 2FA reused; additive migration candidate and targeted tests ready. No actual DB/storage maintenance session, fresh verified backup or isolated restored copy. No live migration/config/enrollment/required change. Owner factor UI is not yet published: do not ask for enrollment until it is ready. |
| E — published desktop/mobile | **ОЖИДАЕТ ДЕЙСТВИЯ ВЛАДЕЛЬЦА (mobile)** | Existing desktop acceptance retained; fresh dashboard screenshot and DOM viewport 1363×936, document scrollWidth 1348. Supported browser API has no viewport or independent-profile control; prior ineffective shortcut not repeated. After final activation, use owner's phone/independent browser for the short login/error/reset/menu/New analysis/Documents/reload/logout/safe MFA-screen scenario; no secret screenshots. |
| F — history, current data/documents/QA | **PASS within checked scope** | Fresh empty ordinary history/reload, three separate QA and identical financial hashes; deleted-ID denial without fallback. No new source/document/AI writes. Prior Documents result retained. This does not assert complete dependent-table cleanup, a SQL backup or successful restore. |
| G — new staging/schema/provenance/compatible recovery | **BLOCKED** | Existing live delivery remains accepted. Recovery activation candidate is prepared, but not deployed: startup auto-applies 0010, so backup/restore and a verified compatible switch path must come first. New candidate/container/live acceptance are distinct from the historical 711-file delivery. |

### Recovery candidate and verification

Code commit **`1ba46bcb55b918a78469cfca7864fae680a833cf`**, tree **`3b33f9eeedb625011875e8cd5d670e34e02fdecf`**. GitHub tree equals the locally checked temporary-index tree. Recovery advanced by expected-SHA, non-force update from `cc6fc4b8f9a3a78738dea7ef23e92cea11c7c57f`; staging did not advance.

Only the prepared MFA migration was promoted to `lib/db/migrations/0010_admin_mfa.sql`; old proposed copy removed to avoid two definitions. Catalog, MFA key/constraint/default validation, runtime schema version, Docker schema label and standalone validator agree on 0010. Existing PostgreSQL upgrade scenario now expects the additive `user.twoFactorEnabled=false` field. Prior migrations 0001–0009 match the published recovery index byte-for-byte. No parser, credit engine, Golden, archive mechanism, analysis-version UI, lock file or package change.

Targeted final auth/migration/role/UI/runtime checks: **34/34 PASS**, 0 skipped, 8820.772883 ms. New migration test covers upgrade from 0009, interruption after MFA DDL before history insert, transactional rollback, unchanged analysis/document/role/session rows, retry, no-op second run, old-registry rejection, unique factor owner, FK/method/counter constraints, proof cascade and schema drift fail-closed. Synthetic PGlite rehearsal is **not** restoration of the current staging backup.

Final local build/typecheck and full gate: **PASS** — regression **6821/6821**, 0 failed/skipped, 791296.167717 ms; Credit Lab **24/24**; lint; standalone **VALID / 13 runtime assets / 0010**; PDF runtime extraction. All five gate stages and the process exited 0. Runtime was **Node 24.22.1**, not a Node 22 Docker build. The historical 6820/6820 result was not transferred to changed code. [Safe candidate evidence](evidence/2026-11-04-stage1-candidate-safe.json).

New packaged inputs: **`e53db33e34da9d53e21138344fef2203a028bed22b689706ee5cccacc30c82b6`**, scope `PRESCORE-SOURCE-INPUTS-1`, **717 files**, same lock. Local standalone build ID `6Lv_ilJ9sy3g9ZhN3T9El`. Local mirror checkout provenance honestly reports UNVERIFIED_DIRTY_CHECKOUT with null commit/tree; no environment-variable SHA substitution. These are scoped input identities, not a running container digest. Compatible local 0010 standalone is prepared at `.next/standalone`; no verified container recovery/switch path is claimed.

A fresh Node 22 container gate remains **BLOCKED**: no local Docker/Podman; the GitHub workflow page exposes no Run workflow control in this session. Last existing RC1 run [39172424372](https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/39172424372), historical commit `b27ae31ab3c8be3eccae6a799abd4c9976236d47`, reports all jobs not started because of account payment/spending-limit restrictions. This historical failure is not a new-candidate result; no unchanged job rerun or paid setting change was made. The existing Dockerfile gate remains mandatory and unchanged apart from the accurate schema label.

Fresh automatic product QA for the real code change: [run 41815387569](https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/41815387569), exact code SHA `1ba46bcb55b918a78469cfca7864fae680a833cf`, **RUNNING / in_progress** observed once at **2026-11-04T10:38:12.836023+00:00**. No conclusion is claimed; no status polling, rerun or additional build follows. This workflow is validation, not an Amvera delivery and not the separate RC1 container gate. Resume this same run later. The documentation checkpoint uses `[skip ci]` and must not be transferred to staging.

### Operational continuation, without another audit

One exact operator action: open [Amvera staging](https://cloud.amvera.ru/projects/applications/msk1/~/dorogovab/prescore-staging), **Чат поддержки → Чат поддержки**, and send the non-secret request in the updated [MFA rollout record](2026-11-03-ADMIN-MFA-ROLLOUT.md#exact-current-operational-blocker). Existing Repository → Online IDE returned upstream connection timeout, unchanged after one reload. `/data` backup list is empty; newest visible database scheduled copy is 2026-10-22. Runtime DB/storage identity and isolated restore destination have not been established. Do not stop the app, assert a backup exists, migrate, deploy or enable enrollment while these conditions are missing. No DBeaver setup or manual SQL chain is required from the owner.

The owner selected “Укажу адреса” but supplied no values yet: the only non-secret information needed now is two controlled test email addresses and whether staging accounts already exist. Do not invent recipients or use the owner's real account for password reset. Factor/password/mail/mobile personal actions must be handed off in the ready interface when their prerequisites are satisfied, together rather than as repeated credential requests.

Evidence: [safe live checkpoint](evidence/2026-11-04-stage1-live-safe.json), [desktop history](evidence/2026-11-04-stage1-history-live.jpg). No secrets, QR/setup key, password, reset token or backup code was saved. No live schema, data, role, password, MFA setting or mail configuration was changed by Work in this continuation. No restart/build/deploy to Amvera was initiated; staging remained available. Production/main/DNS untouched. Future tariff parameters and Checko/EIS/DeepSeek/payment access remain in the existing backlog below; no Stage 2 work.

---

## Prior checkpoint — Stage 1 continuation, 2026-11-03 (historical)

Continued from Issue #11 / 6602289739 and recovery `9e9dee2dda48bf52317ded85f380a38ccc75ae1f`. Actual recovery/staging HEADs and newer comments were read before work and rechecked before publication; no newer changes were found or overwritten. Existing development and archive machinery were not repeated. **Overall Stage 1 remains BLOCKED / not accepted.**

### Live delivery accepted, no second delivery

The one existing staging delivery remains **`8b0809bd5eb22223fc80d73739eaab4d05d2782d`** (code `5e84d1695bb8abb2f22e080de3a569495943d4d7`, tree `fdf3f528e6925038d80a21a8e12099aec2a4861a`). One continuation check of the existing Amvera build found SUCCESS. The new revision **`558be82bea4a078b6672086e917ef877f41c0e98`** was separately marked used/active, with the application running 1/1. The visible row date was 03.11.2026 14:23; that UI timezone was not independently confirmed. No push, build, restart or activation click was made to obtain status. Observation ended after success/activation; previous revision `2cbc84ddc51c9ebf199ad9360d8dce0e3c3e10b0` remains historical rollback evidence.

Fresh browser health at **2026-11-03T12:35:40.470Z (15:35:40 Moscow)**, followed by a fresh ready read (separate timestamp not recorded): alive=true; READY, configuration VALID, database REACHABLE, schema COMPATIBLE, storage READ_WRITE, outbox ACCESSIBLE. The browser JSON surface did not separately expose the HTTP status, so no measured HTTP 200 is claimed here. Schema remains `0009_analysis_archive.sql`. Packaged build timestamp `2026-11-03T11:37:04.265Z`, build ID `eEV00kHUIwKM9l-CJy11z`. Exact expected match:

- Source-input SHA-256 `c68d9c34f312c7b903cb22facac70e9b6959a0f8af1eab18da058e1a1a1cb0d9`.
- Scope `PRESCORE-SOURCE-INPUTS-1`, 711 files; lock `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`.
- sourceSha/sourceTree UNKNOWN, checkout UNAVAILABLE and both image digests null remain **FULL_TREE_AND_RUNNING_DIGEST UNVERIFIED**. The matching scoped input fingerprint is not proof of the full deployed Git tree or container digest.

### Same acceptance matrix — separate local and live results

| Area | Recovery/local result | Published staging result / remaining condition |
|---|---|---|
| Delivery / interface (D, E, H) | Existing 6809/6809 gate retained only for its original SHA; new MFA candidate checked separately below | **PASS for existing delivery and owner scenario**: ordinary `/dashboard` → New analysis leaves empty company context and identical 14 IDs → protected QA selection → Documents → reload retains QA/section. Logout redirects to login; fresh password login returns to the exact selected Documents URL. Unknown analysis shows unavailable message, generic company header and no previous model. `/prescore-control` works for ADMIN; old `/admin` is 404. Foreign-role denial is not inferred from this ADMIN session. |
| History / archive (C) | Existing approved request/CLI/archive/restore implementation unchanged | **BLOCKED**: 11 old records still ACTIVE, protected 3 separately labeled QA; archived **0**, batch **null**. They have not been hidden with a filter. Fresh recoverable snapshot, actual maintenance DB identity and transactional CLI preview are not available. |
| Roles and received mail (A, B) | Actual native auth integration tests include CLIENT-only and assigned BROKER identities, reset verification, session revocation and denied ADMIN authority | **BLOCKED**: live owner ADMIN only; independent permitted CLIENT-only/BROKER sessions and received+used reset email remain unverified. Connected mailbox profile tool was unavailable; no receiver, email delivery or link use was invented. Passwords/roles of real users were not changed. |
| Administrator 2FA (B) | **PREPARED in recovery**: native plugin enrollment, TOTP/backup verification, session proof and central server role filtering; proposed additive schema tested only in an isolated database | **BLOCKED**: no live schema/configuration/factor enrollment change. Requires separate approval of the [concrete rollout/recovery plan](2026-11-03-ADMIN-MFA-ROLLOUT.md), owner setup in secure UI, then live verification of all ADMIN API capabilities. |
| Visual verification (F) | Render/responsive-contract tests remain automated tests, not live visuals | **PARTIAL**: actual desktop Documents view inspected, including the post-login return screen at 13:01:30Z (16:01:30 Moscow). **Mobile NOT VERIFIED**: supported browser surface exposes no viewport/device-resize method; no hidden CDP or synthetic render substituted. |
| Data preservation (G) | Credit engine, parsers, Golden and financial expectations unchanged | **PASS for existing delivery**: fresh projections of all three QA exactly match the pre-delivery hashes at 12:49:04Z. All remain READY_FULL. No financial/source/document uploads or writes. This is not snapshot/restore or post-archive acceptance. |

### Recovery-only MFA candidate

Code commit **d36a39528c5c9c41a7548fec6c1a4e43172cd8f8**, tree **`56d11f948898cfb23e179215a45791b69503aac9`**; local temporary-index tree matches GitHub. Fifteen bounded auth/UI/test files change; no package/lock, parser, engine, archive or live migration-registry change. Source-input fingerprint **`1f56f34a259a9a34a97100b246f23688ad5bc5ecc847bc954edafe0ea00b7354`**, scope `PRESCORE-SOURCE-INPUTS-1`, **717 files**, same lock, local build ID `57iwUNbcfYgtVDKV0rSCA`. This is a new recovery candidate, **not** the running 711-file staging artifact.

Existing credentials form uses the native plugin challenge before navigation. `/prescore-control/security` reuses the current login/session system and the existing UI primitives. `getAuthSession` removes ADMIN from the effective session roles unless the database proves that the particular live session completed the factor; existing downstream admin, billing, foreign-document and dossier checks therefore share enforcement. It does not edit the stored role. Proof lasts at most 12 hours and cascades on session deletion. Factor management requires current password and proof less than five minutes old. Trusted-device bypass and password-only factor disable are rejected. Native lockout, encrypted backup codes and one-time recovery are exercised by actual handler tests. Resetting the password cannot remove the factor.

`lib/db/proposed/0010_admin_mfa.sql` is deliberately outside the automatic migration registry. Default mode is disabled, with explicit enrollment/required modes for the separately approved rollout. No schema or account is switched on by this recovery checkpoint. The plan covers additive migration/catalog/runtime compatibility, isolated restore rehearsal, supervised enrollment, mandatory enforcement, lost-factor recovery and schema-compatible rollback; owner secrets are never committed or logged.

Final targeted auth/UI/history: **32/32 PASS**, 0 skipped, 18083.569386 ms. First MFA test attempt had two test-fixture errors (missing existing document category; a native non-public backup-code helper was expected to be HTTP 403 instead of actual route 404). Corrected only those test fixtures/expectations; 9/9 then expanded 32/32 passed. Original financial/Golden expectations are untouched. Before the final enrollment correction, the first complete gate passed 6820/6820 (810327.381261 ms), Credit Lab 24/24, lint, standalone and PDF runtime. Review then found that a backup code could be offered before the first TOTP verification; the final candidate hides that choice and rejects the direct request before consuming any code. The new native handler assertion verifies rejection and byte-identical backup-code storage. Final candidate full gate: **PASS** — build/typecheck, regression **6820/6820** (810648.285523 ms), zero skipped; Credit Lab **24/24**; lint; standalone VALID / 13 runtime assets; PDF runtime text extraction. All five required stages and the process exited 0. Local Node 24 checks are not a new Node 22 container build or live MFA acceptance.

### Concrete blocked operations; do not restart an audit

1. **Archive — one operator action:** open the authorized staging maintenance session for the actual runtime DB and document storage, with an isolated empty restore target. Do not send credentials or backups to chat. Through that channel verify connection identity, use the existing backup CLI with truthful quiescence confirmation, restore and verify in isolation, then fresh `preview-owner` → exact owner/11 IDs/3 QA/broker checks → existing execute/verify. Permission for the same 11 already exists; mismatch stops archive only. Snapshot confirmation has not been entered. Record the resulting real batch/count and list/reload/QA hashes only after execution.
2. **2FA activation:** separately approve the concrete linked plan before migration, new activation build or owner factor setup. Recovery implementation is saved; do not implement it again. No documentation-only commit goes to staging.
3. **Role/mail acceptance:** provide permitted separate CLIENT-only and assigned BROKER sign-in contexts plus a controlled recipient able to receive and use the reset message. Owner ADMIN does not satisfy these. Changing the password/factor belongs to the owner in the secure interface.
4. **Mobile:** a supported browser/device viewport is required for an actual mobile view and interactions; CSS contracts alone are insufficient.

Safe evidence: [checkpoint](evidence/2026-11-03-stage1-checkpoint-safe.json), [Documents after reload](evidence/2026-11-03-stage1-documents-live.jpg), [Documents after logout/login return](evidence/2026-11-03-stage1-login-return.jpg). QA hashes use the same projection constructed inside the read-only browser evaluate and serialized after the browser bridge's key ordering; reconstructing the object with a different insertion order is not a comparable hash method. Full source documents, credentials and recovery codes are absent from the evidence.

Production, main, DNS, real-user roles, financial sources, credit engine and paid integrations were not changed. Stage 2 was not started. The accepted existing staging result is preserved even though archive/role/mail/mobile/live-2FA conditions prevent closing Stage 1.

---
## Prior checkpoint — Stage 1, 2026-11-03 at 11:33Z (historical)

The following record describes the earlier RUNNING observation and its then-open checks. The current result above supersedes it; its original SHA and verification history are retained.

Scope: existing recovery branch → one checked staging delivery → ordinary browser acceptance. Production and Stage 2 remain excluded. The owner's current instruction authorizes the exact archived set in `2026-10-30-OWNER-ARCHIVE-REQUEST.json`; the historical approval blocker below is superseded. The archive implementation and CLI are unchanged.

Final code checkpoint: `5e84d1695bb8abb2f22e080de3a569495943d4d7`, tree `fdf3f528e6925038d80a21a8e12099aec2a4861a`; the temporary index made from the exact 21 changed code/test files matches that GitHub tree. Logical preceding commits: `4ca8532555ac1a920ed358c7d1d22fa75747b715` (auth/internal administration) and `871c219c449d885042234ee487c5f4d4a7e04019` (history/context). Final source inputs: `c68d9c34f312c7b903cb22facac70e9b6959a0f8af1eab18da058e1a1a1cb0d9`, `PRESCORE-SOURCE-INPUTS-1`, 711 files, lock `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`. Fresh files exactly match the packaged provenance. Local build ID `zgWAuDbHlmVcV3PKuw14p` is not a running-image identity.

### Changes and route continuity

| User scenario | Existing frontend → API → backend | Current change |
|---|---|---|
| Sign in / sign up / reset / logout | `app/login/credentials.tsx`, reset/logout → `/api/auth/[...all]` → `lib/auth/server.ts` / existing Better Auth tables | Preserve safe requested dossier+section across login using a proxy-overwritten request header; account switching goes through logout; logout handles network failure and duplicate clicks. No role creation or auth replacement. |
| Personal history | `client.tsx` → `/api/workspace?projection=summary` and existing full projection → owner-scoped analyses query | Explicit metadata designates only the three protected IDs in the exact staging runtime/origin. Separate WORK and QA groups, QA disclosure, no name matching or filtered-away records. Existing authorization executes before annotation. |
| Company navigation / reload | `client.tsx` → `use-model.ts` → `/api/workspace-model` → WorkspaceModelV1 | New analysis clears selected company without creating a record; 401/403/404 do not retain a financial model or stale company header. Documents retain their independent protected path. |
| Broker | `broker.tsx` / existing ClientShell → `/api/agent`, assigned-dossier workspace path → existing agent assignment checks | Same shell and unchanged assigned-client/read-only contracts; ADMIN session is not BROKER evidence. |
| Internal administration | `/prescore-control` → existing `app/admin/admin-dashboard.tsx` → existing `/api/admin` and `/api/billing/admin` | Server ADMIN check, noindex, no public links. Old `/admin` returns not-found. Existing administrative backend checks unchanged. |
| Future counterparties | Existing ClientShell navigation | Explicit disabled “Контрагенты / Позже”; no second analysis path and no fake action/results. Payment navigation label is “Оплата”; no billing activation. |

### Acceptance ledger — overall Stage 1 BLOCKED, not accepted

| Criterion | Local | Live |
|---|---|---|
| A — authentication | PASS — existing real auth-handler/verification/reset/logout/expiry tests | BLOCKED — ordinary owner login PASS on old active version; registration, received reset email and working link not verified. |
| B — roles | BLOCKED — server allow/deny and foreign-access tests PASS; mandatory 2FA missing | BLOCKED — owner ADMIN session available; separate CLIENT-only and BROKER sessions unavailable; no role grants. |
| C — archive | PASS — unchanged archive/restore/idempotency/payload/document/entitlement tests | BLOCKED — 0 archived. Exact 14 ACTIVE = approved 11 + protected 3, matching owner, no broker links, applications 0; this is not a transactional CLI preview or verified DB snapshot. |
| D — clean start / QA | PASS — explicit grouping, new work visibility and no name-based hiding | BLOCKED — candidate build RUNNING; no new live behavior claimed. |
| E — context | PASS — explicit selection, clearing new context, safe full login return, 401/403/404 isolation | BLOCKED — reload on new active candidate pending. |
| F — desktop/mobile / upload | BLOCKED — build and shell tests PASS; visual acceptance is not a CSS test | BLOCKED — safe before screenshots available; after capture timed out; mobile viewport not verified. |
| G — finances | PASS — 6809 regression and 24 Credit Lab cases, no engine/parser/Golden/financial expectation edits | BLOCKED — no finance/source/document writes; three protected QA before hashes retained; after-activation parity not yet verified. |
| H — traceability | PASS — exact GitHub code tree and packaged source-input match, all final local gates | BLOCKED — one Amvera RUNNING observation recorded; fresh candidate activation/health/ready/source match pending. |

First complete regression: 6807/6809, 0 skipped, 783051.248632 ms. Exactly two pre-existing assertions required a public `/admin` link (admin-controls/platform-ui). The new user requirement intentionally forbids it. Assertions now reject both public administrative URLs; public CLIENT/AGENT and other route checks are retained. Added actual server-role/old-route negative tests. No Golden or financial expected value changed. Targeted auth/UI recheck: 19/19. Targeted new history/access/navigation recheck: 38/38. The complete gate was rerun on the final code; results below retain the failed attempt.

Second complete gate: regression 6809/6809 (779859.127046 ms), Credit Lab 24/24, then LINT FAILED on `react/no-children-prop` in the new test. The correction passes the child as the third React.createElement argument; no product behavior changed. Corrected lint and the five new access/history tests pass. The third complete build and all gates PASS on the final code; the second attempt remains FAILED. Dockerfile and its mandatory gate remain unchanged. Local Docker is unavailable; container verification is still required by the existing Amvera build.

### Final checks and one staging delivery

Final local commands: `npm run build`, `node scripts/release/package-runtime.mjs`, `node scripts/qa/recovery-build-gate.mjs --build-only` — all exit 0. Regression **6809/6809**, zero skipped, 780941.706158 ms; Credit Lab **24/24**; lint PASS; standalone VALID with 13 runtime assets; PDF runtime text extraction PASS. Local Node 24 is not a substitute for the unchanged Node 22 Docker gate in Amvera.

At 2026-11-03T11:29:52Z, staging advanced once from `db33a7624ea061879fe8e2efb32e0b58c75e4993` to **`8b0809bd5eb22223fc80d73739eaab4d05d2782d`**, a history-preserving merge with second parent `5e84d1695bb8abb2f22e080de3a569495943d4d7` and exact checked tree `fdf3f528e6925038d80a21a8e12099aec2a4861a`. Expected-SHA/non-force update succeeded. Direct staging-to-candidate comparison found 36 changed blobs, no removed paths; inherited archive changes were preserved. No parallel branch changes were overwritten. Recovery commits use `[skip ci]`; the existing Amvera hookup watches staging.

**One Amvera observation at 2026-11-03T11:30:29.680Z: “Выполняется сборка” / RUNNING.** The version table still contained the prior successful rows and did not yet expose a new revision SHA. No second build, restart, activation or polling followed. Continue by checking this same delivery, not creating another. The last independently verified active revision/rollback remains `2cbc84ddc51c9ebf199ad9360d8dce0e3c3e10b0`; it is not relabelled as the new candidate. Candidate health/ready/source match and browser acceptance are NOT RUN. Full running digest/tree remain unverified.

Ordinary cabinet URL: https://prescore-staging-dorogovab.msk1.amvera.tech/dashboard . Authenticated owner login and the prior desktop screen were observed there. After activation, verify: sign in → start a new analysis without creating a row → select a protected QA in “Тестовые данные” → open Documents → reload and retain the selected company. Do not write new source data into protected QA for this check.

Safe evidence: [checkpoint and QA projection hashes](evidence/2026-11-03-stage1-checkpoint-safe.json), [login before](evidence/2026-11-03-stage1-login-before.jpg), [dashboard before](evidence/2026-11-03-stage1-dashboard-before.jpg). An Amvera screenshot capture timed out; no after screenshot is claimed. Documentation/evidence changes stay in recovery and must not trigger a second staging delivery.

### Single remaining Stage 1 backlog

1. Check the same staging delivery `8b0809bd5eb22223fc80d73739eaab4d05d2782d` on the next run. If successful, verify activation separately, then health/ready and source-input fingerprint. Do not push or rebuild merely to observe its completion. Docker gate remains enabled.
2. Archive requires the existing authorized maintenance channel running the unchanged CLI, actual connection identity, a verified recoverable snapshot and a fresh owner/IDs/count/fingerprint/broker-link preview. Current local environment has no DATABASE_URL; Amvera only exposes a masked runtime secret. The application /data backup list is empty. The database panel shows the latest listed daily snapshot dated 2026-10-22 and manual snapshot dated 2026-10-17; these predate the 2026-10-28 protected QA/upload data. They do not satisfy a current verified recovery snapshot. The cluster notes also mention an isolated production database, so the cluster name alone is not proof of the runtime database identity. Do not export credentials or invent confirmations. Owner authorization is already present and must not be requested again.
3. Existing Better Auth configuration has no 2FA plugin and existing schema has no factor enrollment. The installed package supports it, but activation requires a reviewed additive migration (`user.twoFactorEnabled`, plugin `twoFactor` records with encrypted secret/backup codes), owner enrollment/recovery and server enforcement for every ADMIN capability. No migration, fake 2FA or new privileged role was applied. Agree this minimal migration before executing it; hiding the URL is not 2FA.
4. Obtain permitted separate CLIENT-only and BROKER identities/sessions; exercise received verification/reset mail and reset link through the ordinary flow. Do not invent email recipients or treat owner ADMIN as BROKER.
5. After activation: ordinary dashboard + QA selection + documents/upload + reload; old URL and cross-role denial; desktop/mobile screenshots; exact active source metadata; archive batch/count and preserved QA evidence. Keep BLOCKED where these are absent.

### Configuration presence (no external integrations called)

Amvera `dorogovab/prescore-staging`: runtime mode `release-candidate`, exact canonical staging origin confirmed in UI. SMTP host/user/password/from variables present; delivery is unverified. AUTH_SECRET and DATABASE_URL present and masked. Checko, EIS, DeepSeek and acquiring credentials not listed in the complete 16-entry runtime configuration; no integration success inferred. Local build environment contains none of these live credentials. Existing synthetic fixtures and authorized real-source analyses are already present; no re-upload requested.

### Requirements retained for later stages, not implemented here

Counterparty checks reuse the same analytics; protected upload links without registration; FREE up to five quick checks per month and up to three justified own-company recommendations; paid target 500 with its period still undecided; Checko monitoring with update budget undecided; free financing requests; analysis versions and financing outcomes. Decide the 500 period and monitoring budget before commercial implementation. No guest upload, billing, Checko/EIS/DeepSeek integration or monitoring work in Stage 1.

---
Historical evidence below applies only to its stated code and dates.

Updated 2026-10-30. Current packet: owner-only history archive, prepared in recovery; no live archive/deployment authorized yet. The accepted db33a762 print/local-AI results remain historical evidence for that code.

## Owner-only history cleanup — 2026-10-30

Evidence and exact inventory: [bounded implementation / operator record](2026-10-30-OWNER-HISTORY-ARCHIVE.md); [proposed 11-ID request](2026-10-30-OWNER-ARCHIVE-REQUEST.json). Existing recovery branch only; no new API/storage/migration and no change to the credit engine.

| Check | Status | Evidence / boundary |
|---|---|---|
| LIVE_OWNER_INVENTORY | PASS — read-only | Real staging dashboard has 14 ACTIVE rows; authenticated admin metadata matches the same owner and IDs. Broker fields null, applications total 0 at observation. |
| OWNER_ARCHIVE_IMPLEMENTATION | PASS — targeted local tests | Existing archive CLI now supports owner + exact IDs + protected QA + broker-link refusal; transactional revalidation and existing restore. Unowned/foreign rows cannot enter this owner plan. |
| PERSONAL_HISTORY_AND_EMPTY_ENTRY | PASS — local / live after change pending | Summary is strictly owner-only, GET no longer auto-claims unassigned rows; cached removed model cannot populate the header; explicit “Создать новый анализ”. |
| SOURCE_AND_QA_PRESERVATION | PASS — isolated local | Payload/documents/entitlements/owner unchanged; protected QA and foreign rows remain ACTIVE; archive and restore tested. Live QA not modified. |
| LOCAL_CANDIDATE_GATES | PASS — final code `7701c98bc23966f5c833c985538ec59a8a4b4651` | Typecheck/build, 6802/6802 regression, Credit Lab 24/24, lint, standalone and PDF runtime exit 0. Targeted 46/46; corrected baseline test 16/16. First 6800/6802 failure and baseline reproduction retained in evidence; only test binding corrected, report/engine/Golden unchanged. Source fingerprint `860c9101b6409ea0165323ba05a8ba7b52c108b732d26c890347c85a95080fff`, 708 files, same lock. |
| LIVE_ARCHIVE_AND_AFTER_RELOAD | BLOCKED — required owner confirmation | 0 live analyses changed. Exact 11-ID approval and separate staging-deployment authorization required. Three QA must remain ACTIVE/visible; literal empty history is not claimed. |

No other 19-block acceptance status is changed by this package. Production, DNS, roles and financial sources remain outside its write scope.

## Latest acceptance — db33a762 print/local AI, 2026-10-28

Continuation after [#11 comment 6469622804](https://github.com/Teddy1-blip/Prescore-v1.1/issues/11#issuecomment-6469622804). Full bounded evidence: [live acceptance record](2026-10-28-PRINT-AI-LIVE-ACCEPTANCE.md).

GitHub staging `db33a7624ea061879fe8e2efb32e0b58c75e4993`; tested recovery code `1d693c2ec6b48eb2273281d74e7fb5a8a6b24bd5`; GitHub tree `ba7c020f2a20b45e9462a0903b35ca4639eba83d`. Amvera success and active/used revision `2cbc84ddc51c9ebf199ad9360d8dce0e3c3e10b0`, previous 0fc268e4 no longer used. UI row date 28.10.2026 16:19; timezone not independently confirmed. No repeated build/restart/push/cancel.

Fresh health/ready HTTP **200 / 200**, READY, measured 10,256 / 6,154 ms at 18:07:17 / 18:07:23 UTC. Release RC3, schema 0009. Packaged source fingerprint `80a9e0f06b05f2c4638f695c9f4a17aef41874663372e8de62cae63cfa5bc797`, scope `PRESCORE-SOURCE-INPUTS-1`, 707 files, lock `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`: exact expected match. sourceSha/sourceTree UNKNOWN and image digests null remain separate **FULL_TREE_AND_RUNNING_DIGEST PARTIAL / TRACEABILITY_BLOCKED**; source-input match is not full-tree/image proof.

| Item | Result | Evidence |
| --- | --- | --- |
| BUILD_AND_ACTIVATION | PASS | Success and used checks on new revision; previous revision not used; running 1/1. |
| HEALTH_READY_AND_SOURCE_INPUTS | PASS | Fresh 200/200 READY, exact fingerprint/scope/count/lock match. |
| PRINT_BANKING_PARITY | PASS | Ordinary “Печать / PDF” link opened the protected report for the working analysis; banking labels, RUB values and individual periods match the fresh workspace-model. Source table retains bank period. Accounting periods and historical/current debt remain separate. |
| PRINT_CONTROL | PASS — screen control | Visible enabled “Печать / сохранить PDF” in “Управление печатью”; no automatic dialog on opening. Dark text now readable on white disclaimer background. This does not certify an exported PDF. |
| PDF_EXPORT_AND_VISUAL | BLOCKED | One ordinary print-button click: no download within 12,000 ms, no exposed save/print dialog; cloud browser has no supported general product-page PDF export and native control is unavailable. No substituted PDF. File, page count and SHA-256 unavailable; zero PDF pages visually inspected. |
| AI_PERIOD_EXPLANATION | PASS — requested meaning | New 1.2 answer gives annual 12 months versus actual six-month CUMULATIVE_YTD, exact revenue/profit/periods, and expressly rejects automatic annualization or treating half-year totals as equivalent annual deterioration. |
| AI_DEBT_DATES_AND_BASIS | PASS | New answer separates current UNKNOWN from dated historical 1.5m, dates overdue zero to the source, identifies 15.07.2026 as past relative to explicit 28.10.2026 assessment, and says this proves neither payment nor default. Observed service is explicitly distinguished from a confirmed future schedule. |
| AI_INDEX_AND_CAPACITY_LIMITATIONS | PASS — current-model reasons | Composite question includes both index and capacity, actual five missing fact codes in Russian, account coverage, freshness, unknown current principal, incomplete schedule and unmatched payments; 12 months/files do not establish sufficiency. No FNS-only or approval promise. |
| FINANCIAL_SOURCES_UNCHANGED | PASS | Exact before/after equality of nine financial/source projection groups. All four sources remain READY; no analysis/source parameter change. |

Working analysis `36527dc1-d7db-4fef-bd47-719a451b4d58`: bank 01.07.2025–30.06.2026, 12 full months, inflow 12,000,000 / outflow 10,320,000 / closing 11,680,000 / net 1,680,000 RUB all match their labelled print rows and periods. Opening remains UNKNOWN. Annual 2025 revenue/profit 12,000,000 / 2,160,000 and Jan–Jun 2026 cumulative 6,000,000 / 1,080,000 remain separate. Historical BKI 1,500,000 RUB on 30.06.2026 is not substituted for current UNKNOWN. No general index or capacity invented.

AI preflight rules/false/1.2 with zero messages; three ordinary UI questions sent once, exactly six new messages read back in the new namespace. Old 1.1 messages untouched. Application writes: 3 user + 3 assistant messages, normal conversation metadata and three usage writes inferred from successful handler; no SQL verification claimed. QA A not modified or messaged. Financial/source projection (nine groups) identical before/after, SHA-256 `44b5c8e677ec08611cf15a9350835c1effc15b2a86b95047b4f577180936aeb8`; all four sources READY.

Residual presentation issue: generic factor tails still repeat phrases, despite the three specific explanations now being correct; not claimed fixed. Actual PDF file/count/hash/all-page visual check remain BLOCKED after one ordinary button attempt. No alternative PDF generation. Broker/live legal/full numerical evaluation and missing image identity remain independent.

Final local code evidence for 1d693c2 (recorded in 6469622804, not rerun here): typecheck/build PASS; targeted 53/53; regression **6795/6795, zero skipped**; Credit Lab **24/24**; lint, standalone and PDF runtime gate PASS. This supersedes the pending corrected-candidate gates below without erasing the first failed gate. No old SHA PASS is transferred to changed code.

Safe evidence: [bank rows/disclaimer](evidence/2026-10-28-db33-print-banking.jpg), [print control](evidence/2026-10-28-db33-print-control.jpg), [new local limitations](evidence/2026-10-28-db33-ai-debt-capacity.jpg), [bounded JSON](evidence/2026-10-28-db33-acceptance-safe.json). Documentation-only recovery update; **do not merge this evidence commit into staging**. This pass does not close all 19 blocks.


## Implementation continuation after comment 6465853196 — 2026-10-28

Packet 1 (print banking/control): reproduced both omissions against actual PrintReport (2 failed assertions, after fixing the test loader import order). Added a FULL-only narrow banking projection from the same authorized workspace, exact sourceId joins to canonical report source groups, metric-specific periods, observed amounts/units/statuses and explicit UNKNOWN opening balance. No financial calculation, source mutation, scoring or Golden edit. Screen-only explicit print control on the protected real-analysis page; no automatic print dialog; footer contrast fixed.

Targeted command: `node --experimental-strip-types --test --test-concurrency=1 tests/print-banking-acceptance.test.mjs tests/client-report-visual-v1.test.mjs`: **22/22 PASS**. Covers labels/amounts/units/periods, known zero, UNKNOWN, multiple source periods, missing/unrelated IDs, absent bank data, immutable input and BASIC/FULL boundary. `npm run typecheck`: zero diagnostics. Local code checkpoint; new live acceptance NOT RUN. Installed Playwright Chromium executable absent; actual PDF export/page count/hash/all-page visual inspection remain BLOCKED pending a supported browser path. No app data written, no deployment performed at this checkpoint. Source IDs added only to authorized FULL availability; AI source allowlist deliberately strips them.

AI reproductions: three isolated tests fail for cumulative-period meaning, past payment dating/basis and composite index/capacity coverage. Fix follows as a separate packet. Prior acceptance evidence below remains historical for its original code.

Packet 2 (local explanations): prompt/context namespace now `PRESCORE-AI-ANALYST-CANONICAL-1.2`; no old messages rewritten. Bounded subtopics preserve the old primary-topic function and include debt/capacity in an index question. Safe allowlist adds reported period kind/flow/months, assessment/source/payment dates, canonical anchor basis and actual coverage/capacity diagnostics. Annual versus cumulative meaning, dated historical/UNKNOWN principal, dated overdue, past payment not proof of payment/default, observed versus contractual service, and published next action are rendered without recalculation or provider calls.

`tests/ai-local-acceptance.test.mjs tests/ai-context.test.mjs`: **31/31 PASS**, including actual isolated API persistence/auth/provider-mock boundary and legacy conversation isolation; typecheck **0 diagnostics**. New test scenario explicitly uses existing `parseFinancialPeriod('за 6 месяцев 2026')` to obtain valid CUMULATIVE_YTD; legacy integration-b YTD fixture and all Golden remain unchanged. Replayed pre-fix AI against this valid scenario: all three annual/YTD/annualization explanations absent. Tests also vary period type/months, missing dates, evaluation date, zero/UNKNOWN and actual coverage while preserving the input model. This fixture is not the live saved analysis.

Combined candidate still requires final build/regression/Credit Lab/lint/standalone/PDF-runtime gates and one staging delivery. Actual PDF export/visual and live AI answers are not yet accepted. No live messages, source writes, deployment or settings changes occurred during these local packets.

### First full gate failure and source-contract correction

Candidate `cf92291e7f10dafb1528be007609e7a710b71654`, tree `96b9873b497bb5e08794c9646490adeb75cbac16`: production build/typecheck and package-runtime passed, but full REGRESSION completed **6,794 PASS / 1 FAIL / 0 skipped** (6,795 total; 1,419,336.841079 ms), exit **1**. First/only failure: `tests/live-source-full-response.test.mjs:127`, `canonical sources remain authoritative and non-BKI rows keep their shape`, deep equality rejected the additional `sourceId: external-bfo` on a FINANCIAL_STATEMENTS row. Later gates correctly did not run. This candidate was never delivered to staging. Failed verification is preserved at `evidence/2026-10-28-print-ai-first-failed-gate.json`.

Correction restores the exact common `basic.sources.availability` contract. Only FULL receives a separate narrow `bankingSources` array (sourceId and its own dates), copied from the same canonical source observations; print uses it for ID joins. BASIC and the analyst allowlist do not receive these IDs. The existing failing test and all Golden remain unchanged; the new print test also asserts unchanged common source rows. Targeted print + FULL response + AI context + local AI tests: **53/53 PASS**, 18,659.092621 ms; typecheck **0 diagnostics**. Mandatory full gates must run again on the corrected tree; no prior PASS is transferred to it. No staging/app data write occurred.

## Historical packet — report, broker and local AI acceptance before fixes, 2026-10-28

Continuation after [#11 comment 6463225892](https://github.com/Teddy1-blip/Prescore-v1.1/issues/11#issuecomment-6463225892). Working analysis **`36527dc1-d7db-4fef-bd47-719a451b4d58`**, ООО PRESCORE QA UPLOAD 20261028 SYNTHETIC, synthetic INN **9900002906**. QA A `992ab9e3-672e-4adf-955e-9a2c40e3ece3` was only selected read-only to check context separation; no message or source update was submitted there.

| Acceptance item | Status | Scope and evidence |
| --- | --- | --- |
| CLIENT_REPORT_PARITY | **FAIL — missing bank details in print report** | Company/INN, annual and interim figures, dated historical principal/current UNKNOWN, insufficient index/readiness/capacity, material limitations and Action Plan retain their meaning. However the ordinary linked print report omits bank outflow **10,320,000 RUB**, closing balance **11,680,000 RUB**, and bank start/period **01.07.2025–30.06.2026** that exist in the live API/client screen. The bank source row has an empty date cell. The 12,000,000 RUB visible in the financial appendix is BFO revenue, not proof of a displayed bank inflow total. |
| PRINT_VIEW | **PASS — opening only** | The normal “Печать / PDF” link opened the authenticated product route `/dashboard/report-v2?analysisId=36527dc1-d7db-4fef-bd47-719a451b4d58&print=1`, for the correct saved company. Actual report, source appendix and actions rendered. This PASS does not certify a PDF, pagination or complete financial parity. |
| PDF_EXPORT_AND_VISUAL | **BLOCKED** | This reachable print route exposes no save/print button: `ClientReportShell` renders `PrintControl` only when `!print`. One ordinary browser Ctrl+P attempt exposed no usable save-PDF/print-preview dialog or downloadable PDF in this cloud session. The supported browser API has no general PDF printing/export capability and native computer APIs are disabled. No alternate generated PDF, reconstructed HTML export, hidden browser/CDP method or old extraction smoke was substituted. **PDF file, page count and SHA-256: unavailable. All-page PDF visual inspection: not performed.** |
| BROKER_PARITY_AND_ACCESS | **BLOCKED** | The available authorized session returns `access.role=OWNER`, `readOnly=false`. No separate existing ASSIGNED_BROKER session for this analysis was available. Assignment is not proved absent; it could not be tested under a broker actor. No /agent-owner view was counted as broker acceptance, no account/role/assignment was created or changed, and no mutation was attempted to test denial. |
| AI_LOCAL_CONTEXT | **PARTIAL** | Existing GET returned available=true, mode=rules, providerConnected=false, promptVersion `PRESCORE-AI-ANALYST-CANONICAL-1.1`, zero initial messages. Source review proved that the POST cannot choose the external DeepSeek provider without the same key/model pair. Three normal UI questions produced three saved deterministic answers; subsequent GET remained rules/false and contained exactly six messages. Financial facts were not invented, but each answer misses part of the requested explanation; details below. Context switching and return preserved correct per-analysis history. |
| FINANCIAL_SOURCES_UNCHANGED | **PASS — explicit before/after projection** | Fresh authorized workspace-model before and after the pass: exact equality of company/analysis period, full basic source summary, all bank facts/months, financial analysis/history, BKI portfolio, index value/status, capacity status/operating basis/headline and readiness status/level. Technical request/conversation timestamps were not treated as financial regressions. Four sources remain READY. |

### Version, baseline and method

Remote staging remained `48d3b7d79e90bd76079a1f21352c80bc844f9162`; recovery baseline for this documentation update is `8c99ffdc9cd2b09650aa61d8ec7b372f0b7ba9c1`. Latest issue comment at start was 6463225892. One fresh health GET completed **28.10.2026 12:37:32 MSK** (`2026-10-28T12:37:32.379969+03:00`), **HTTP 200 / 6021 ms**. Release `PRESCORE-V1-RC3-20261019`, schema `0009_analysis_archive.sql`, buildId `qrOQ6A71_FY67MFZVPx4C`, buildTimestamp `2026-10-27T20:34:25.026Z`.

Packaged fingerprint unchanged: `ef11633a5b56cf8128eb50f4f0afecaaa10e0c1d97cf5a1ac4712a58f5c9ac6c`, scope `PRESCORE-SOURCE-INPUTS-1`, 702 files; lock `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`. sourceSha/sourceTree UNKNOWN and running/published digest fields null remain separate limitations. Last independently verified active Amvera revision is `0fc268e4d611bb4bf5cc9bf4c29c762a095936c4` from the accepted earlier pass; old build logs/activation/ready were not re-audited or relabelled as freshly checked.

This is manual browser Work acceptance against the live saved analysis, not a fixture/adaptor replay or an automated Playwright suite. Browser-rendered authorized API JSON was read via ordinary GET; no cookies, token export, raw DB access or fabricated payload. POST/API HTTP headers were not exposed by the available browser inspection, so no numeric status is invented for those requests.

Baseline matched the preceding accepted controls:

- Bank 01.07.2025–30.06.2026, 12 full months; inflow 12,000,000, outflow 10,320,000, ending balance 11,680,000 RUB. Operating basis 1,000,000 RUB.
- Annual BFO 01.01–31.12.2025 / FULL_YEAR / 12 months: revenue 12,000,000, net profit 2,160,000 RUB.
- Interim 01.01–30.06.2026 / CUMULATIVE_YTD / 6 months: revenue 6,000,000, net profit 1,080,000 RUB. These are separate periods, not comparable annual growth or automatic annualization.
- BKI source date 30.06.2026: reportedPrincipal 1,500,000 RUB; payment/nextPayment 100,000 RUB; nextDate 15.07.2026. Current principal null/UNKNOWN as of 28.10.2026. The July payment date is in the past relative to assessment, not a new future payment.
- Overall index null/INSUFFICIENT_DATA; readiness UNKNOWN/INSUFFICIENT_DATA; capacity INSUFFICIENT_DATA. Existing stale-source, unproven account coverage, unmatched-payment, unknown-principal/incomplete-schedule and LEGAL_LIFECYCLE limits remain. No expected values were changed to fit a different live result.

### Report defect reproduction and bounded evidence

1. Open the working saved analysis → “Анализ Prescore” → “Печать / PDF”.
2. In the rendered print route, inspect “Данные и ограничения” / source table and source appendix.
3. Expected: bank source retains its known period, and the report carries the checked bank totals/balance distinctly from accounting revenue.
4. Actual: bank source date cell is blank; the rendered full report text (76,025 characters) contains neither bank-period start nor outflow/ending-balance values, including whitespace-normalized checks. The client Conclusion and live API retain them. This is an omission in report projection/display, not evidence that source data were lost.
5. Financial appendix does show the two separate accounting periods and their exact revenue/profit, then historical principal 1,500,000 RUB on 30.06.2026 versus “Не определено” on the analysis date. It preserves the next-payment date as a dated source field; it is not accepted as a future commitment.
6. Report retains 12 full months, operating bases 1,000,000 RUB, insufficient index/readiness/capacity, stale-source/unknown-principal/unmatched-payment explanations, recommendations and Action Plan counts **11 / 1 / 0** on 04.11 / 27.11 / 27.12.2026. No bank approval promise found.
7. A separate visible HTML-print issue: the repeated footer disclaimer has dark text on a dark background. This observation concerns the web print view, not unproduced PDF pages.

Safe image: [bank source has no period](evidence/2026-10-28-print-bank-period-missing.jpg). No input document or full payload is included.

### Local AI: exact questions, bounded result and persistence

Preflight checked `app/api/ai-analyst/route.ts`, `lib/ai/providers/index.ts` and `lib/platform/runtime.ts` for the accepted source scope. GET's key/model pair comes from process.env via getRuntime; POST's configuredProvider returns null when that pair is absent. Existing mode was rules before submission; no mode/config/key change or provider smoke request was made. All three questions were submitted through the ordinary UI on the working analysis:

1. “Сопоставь годовую и промежуточную выручку и прибыль. Укажи периоды и объясни, почему это разные показатели”.
   **Facts PASS, explanation PARTIAL:** correct 2025 revenue/profit 12,000,000 / 2,160,000 and 2026 Jan–Jun 6,000,000 / 1,080,000 RUB, with both date ranges. It lists facts but does not explain annual versus six-month cumulative comparability; generic repeated context text adds noise.
2. “Какой остаток долга подтверждён сейчас? Чем он отличается от 1,5 млн рублей в отчёте БКИ? Актуален ли указанный следующий платёж?”
   **Principal distinction PASS, payment currency PARTIAL:** current debt is not confirmed, historical 1,500,000 RUB explicitly tied to 30.06.2026. It does not include 15.07.2026 or assess that payment date's past/current status. It gives the canonical regular/near-term service anchors 100,000 RUB without explaining their distinction from the historical next-payment field; it does not explicitly call July a future date. Overdue 0 RUB is printed without its own source-date qualification in that line. No new current principal or approved limit is invented.
3. “Почему общий индекс и долговая ёмкость не рассчитаны, хотя загружены четыре документа и есть 12 месяцев выписок? Каких подтверждений не хватает?”
   **PARTIAL:** states index insufficient, then generic factors and caveats. It does not enumerate the actual missing BANK_OPERATING_TREND, BANK_TOP1, BANK_COVERAGE_ADEQUATE, BANK_DEBT_SERVICE_RATIO and LEGAL_LIFECYCLE facts, or the separate capacity coverage/staleness/portfolio constraints. It does not claim FNS alone would suffice. Existing keyword routing selects the index topic before debt; this is a diagnostic observation, not a code change.

All responses remained within the selected synthetic snapshot: no other-company facts, newly calculated score, bank approval promise or declared current 1.5m debt. Generic labels and repeated “период не указан — не указан” remain in local AI source text; this does not undo the separately accepted linked Why dialog on QA A.

One post-answer history GET returned visible infrastructure text: `upstream connect error or disconnect/reset before headers. reset reason: connection termination`. HTTP status was not exposed. One read-only retry succeeded, with rules/false and six messages; no POST was repeated. Switching the selector to QA A removed all six messages and displayed its own empty local conversation. No message was sent there. Switching back restored the same three questions/three answers. This checks per-analysis context in one owner session, not cross-user security.

Safe image: [local AI answer and limitations](evidence/2026-10-28-ai-local-result.jpg). Exactly **3 user messages + 3 assistant messages** were observed persisted in the working synthetic analysis; the ordinary handler also maintains its conversation and three usage records. Usage metadata count is inferred from the successful handler path, not independently queried with SQL. No financial source or analysis parameter was edited.

### Remaining next steps and boundaries

Next implementation package, if authorized separately: restore missing bank totals/source period in the ordinary report; improve deterministic explanations of period comparability, past BKI payment dates and the actual index/capacity limitations. No fix or rebuild was attempted here. Genuine PDF export + all-page visual inspection still requires an available supported print/download path. Broker acceptance still requires an existing authorized ASSIGNED_BROKER session and effective assignment, without changing roles to manufacture a pass.

No new uploads/analyses, source changes, code changes, deployments, manual SQL/migrations, role/settings changes, production, DNS, payment, FNS or external AI/Checko request. Documentation-only recovery evidence must not be transferred to staging. Full numeric scoring, trusted live legal intake, full imported-tree/running-digest identity and overall 19-block acceptance remain separate.

## Previous accepted packet — ordinary document upload acceptance, 2026-10-28

Continuation after [#11 comment 6460656372](https://github.com/Teddy1-blip/Prescore-v1.1/issues/11#issuecomment-6460656372). The preceding packet's build/activation, health/ready, source-input match, live Why and QA A control facts remain accepted in their verified scope. The historical RUNNING observations below are superseded by that terminal acceptance, not repeated here. Full imported-tree/running-container-digest identity remains a separate PARTIAL/BLOCKED release-ledger item.

### Version and safe write boundary

- At start and before this ledger update, staging remained `48d3b7d79e90bd76079a1f21352c80bc844f9162`; recovery remained `c1dd60c268d9598951688a26ad5008e20fa30807`. The latter is the parent baseline for this documentation-only update; it is not another staging delivery.
- One fresh `GET /api/health` at `2026-10-28T06:59:04.076590Z`: HTTP 200, 4514 ms. Release `PRESCORE-V1-RC3-20261019`, schema `0009_analysis_archive.sql`, buildId `qrOQ6A71_FY67MFZVPx4C`, packaged buildTimestamp `2026-10-27T20:34:25.026Z`.
- Same packaged source fingerprint `ef11633a5b56cf8128eb50f4f0afecaaa10e0c1d97cf5a1ac4712a58f5c9ac6c`, scope `PRESCORE-SOURCE-INPUTS-1`, 702 files; lock SHA-256 `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`. sourceSha/sourceTree remain UNKNOWN, checkout UNAVAILABLE. No full-tree or running-digest assertion is added. Last independently confirmed active Amvera revision remains `0fc268e4d611bb4bf5cc9bf4c29c762a095936c4` from the prior pass; this pass did not repeat the build/version-control investigation or claim a fresh ready check.
- Before the first write, the selected host and Amvera app were verified as `prescore-staging-dorogovab.msk1.amvera.tech` / `prescore-staging`. Existing non-secret configuration showed release-candidate mode and `PRESCORE_STAGING_FREE_FULL=1`; no change was made.
- Source review found that ordinary bank acceptance automatically attempts the internal `/api/checko` route. All 16 staging variable names were inspected without revealing values: `CHECKO_API_KEY` is absent. The route returns before the external provider call without that key; Docker inputs exclude .env files. The UI subsequently reported that open data were unavailable while bank analysis was saved. Thus this flow includes an internal enrichment attempt but did not send the synthetic INN to Checko. No FNS request, AI message, external application, payment or email was initiated. Ordinary source handlers use local parsers.
- New analysis: **`36527dc1-d7db-4fef-bd47-719a451b4d58`**, **ООО PRESCORE QA UPLOAD 20261028 SYNTHETIC**, synthetic INN **9900002906**. Existing authorized OWNER session, existing FULL entitlement. Opened documents without analysisId, saw an explicit selection/new-analysis prompt, then used “Новый анализ”. Exactly one bank submission created this analysis; three subsequent analytic source submissions extended the same analysis. No duplicate analysis, seed, API payload injection or “Добавить в досье” substitution.

### Inputs fixed before upload

Existing `tests/fixtures/integration-b` supplied the synthetic 12-month 1C data and accounting values; the prior synthetic corporate PDF layout supplied the BKI layout. Three real, text-readable PDFs were prepared with the same synthetic company, visually inspected and text-extracted before upload. Adapter-only JSON was not uploaded. No legal ACTIVE or legal source was fabricated.

Before any live write, file hashes and independent controls were recorded. Bank expectations came from Python Decimal summation of raw 1C transactions; PDF expectations came from explicitly authored accounting rows and labelled BKI figures, not the Prescore parser or workspace-model under test. The pre-upload manifest is an immutable preparation snapshot, not a subsequent runtime PASS.

| Uploaded file | Format / bytes | SHA-256 |
| --- | --- | --- |
| `01_bank_12m_synthetic.txt` | 1C TXT / 113054 | `ed2418cbd22c9225688b0164066edfb7a77503ea68518612fabc5ae8cfe78134` |
| `02_bfo_2025_synthetic.pdf` | Text PDF / 27165 | `517c8b35878e5076f0b6a258ed4273db9249455e86ec21f60592d19b50188d48` |
| `03_quarterly_6m_2026_synthetic.pdf` | Text PDF / 27188 | `ceb477ea3bd9956038974988d06a92d98a76535f882a7bf9713f6d0296b547a3` |
| `04_bki_corporate_synthetic.pdf` | Text PDF / 27548 | `70af77a09c8ba82ea0ff3e1660b5d43b36f57ca8648ad13fd4dce5db5bec084c` |

### Actual ordinary-form results

PASS here means supported file → ordinary form → parsed/saved source → authorized workspace-model → screen → page reload, for this synthetic input only. This was a manual Work browser pass, not an automated Playwright suite. POST response status/timing/size were not exposed by this browser inspection; none is invented. Fresh standard workspace-model JSON and visible success/source states were read without publishing their full payloads. HTTP 200 above belongs only to the independently measured health request.

| Source | Result | Independently expected and observed controls |
| --- | --- | --- |
| Bank statement | **PASS** | 01.07.2025–30.06.2026; 132 transactions; 12 full months. Inflow 12,000,000 RUB; outflow 10,320,000 RUB; net 1,680,000 RUB; closing 11,680,000 RUB from opening 10,000,000 RUB. Each month: inflow/operating basis 1,000,000 RUB, outflow 860,000 RUB, observed debt payments 100,000 RUB. UI “Обработан”, API bank source READY. Reload retained analysis, company, period and values. |
| Annual BFO | **PASS** | 01.01.2025–31.12.2025, FULL_YEAR, 12 months, RUB scale 1. Revenue 12,000,000; net profit 2,160,000; assets 10,000,000; current assets 6,000,000; equity 5,000,000; current liabilities 3,000,000; working capital 3,000,000 RUB; current ratio 2. API annual source READY, source identity includes the uploaded file hash. Balance/income reconciled. UI values and period match; reload retained source. Bank facts remained equal to the prior fresh API snapshot. |
| Interim / quarterly reporting | **PASS** | 01.01.2026–30.06.2026, INTERIM / CUMULATIVE_YTD, 6 months. Revenue 6,000,000; net profit 1,080,000 RUB; same explicit balance controls and current ratio 2. API source READY, hash-linked identity; annual and interim periods coexist without annualization or replacement. UI period/values match; reload retained both. Bank facts and existing annual history remained equal. |
| Corporate BKI | **PASS** | One TERM_LOAN / FUNDED_DEBT obligation, report dated 30.06.2026. Historical reported principal 1,500,000 RUB; monthly/next payment 100,000 RUB, next date 15.07.2026; overdue 0 RUB **as of the report date**. UI separates report date from receipt 28.10.2026, displays the source size/limit 2,500,000 RUB, and explains incomplete/current-unknown schedule. Current principal remains null/UNKNOWN, not the historical amount or zero. API source READY; reload retained obligation and previous sources. |

The source's labelled 2,500,000 RUB size/limit was displayed; no additional acceptance claim is made that this label proves a particular `originalAmount` contract. Period confidence from the authored preparation manifest is not runtime validation: parsed financial period confidence was MEDIUM and was not elevated to the author's HIGH annotation.

Final reload and fresh workspace-model: same analysis/company; all four source statuses READY. Bank facts equal the bank baseline, the complete two-period financial history equals the pre-BKI snapshot, and BKI portfolio equals its pre-reload snapshot. The Financials screen retained both periods and their expanded control values; Obligations retained historical principal, dated payment and current-unknown explanation. Documents displayed all four “Обработан” rows with separate own periods/report date. Only derived analytic persistence is accepted here; this is not a claim that original PDF bytes were retained in the company dossier.

### Exact remaining limits

- Workspace state READY_FULL describes the available workspace/entitlement, **not** a sufficient numeric index. Overall index is null / INSUFFICIENT_DATA; readiness level UNKNOWN / INSUFFICIENT_DATA; capacity INSUFFICIENT_DATA with 12 full months.
- Financial-strength component ADEQUATE, missing facts [].
- OPERATING_BEHAVIOR INSUFFICIENT: missing `BANK_OPERATING_TREND`, `BANK_TOP1`, `BANK_COVERAGE_ADEQUATE`.
- DEBT_CREDIT INSUFFICIENT: missing `BANK_DEBT_SERVICE_RATIO`.
- LEGAL_CORPORATE INSUFFICIENT: missing `LEGAL_LIFECYCLE`.
- Observed capacity limitations include `ACCOUNT_COVERAGE_NOT_PROVEN`, `ASSESSMENT_NOT_COMPLETE`, `CAPACITY_NOT_COMPLETE`, `COVERAGE_INSUFFICIENT`, `SOURCE_STALE`, `CTX-BKI-STALE_SUPPORTED`, `DEBT_PAYMENT_UNMATCHED`, `CTX-UNMATCHED-PAYMENTS_SUPPORTED`, `PORTFOLIO_OUTSTANDING_UNKNOWN`, `PORTFOLIO_SCHEDULE_INCOMPLETE`, `UNSPLIT_PAYMENT_NOT_PRINCIPAL_REDUCTION`; pre-calibration/shadow and not-bank-decision/product-recommendation caveats also remain. UI explains stale evidence, preserves history and does not turn an unknown schedule remainder into zero. Twelve full months do not by themselves prove current coverage or adequate index inputs.
- No upload/parser/persistence/API-projection/display defect was found in the four tested supported synthetic files. This does not accept an unavailable problematic owner file, arbitrary PDFs/scans or other formats.
- Live FNS / sufficient trusted legal intake remains **BLOCKED / separate**. No test transport, arbitrary PDF or ACTIVE substitution. Full-tree/running-digest identity, live BROKER, AI and generated visual PDF acceptance remain separate, as does the whole 19-block acceptance. The next product scenario is a genuinely supported, independently verified legal-source intake when its service/path is available; it must not be inferred from these uploads.

Input documents, full payloads, cookies, tokens and personal documents are not published. The safe UI evidence shows only the synthetic analysis and its four processed sources. This ledger update is documentation only and must not be merged into staging as another delivery.

## Historical packet — linked Why evidence and packaged provenance

**Final local gate PASS; one staging delivery RUNNING.** Frozen code candidate `2aaf838cb8941754b59dda681f1d0e7ce8dea0e8`, tree `05661a427d579add8eeee46341d930aa9c2c2536`. Staging merge `48d3b7d79e90bd76079a1f21352c80bc844f9162` has exactly the same tree and parents `186706751b43798c53f59533628fcb6dcbb94482` / `2aaf838cb8941754b59dda681f1d0e7ce8dea0e8`. Heads and 17-path diff were rechecked before the single non-forced delivery; no independent changes were discarded. This subsequent ledger-only recovery commit is **not** the staging candidate.

- `npm run build` → PASS (typecheck 0 diagnostics, Next 16.4.1 webpack); `node scripts/release/package-runtime.mjs` → PASS.
- `node scripts/qa/recovery-build-gate.mjs --build-only` → exit 0, all five stages PASSED: REGRESSION **6785/6785**, 0 fail/cancelled/skipped (769835.085874 ms); CREDIT_LAB **24/24**; LINT exit 0; ARTIFACT VALID (13 required assets, input fingerprint/BUILD_ID match); PDF_RUNTIME native canvas/DOMMatrix/worker/text extraction PASS. Node 24.22.1/npm 11.9.0 locally; Docker verification belongs to the still-running Amvera build, not this local result. No build gate was disabled.
- New imported Amvera revision: `0fc268e4d611bb4bf5cc9bf4c29c762a095936c4`. One read of Control Versions/Repository and one build-log query: RUNNING, `RUN npm ci`. Last captured line `27/10/26 22:30:43` — `Container builder is still running.` UI timezone is not independently confirmed. The log records checkout of `0fc268e` at `22:30:08`; no terminal exit code yet. Active/stored/built image remains `0c0b10ef2d9dcb98467011aa1ea94c58bd0aaf4c`. No cancellation/restart/repeated query/build.
- **WHY_EXPLANATION: local PASS; live acceptance BLOCKED on new activation.** Reproduction, concrete CUSTOMER_CONCENTRATION_HIGH, canonical values/units, exact July source period, multiple/unrelated/missing claims, dates, duplicate references, CLIENT/BROKER basis and model immutability are checked. New-candidate health/ready and unchanged QA A browser path were not performed and are not marked PASS. The previous candidate's accepted control facts remain historical evidence.
- **BUILD_TRACEABILITY: PARTIAL.** GitHub candidate/staging SHA and exact whole-tree equality are established. Local build captures/rechecks/packages the 702-file fingerprint; real standalone HTTP health reads it and rejects runtime SHA/timestamp impersonation. Amvera import revision is observed; equality of its whole tree, the next published digest, activation and running digest are not yet established. The old published digest `sha256:2c58ed8a7be9554b2c49d2182b4f1f2b02bf2bd25579097c950056dcf04ecb35` remains a separate historical link, not a running-container digest. Old image imported-tree/running-digest identity remains TRACEABILITY_BLOCKED.
- Next bounded step: one terminal status/log read for `0fc268e4d611bb4bf5cc9bf4c29c762a095936c4`; on SUCCESS establish activation, compare packaged source fingerprint/lock with this candidate, check fresh HTTP health/ready, then read-only QA A → Conclusion → Key limitation → Why and retained financial facts. On RUNNING record stage/time and stop; on FAILED record first error and stop. No new push/build is needed.

Safe captured build excerpt: [2026-10-27-why-build-observation.txt](evidence/2026-10-27-why-build-observation.txt). Full-19-block acceptance, live FNS, sufficient legal intake, ordinary upload E2E, live BROKER, AI and visual PDF are not implied by this packet.

Packet start: continuation of #11 comment 6451350666, recovery HEAD `511e1baf191fcd21c66d74b317709eb2ff2ef01f`; staging was `186706751b43798c53f59533628fcb6dcbb94482`. The previous container completed exit 0 and Amvera revision `0c0b10ef2d9dcb98467011aa1ea94c58bd0aaf4c` became active. New health/ready HTTP 200 and read-only QA A/entry checks are preserved as confirmed historical results, not reset to unaccepted and not inherited by the next candidate.

WHY_EXPLANATION: regression first reproduced the exact generic copy and doubled missing-period placeholder. Presentation now follows existing claimId → riskFindingIds → concrete claims → value-binding sourceReferenceIds. No text/array-position/source-kind join; no source dates borrowed from the whole analysis. Same-source identities and dates are deduplicated, distinct periods are preserved, and missing/partial/as-of dates remain explicit. CLIENT and read-only BROKER share this resolver. Key-constraint selection order and all canonical computations are unchanged; Golden files are unchanged.

BUILD_TRACEABILITY: previous artifact remains BLOCKED for imported-tree/running-digest identity. A bounded system-log query returned no history; export prohibition was respected. The next build captures/rechecks/embeds actual source inputs and lock fingerprint, retaining only verified local Git metadata when available. Health reads packaged evidence, never runtime SHA assertions. Scope and limitations: [BUILD-PROVENANCE.md](BUILD-PROVENANCE.md). No manifest/timestamp claim is a running-digest attestation.

Targeted checks: `node --experimental-strip-types --test --test-reporter=tap --test-concurrency=1 tests/why-linked-evidence.test.mjs tests/build-provenance.test.mjs tests/rc-runtime.test.mjs tests/live-source-full-response.test.mjs tests/client-product.test.mjs tests/recovery-build-gate.test.mjs` — 75/75 PASS, 0 fail/skip. Compatibility checks first caught four missing-claims rendering failures; the resolver now retains the original fallback when claims are absent. The existing assertions were not weakened. `npm run build` (including typecheck, 0 diagnostics) and `node scripts/release/package-runtime.mjs` passed. `node scripts/qa/recovery-build-gate.mjs --build-only` is RUNNING at candidate save; the terminal result and exact candidate SHA will be appended, with no inherited old full PASS. Local standalone `/api/health` returned HTTP 200, 513 ms, the packaged fingerprint and timestamp; forged runtime SHA/timestamp did not replace them (sourceSha remained UNKNOWN). This is a local artifact check, not staging health/ready acceptance.

Candidate input fingerprint `ef11633a5b56cf8128eb50f4f0afecaaa10e0c1d97cf5a1ac4712a58f5c9ac6c`, scope `PRESCORE-SOURCE-INPUTS-1`, 702 files; lock SHA-256 `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`. Local build checkout was dirty and correctly published no commit/tree. Container Git absence must remain UNAVAILABLE; compare source fingerprints, not a runtime SHA assertion. Before transfer, Amvera Control Versions showed `0c0b10ef2d9dcb98467011aa1ea94c58bd0aaf4c` Built/Stored/Used, with the normal rollback action (disabled while already active); no retention setting or rollback was changed. Existing Git staging source remains a separate rollback reference. QA A, data, roles, production, DNS, paid providers and secrets remain untouched. Live FNS, ordinary uploads, sufficient legal scenario, BROKER browser flow, AI and visual PDF remain separately unperformed/blocked as previously recorded.

## Historical checkpoint — trusted legal intake candidate

**Local gate PASS; Amvera container RUNNING; live acceptance NOT DONE.** Frozen code candidate: `a42207b5aff43e0ff6a0b5957f6ab35d80021154`, tree `9a329daaeb8db9fee385daf97d33852063472113`. One staging merge: `186706751b43798c53f59533628fcb6dcbb94482`, same tree. New Amvera imported revision: `0c0b10ef2d9dcb98467011aa1ea94c58bd0aaf4c`. Last captured build stage `RUN npm ci`; last log line `27/10/26 19:23:42` (literal Amvera UI time; timezone not independently established), `Container builder is still running.` Observation ended as instructed, without cancellation, restart, repeated query or duplicate delivery.

The API cells for 01/07/10 now distinguish the implemented/verified isolated handler from the still-unverified live official-source path. Historical results below remain attached to their original code; final evidence for the new candidate is at the end.

## Baseline and packet 1

- Recovery base: `2a4f981eee08c97b4ce5099c02235d5d0366f04b`, tree `4bed0546f53ffbeedcb4a8ea4e528b0ae8791792`.
- Staging: `783bfdf9977d6a1aaa899cddcb757ffc637df4b6`, tree `731e58e64ca36353bab63ae955035f2917922054`.
- Product: `e798d4654f2b0cf7eb96b291ff2c6135c84dcfa8`.
- Exact recovery snapshot restored by verified Git blobs; local `git write-tree` equals its remote tree.
- Compared both directions against common ancestor `e3cd54403310e74be988c4f5001c3c7dd52bd76b`. Staging changes nine paths; recovery independently changes five public-financing paths. Sets are disjoint. Nine staging paths integrated without rewriting history or changing the five public-financing files.
- Amvera terminal revision `a02e4c61aa05048b64883c0633e3cf5c1803f93d`: build FAIL, 6,733 PASS / 5 FAIL / 0 skipped. Last UI line 27.10.2026 15:43:09, “Docker build watcher application completed”; exit 1. Source parent/tree identity has NOT been independently established from the Amvera merge label.
- Active revision remains `574c42b929b3116dac4bf3b99ec012d9d0aa60ba` (Used and Built check marks). No restart or repeated build.
- All five failures reproduced locally in `tests/live-source-full-response.test.mjs`: `TypeError: Cannot read properties of undefined (reading 'components')` at `IndexEvidenceGaps`. The isolated service stub supplied only `prescoreIndex: {value:null}`; the real required Index contract includes coverage. Fixture now supplies legal/operating missing facts; assertions additionally require both explanations. No production fallback, scoring change, skip, or Golden update.
- Node 24.22.1, npm 11.9.0: clean `npm ci` PASS (473 packages); `npm run typecheck` PASS (0 diagnostics).
- Targeted packet checks: 30 PASS / 0 FAIL / 0 skipped across full-source-response, quick-entry authorization, coverage guidance and preserved public financing.
- Initial full regression was superseded by the reproduced defects below; no complete PASS is claimed. The packet 2 full run was locally stopped after another reproduced defect; no Amvera build was cancelled. A clean build and the unchanged full gate subsequently passed for packet 3; final evidence is below.
- Local Next build compiled and generated routes but returned exit 1 with `SecurityFatalError` for Next 16.4.0. This is NOT build PASS; dependency advisory was subsequently verified and addressed in packet 2. Docker executable is unavailable locally. Required Docker/recovery gates are unchanged.

## Status rules

PASS means the named layer was executed and checked on the integrated candidate, not merely found in source. Engine/canonical/tests PASS below refers to the completed 6,754-test regression, 24 business cases and isolated B/handler checks on code candidate 88966d3. It is bounded by those supported formats and synthetic cases, not proof of every possible real document or live workflow. API PASS means actual handler/permission tests, with synthetic auth identities and isolated PGlite. CLIENT/BROKER/Report cells remain BLOCKED for browser/visual acceptance even where static renders pass. AI PASS is the deterministic provider-free and mocked-provider contract only. BLOCKED means verification/input/environment is outstanding. PARTIAL identifies an evidenced missing integration. No live acceptance is inherited from old documents or an older active revision.

| Block | Engine | Canonical | API | CLIENT | BROKER | Report/AI | Tests | Live |
|---|---|---|---|---|---|---|---|---|
| 01 Source Integrity | PASS | PASS | PARTIAL (handler PASS) | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 02 Normalization | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 03 Classification | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 04 Banking Metrics | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 05 Financial Analysis | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 06 Reconciliation | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 6.5 Credit Portfolio Foundation | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 07 Risk / Stops | PASS | PASS | PARTIAL (handler PASS) | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 08 Credit Lab | PASS | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | PASS | NOT_APPLICABLE |
| 09 Context | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 10 Prescore Index | PASS | PASS | PARTIAL (handler PASS) | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 11 Financing Readiness | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 12 Credit Assessment | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 13 Debt Capacity | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 14 Product Selection | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 15 Recommendations | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 16 Action Plan | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 17 Explainability | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 18 Client Report | PASS | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | PASS | BLOCKED |
| 19 AI Analyst | PASS | PASS | PASS | BLOCKED | BLOCKED | PASS | PASS | BLOCKED |

## Exact verification seams and exit criteria

Engine/canonical/test gates now pass for the stated synthetic and supported-source scope. At the historical baseline, API PARTIAL for 01/07/10 identified missing trusted provider-independent legal-document intake, not a failing Checko/profile adapter. The new handler and its isolated checks are now implemented; live official-source compatibility remains unverified as detailed in the latest checkpoint. UI/BROKER/Report BLOCKED cells require an available real browser and visual/ordinary-role acceptance, beyond tested static renders and handler role isolation. Every Live cell requires a successfully identified candidate, real HTTP health/ready, and authorized browser verification. An unchanged old deployment does not satisfy them.

| Blocks | Existing locations / outstanding criterion |
|---|---|
| 01–04 | `lib/prescore.ts`, `lib/credit-engine/source-foundation.ts`, `normalization/`, `classification/`, `metrics/`; `app/api/analysis/route.ts`; `lib/workspace/model.ts`; `banking-ledger.tsx`. Verify actual statement bytes → screening → full-population canonical metrics → saved analysis → API and screen; matching independent monthly totals, known zero vs missing, wrong INN and period rejection. |
| 05–06 | `financial-analysis/source-selection.ts`, `financial-analysis/engine.ts`, `reconciliation/engine.ts`; `app/api/source-documents/route.ts`; `client-financials.tsx`. Verify annual/interim units/dates, precedence, conflicts and replacement through real upload handlers; no quarterly annualization. |
| 6.5, 13 | `credit-portfolio/resolver.ts`, `credit-portfolio/bki-adapter.ts`, `debt-capacity/portfolio.ts`, `debt-capacity/engine.ts`; `client-analysis.tsx`, `credit-coverage-guidance.ts`. Per-obligation canonical exclusion copy added and tested offline; live QA A 9,000/date/unknown-principal parity and responsive rendering remain outstanding. |
| 07, 09–12 | `production/orchestrator.ts` calls `risk`, `context`, `index`, `readiness`, `credit-assessment` engines. `lib/workspace/financing-request.ts` and form now carry urgency; five fields, backward compatibility and persistence tested. Saved-request cutoff defect is fixed in packet 3 below; no policy/weight change. Verify legal lifecycle only from explicitly sourced applicable facts; no fabricated ACTIVE in QA A. |
| 08 | `scripts/credit-lab-business.mjs`, `credit-lab/business-corpus.mjs`, existing 24-case corpus/fingerprints. Run all 24 and unchanged fingerprint tests. Internal QA only. |
| 14–16 | Orchestrator `productSelection → recommendationSet → actionPlan`; `client-analysis.tsx` FinancingProducts/ActionPlan. Verify canonical factor → supported product/recommendation → ordered action links and honest unknown conditions, shared read-only dossier. |
| 17 | `explainability/engine.ts`, `client-insights.tsx` Why, `explanation-library.tsx`. Verify real claim/source IDs, search, navigation, provenance and no independent UI math. |
| 18 | `client-report/adapter.ts`, `production/public-model.ts`, `app/dashboard/report-v2`, `canonical-dossier.tsx`. Same WorkspaceModel report for CLIENT/BROKER/print; PDF packaging smoke and actual artifact content/long tables are required. |
| 19 | `app/api/ai-analyst/route.ts`, `lib/ai`, `app/dashboard/ai-analyst.tsx`. Verify provider-free authorized current snapshot, context reset on changed source, no cross-company facts or invented score. No paid calls. |

## Actual data flow

`analysis POST → source screening → normalization/classification → BankStatementMetricsV2 → saved AnalysisResult`

`saved analysis + current financial sources + dated BKI + cached sourced profile + declared financing case → buildCanonicalCreditAnalysis`

Inside the existing orchestrator: financial analysis and portfolio, then reconciliation, risk, context, index, readiness, assessment, capacity, products, recommendations, plan, explainability and client report.

`loadWorkspaceModelV1` separately checks access and entitlement, projects BASIC, and publishes canonical FULL/report. CLIENT and read-only CanonicalDossier share components. Print and AI must consume the authorized snapshot. Credit Lab independently verifies the engine.

## Packet 2 — completed fixes and isolated evidence

Parent: `5240822d240fa9635284b5e4346ff0f2b0301057` (packet 1; issue comment 6445678934). Remote packet SHA is recorded in #11 after creation.

- Completed the fifth financing field, urgency, through existing form, validated POST, persisted payload and canonical CLIENT_DECLARED fact. Old records remain UNKNOWN. Invalid enum is rejected. Isolated real API/PGlite persistence, readonly rendering and print parity: 5/5 PASS.
- Reproduced `ACTION_PLAN_INPUT_INVALID:CAPACITY_REFERENCE` at `action-plan/validation.ts:21`: a valid recommendation referenced a capacity scenario omitted from the allowlist. Added existing scenario references, retaining rejection of forged references. No formulas/policy changed.
- Reconciliation was receiving only the authority-selected financial snapshot, hiding competing current evidence. It now receives current snapshots; Financial Analysis still selects one source per economic period. Conflict variant yields explicit data-review findings, without duplicate financial history.
- DebtPortfolio displays canonical schedule membership for each obligation. CREDIT_LIMIT exclusion is explained without including its payment by assumption; dated payment remains displayed. QA A has not been edited or refreshed by this packet.
- Next 16.4.0 build failed after compilation with SecurityFatalError. Official advisory https://nextjs.org/blog/nextjs-security-update-october-14-2026 identifies 16.4.1 as fixed. Pinned Next and eslint-config-next to 16.4.1; clean npm ci PASS, typecheck/Next standalone build PASS (exit 0). No runtime environment change.

### Separate synthetic B

`tests/fixtures/integration-b/manifest.json` records SHA-256 of raw sources and independently derived expected values. Actual 1C statement bytes pass screen/analyze/storage; BFO/interim JSON is passed through the real normalizer, BKI through the real adapter, and the production orchestrator runs through report generation. Financial/BKI/legal JSON are adapter-input fixtures, not proof of binary upload parsing. Legal source is explicitly OTHER/SYNTHETIC_OFFLINE_REGISTRY_FIXTURE_NOT_EXTERNAL_VERIFICATION; no paid provider or real company is used.

| Check | Verified result |
|---|---|
| 12 full months | Receipts 12,000,000 RUB; outflows 10,320,000; opening 10,000,000 → closing 11,680,000 |
| Operating / debt service | 1,000,000 monthly operating basis; 100,000 observed and 100,000 scheduled service |
| Annual vs interim | 12,000,000 annual revenue and 6,000,000 for six months, distinct periods |
| Index | 1,000; four ADEQUATE components; status PARTIAL, not a claim of complete verification |
| Readiness | MEDIUM, with explicit review/uncertainty constraints; all five CASE fields DEFINED |
| Capacity | PARTIAL; additional monthly prudential 100,000 / maximumPolicy 150,000 RUB |
| Explicit zero-rate, 12-month scenario | Principal equivalents 1,200,000 / 1,800,000 RUB, not a bank limit |
| 1/5/6-month boundaries | No numeric capacity at 1/5; 6 permits the existing PARTIAL numeric result |
| Missing/failed legal source | Null Index, UNKNOWN readiness and null numeric capacity; never fabricated ACTIVE |
| Unknown principal | Null remains null; separately evidenced 100,000 payment retained |
| CREDIT_LIMIT | Excluded schedule remains null; known dated 100,000 payment and reason retained |
| Conflict / foreign identity | Financial conflict reaches risk review; foreign profile/invalid INN rejected |

Targeted evidence: integration B plus original canonical provenance/fingerprint checks 25/25 PASS; financing persistence 5/5 PASS; existing source-authority/full-response/completion checks 25/25 PASS. Original business Credit Lab 24/24 PASS, fingerprints unchanged. Full serial gate for packet 2 was superseded by the dated-declaration fix below; these counts are separate commands, not an invented aggregate.

### Outstanding, evidenced limitations

- Before packet 3, a later saved financing request (2026-07-02) against B sources dated 2026-06-30 reproduced `CAPACITY / FUTURE_OR_INVALID_AVAILABILITY`. `canonicalAsOf` omits the saved declaration receipt date. Packet 3 includes this recorded knowledge date and preserves historical vs current principal semantics; source dates and availability validation remain unchanged.
- Local Docker executable is absent. Docker image checks remain mandatory and BLOCKED; no Dockerfile gate is disabled.
- `npx playwright install chromium` failed extracting the downloaded Chromium 151.0.7922.34 archive: “End of central directory record signature not found.” Browser QA and visual PDF acceptance remain BLOCKED, not passed by static renders.
- No trusted free legal-evidence upload/review workflow has been implemented here. Adapter-level offline provenance proves independence from a provider, not independent verification of arbitrary user declarations. Live sufficient-data acceptance requires an explicitly authorized trusted-source path.
- No staging candidate has been promoted, no live acceptance claimed, no QA A/production/DB/configuration changed.

## Packet 3 — saved declaration cutoff and real isolated routes

Parent packet 2: `860e977836faab3c9f05330cd17ca67b3c1fb726`, tree `92c0f93709fdce86bdbe439532ca6ba4688282e0`, issue comment 6446232862.

`canonicalAsOf` now considers `financingRequestV1.receivedAt`, a saved observation date. It does not consult the wall clock, rewrite any source date, extend history, or refresh a debt balance. Regression demonstrates 02.07 declaration against 30.06 sources: all five CLIENT_DECLARED facts are DEFINED, full history remains 12 months, the 15.07 scheduled payment remains 100,000, and 1,500,000 principal stays dated evidence while current principal is UNKNOWN/null. Invalid receipt dates are rejected. Repeated builds of the same input are identical.

Targeted integration B + unchanged provenance/fingerprints + real financing persistence: **31 PASS / 0 FAIL / 0 skipped**. Fresh typecheck and Next standalone build PASS. The full unmodified recovery-build-gate subsequently passed after that build; final evidence is below.

An additional read of real API handlers in isolated PGlite used synthetic B only. CLIENT, assigned BROKER and ADMIN canonical and report objects were identical; BROKER/ADMIN readonly flags true; stranger received HTTP 404. This exercises handler/permission integration, not production login or live authorization.

| Local route | HTTP | Elapsed ms | Response bytes |
|---|---|---|---|
| workspace?projection=summary | 200 | 594 | 335 |
| modules | 200 | 19 | 10,540 |
| workspace-model, first | 200 READY_FULL | 1,017 | 940,016 |
| workspace-model, repeat 1 | 200 READY_FULL | 819 | 940,016 |
| workspace-model, repeat 2 | 200 READY_FULL | 795 | 940,016 |

No before/after performance improvement is claimed. Service still builds canonical results after each authorized FULL read; use-model binds fetching to analysis/revision/endpoint rather than section selection. A future result cache cannot be keyed only by analysis ID: it must include actual current source/profile/declaration content and policy versions, while authorization and entitlement must still run on every read. No cache was introduced without invalidation and browser evidence. Time to visible UI, section latency, network request count and real client-file parsing remain BLOCKED by browser/input availability.

Mandatory Docker and real browser/live acceptance remain open; do not turn them into PASS or promote by bypassing them.

## Final local gate evidence and delivery state

Test subject: recovery code commit **`88966d3ce75e6c53cea358d0a7973b4c772df852`**, exact tree **`55095af98e45776b18ed1961c2960b07fb7f2b4a`**. Local index matched that tree and worktree was clean before recording this result. This subsequent ledger-only commit does not change executable code; the tests are attributed to 88966d3, not silently relabeled to another SHA.

Environment: Node 24.22.1 / npm 11.9.0. Docker's Node 22 image was NOT executed locally.

| Mandatory command/stage | Observed result |
|---|---|
| npm ci | PASS, 473 packages, dependency lock unchanged during final build/gate |
| npm run typecheck | PASS, no TypeScript diagnostics |
| npm run build | PASS, Next 16.4.1 webpack and standalone routes |
| node scripts/release/package-runtime.mjs | PASS |
| node scripts/qa/recovery-build-gate.mjs --build-only | PASS, exit 0, all five mandatory stages |
| Full serial tests, concurrency 1 | 6,754 PASS / 0 FAIL / 0 skipped; 837,297 ms |
| Credit Lab business | 24 cases / 24 returned models / 24 PASS / 0 FAIL; original corpus/fingerprints unchanged |
| npm run lint | PASS, exit 0 |
| validate:artifact | VALID; standalone true; 12 runtime assets; schema 0009_analysis_archive.sql |
| PDF artifact smoke | PASS: DOMMatrix, native canvas, worker and text extraction |
| Docker build/runtime checks | BLOCKED: no Docker executable |
| Applicable scripts/qa browser suites | BLOCKED: no Chromium binary; standard install downloaded an invalid ZIP |
| Visual PDF pagination / long-table review | BLOCKED: extraction smoke is not visual report acceptance |
| New candidate Amvera / health / ready / QA A | BLOCKED: candidate not promoted, no new-version HTTP/browser proof |

Final build-verification manifest: version PRESCORE-RECOVERY-BUILD-GATE-1; scope BUILD_REGRESSION_ONLY; status PASSED; REGRESSION/CREDIT_LAB/LINT/ARTIFACT/PDF_RUNTIME each exit 0. It explicitly retains browserAccepted=false and liveAccepted=false. Lock SHA-256: `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`.

The first complete regression also passed 6,754/6,754 (877,588 ms), but its following Credit Lab command failed before calculations with EEXIST at scripts/credit-lab-business.mjs:7:84: the output directory already existed. That FAILED result was not called PASS. The previous local output and failed manifest were preserved separately, then the **entire unchanged gate** was rerun once with a fresh output directory. No check was skipped, no gate code altered, and no Amvera build restarted or cancelled.

Latest checked GitHub staging remains `783bfdf9977d6a1aaa899cddcb757ffc637df4b6`; product remains `e798d4654f2b0cf7eb96b291ff2c6135c84dcfa8`. Last observed active Amvera revision is `574c42b929b3116dac4bf3b99ec012d9d0aa60ba`; observed failed build a02e4c6 is described above. No newer activation is claimed. No Actions, staging push, production/DNS/configuration change or live database write was performed. QA A was preserved.

The current implementation already warns above “Добавить в досье” and after saving that attachments do not enter the credit calculation automatically. This was checked in source/static coverage; its appearance in a live browser remains unverified. The original owner's real statement file was not available, so synthetic 1C/PDF test success does not establish support for that specific file or arbitrary bank PDF/XLSX formats.

Remaining execution, in order: obtain the existing permitted Docker/browser execution environment; run unchanged Docker build and applicable CLIENT/BROKER/ADMIN/print browser suites on the exact candidate; implement and test the trusted legal intake described below without overwriting QA A; reassess all gates if code changes; then prepare one reviewed staging candidate, prove GitHub-to-Amvera source identity, obtain real health/ready and ordinary-role E2E evidence. Only after those gates is there a basis for a separate commercial/production decision. Real payments, production domain and external paid providers remain outside this delivery.

## Provider-independent legal lifecycle: verified source and remaining implementation

Official FNS service documentation, checked 2026-10-27: https://egrul.nalog.ru/about.html and https://www.nalog.gov.ru/rn77/related_activities/registries/egrul_egrip/ . FNS supplies a free electronic registry extract signed with a qualified electronic signature. This is a source option, not a claim that Prescore already verifies such PDFs.

Engineering conclusion: existing `risk/adapters/legal.ts` accepts sourced CompanyProfileData with an applicable READY company envelope, matching INN, observation date/freshness and explicit source confidence. It does not require Checko as a provider; B proves the OTHER source seam offline. A production intake must verify the original document/signature or independently authenticated source, preserve original hash/issuer/effective and receipt dates, and project only explicitly established fields. A PDF's visual signature stamp or client-entered ACTIVE is insufficient. Unknown address, enforcement and other facts must remain unknown; a lifecycle extract does not establish that all other legal risks are absent.

Concrete missing integration: a trusted intake/review path into the existing profile/source contract, including malformed/altered signature, foreign INN, stale/future observation, ambiguous/unsupported status and duplicate/replacement tests, then ordinary-role browser acceptance. Do not label an arbitrary attachment READY/HIGH or alter QA A. No new credit engine, commercial provider dependency or legal-status override was introduced.


## Trusted legal intake — 2026-10-27, new package 1

Historical 6,754/6,754 regression, 24/24 Credit Lab, build/lint/standalone/PDF runtime PASS remains evidence for **88966d3ce75e6c53cea358d0a7973b4c772df852**, not an inherited result for this change. Base remote HEAD: `69472ec39831198395582f2c49c2770467f07826`.

Implemented an owner-only multipart `/api/legal-source` and ordinary Documents form. No migration or provider credential is introduced. The uploaded PDF is parsed server-side; only an explicit, unambiguous labelled lifecycle, unique matching corporate INN and valid information date are eligible. The server independently retrieves the same bytes from the narrowly allowlisted FNS generated-download path `https://egrul.nalog.ru/vyp-download/<hex-token>` over normal TLS and compares SHA-256. Redirects, arbitrary hosts/paths, credentials and query strings are refused; 8 MB/100-page/12-second budgets apply. This is **independent official retrieval, NOT cryptographic signature verification**. No manual trust checkbox, ACTIVE default or test trust configuration exists.

Receipt stores INN, document hash, locator hash (not the download token), information/receipt/check dates, server verifier/version/method, origin, applicability reasons and replacement lineage. Unconfirmed/stale/future/ambiguous submissions remain non-applicable. Failed attempts cannot overwrite confirmed evidence. Verified conflicting statuses on the same date invalidate selection. Metadata/history persists in the existing analysis payload; original PDF is not retained. Existing legal adapter supplies only LEGAL_LIFECYCLE; other legal risks are not declared absent. Workspace/report consumers use the existing canonical path. Existing QA A is untouched.

New evidence layer: `node --experimental-strip-types --test tests/legal-registry-intake.test.mjs tests/integration-b-chain.test.mjs` → **22 PASS / 0 FAIL / 0 skipped**; `npm run typecheck` → exit 0, no diagnostics. Actual multipart route + native PDF extraction + isolated PGlite + CLIENT/BROKER/ADMIN read parity were executed. All outbound official-source responses are controlled test doubles in this isolated suite; neither a real FNS download nor ordinary browser E2E is claimed. Foreign INN, corrupt PDF, wrong URL, unconfirmed origin, forged client flags, tampering, old/future dates, ambiguous status, duplicates, replacement/history, conflicting sources, forbidden writers and stranger reads are covered. Synthetic source data has no accepted production trust key/host/flag; only the test process replaces outbound fetch.

Matrix delta for blocks 01/07/10: the previously missing API intake is implemented and **PASS for the isolated handler/adapter scope**. Their end-to-end/live cells remain BLOCKED until the actual official-source path and browser form are exercised. The existing matrix above retains the historical baseline, not a blanket PASS for future changes.

Environment checked once: no Docker executable; local Playwright Chromium executable absent (previous installation had invalid ZIP; no repeated installation attempted). Work browser is available. Official egrul.nalog.ru retrieval returned HTTP 503 from the executor and connection timeout in Work browser. Therefore real FNS origin/format compatibility remains **BLOCKED**, not PASS. Parsing is deliberately narrow; unsupported extracts, multiple corporate INNs, missing explicit status or unsupported dates do not become confirmed facts. No paid query, live database change, production/DNS/configuration change or staging build has been made in this package. The existing Amvera Docker gate remains required and unchanged for the single eventual staging candidate.


### New candidate evidence and pre-transfer check

Package 1 code commit: `9822cebb8adb18980bcf214e2f8a8ccae56ac423`; tree `3e25f43fd50e0a8d5f0ad7d3d285fa6285f8b01a`. `npm run build` exited 0 (Next 16.4.1, 0 type diagnostics); `node scripts/release/package-runtime.mjs` exited 0. Full `node scripts/qa/recovery-build-gate.mjs --build-only` is in progress; no new full PASS yet. Prior `.next/recovery-credit-lab` output is preserved separately before the required fresh gate, not reused as evidence. Lock SHA-256 remains `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`; Node 24.22.1 / npm 11.9.0. No Docker/recovery gate changes.

Recomputed `integrationB()` through `buildCanonicalCreditAnalysis` on this code: index **1000/PARTIAL**, confidence **UNKNOWN**, four ADEQUATE core components, no missing required core codes. Data review: `RISK-DATA-DEBT-PAYMENT-UNMATCHED` / `DEBT_PAYMENT_UNMATCHED`; `RISK-DATA-NEW-OBLIGATION-DETECTED` / `NEW_OBLIGATION_REQUIRES_REVIEW`. Readiness **MEDIUM/PARTIAL**, caps `DATA_REVIEW_REQUIRED`, `INDEX_PARTIAL`, `UNKNOWN_INDEX_CONFIDENCE`; additional context review `CTX-UNMATCHED-PAYMENTS_SUPPORTED`. Capacity **PARTIAL**, 12 full months, observed and scheduled service each 100,000 RUB, headroom 100,000/150,000 RUB. Its limitations include `ACCOUNT_COVERAGE_NOT_PROVEN`, `ASSESSMENT_NOT_COMPLETE`, `CAPACITY_NOT_COMPLETE`, both debt-review reasons and `UNSPLIT_PAYMENT_NOT_PRINCIPAL_REDUCTION`, in addition to shadow/pre-calibration/not-bank-decision notices. This remains adapter/synthetic evidence with the original B profile, not a live trusted-source upload or fully confirmed index.

Pre-transfer GitHub HEADs: recovery `9822cebb8adb18980bcf214e2f8a8ccae56ac423`; staging `783bfdf9977d6a1aaa899cddcb757ffc637df4b6`. Recursive Git tree comparison: 36 changed/added paths, zero deletions. Merge ancestry diverges (13 ahead / 24 behind); staging's nine independent changes were already integrated in the prior locally checked recovery package and remain present. The five existing public-financing changes are preserved and covered by unchanged public-entry tests. No main/production/configuration/migration file is newly changed by this package. Transfer must use both existing parents and the checked candidate tree, with a compare-and-swap staging update; no force push.

Amvera pre-transfer read: active built and stored image `574c42b929b3116dac4bf3b99ec012d9d0aa60ba`; latest failed image remains `a02e4c61aa05048b64883c0633e3cf5c1803f93d`. Version menu exposes rollback (disabled for the already-active version), so the intended return path is this retained version via Control Versions after a later activation. No rollback or retention-setting change was performed. Git fallback source is the unchanged staging SHA above. Actual rollback execution is not claimed as tested.


### Reproduced test-environment failure before delivery

The first new full regression run failed two unchanged `tests/billing-admin.test.mjs` assertions: line 3 column 1333, grossMinor `0 !== 650000`; line 4 column 802, newPaidCompanies `0 !== 1`. Both reproduced in the isolated file. At `2026-10-27T16:54:43Z`, PGlite reported `TimeZone=Etc/GMT-8`, `current_date=2026-10-28`, while the application query used UTC range `2026-09-28..2026-10-27`. On the identical synthetic ledger, changing ONLY the disposable test database session to UTC changed grossMinor from 0 to 650000. This proves a previously time-dependent fixture problem, not a legal-intake or payment-data failure.

Minimal correction: initialize the isolated `tests/fixtures/workspace-runtime.mjs` PGlite session with `SET TIME ZONE 'UTC'`. Original billing assertions, real payment code, tariffs, live database/configuration and recovery gates are untouched. The first full run is superseded/FAILED, not PASS; a fresh complete gate on the resulting final test environment is required. This correction does not certify billing date behavior for an arbitrarily configured non-UTC live PostgreSQL session.


The first full gate completed: **6,740 PASS / 3 FAIL / 0 skipped**, 837,409.987 ms, REGRESSION exit 1; later gates correctly did not run. In addition to both billing failures, a focused presentation harness failed before registering its cases: `Error: UNEXPECTED_IMPORT:../legal-registry.ts` at `tests/live-source-presentation-recovery.test.mjs:28`, called while loading `lib/workspace/model.ts`. The explicit test loader was extended to load the real legal receipt projection and new child presentation component. No assertions, Golden cases or production fallback were removed. First failed output and manifest are preserved; no staging build or runtime was cancelled/restarted.


## Final local candidate and single staging delivery — 2026-10-27

- Evidence subject: `a42207b5aff43e0ff6a0b5957f6ab35d80021154`, exact tree `9a329daaeb8db9fee385daf97d33852063472113`; clean local tree matched the GitHub tree.
- Exact final commands: `npm run build`; `node scripts/release/package-runtime.mjs`; `node scripts/qa/recovery-build-gate.mjs --build-only`. All exited 0. Build includes typecheck (0 diagnostics) and Next 16.4.1 production compilation.
- REGRESSION: **6764/6764 PASS, 0 fail, 0 skipped**, 836560.425625 ms. CREDIT_LAB: **24/24 PASS**, 0 failures. LINT: PASS. ARTIFACT: VALID standalone, 12 runtime assets, schema `0009_analysis_archive.sql`. PDF_RUNTIME: native DOMMatrix/canvas/worker/text extraction PASS. This is not visual PDF acceptance.
- The unchanged gate manifest is PASSED for all five stages, scope BUILD_REGRESSION_ONLY, browserAccepted=false, liveAccepted=false. Lock SHA-256 `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`; final build log SHA-256 `85aabfc1535695654ba2415a0dce53769102bce6bc94b28169a5d9ad9cbaa6bd`; final gate log SHA-256 `951c246daea6afad975bfcc7b103bbb13627e7de55b17d0812e3eba9163a9d51`; manifest SHA-256 `b926af284abe2ecc2b3dbbf20571e789cb2ee3df1b8d04d09c4d2a26b977499d`.
- Heads were re-read immediately before transfer: staging `783bfdf9977d6a1aaa899cddcb757ffc637df4b6`, recovery `a42207b5aff43e0ff6a0b5957f6ab35d80021154`. Exact recursive tree diff: **38 changed/added paths, no deletions**. Two paths added since the earlier 36-path check are only the UTC test fixture and focused presentation test loader. No independent staging change was discarded.
- A single two-parent commit `186706751b43798c53f59533628fcb6dcbb94482` was put on existing staging with expected-head lease, force=false. Parents are the two preceding HEADs; tree exactly `9a329daaeb8db9fee385daf97d33852063472113`. Commit includes [skip ci]; no GitHub Actions operation or manual Amvera build/restart was used.

### Container checkpoint (not SUCCESS)

Amvera Repository changed to `0c0b10ef2d9dcb98467011aa1ea94c58bd0aaf4c` and displayed “Выполняется сборка”. One build-log query (200 rows, last 30 minutes, stream OFF) returned 43 lines. First: `27/10/26 19:22:58 Cloning into '/git'...`; next `19:23:00 HEAD is now at 0c0b10e ...`. Builder selected `node:22-bookworm-slim`, read `.dockerignore`, resolved stages and started `RUN npm ci` at `19:23:17`. Last returned line: **27/10/26 19:23:42 — Container builder is still running.** The slice includes two npm deprecation warnings, no confirmed failure. These are literal UI timestamps, not an asserted timezone conversion.

Per RUNNING instruction, observation stopped after this single query and one saved screenshot, without cancelling/restarting the build or issuing another push. Last positively inspected active/built/stored revision **before transfer** was `574c42b929b3116dac4bf3b99ec012d9d0aa60ba`; new activation has not been verified. The GitHub candidate/staging tree identity is proven. The new Amvera checkout/revision is observed, but its full tree/parent equivalence and active image identity are **NOT YET PROVEN**; a merge label is not accepted as proof.

### Explicit remaining limits

- Container final result / active revision: PENDING. No container PASS is inferred from local gates.
- New-candidate `/api/health` and `/api/ready`: NOT RUN, pending successful activation. No old HTTP response is reused as new-candidate evidence; no HTTP status/timing is invented.
- Manual Work-browser acceptance: NOT RUN. Exact owner entry `/dashboard?view=documents`, explicit analysis selection, QA A facts (no LEGAL_LIFECYCLE, one full month, July observed zero, BKI 9000 on 01.11.2026 and retained exclusion explanation), CLIENT/BROKER rights, Why, Action Plan, sources, company switch/reload, provider-free AI context, print and visual PDF all remain outstanding for the new image. No automatic Playwright PASS is claimed.
- Ordinary browser uploads and a sufficient trusted-legal scenario: NOT RUN. The native-PDF/API/PGlite tests use synthetic data and controlled outbound responses; the original B legal adapter fixture is not real provenance. Actual FNS availability/format compatibility remains BLOCKED by the earlier 503/timeout. Unsupported/ambiguous extracts remain unconfirmed; no synthetic test key/host/config is accepted by production.
- Index B remains 1000/PARTIAL/UNKNOWN confidence with the exact review/capacity reasons recorded above, not a fully evidenced index or lending decision.
- QA A and all existing analysis data were unchanged. No production, DNS, credentials/access settings, tariffs, real payments, data deletion/archive/reset or new database migration occurred. Only existing recovery/staging branches and the existing staging delivery path were used.

Screenshot: `prescore-staging-legal-intake-running-20261027.jpg`, cropped to staging status and build log, without account/balance/secrets/documents; preserved with the session deliverable. Full synthetic local failure and final gate logs remain in the workspace; fingerprints above bind the final evidence. This final ledger update is documentation-only on recovery after the single staging delivery and must not trigger another staging build.

Screenshot SHA-256: `44099850d12e915178aba437519e385b4f2eccafa8f6909d4deb84a44ec2ed50`.
