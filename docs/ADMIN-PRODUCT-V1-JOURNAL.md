# ADMIN Product V1 journal

Base: f26f2d2e5f72d4d15fc46539d3f6a922bc936f47. Exact GitHub tree verified locally.
No deployment, Amvera, main/staging changes or destructive database work.

## Milestone 1
Admin navigation and bounded resource contract. Overview reads metadata/counts only; no analysis payload or legacy scoring aggregation. Anonymous 401; CLIENT/BROKER 403. Legacy control mutations and premature subscription/payment mutation code removed from active admin route. Targeted tests recorded with the milestone commit.

Milestone 1 commit: f4e9c662efdb6ee3c2a9eff0042ab933df6b138f. Tests: 3/3; typecheck: no new diagnostics.

## Milestone 2
Companies by INN, search/filter/sort/pagination; independent analysis versions and company detail. ADMIN dossier consumes the unchanged shared canonical presentation and WorkspaceModelV1; access envelope is read-only. Synthetic FULL equality across all nine canonical objects, complete report and source state verified: 4/4 targeted tests. Typecheck: no new diagnostics.

Migration 0004 is prepared for a derived observation cache, not applied to any external DB. Reports calculate only on demand; matching input fingerprints guard list observations, changed inputs become UNKNOWN. Overview does not calculate canonical reports.

Milestone 2 commit: 038c124e2b2be4d8f73cde7df68a17fae39ee003.

## Milestone 3
Real agent_accounts registry, logical applications (deal takes precedence; same-ID mirror deduplicated), paginated status history/messages/document associations and metadata-only document registry. Broker forecasts are separate from unavailable accruals. No document content, storage keys or curator client details in list APIs. Targeted ADMIN tests: 5/5. BROKER regression: 10/10. Typecheck: no new diagnostics.

Assignment gap: authorization grants access through any matching agent_lead; applications independently store agent_code. Existing contracts have no atomic company reassignment/cascade for all leads, applications and access relations. Assignment stays read-only; client ownership is unchanged.

Milestone 3 commit: 27b07983899990346552edca416fe9b25c2d4efd.

## Milestone 4
Existing per-analysis BASIC/FULL access management; grants/revokes and safe UI module flags use atomic audit transactions. Orders, confirmed payments and entitlement states are separate resources. No new subscription lifecycle or manual fabrication of payments. Product section exposes actual canonical policies/risk registry read-only and code-owned operational BROKER routes. Legacy credit controls have no mutation API.

Audit filters and metadata allowlist; aggregated AI usage (no conversations/credentials); actual DB/schema reachability, build SHA if supplied, configured AI and storage metadata. No uptime fabrication. Code-owned catalog editing remains a domain-contract gap, not a mutable credit governance panel.

Milestone 4 validation: targeted ADMIN tests 6/6; typecheck no new diagnostics.

Milestone 4 commit: a1d27e4f765b86417f5ad834f2a0f200b68f2d22.

## Milestone 5 — QA candidate
Responsive/browser acceptance added for nine ADMIN views, company/application details, six canonical dossier sections, BASIC/FULL persistence, safe flags, empty/filter/error states and role authorization. Widths: 1440/1024/768/390/360. Existing CLIENT/BROKER/Analysis V3 QA is retained in the same workflow.

Local build and lint passed. Local Chromium download is blocked (the network returns an invalid ZIP); browser acceptance will execute in GitHub Actions, which successfully installs Chromium. Local complete tests and 24 business cases are also being executed. No PASS asserted until the final workflow completes.

Milestone 5 QA candidate: 3487e1750e81703c41e85c42aed7b22e9cf1bf29. ADMIN targeted tests 6/6. Build/lint passed; business cases 24/24. Full CI pending.

QA candidate 3487e175: Analysis V3, CLIENT and BROKER browser gates passed. ADMIN passed all nine views, details and six dossier sections at all five widths with no page errors or overflow, then revealed a real controlled-checkbox interaction defect. Fixed flags to update immediately and reload authoritative state after failure; browser acceptance will be rerun.

Prepared migration 0005 invalidates only derived observations when canonical inputs change. Added snapshot-lock/fingerprint race protection, actual schema-trigger verification, source/canonical overview distributions, metadata bounds, safe application navigation and a generated Next route-export type fix. ADMIN tests 7/7; rollback and profile invalidation are explicit checks. Local standalone PDF extraction/artifact validation passed after dependencies became local.

Visual review of downloaded browser evidence found that inherited mobile workspace CSS stacked ADMIN cells and hid their labels despite passing the no-overflow assertion. Scoped ADMIN overrides retain real table headers and local horizontal scrolling. Browser QA now explicitly checks visible table headers at every width.

Full local npm test passed 6330/6330 (build included). Credit Lab 24/24; lint/artifact/PDF passed. ADMIN browser gate is now a separate concurrent CI job so a failure can be diagnosed without waiting for unrelated presentation gates. Existing complete CLIENT/BROKER/Analysis V3 QA remains mandatory.

Milestone 5 implementation candidate: fcfb1bd16ceb304917670cd1e0c1ef165c267cb9. Final CI pending.

fcfb1bd1 ADMIN browser QA: 125/125 checks, no page errors. Visual review still exposed inherited fixed table layout squeezing columns on mobile. Fixed intrinsic table width and column sizing; added explicit minimum column-width assertions. This is why numeric QA alone is not treated as final visual acceptance. Final responsive rerun follows.
