# Platform migration / Product UI v2 — implementation review

This is an uncommitted migration working tree on approved main `2ea25f26532396f3a90f2ccf6eb4f8dc534ca36c`. It is not a new analytical block. Block 18 remains a separate preserved presentation change set. No production cutover is authorized.

## Runtime and storage

`lib/platform/runtime.ts` supplies server environment and the portable database. All active API routes now obtain the database through this boundary. Standard `next build` / `next start` are the production path. Vinext, Wrangler, D1 examples, old SQLite schema and Sites scripts remain isolated for rollback/reference under explicit legacy commands; their removal is deferred until staging parity. They are not necessary to execute the standalone server.

PostgreSQL preserves 21 product tables and 211 original columns. SQLite integer values use checked JavaScript-safe PostgreSQL bigint decoding. The compatibility adapter preserves parameter binding and camel-case aliases; request-time CREATE/ALTER calls assert migrated schema instead of creating objects. Transactions back `batch()`. Known SQLite ignore/replace forms have narrow registered translations. Unregistered destructive DDL fails closed. Schema files are additive, transactional and checksum-locked; no production migration has run.

`DocumentStorage` separates file content from business metadata. New document bodies go to generated UUID keys below configured `/data/prescore`, with private permissions and no symlink following. Database metadata continues to support old base64 documents for migration compatibility. Download authorization precedes storage access. Attachments use no-store/nosniff and attachment disposition. Uploads check every supplied company/analysis/application relationship, actual decoded size and allowed metadata. Failed database inserts remove newly stored file content. Physical keys are not public URLs. A future object-storage adapter can implement the same interface.

## Standalone identity

Better Auth handles email/password authentication with verified email, server-side sessions, password reset, HttpOnly/Secure/SameSite cookies, expiry/logout, origin checks and persistent rate limits. SMTP is required for usable registration and reset. No shared demo password or header impersonation fallback exists. Active `app/chatgpt-auth.ts` retains only compatible function names; it delegates to standalone sessions. Historical header logic is isolated in `lib/platform/legacy` and is not imported by active routes.

Authorization resolves CLIENT plus persistent roles and existing verified-email agent assignments. ADMIN is never inferred from a hard-coded email. The one-time bootstrap requires an already verified account and writes security audit metadata. No account is granted privileges by choosing a login tab. Owner/assigned-agent/admin analysis access remains unchanged. Agent mutations now enforce the AGENT/ADMIN role consistently. Existing public referral submissions remain public and still require consent and a real referral target.

Session create/delete and admin bootstrap are audited without passwords, tokens or prompt text. Admin control changes retain the existing audit subsystem and now show explicit confirmation scope. Staging must still verify real mail delivery, credential lifecycle and full per-route access parity.

## Data transfer

`normalize-d1-export.mjs` reads a directory of read-only Wrangler result JSON files, one `<table>.json` for every catalog table. It performs no network access or D1 mutation. Output is a private, exclusive-created JSON artifact. Only sanitized exports are allowed in staging.

`import-d1.mjs --file=/absolute/export.json` defaults to validation/dry-run. `--apply` requires explicit operator intent. Validation checks table/column shapes, safe scalar types, primary-key duplicates, supported references and ownership/entitlement consistency. Application runs in one serializable transaction: identical existing records are counted, conflicting existing records abort; new rows are read back and compared. It emits counts and safe error codes, not row contents. The utility preserves legacy document base64 fields; bulk movement of historical files can be a later controlled operation.

No actual production export, data transfer or managed-PG import has occurred. Local embedded PostgreSQL coverage must not be represented as a live Amvera migration rehearsal.

## AI portability

`AIProvider.generate/health` keeps the current explanatory analyst separate from the concrete DeepSeek HTTP client. Official HTTPS endpoint only; redirect following disabled; configured model; timeout; response shape checks; safe failure metadata. Every outbound message, including history, passes identifier masking. The structured context remains the existing minimized context; internal analysis ID is removed at the route boundary. No raw files or provider payloads are introduced.

Missing configuration, timeout, provider errors, empty/invalid responses and explicit prohibited bank promises fall back to the existing deterministic answer. Existing conversation ownership/FULL checks and usage limits remain. `ai:smoke` uses a synthetic JSON prompt only. Live smoke currently returns `AI_CONFIGURATION_MISSING`; requested `deepseek-flash` availability has not been confirmed. Regex masking and promise rejection are not a complete grounding system; stronger canonical-answer grounding remains Block 19 and is not implemented here.

## UI v2

The shared product stylesheet centralizes Inter, navy/teal, cyan `#72C9D5`, violet `#9698D4`, abyss `#0B2434`, ice `#EEF4F8`, readable typography, spacing, surfaces, focus, input and responsive table treatment. Login uses reusable typed controls. Existing functional client/agent/admin components remain in place.

Landing now uses the approved signature visual and describes Index, Readiness, capacity and mechanics separately; the old invented example bank-limit hero is removed. Client navigation groups analysis, financing, data and help. Bank offers retain their own subsystem. Agent/client/admin logout is explicit. Legal/offer/consent content is unchanged; styling does not claim a legal revision. Client/admin tables have local overflow, mobile shells adapt, and reduced-motion overrides prevent delayed semantic content.

Prepared Block 18 files, fixtures, canonical adapter and approved analytics remain byte-identical to the pre-migration preservation manifest. It stays an authenticated synthetic preview, not a production report replacement. Existing production features remain reachable. The whole-product visual pass is **not yet accepted**: static renders prove basic route markup, not layout quality or every interactive state. Actual staging review must identify and fix remaining spacing/overflow/contrast issues.

## Verification and limitations

Infrastructure tests execute PostgreSQL SQL through PGlite, actual Better Auth endpoints and actual route SQL. Coverage includes CSRF, header spoofing, verified-account requirements, role resolution, secure cookies, expiry/logout/login throttling, owner/agent/admin isolation, cross-company document rejection, storage traversal/symlinks, SQL binding/rollback, and provider fail-safe behavior. Public/checkout/client/agent/admin static renders supplement the unchanged Block 18 render tests.

Repository diagnostics use an exact baseline multiset gate before the Next build. Known old diagnostics are permitted; any new diagnostic fails. This is explicit compatibility debt, not a claim of globally clean TypeScript. New isolated infrastructure modules also have a strict zero-diagnostic check.

Still required before completion: full live route matrix, managed PostgreSQL/network/volume restart tests, import idempotence on managed PostgreSQL, SMTP/Checko/DeepSeek live checks, real responsive screenshots, full report print/A4, browser accessibility and motion review, and final security review after deployment. See `AMVERA-STAGING.md`. No production secrets or documents should be copied into staging.
