# Standalone environment contract

Version: PRESCORE-STANDALONE-ENV-1. Secrets exist only in staging runtime secret storage; never in source, Docker build arguments, image layers, screenshots or reports. GitHub deployment source is branch `staging`; Amvera branch integration requires separate one-time configuration. Do not copy production credentials into staging.

| Variable | Storage | Requirement |
|---|---|---|
| DATABASE_URL | Secret | PostgreSQL URL with database/user/password and displayed internal RW host; URL-encode credential components |
| AUTH_SECRET | Secret | Separate staging secret, at least 32 random characters; user-controlled secure provisioning; never regenerate on restart |
| PRESCORE_BASE_URL | Variable | Exact staging HTTPS origin, no path/query/credentials |
| PRESCORE_STORAGE_ROOT | Variable | `/data/prescore`, persistent volume writable by UID 1000 |
| SMTP_HOST | Variable | Actual selected provider hostname, no URI scheme |
| SMTP_PORT | Variable | 465 implicit TLS or 587 STARTTLS |
| SMTP_SECURE | Variable | `true` for 465; `false` for 587, STARTTLS required |
| SMTP_USER | Runtime setting | Existing SMTP account login; do not print in deployment reports |
| SMTP_PASSWORD | Secret | Existing SMTP app password, never regular mailbox password unless explicitly required by provider |
| SMTP_FROM | Variable | Authorized bare sender address, no CR/LF or arbitrary headers |
| PRESCORE_INTERNAL_REPORT_PREVIEW | Variable | `1` only on authenticated synthetic staging preview; normal production default `0` |
| PRESCORE_BUILD_VERSION | Variable | Nonsecret deployment identifier |
| CHECKO_API_KEY | Secret | Only approved staging integration credential; no copying production data |
| AI_PROVIDER | Variable | `deepseek`, optional explanatory integration |
| DEEPSEEK_API_KEY | Secret | Staging provider credential |
| DEEPSEEK_BASE_URL | Variable | Official `https://api.deepseek.com` endpoint |
| DEEPSEEK_MODEL | Variable | Configured model; availability requires separate live verification |

`npm run env:check` is offline/no-send. Missing configuration exits nonzero with variable names and safe issue codes. It does not prove DB readiness, DNS resolution, SMTP delivery, secret entropy or permissions. SMTP options impose connection/greeting/socket timeouts and certificate verification; no file/URL content loading. No mail is sent during build, contract validation or tests (auth test uses in-memory capture).

After DB 1/1: configure runtime secrets securely → run explicit migrations → inspect health → synthetic registration/verification/reset → authorization and persistent-storage tests. Actual email sending requires configured recipient and approved test purpose; this offline pass sends nothing.
