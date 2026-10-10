# CLIENT credit conclusion acceptance

Source: staging `7d5677d99673942efd60bd94090af97ab4041529`.

The default CLIENT home and preserved `view=analysis` deep link render the same
credit conclusion. Banking remains a separate detail screen. Existing selection,
upload, applications, documents, entitlements and AI behavior are retained.

First level: company/date/period; source status disclosure; canonical Index and
readiness; canonical assessment caveat; strengths; principal attention items;
prudential additional monthly payment, observed and scheduled service; financing
scenarios; obligation summary; latest published financial indicators and existing
trends; reconciliation summary; product fit; up to five prioritized actions.
Evidence, complete portfolio, financial tables and full plan are disclosures.

All result values come from WorkspaceModelV1 / its current public report. No
engine, policy, parser, model schema, authorization or storage changes. The UI
maps readiness labels but does not promote a partial assessment to a complete one.
A READY source does not imply known metrics. Current canonical source observations
prevent the earlier bank-only integrity missing-source list from incorrectly
claiming that already processed BFO, quarterly or BKI sources are absent.
Unknown monetary values are not displayed as zero; no portfolio totals or product
fits are computed in the browser.

## Reproducible synthetic evidence

`tests/fixtures/credit-conclusion.mjs` loads existing `CL-RU-BUS-019` through the
canonical production orchestrator. This case includes bank statements, BFO for
2024/2025, quarterly June 2026 reporting, BKI and synthetic open company data.
It calculates Index 1000 (PARTIAL), MEDIUM readiness and prudential incremental
monthly debt service 100000 RUB. These numbers are evidence, never UI constants.
The assessment remains partial: new obligation observation and unmatched payment
need evidence; UNKNOWN product fit is preserved. No artificial positive result.

Run `node --experimental-strip-types --test tests/credit-conclusion.test.mjs`.
Run `node --experimental-strip-types scripts/qa/credit-conclusion.mjs <output>`
with an installed Playwright Chromium (or `QA_CHROMIUM_PATH`).
The harness serves actual production CLIENT components and calculated models on
loopback only, rejects non-GET requests and blocks external browser requests.
It verifies 1440/1024/390 layouts, canonical Index equality, evidence interaction,
A → B → A selection and reload. Full-page and viewport screenshots are generated.
It creates no staging analysis or user data and makes no AI calls.

## Completed purge removal

Remove the one-time instrumentation hook, purge module, startup reset script and
Docker startup reset invocation. Temporary staging-only health verification uses
`BEGIN READ ONLY`, fixed count queries and preserved-access booleans. It contains
no DELETE, schema or data mutation. Remove that read-only diagnostic after the
live evidence has been collected; retain ordinary database health only.
