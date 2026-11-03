# Owner-only history archive — 2026-10-30

Status update 2026-11-03: owner authorization for the exact 11 analyses and staging delivery is now present. No repeat approval is needed. Live execution remains gated on actual staging DB identity, recoverable snapshot and fresh CLI preview. Archived count remains 0. The current Stage 1 checkpoint is in PRESCORE-19-BLOCK-INTEGRATION.md; the historical preparation record below is retained, not a claim of live completion.

Code candidate: `7701c98bc23966f5c833c985538ec59a8a4b4651`; exact tree `14716732d62757e3bcbaad761528d8e6f9d9749c`. Local temporary-index tree equals the GitHub tree. Source input fingerprint `860c9101b6409ea0165323ba05a8ba7b52c108b732d26c890347c85a95080fff`, scope `PRESCORE-SOURCE-INPUTS-1`, 708 files. Lock SHA-256 `8fc1937ff193da2f1cd7504442f2dd64e44559306a0f77d2775af83e17f9deb1`. This identifies the local candidate; no claim of a deployed image is made.

## Starting point and live read-only inventory

- Issue #11 latest comment read: 6477145088, after the accepted print/local-AI package. No repeated 19-block audit.
- Actual recovery HEAD before work: `ead10021edabfafddf4f55c40131749d20b6a2b3`; tree `4f107ada56b5b786ceac9d600077b0f5f42cfa71`.
- GitHub histories diverge (initial archive candidate ahead 2 / behind 27). Independent recursive **tree-to-tree blob SHA comparison**, not merge-title inference, found exactly nine scoped code/test changes plus six pre-existing acceptance-document/evidence changes against staging. The final candidate adds only the documented tenth, test-only Evidence assertion correction. No independent product-code change is lost. Future delivery requires a fresh check and a history-preserving merge; no force push.
- Actual staging HEAD before work and at recheck: `db33a7624ea061879fe8e2efb32e0b58c75e4993`. No staging ref move, build, restart, webhook or deployment in this task.
- Real authorized client UI: `https://prescore-staging-dorogovab.msk1.amvera.tech/dashboard`. No analysisId, selected option “Выберите анализ”, header “Ваш кредитный профиль”. No implicit selection was observed. Dropdown contains 14 ACTIVE analyses, including the old companies; home contains recent-history cards.
- Existing read-only `/api/admin?resource=analyses` returned total 14: all match the personal dropdown, all owned by the signed-in account, all ACTIVE, all broker fields null. The response requires ADMIN; personal summary and matching nonblank owner establish the owner scope. No cookie/session/token was exported. `/api/admin?resource=applications&limit=50` returned total 0. This is a point-in-time read, not a substitute for transactional checks at execution.
- Owner is specified in the private request JSON, not inferred from a company name. No full payload, source documents or financial results were exported.
- Screenshot was captured in the browser, but did not synchronize to the permitted shared directory within the documented five-second check. No attachment is claimed and no alternate export bypass was used.

## Exact proposed scope — 11, not yet approved

Request SHA-256: `76c235ff140ba04a0fbcffc7bc7cf0e348a4840512de34f53e13b7918b40a0e9`.

The attached [request](2026-10-30-OWNER-ARCHIVE-REQUEST.json) is input to a future read-only preview, **not** an executed plan or approval token. Cutover `2026-10-30T00:00:00.000Z` is an additional ceiling; membership comes from exact IDs and owner, never “all before this date”.

| Анализ | Компания | Создан, UTC |
|---|---|---|
| `6d30e530-bb6c-47a9-ac85-f32f34c1b9b5` | АРТУЛ | 2026-10-28T18:18:18.426Z |
| `c168b6de-25bf-48ca-a6b1-c76b72078218` | АРТУЛ | 2026-10-27T21:12:41.471Z |
| `4f95b8fa-d933-46d4-893b-992385b5d893` | ВИВО МЕДИКАЛ ТЕХНОЛОДЖИС | 2026-10-20T18:36:24.544Z |
| `d1792edf-2881-4c10-927f-2a867cac3cf6` | ВИВО МЕДИКАЛ ТЕХНОЛОДЖИС | 2026-10-18T00:18:18.795Z |
| `ad26967b-568b-4153-8c5c-e80eb8133651` | ВИВОЛАЙН ПЛЮС | 2026-10-03T15:30:00.400Z |
| `ad80031b-b5c4-48bf-9eab-7cc07c66a2a3` | ВИВОЛАЙН ПЛЮС | 2026-09-28T19:53:55.353Z |
| `ea1b95b5-ad8d-457c-8c79-c4c43ba9a054` | ВИВОЛАЙН ПЛЮС | 2026-09-28T19:32:20.229Z |
| `5c5ba503-1abb-46b6-a1bd-a835f9dbb750` | ВИВОЛАЙН ПЛЮС | 2026-09-25T10:50:04.338Z |
| `ac19eb41-46ce-4eac-b88c-aa8f442a00bd` | ВИВОЛАЙН ПЛЮС | 2026-09-24T17:01:22.153Z |
| `95b312a4-2d85-4ec8-80e1-06d957b4f9a4` | СВЯЗЬ | 2026-09-24T09:41:25.595Z |
| `d1f868b5-53fc-493a-ab27-790043c8335e` | ВИВОЛАЙН ПЛЮС | 2026-09-20T23:03:46.258Z |

Protected and left ACTIVE, including the older QA B:

- `36527dc1-d7db-4fef-bd47-719a451b4d58` — synthetic upload/report/AI QA.
- `992ab9e3-672e-4adf-955e-9a2c40e3ece3` — immutable QA A.
- `7ec7daeb-dfef-4f1f-9c9d-15ea86fe864c` — QA RECOVERY B PHASE 3 SYNTHETIC.

Archiving only the approved 11 would leave these **three active QA entries** visible for explicit selection. Therefore literal zero-row history cannot be claimed while also preserving these controls. They are not silently hidden, moved, deleted or archived.

## Implementation and storage

Extended the existing `lib/release/analysis-archive.ts` and release CLI; no new storage, API, migration or archive state. Legacy V1 batches retain their original fingerprint/restore behavior. Owner-scoped V2 binds owner, explicit IDs, protected IDs, staging origin, cutover and persisted ID/createdAt records into the preview fingerprint.

- Reject empty/duplicate/protected/missing/foreign/unassigned selections and pre-cutover violations.
- Reject a linked `agent_leads` company or `agent_applications.analysis_id`; the maintenance operation never changes their rows. Revalidate under the existing advisory lock, analyses table lock and broker-table SHARE locks. A changed owner, archive state, date, membership or broker linkage aborts the transaction.
- Update only existing `analyses.archive_state`, `archived_at`, `archive_batch_id`; insert one `analysis_archive_batches` audit row. Actual payload, documents, financial facts, entitlements and owner remain untouched. Restore uses the existing batch mechanism.
- CLI owner operations require the existing `release-candidate` mode and exact approved staging origin. This is a guard, not independent proof of database identity: before execution an operator must confirm the actual connection is `prescore-stage-db`, without publishing credentials. Production must never be used.
- Personal `/api/workspace` summary is strictly owner-scoped for ADMIN too. Removed legacy GET auto-claim of blank-owner analyses/deals; these remain available through existing administrative reads, not silently assigned to the browsing administrator.
- Client rejects cached model display when the analysis is absent from the active list. Empty home has an explicit “Создать новый анализ” button using the existing upload entry point, without creating a record on click.

Affected tables: `analyses`, `analysis_archive_batches`. Read-only safety checks: `agent_leads`, `agent_applications`; preserved related data includes `client_documents`, `analysis_entitlements`, payloads and other financial/source records. No direct live database or archive-maintenance command has run; inventory reads used the existing authenticated UI/API.

## Regression evidence

Before fixes: seven reproduced failures in the new owner-scoped tests, strict administrator-summary assertion and removed-selection header test (39 tests, 32 passed, 7 failed). Existing expectation that an administrator personal summary included unassigned rows was intentionally changed: GET must neither show nor claim unowned history. This is a scoped authorization expectation change, not a Golden/financial-result rewrite.

Final targeted command:

```sh
node --experimental-strip-types --test --test-reporter=tap tests/owner-analysis-archive.test.mjs tests/live-recovery-archive.test.mjs tests/workspace-quick-entry.test.mjs tests/client-navigation-recovery.test.mjs tests/workspace-product-review.test.mjs tests/clean-client-onboarding.test.mjs
```

46/46 PASS, 0 failed/skipped. PGlite executes actual archive SQL and protected API handlers against isolated synthetic data. Checks include unchanged payload/owner/documents/entitlement, QA and foreign preservation, repeat summary reads, archived model 404, idempotent archive/restore, changed-owner rollback, broker-assignment and direct-application rejection, environment guard, no GET auto-claim, explicit empty-home CTA, and no stale cached header in home/documents/analysis. Render-branch tests use stub hooks and do not claim live browser lifecycle acceptance or PostgreSQL concurrency testing.

Final code candidate `7701c98bc23966f5c833c985538ec59a8a4b4651`, Node v24.22.1:

```sh
npm run typecheck
npm run build
node scripts/release/package-runtime.mjs
node scripts/qa/recovery-build-gate.mjs --build-only
```

All commands exited 0 on the final inputs. Build invokes the typecheck again. Final REGRESSION **6802/6802**, zero failed/skipped, 802489.369314 ms; Credit Lab **24/24**; LINT, ARTIFACT (13 required runtime assets), PDF_RUNTIME all exit 0. The gate invokes the complete tests list with `--test-concurrency=1`, `scripts/credit-lab-business.mjs`, `npm run lint`, `scripts/platform/validate-artifact.mjs`, and `scripts/platform/pdf-artifact-smoke.mjs`. Exact commands are unchanged in `scripts/qa/recovery-build-gate.mjs`.

Safe machine-readable [check record](evidence/2026-10-30-owner-archive-checks.json) includes candidate/tree, source fingerprint, lock hash, gate results and log hashes. PDF_RUNTIME is text/native-runtime smoke, not visual PDF acceptance. No container/staging build was run. No prior-SHA PASS was transferred.

### Existing gate failure reproduced and corrected at the test boundary

The first full gate on intermediate code `d2280832b04e02223cb08f475c17966e61f74a5e` stopped at REGRESSION exit 1: 6800/6802, duration 814501.716754 ms. One child assertion plus its parent failed at `tests/workspace-recovery-phase2.test.mjs:29`: `assert.ok(html.includes(c.titleRu))`. The unchanged baseline tree `4f107ada56b5b786ceac9d600077b0f5f42cfa71` in an isolated detached worktree reproduced exactly the same failure (14/16), as did the isolated candidate (14/16). This was not an archive regression.

Observed semantic difference, from a synthetic fixture only:

- Raw canonical CONTEXT title: “Контекст требует дополнительной проверки и не является положительным фактором.”
- Existing published title: “Обстоятельства компании пока не подтверждают положительный вывод. Проверьте связанные документы и пояснения; после подтверждения Prescore уточнит интерпретацию.”

`Evidence` already applies the published `publicText` mapping and excludes INDEX_CONTRIBUTION. The test incorrectly demanded the raw title; which source-linked claim sorts first can vary with dated/generated canonical identifiers. Only this test was corrected: select an eligible claim, assert its exact claim ID, escaped published heading, exact source-reference set (no extras), and byte-identical input model. The component, copy mapping, engine, financial expectations and Golden files were not changed. Isolated corrected file: **16/16 PASS**, 0 skipped. The final candidate was rebuilt and the complete gate passed; the failed first gate is retained here, not re-labelled PASS.

## Operator continuation — only after separate confirmation

1. Obtain approval for the exact 11 IDs and separately for staging deployment of the reviewed candidate; retain the three protected QA entries. If the user requires zero visible rows, resolve that conflict before data changes.
2. Verify fresh branch heads/diff and existing rollback, perform only the separately authorized staging delivery. Confirm active version and new source fingerprint; no production/configuration changes.
3. In the existing authorized staging maintenance environment, verify application/database identity and an existing recoverable snapshot according to the archive confirmation contract. Do not change credentials or environment settings to bypass a guard.
4. Place the approved request JSON in a private maintenance path using the existing authorized operational channel (documentation files are not copied into standalone). Read-only preview:

```sh
npm run analysis:archive -- preview-owner /secure/reviewed-owner-request.json /secure/reviewed-owner-plan.json
```

Review the produced owner/IDs/count/fingerprint against the user-approved 11. If any differ or any broker link appears, stop; do not expand the scope or regenerate approval automatically. The JSON must be held privately (CLI writes mode 0600, exclusive create).

5. Only after approval and snapshot verification, use existing `execute /secure/reviewed-owner-plan.json` with its existing `SNAPSHOT_CONFIRMED_PREVIEW_REVIEWED` confirmation, then `verify` on the same plan. This record does not set or supply that confirmation.
6. In the real client UI verify `/dashboard`, Documents and Analysis without ID; old names absent, explicit create entry, no old company context. Reload once. Check that the three QA remain accessible and were not changed. Record actual batch ID/count and the exact before/after evidence in #11.
7. Recovery, if explicitly needed: existing `restore-owner /secure/reviewed-owner-plan.json`, with the existing `RESTORE_REVIEWED_BATCH` confirmation. The same batch data is restored; nothing is reconstructed from a fabricated payload.

## Completion boundary

Live archived analyses: **0**. Live source/document/analysis writes: **0**. New analyses/uploads: **0**. Deployment: **not authorized/not performed**. No changes to production, roles, DNS, scoring, parsers, Checko, recommendations, reports or offers. The task's final live-cleanliness criterion remains pending the user's required confirmation and subsequent verification.
