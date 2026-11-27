# Staging delivery through GitHub Actions

Push to GitHub `staging` starts `.github/workflows/amvera-staging.yml`.
The exact event SHA is checked out in each job. No PR or manual trigger is
configured; GitHub main is not modified to expose a Run workflow button.

## One-time setup

The repository owner saves these repository Actions Secrets in GitHub:

- `AMVERA_USERNAME`: the existing Amvera account username.
- `AMVERA_PASSWORD`: that account's documented Git password.
- `AMVERA_GIT_URL`: the exact HTTPS Git clone address shown under
  `prescore-staging` → Repository (not the webhook URL, not an application URL).

The script restricts delivery to the already verified staging account and Git
endpoint. Credentials must not be embedded in the URL. It does not create
credentials, change 2FA, or accept a GitHub PAT as an Amvera password.
Amvera documents account username/password Git authentication here:
https://docs.amvera.ru/applications/git/secondary-origin.html
If that authentication fails, stop and establish the documented account-specific
access method. No fallback credentials, SSH setup, or TLS bypass is attempted.

## Gates and delivery

1. A separate job runs authenticated `git ls-remote` and requires Amvera master.
   Missing secrets or failed access stops the workflow before tests or delivery.
2. On a fresh runner without deployment secrets: Node 22, `npm ci`, deployment
   safety tests, `npm run build`, `npm test`, `npm run lint`, artifact validation.
   The existing build reports TypeScript baseline/current/new and rejects new errors.
3. On another fresh runner, recheck read access and the current GitHub staging SHA.
   Fetch Amvera refs into a temporary bare repository. Save all fetched history
   as a verified Git bundle and upload it BEFORE push. Artifact retention is 90
   days; download it for longer retention. No Git configuration or credentials
   are included in the backup. History includes the old committed archive as
   historical evidence only; the new source tree contains no upload archive.
4. Create an Amvera-only commit with current Amvera master as its single parent
   and the exact checked GitHub commit tree, including current Dockerfile and
   amvera.yml. Record the source GitHub SHA in its message.
5. Recheck both source freshness and Amvera master, then normal fast-forward push
   to Amvera `refs/heads/master` only. Never force/mirror. Re-read after push.

Workflow concurrency serializes runs without cancelling an active delivery.
GitHub may reorder pending runs: explicit freshness checks reject old runs.
An existing deployment marker also prevents source-history rewinds. If Amvera
master changes, delivery stops and rereads the ref; rerun the latest staging run
to create a new backup and commit from the new parent. Never force the old commit.

Git output is captured and reduced to safe diagnostics. No shell tracing,
credential remote configuration, or raw network logs. Secrets are step-scoped to
Git delivery only. GITHUB_TOKEN has contents:read; action versions use full SHAs.

## Build and runtime

Unchanged Dockerfile: Node 22 → npm ci → npm run build → standalone runtime
`node server.js`, port 3000, persistent mount /data. Existing environment secrets
remain in Amvera. No automatic database migration, data access, production or DNS
changes are performed by this workflow.

## Acceptance and webhook retirement

Workflow success proves Git delivery only. In the existing Amvera application,
separately confirm the new deployment SHA, a new build and successful build log,
then the running version. Only after that check `/`, `/login`, and `/api/health`.
Old-page HTTP 200 is not evidence that the new version runs.
After confirmed direct deployment, deactivate (do not delete the application)
the old GitHub webhook. Until that acceptance, its configuration is retained;
this workflow never invokes it. Ordinary staging pushes still generate GitHub
events for any active webhook until it is disabled.

For a failed first run due to missing secrets: save the three secrets, then
use Re-run all jobs on that run if its SHA is still the current staging SHA.
No main change or extra empty commit is necessary.
