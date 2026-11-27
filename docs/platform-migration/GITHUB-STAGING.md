# GitHub staging deployment

## Source and scope

Repository: `Teddy1-blip/Prescore-v1.1`; deployment branch: `staging`.
Protected-by-task main SHA: `2ea25f26532396f3a90f2ccf6eb4f8dc534ca36c`.
The staging snapshot includes the complete approved platform migration/UI source and
latest standalone auth/email changes. Existing assets from main are retained.

No source archive is required. The root Dockerfile copies `package.json` and
`package-lock.json`, runs `npm ci`, copies the actual source and runs `npm run build`.
The packaging script is retained only as historical recovery tooling, not as a normal
development or deployment step. Do not commit `source.tar.gz`.

## One-time Amvera integration (not performed by a Git push)

Connect only application `prescore-staging` to this GitHub repository. Select the
`staging` branch explicitly and restrict the integration to its push events.
Use the repository root as build context and root `Dockerfile`/`amvera.yml`.
Do not select main or enable any synchronization back into GitHub.
A GitHub branch creation does not establish this connection automatically.

When the connection is configured, normal source updates require only:

```sh
git switch staging
# Edit and validate source.
git add <reviewed-files>
git commit -m "Describe the change"
git push origin staging
```

Amvera then builds and deploys this source according to its configured trigger.
Environment changes, schema changes and operational acceptance are separate tasks;
they are not performed implicitly by git push.

## Build and runtime

- Build/runtime base: `node:22-bookworm-slim`; package engine >=22.13.0.
- Build: `npm ci` then `npm run build` (baseline type diagnostics gate + Next build).
- Output: Next standalone server, static assets and public files.
- Runtime command: Dockerfile `CMD ["node", "server.js"]`.
- `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`.
- `amvera.yml`: docker environment/toolchain, root Dockerfile, containerPort 3000,
  persistenceMount `/data`. Leave run.command and run.args unset.
- Application runs as user `node` (UID 1000). Existing volume must be writable to it.
- Documents: `PRESCORE_STORAGE_ROOT=/data/prescore`.
- Database: existing managed PostgreSQL through runtime `DATABASE_URL`.
- Auth: runtime `AUTH_SECRET` and HTTPS `PRESCORE_BASE_URL`.
- SMTP: runtime `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
  `SMTP_PASSWORD` (Secret), `SMTP_FROM` (authorized bare sender email).
- SMTP 465/true or 587/false with required STARTTLS; certificate checks stay enabled.

No database/auth/SMTP credentials are needed or embedded at build time. Keep existing
DATABASE_URL, AUTH_SECRET and database password unchanged. Do not rerun already
applied migrations without evidence that a migration is missing. No automatic
migration or admin bootstrap is part of container startup.

## Validation before a staging push

```sh
npm run build
npm test
npm run lint
npm run validate:artifact
```

Report baseline/current/new TypeScript diagnostics separately. Known diagnostics may
be tolerated by the existing exact-baseline gate; passing build does not mean strict
TypeScript is entirely clean. Run `npm run env:check` only with the intended runtime
environment supplied securely; offline validation is not an SMTP delivery test.

The setup task ends after publishing staging. It does not connect Amvera, change
production or DNS, rotate credentials, run migrations, or begin frontend redesign.
