# ADMIN Product V1 journal

Base: f26f2d2e5f72d4d15fc46539d3f6a922bc936f47. Exact GitHub tree verified locally.
No deployment, Amvera, main/staging changes or destructive database work.

## Milestone 1
Admin navigation and bounded resource contract. Overview reads metadata/counts only; no analysis payload or legacy scoring aggregation. Anonymous 401; CLIENT/BROKER 403. Legacy control mutations and premature subscription/payment mutation code removed from active admin route. Targeted tests recorded with the milestone commit.

Milestone 1 commit: f4e9c662efdb6ee3c2a9eff0042ab933df6b138f. Tests: 3/3; typecheck: no new diagnostics.

## Milestone 2
Companies by INN, search/filter/sort/pagination; independent analysis versions and company detail. ADMIN dossier consumes the unchanged shared canonical presentation and WorkspaceModelV1; access envelope is read-only. Synthetic FULL equality across all nine canonical objects, complete report and source state verified: 4/4 targeted tests. Typecheck: no new diagnostics.

Migration 0004 is prepared for a derived observation cache, not applied to any external DB. Reports calculate only on demand; matching input fingerprints guard list observations, changed inputs become UNKNOWN. Overview does not calculate canonical reports.
