# Recovery package 2: account cash perimeter and bank posting dates

Date: 2026-10-21. Parent: `856f62ba4f836e2c623785138b4f7dbb540a6617`.
Working branch: `prescore-live-product-recovery-v1`.
Status: locally verified code candidate; NOT deployed; NOT full product/19-block acceptance.
Staging remains `7aa6b167b696e8cc4073f623036081c8602fc7a1`.

## Reproduced defects

1. Metrics V2 reconstructed account balances from company-external transactions, dropping own-account transfers. That exclusion is correct for external/operating receipts, but not for movements of the supplied account perimeter. A mismatching reconstructed closing balance only produced a warning while false daily balances remained KNOWN.
2. The 1C adapter always selected the document date. Explicit own-side debit/credit posting dates were ignored. A previously uploaded private statement contained differing document/posting dates; a document-date oracle therefore did not establish the correct bank-date daily average.

## Changes

- Reconstruct daily balances from all retained cash movements of supplied accounts. Internal transfers still do not enter operating/external revenue; observed matching legs cancel on their actual days.
- Validate finite endpoints, opening/closing source evidence, dates, direction and period. Preserve the existing 740-day bound, but never publish a truncated series as a whole-period average.
- Failed closing reconciliation makes derived daily statistics UNKNOWN; reported closing balance is retained. Genuine reconciled negative balances are not clamped to zero.
- Select `ДатаПоступило` for IN and `ДатаСписано` for OUT using the existing normalization direction rules. Fall back to document date only when the applicable posting field is absent. An invalid explicit posting date still fails normalization.
- Preserve original document date in optional canonical raw-value provenance when a posting date is selected. Direction priorities and company-identity rules are unchanged.
- Add 12 independent liquidity examples, 7 posting-date cases and 5 real parser-to-workspace scenarios. No calculation engine is mocked in these tests.

Only the cash reconstruction/date selection and their tests/contracts are changed. No index/risk weights, scoring thresholds, debt-capacity policy, billing or provider policy is changed. Existing golden expected files were not rebaselined.

## Executed evidence

Environment: Node 22.16.0; native TypeScript stripping. Local TypeScript 5.8.3 is not the locked 5.9.3 toolchain.

- Original liquidity engine: 12 new tests, 4 passed / 8 failed. Fixed engine: all 12 passed.
- Final candidate banking/parser/workspace run: **122 passed, 0 failed, 0 skipped**. Command:
  `node --experimental-strip-types --test tests/bank-posting-date-recovery.test.mjs tests/bank-liquidity-perimeter-recovery.test.mjs tests/bank-statement-metrics-v2.test.mjs tests/workspace-real-engine-recovery.test.mjs tests/transaction-normalization.test.mjs tests/block2-parity.test.mjs tests/bank-statements.test.mjs`
- Final candidate native core regression: **4,867 passed, 0 failed, 0 skipped**, exit 0. Suites: reconciliation-v1, credit-portfolio-v1, risk-engine-v1, context-engine-v1, prescore-index-v1, financing-readiness-v1, credit-assessment-v1, debt-capacity-v1, product-selection-v1, recommendations-v1, action-plan-v1, explainability-v1. Run with `node --experimental-strip-types --test --test-concurrency=3`.
- All **24** business-corpus cases executed real source builders, canonical orchestration and the existing business assertions: all returned, no assertion failures. The corpus was extracted locally to avoid the unavailable ZIP dependency; the engines were not substituted.
- A real private single-account TXT was processed through the actual parser, saved JSON and workspace service. Incoming/outgoing/closing sums reconcile to the source. An independent Python Decimal ledger using bank posting dates matches final average/minimum/closing values to cents. No private documents, operations, company identity or balances are committed here.
- A separate zero-operation/no-owner sample is rejected rather than assigned an invented company. This does not claim general zero-activity statement support.
- Changed TypeScript files have no local semantic diagnostics. Missing third-party dependencies cause other diagnostics; this is NOT a project-wide typecheck/build pass.

The entire original `lib/credit-engine` tree was reconstructed and checked against parent tree `13cf566bdd5461f3cd6dca594386a0562af96326`, substituting original parent bytes only at the four proposed edits. The original metrics blob is `71070a12202c56c73cb95740cbafebc4c25fecb4`. Final uploaded blobs are checked against locally tested bytes. An older source bundle was only a retrieval bootstrap, never the commit parent.

An intermediate liquidity edit changed diagnostic metadata for unaffected golden cases; fingerprint guards caught that. Those unrelated metadata changes were removed, not accepted by changing the goldens. The final complete regression above passes the existing expectations.

## Scope limits and next acceptance

The 5 parser-to-workspace tests use actual TXT/BFO/BKI/quarterly text parsers and all downstream engines. Authorization/storage callbacks are explicit in-memory readers with JSON round-trips. They are NOT PostgreSQL, HTTP uploads, PDF/XLSX extraction, Checko live requests, React or browser tests. READY_FULL means the model was produced, not that the company is creditworthy or ready for financing.

No full locked-dependency install, Next.js build, authenticated staging test or deployment was completed: npm registry DNS is unavailable from the execution environment. No GitHub Actions were run. Do not promote this candidate based on native tests alone.

Existing stored metrics are not silently recomputed. Historical analyses require a separately controlled recalculation from complete originals; masked/truncated display rows must not be treated as the complete source. Generic multi-account coverage/alignment, duplicate-period boundary aggregation and legacy alternate liquidity outputs remain outside this narrow correction. Supplied-account balances do not prove all-company account coverage.

No DB write/reset/archive, historical QA deletion, environment change, secret/webhook modification, production change or payment activation was performed. Checko policy, live FULL flag, the specific empty staging analysis, visual UI acceptance and final 19 blocks plus 6.5 acceptance remain open.
