# Stage 1 — resume the exact broker candidate

Continuation of Issue #11 / 6634722334. Scope: finish concrete CLIENT/PostgreSQL failures and exact-candidate acceptance, without another product/auth/MFA implementation. Actual recovery/staging HEADs and newer comments were read before changes. No uncommitted foreign edits were found against the saved checkpoint index.

## Saved source identities

- Prior recovery checkpoint: `8c7b0c96a5b3b9f93096fab4d71d99896402d76c`.
- Prior unpromoted 0009 candidate: `1f2a057e0694b72d7cbc5b1938b506866eddbf22`.
- First test candidate: **`ecfeec1f73d8083e3c5191a300b43a39b31b75ee`**, tree **`4b86b2ea24313156dfd7d39b6deb1f2b0c488cab`**; child of the prior candidate.
- First recovery carrier: **`77a68525819bf40dd7b13269843eff0f75fd1cb8`**, tree **`807e0a7b195367094178c7c594fc4c4842b35c2e`**. Its first parent retains all recovery/MFA work; its additional parent preserves the 0009 candidate without a new branch. It must not be deployed.
- Staging at the start of this continuation: `8b0809bd5eb22223fc80d73739eaab4d05d2782d`. No production/main/DNS setting was changed.

The nine changed paths are existing CLIENT/BROKER browser scenarios, the existing PostgreSQL scenario, two existing workflows, CI environment/wait code and the small shared test-SHA resolver plus its negative tests. Application permissions, billing arithmetic, dependencies, startup driver, catalog, migrations 0001–0009, schema registry/version, Dockerfile and artifact validator are unchanged. `database-scenarios.mjs` now derives its legacy-user expectation from the actual selected registry: recovery still tests additive MFA 0010; the 0009 candidate does not contain or apply it.

Expected candidate inputs, recomputed from files matching the exact GitHub tree: **`48396f590c46a35cca463791784de59bbdae5ca23d40cd5d8292a7fa20b4fbc2`**, `PRESCORE-SOURCE-INPUTS-1`, **717 files**, lock **`30f95307620b4c49b2eba4665be9dcd8c10192eb1e51a72a9a112bea2c492932`**. This is a scoped source fingerprint, not a running-container digest or proof of activation.

## Actual failures and bounded corrections

### CLIENT

Old Product QA 41856017870 / job 126665194761 failed at `client-product-browser.mjs:126`: the alert never appeared. The installed Playwright matcher returns false for `**/api/workspace` against the actual `/api/workspace?projection=summary` URL. The old empty-history test could also pass while failing to intercept that request, because the product does not automatically select old analyses.

The test now matches the exact origin and `/api/workspace` pathname, preserving query strings and excluding other APIs. Both empty and error scenarios record intercepted URLs, assert `projection=summary` and the browser response body/status. It still requires the visible alert and retry; after removing only its own route handler it clicks Retry and asserts a real 200 and cleared alert. No UI error handling or timeout was weakened.

Executed complete local Chromium harness: **121 checks PASS**, no page errors, including observed summary 503 and successful retry. Original source/role tests remain unchanged. Local browser is portable Chromium 153 from the npm registry; this is not the published staging browser or a claim about every browser version.

### BROKER

The previously skipped BROKER script was actually executed. It reached owner revoke successfully, then failed because `getByLabel('Вид разрешения', exact:true)` includes wrapped option text in the label lookup. Real browser accessibility snapshot exposes exactly one `combobox "Вид разрешения"`; its accessible name and visible UI were already correct. The test now selects that exact role/name. No product screen or permission expectation changed.

After correction: complete isolated BROKER browser **87 checks PASS**, zero page errors. This includes owner grant form at 1440/390/360, revoke, old BROKER model/workspace denial, regrant through the form, reload and exact dossier access. Owner and BROKER use separate synthetic identities; no ADMIN substitution. Desktop and 360px form screenshots were inspected: text, inputs, confirmation and submit fit the viewport. These isolated screenshots are not live mobile acceptance.

### PostgreSQL/startup

Old jobs 126665289789 / 126665289821 / 126665290079 reached the intentional missing-table rollback probe and timed out after 30 minutes. That intentional SQL error was not the cause of the wait or proof of a failed database connection.

The old test then called `spawnSync(start.mjs, timeout:15000)` on the rolled-back empty database and expected exit 1 / DATABASE_MIGRATION_REQUIRED. The real startup contract applies pending migrations before readiness. Before the build step, its Next child cannot run; release-candidate keeps the diagnostic listener. The installed SIGTERM handler targets the already exited child and leaves this listener running. `spawnSync` continues waiting after its timeout signal.

Reproduction used the unchanged startup driver and existing synthetic import/DB-boundary approach: timeout 1000 ms, observed at 2200 ms, parent still running, spawnSync not returned, diagnostic `APP_PROCESS_EXITED`. This reproduction alone was not a real PostgreSQL result. The CI evidence below then verifies the corrected contract on actual PostgreSQL 17.

The test now logs each phase, preserves actual rollback/absent-schema denial/lock acquisition, executes the real startup driver against the rolled-back DB, checks that migrations complete before a synthetic Next marker, and retries idempotently. It then adds an incompatible future schema entry and requires startup diagnostics with `SCHEMA_VERSION_INCOMPATIBLE`, ready/product routes 503, no Next marker and unchanged schema history. Removing the synthetic entry must permit retry. Checksum, old-registry, catalog/append-only guards and legacy data preservation remain. All child process groups have bounded SIGTERM/SIGKILL cleanup; no global CI timeout was increased and no scenario skipped. Only disposable CI databases are created/dropped.

Isolated existing migration/startup tests: **35/35 PASS**. Selector/wait security tests: **4/4 PASS**, covering short/ref/injected SHA rejection, duplicate selection, non-parent/missing/mismatched object, and another candidate/workflow/carrier not being accepted.

### PostgreSQL backup client selection

The first exact-candidate run passed migration/startup checks and production builds in both clean and upgrade jobs. Both then failed at the backup-tool preflight: `postgresql-client-17` installed successfully, but the unqualified `pg_dump --version | grep -Eq ' 17\.'` returned 1. The old pipeline discarded the actual version, so no particular default version is claimed. Chromium and real backup/restore had not started in those jobs.

The existing workflow now prepends `/usr/lib/postgresql/17/bin` to the current PATH and `$GITHUB_PATH` for the subsequent E2E step. It asserts the resolved paths of `pg_dump`, `pg_restore` and `psql`, prints their versions and still requires major 17. YAML and shell syntax checks pass. This keeps the version guard and real restore checks; it does not change application code, backup logic, migration files or the scoped source-input fingerprint. New candidate `15be14f514d91662a6c78b7d00ba921536e814bc`, tree `f5b06320e21bc2c1e9fc60fc86e87061a1d93ceb`, descends from ecfeec1.

## Exact-candidate CI without moving staging

The existing Product QA/RC1 workflow files are absent on default `main` (actual API 404), and the GitHub workflow page has no Run workflow control. No default branch, token permission, repository setting or paid quota was changed.

The same workflows now accept a full `workflow_dispatch.candidate_sha`. For the currently available recovery push, an explicit `Prescore-Test-Candidate:` trailer can select only a full SHA verified to be a direct parent of the current GitHub carrier object; a normal push still tests its own SHA. The shared resolver uses only the read-only GitHub token, checks repository/object/tree/timestamp, rejects ambiguous or invalid input before lookup and outputs an immutable SHA. Every test job checks out and verifies that exact SHA. Docker SOURCE_SHA, CI environment, evidence names and Product QA waiting use it. Reports retain separate workflowSha/sourceSha. No shell interpolation of user input, deployment step, new workflow/platform, remote branch or live secret was added.

First exact-candidate runs:
- Product QA **41871308620**.
- RC1 **41871308323**.

Both resolver jobs succeeded and recorded workflowSha **77a68525819bf40dd7b13269843eff0f75fd1cb8**, sourceSha **ecfeec1f73d8083e3c5191a300b43a39b31b75ee**, sourceTree **4b86b2ea24313156dfd7d39b6deb1f2b0c488cab**. This is explicit candidate checkout evidence, not relabelled recovery CI.

At the first phase observation, real PostgreSQL worker job **126718927539 SUCCESS**: 04.11.2026 19:49:59–19:50:01 Moscow completed the formerly hanging migration scenario. Database verify reports **0009_analysis_archive.sql, 9 applied, 0 pending, 48 tables, COMPATIBLE**. Worker crash/provider-idempotency/concurrency/lease/retry/SIGTERM passed with POSTGRES_FAKE and no external calls; storage crash checks passed in the job. Clean/restore and upgrade passed their migration step and continued to production builds. This is synthetic CI PostgreSQL, never restoration of the live Amvera backup.

Product presentation job 126718929405 completed SUCCESS: Full Analysis V3 responsive/native zoom, CLIENT and BROKER (87 checks, no errors) ran on the exact candidate under Node 22 / Chromium 151. Admin and billing browser jobs also completed SUCCESS. Static artifact/build/dependency checks completed SUCCESS. PostgreSQL clean/upgrade failed only the preflight described above; real restore is still pending.

Final run outcomes, delivery and acceptance must be appended only after they are actually observed. No pending step is PASS. Do not rerun unchanged code merely to obtain status.

## Final backup-tool correction candidate

- Exact 0009 candidate: **`15be14f514d91662a6c78b7d00ba921536e814bc`**, tree **`f5b06320e21bc2c1e9fc60fc86e87061a1d93ceb`**.
- Recovery carrier: **`5007411b31f388aed5fffb760b59d2081a6ccdf6`**, tree **`e8b9bcbd1aef88d6ddc4ca46dc08b9d4291c0587`**.
- Existing workflows: [Product QA 41873340307](https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/41873340307), [RC1 41873340386](https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/41873340386), created **04.11.2026 20:01:09 Moscow**. These run after a concrete workflow correction, not an unchanged status rerun. Earlier incomplete full-regression/container gates are not PASS.
- The only delta from ecfeec1 is the versioned PostgreSQL tool PATH/assertions in the existing RC1 workflow. No source-input-scope files or lock changed. Final full gates are bound to this new exact SHA.
- Original red-case bytes still hash to `7bcb779aba2f2238d1244c44d0447f7e19f731309a4626a670d9caf954adc753`. Migration files 0001–0009, registry/catalog, Docker schema and artifact validator remain identical to current staging; no0010 and no migration required.

## Remaining Stage 1 boundaries

Safe broker delivery does not depend on activating MFA 0010 because the candidate has no schema change. Ready MFA and its consistent DB+documents restore/protected-executor gates remain intact and unfulfilled. No new expenses, support, Online IDE attempt, production change, repeated removal/restoration of 11 analyses, QA source change or “Версия анализа” edit.

Current-source/context lookup found no explicitly provided controlled CLIENT/BROKER email addresses or confirmed existing test accounts. After safe activation, request only these non-secret identities and their registration status once; passwords, factor secrets and reset links stay in the protected interface. Sequential ordinary sessions are permitted; verify actual identity and cleared prior context. Actual mail receipt/use and live mobile remain distinct from fake mailbox and isolated browser results. Stage 1 and Stage 2 are not automatically accepted/started by this packet.

## Continuation: native connection response lifetime

The actual newer recovery `5007411b31f388aed5fffb760b59d2081a6ccdf6`, Issue #11 / 6636560863, and both running workflows were read before changing files. The complete local candidate checkout matched the recursive GitHub tree `f5b06320e21bc2c1e9fc60fc86e87061a1d93ceb`; the uncommitted recovery work was retained. No second executor or remote branch was created.

The PostgreSQL 17 tool correction succeeded. Both clean/upgrade jobs (126726830187 and 126726830307) then reached actual native broker connection and failed at `connectInBrowser`: `Network.getResponseBody: No resource with given identifier found`. The old helper deferred `connected.json()` until after the product's full navigation and an explicit reload. A local real-Chromium HTTP fixture reproduced exactly that failure. Merely starting the read sooner still raced the automatic navigation, so that incomplete approach was not committed.

The bounded correction keeps the real connection POST and required status 201, the ordinary user's visible name, `/agent`, no page errors and reload. It then reads the durable account with the same context's native session, asserting 200, an account code and an empty cabinet. Existing idempotency, native sign-out/fresh login and ADMIN denial checks remain. No response stub, product route, role check, assertion timeout, database schema or application code changed. The extracted corrected helper passed 3/3 fixture trials; these trials alone are not application/PostgreSQL acceptance.

- Code-only 0009 candidate: `7723bba2b64b01864d45bbbfea3f489665f79f15`, tree `4027e6ca633091cf17d1b1006c67c2a815368f99`; parent `15be14f514d91662a6c78b7d00ba921536e814bc`.
- Recovery carrier: `ad8fb70712ad94fa4d2b00e6f1ae441aa52338b8`, tree `ae9ad45fdd1c8d379a316a6d6e311568a6862976`; preserves MFA recovery and the separate 0009 candidate as an additional parent.
- Only delta from the previous candidate: `scripts/release/e2e.mjs`. Syntax and targeted lint passed. Complete source input fingerprint: `63b20684724069ee354cf2b739992e73c23ddbb6575532006d7ffdcf8cedb222`, 717 files; lock unchanged at `30f95307620b4c49b2eba4665be9dcd8c10192eb1e51a72a9a112bea2c492932`.
- Original negative self-assignment case, including its trailing newline, remains byte-identical: SHA256 `7bcb779aba2f2238d1244c44d0447f7e19f731309a4626a670d9caf954adc753`.
- Exact GitHub comparison against staging confirms unchanged migrations0001–0009, schema registry/catalog/version, Dockerfile, artifact validator and credit engine; 0010 is absent. No migration is required.

### Completed independent checks on 7723bba

Product QA [41875375879](https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/41875375879) and RC1 [41875375762](https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/41875375762) run the verified candidate, while retaining the separate workflow carrier SHA. Node is **22.23.4**.

- Presentation/CLIENT/BROKER job126733930711 **SUCCESS**: CLIENT121, BROKER87, no browser errors, responsive widths and owner grant/revoke/regrant/reload. Full Analysis V3 and native 200% zoom also pass.
- ADMIN and isolated billing browser jobs **SUCCESS**.
- Static job126733970025 **SUCCESS**: standard npm ci, typecheck/lint/build, standalone **VALID / 13 assets / 0009**, PDF runtime and dependency gate. `criticalHigh=0`; the same five moderate entries remain disclosed, with no gate exception.
- Real PostgreSQL clean job126733970150 **SUCCESS**, actual HTTP E2E **28 checks**; upgrade job126733970215 **SUCCESS**, actual HTTP E2E **28 checks**. Both complete native new-broker/existing-CLIENT enrollment, real app/worker restart, interrupted backup rejection, complete DB+storage backup, isolated empty-target restore and post-restore checks. Both record sourceSha7723bba and the exact source fingerprint/tree. PostgreSQL and backup clients are17.11.
- Real PostgreSQL worker/concurrency/crash/lease/SIGTERM **SUCCESS**. Schema reports0009, nine applied, zero pending,48 tables, COMPATIBLE. This is disposable CI data, not a restoration of live Amvera.

Full regression and container final outcomes are still pending at this checkpoint. No incomplete run is PASS. A superseded earlier validate job was cancelled by the existing workflow concurrency policy; it is not claimed as evidence for the current candidate.

### Delivery preparation without a live write

Amvera still shows active revision558be82 and health still reports old fingerprintc68d9c34/schema0009. Three QA are visible and ordinary history is empty. Before any delivery, fresh full financial projections of the three authorized synthetic QA were retained for exact semantic comparison afterward (125302,86071,31870 serialized characters). No QA source/document mutation was made.

The GitHub UI shows an existing Amvera push webhook with a successful last delivery, alongside the existing GitHub staging delivery workflow. A deployment must avoid triggering two deliveries. No webhook/token/settings changes or verification email were requested; its deeper settings require GitHub sudo confirmation. Safe activation must use the previously established single-delivery method after all exact-candidate gates pass, preserve history and avoid a whole-recovery merge. No new paid resource, live restore, MFA enrollment or additional migration is authorized here.

Current ongoing checkpoint: Issue #11 /6637218148. Final gate, delivery, identity and remaining A–G outcomes must be updated here and in that same checkpoint from observed evidence.

The live GitHub log was inspected because completed-job log downloads were not yet available. At the observation, Product regression had reached test5433 (`atomic persistent files...`) and Docker's actual regression had reached test4957 (`Golden PRD-RU-039 Guarantee...`). These are progress observations, not final counts or proof that the entire log is failure-free. Neither job was restarted, cancelled, bypassed or given a higher timeout. The existing runs must be resumed by reading their final results, not rerun on unchanged code.

The safe evidence JSON now preserves fresh SHA256 hashes for the exact before-delivery financial projections, using an explicitly different deep-sorted JSON method. Do not compare these directly to historical bridge-ordered hashes. Use the same deep-sorted method after activation. Current live source remains the old vulnerable version; no freeze or new delivery was performed. Existing user session remains intact. The one optional request for controlled test email identities returned no addresses; code and CI continued independently, and no password/reset/role action was performed on a real account.

Next operation: read final Product QA41875375879 and RC141875375762. If every mandatory job is SUCCESS, re-read recovery/staging HEADs and actual delivery triggers, use one existing staging delivery with the exact tested candidate tree (no whole recovery/MFA merge), verify activation and health/ready/fingerprint0009, then continue ordinary-role/mail/mobile acceptance. If a job fails, retain its first actual failure and repair only that cause. The completed PostgreSQL and browser checks do not waive the remaining gates.
