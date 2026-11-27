# Credit Lab — Development V1 (staging only)

This extension preserves the 31-case Block 8 Golden pack and all pre-existing fixtures.
The 100 new Risk cases are **SYNTHETIC / DRAFT**, never externally validated or promoted.
Source package reference: staging `69ccc712ddd7adac00b25531083191267043fdb0`.

## Reproduce three separate acceptance layers

- `npm run credit-lab`: original Golden command, unchanged.
- `npm run credit-lab:development`: 100 DRAFT cases through the existing Lab runner; HARD mismatches exit nonzero.
- `npm run credit-lab:business -- /absolute/new/output-directory`: 24 source bundles through screening, parsing, classification, full-population metrics and production orchestration. Writes per-case models, assertions, sources, account periods, month coverage, deduplication, scenarios and pair checks. **Any business FAIL exits nonzero.** Model returned is reported separately from business acceptance.
- `node --experimental-strip-types --test tests/credit-lab-runtime.test.mjs`: real upload route over localhost HTTP, disposable in-memory PGlite, SQL persistence/reread, real ownership and entitlement functions, protected report service for all 24. Synthetic auth principal is injected only in the test loader. No deployed auth bypass or real database connection. Source attachments are explicit fixture-boundary injection into this disposable DB; not PDF upload/Checko transport acceptance.
- `npm test`: existing tests plus DRAFT, source invariants and isolated runtime tests. It does **not** convert or hide the separate business command's failures.

The compact `tests/fixtures/credit-lab/development-v1/business-sources.zip` contains the
original 171 synthetic input files byte-for-byte (including Windows-1251 TXT). It is
an input fixture, not an application deployment archive. No `source.tar.gz` workflow.
`case.json` byte and decoded text hashes are checked before parsing. The generator
is retained at `scripts/generate-credit-lab-businesses.py`; prepared inputs are not
regenerated during deployment. No computed model is stored as a runtime fixture.

Banking uses the actual `screenBankStatements` / `analyzeBankStatements` /
`analysisForStorage` functions, including upload screening of byte duplicates.
BFO JSON enters the real accounting-line normalizer with explicit scale. BKI JSON
is a `CreditHistoryReport` parser-boundary fixture. Legal JSON is a provider-boundary
fixture. These do not prove actual bureau PDF extraction or a live provider response.
The adapter sets only synthetic identity/receipt metadata; it never assigns metrics.
The large bundle has 12,072 retained transactions; display storage is 10,000 while
canonical metrics keep the entire population. Runtime tests compare the saved
metrics against independently parsed full inputs before adding boundary sources.

## Existing report-v2 preview

On the exact existing staging origin, sign in normally and open
`/dashboard/report-v2?lab=1`. It offers all 24 synthetic companies. Each selection
is recomputed server-side and rendered by the existing `ClientReportShell`.
`?lab=CL-RU-BUS-001&print=1` uses the existing print component.
The preview is labeled synthetic and DRAFT, with review notes on known failing cases.
Only catalog case IDs are accepted. No file path, SQL or real dossier is accepted.
The real `analysisId` branch always wins and does not import or execute Lab code.
Preview requires existing authentication, reads no dossier and writes no DB.
`next.config.ts` traces only the source ZIP into the standalone build. Dockerfile,
amvera.yml, secrets, permissions, workflow and production routing are unchanged.

## Prior-block defects exposed by independent expectations

These are kept as FAIL, not redefined to match current behavior. Engines, thresholds,
weights, source contracts and Golden files are not changed by this Lab task.

1. **CL-RU-BUS-010 / COVERAGE_PER_ACCOUNT_REVIEW**: two fully covered accounts,
   12 calendar months expected; current fullMonths = 0 and overlapMonths = 12.
   `analyzeCalendarCoverage` in `source-foundation.ts` considers distinct source IDs
   per day without account identity. `metrics/engine.ts` retains OVERLAP and excludes
   it from full-month capacity basis. Correct own transfers and sales totals do not
   repair this source/account coverage contract. Do not mechanically promote OVERLAP.
2. **CL-RU-BUS-013 / CURRENT_OVERDUE_NOT_HISTORY_DAYS**: explicit boundary input
   overdueAmount=1000, maxDelinquencyDays=0; current canonical history days = UNKNOWN.
   `credit-portfolio/bki-adapter.ts` requires `confirmedZeroFields`; production
   orchestration supplies no such provenance. This is a boundary provenance gap,
   not permission to treat all parser zeros as confirmed. Current overdue remains
   1000; no historical delinquency band may be fabricated. An explicit presence/
   confirmation contract is needed before a safe general fix.
3. **CL-RU-BUS-022 / NO_SILENT_DOUBLE_COUNT**: two versions of the same operation
   differ by 1,000 RUB. Accepted operating totals should not add both versions.
   `normalization/deduplication.ts` includes amount in both exact and probable keys;
   neither key joins different-amount versions of the same document. Both are retained.
   Data review is raised, but the summed operating amount exceeds either source version.
   A conflict-preserving identity contract is needed; do not pick a version silently.

Metamorphic checks cover permutation, exact duplicates, own transfers, disjoint
file splitting, explicit RUB/thousands scale, deterministic reruns, input immutability,
truncation, zero-rate annuity, missing scenarios and UNKNOWN principal. Historical
cutoff/future-source exclusion is **NOT_RUN** at the production entry point: it has no
caller-specified historical asOf, and derives its cutoff from the latest supplied
source. Determinism alone does not prove point-in-time selection.

The business runner's nonzero result is intentional evidence of unmet expectations,
not a suppressed test or a claim of successful bank validation. Browser rendering,
server delivery and business correctness are separate acceptance results.

The supplied 9.9 MB human-readable Risk entry copy is kept byte-exact as
`cases.json.gz` (not loaded by the runner). Decompress with `gzip -dc` when needed.
Uncompressed SHA-256: `62640dfd939d2ecf14746c1f6457606a7be75831199d23e9c778dbf180a45323`.
Executable definitions and original fingerprints remain unchanged.
