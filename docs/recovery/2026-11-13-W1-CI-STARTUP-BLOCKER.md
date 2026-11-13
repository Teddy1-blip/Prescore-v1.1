# Prescore W1 — GitHub Actions startup blocker (13 Nov 2026)

Status: **OPEN / CI NOT RUNNING**. Diagnostic evidence for continuation of W1; does not alter methodology, database, deployment or CI gates.

## Proven facts

Repository `Teddy1-blip/Prescore-v1.1`, branch `prescore-product-v1`.

- Last confirmed successful full **Prescore product QA**: [run 42482129359](https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/42482129359), started **2026-11-08 12:50:43 UTC**, commit `69d1dcb4955c570af1d3e486da6679b93b03b222`. Candidate, validation, presentation, billing, admin **success** (step counts 7/15/14/11/11).
- Following failed **Prescore product QA**: [run 42485286772](https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/42485286772), started **2026-11-08 13:30:33 UTC**, commit `487b2321149dcc2947ea0420588e7c5286d4994d`. Candidate **failure**, remaining jobs **skipped**.
- Current W1 code [run 43419128596](https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/43419128596), commit `bbc237e2aca04f78d4d9fe97947022e78fa65b9e`, also candidate **failure** with no assigned runner name, no steps; downstream jobs skipped. Rerunning [run 43413664209](https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/43413664209) yielded the same outcome.
- **Byte-identical GitHub blob SHA** in all three commits above:
  - `.github/workflows/prescore-product-qa.yml`: `085d93ed5e0f5eb0840f5e06a9407a749f2c31b8`.
  - `scripts/release/ci-candidate.mjs`: `29e8f2c7a6bcf32f0f8b7dc5085f77c18728bd5c`.
- Connector's job logs endpoint returned `404 BlobNotFound`; job-steps endpoint returned an empty array. No `npm ci`, build, lint, Credit Lab, browser tests or PDF checks ran on the failed W1 commits. **Do not claim success or attribute this to a code regression.**
- GitHub public status has historical Actions incidents on Nov 9 and Nov 11, resolved, but these do **not** explain the first observed Nov 8 failure on their own.

## Working hypothesis, not confirmed

A GitHub Actions account/repository scheduler or billing/quota restriction is likely because even the `candidate` job cannot obtain the GitHub-hosted `ubuntu-latest` runner. Root cause must be confirmed by the owner-facing GitHub Actions run banner and billing page or by GitHub Support. Do not edit workflow files or change runner class solely from this hypothesis.

## Safest owner-side check

1. Open the [failed run](https://github.com/Teddy1-blip/Prescore-v1.1/actions/runs/43419128596) and read any warning/banner above the jobs (e.g. usage limit, budget, payment, runner restriction, policy). Copy **only the warning text**, not private billing data.
2. Open the personal [GitHub Billing & Licensing](https://github.com/settings/billing), inspect **Actions usage and budget**. If the included compute allowance is exhausted or the budget blocks work, the **owner** decides whether to authorize spending or use a self-hosted runner. No automatic enabling of charges.
3. If no usage/budget restriction is reported, check GitHub Actions settings and contact [GitHub Support](https://support.github.com/) with both successful and failed run IDs and the unchanged blob SHAs.

## W1 continuation when CI executes again

- Run unchanged full QA for **exact candidate SHA** (build + tests + Credit Lab + lint + browser + PDF).
- Run the authenticated isolated browser integration test `scripts/qa/approved-client-integration.mjs` for client TXT upload, BASIC/FULL, credit profile, derived financing directions, role isolation, mobile, source upload, re-login.
- Only after green QA confirm staging revision, isolated staging database and rollback point; obtain deployment authorization before touching `staging`/Amvera.
- Verify live authenticated upload → `analysisId` → evidence-backed report → action plan 7/30/60 → PDF. Only then mark W1 accepted and begin W2.

**No repository access, DB secret, backup or production operations are needed to confirm the owner-side billing warning.**
