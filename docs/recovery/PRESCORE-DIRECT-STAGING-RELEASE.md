# Prescore · Direct staging release without GitHub Actions

Decision: 2026-11-13. Owner requires one-session delivery: **agree change → implement existing product → verify → publish to existing prescore-staging → verify live UI**. No new host, second project, paid GitHub Actions, new CI service, new branch, or automatic production release.

## Source of truth

- GitHub repository: `Teddy1-blip/Prescore-v1.1`.
- Work branch: `prescore-product-v1` (code and tests); **do not connect it directly to Amvera auto-build**.
- Release branch: existing `staging` (only reviewed candidate for `prescore-staging`). Never update `main` or production as part of this workflow.
- Destination: existing Amvera application `dorogovab/prescore-staging`; keep its data volume, secrets, domain, settings and underlying PostgreSQL cluster untouched.
- Preserve exact candidate SHA + source tree + observed Amvera deployed revision in each release note.
- Never call a GitHub commit, Git transport, CI status, or a successful Docker build a verified live release.

## One-time Amvera wiring — pending owner/UI verification

Use the *existing* app's **Repository** screen. Inspect current Git source and webhook before changing anything. Intended configuration if missing and if no conflicting integration must be disconnected:

- Provider: **GitHub**, repository `Teddy1-blip/Prescore-v1.1` (private).
- Tracked branch: `staging` — never `prescore-product-v1` or `main`.
- Trigger: **Push** only, not `Workflow runs` / CI-completion. Amvera pulls from GitHub on a `staging` push and begins build; no GitHub-hosted runner is needed.
- Use Amvera's secure GitHub access setup and existing webhook credentials. Never put tokens, passwords or webhook secrets in chat, Git, build logs or release notes.
- Amvera allows only one webhook per repository connection. Before changing an existing Git integration, verify that doing so preserves history and rollback; do not replace the current working remote blindly.
- Alternative if webhook cannot be safely connected: deliver the exact source tree through **Amvera's built-in Git/interface** using the owner's authenticated Work cloud browser / terminal, with read-back of the current remote and non-force fast-forward; do not require GitHub Actions.

## Per-change release procedure

1. Owner approves concrete product behavior in chat. Implement it in the **existing** UI and canonical engine on current `prescore-product-v1` HEAD; no parallel cabinets or engines. For visual changes, render the actual calculated data and ensure no fictitious credit approvals/limits.
2. Validate **exact source commit** outside GitHub Actions in a suitable trusted Node 22 runtime: `npm ci`, `npm run typecheck`, `npm run build`, `node scripts/release/package-runtime.mjs`, `node --experimental-strip-types --test tests/*.test.mjs`, `npm run credit-lab:business`, `npm run lint`, `npm run validate:artifact`, and PDF smoke. For browser-facing changes, run the relevant isolated Playwright/browser acceptance test. Missing checks must not be labeled PASS. Existing Dockerfile includes a fail-closed `recovery-build-gate.mjs --build-only` step.
3. Before promoting SHA, verify **live** `prescore-staging`: /api/health and /api/ready (200; `ready=true`), application replicas, current revision and rollback availability, `prescore_staging_isolated` and intended DB access, completed current backup. If unavailable, 503, unexpected DB/config, or backup unconfirmed: **STOP**. Do not modify credentials, `DATABASE_URL`, PostgreSQL permissions or data to force release.
4. Only after proof: inspect `staging` HEAD and `prescore-product-v1` SHA; require a **fast-forward** with zero behind / expected previous SHA lease. Promote **the checked exact candidate only** to `staging` (GitHub `update_ref` `force=false` and `expected_sha`). The Amvera Push webhook, once verified, should pick up the change; if not, investigate or use the already-approved direct Amvera Git path. Never force-push or create a second app.
5. Read Amvera's build status and logs, running source/revision, health/ready, and authenticated client UI. Run live synthetic TXT → `analysisId` → BASIC/FULL → risks and facts → index / financial opportunities → 7/30/60 → PDF; check relevant changed views. If any fail, **do not declare success**; use Amvera's *known* previous working revision for rollback after safety verification (no destructive DB operations).
6. Reply to owner with exact source commit, release commit/revision, live test evidence, changed screen URL, and success/failure; avoid progress-only claims.

## Why this is a two-branch model

GitHub `prescore-product-v1` may receive many internal commits; only one **approved/passed** `staging` ref update initiates a public staging build. This prevents repeated automatic rebuilds per draft. It does not depend on GitHub Actions budget.

## Cost boundary

No new paid GitHub Actions. **Amvera itself bills build-container resource use** under its existing pricing; frequent rebuilds may incur additional variable usage, even without changing tariff. Do not promise zero marginal build cost. Batch internal commits, publish only an accepted candidate, do not increase Amvera tariff or enable paid services without explicit owner approval.

## Current checkpoint (not release authorization)

At decision time `staging` was `f6eae32f0bf50bd40d61223ff4035980e1d89606`; product branch had 22 commits ahead and none behind. This is a Git ancestry fact, **not** approval to deploy them as a batch. W1 authenticated end-to-end and deployment on the newest product code have not been accepted. Earlier owner authorization was limited to exact candidate `b949c2ebad7ad81a4b9a23c3f36c133a06657d17`; newer SHAs must be reviewed and tested before staging. The Amvera Repository webhook configuration is not available to this chat, hence **not yet verified or wired**.

See `docs/recovery/2026-11-13-W1-CI-STARTUP-BLOCKER.md` and the W1 handoff for evidence.
