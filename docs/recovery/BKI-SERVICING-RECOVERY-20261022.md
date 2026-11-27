# Recovery package 4: separate BKI servicing fields

Date: 2026-10-22. Parent: `e79c2f034358d46ad273b4d7c81e58d25301ebc5`.
Working branch: `prescore-live-product-recovery-v1`.
Status: tested native parser/portfolio candidate; not deployed or product-accepted.

## Reproduced failures

In the SB text parser, `Текущая просрочка: 5 000.00 ₽` followed by a next-payment field containing `нет данных` became zero overdue. The broad search for `нет` inspected neighbouring fields. When only the overdue amount was present, that same amount was also published as the next payment. A date in the overdue field could become the next-payment date. `Нет данных` could be labelled as no delinquency because zero historical days were sufficient on their own.

## Changes

- Read labelled current-overdue, next-payment amount and next-payment date separately, including newline/inline values and supported SB next-payment labels.
- Do not borrow neighbouring unknown markers, amounts, dates or section headings. Unlabelled or unsupported next-payment data stays unknown.
- Preserve explicit absence/zero with field-level provenance for the canonical BKI adapter. Unknown is not converted to zero.
- Keep historical timeliness separate from current arrears. An all-clean descriptive label requires both confirmed zero history and current arrears. A mixed known/unknown report does not get an all-clean summary.
- The legacy explanation no longer describes unknown current arrears as zero or as confirmed absence. A disclosed positive subtotal is labelled as a lower bound when other obligations are unknown.
- No risk thresholds, index weights, debt-capacity formulas, statement or financial parser code are changed.

## Executed evidence

Command:
`node --experimental-strip-types --test tests/bki-servicing-field-recovery.test.mjs tests/credit-history.test.mjs`

Node 22.16.0; real text parser, BKI adapter and credit-portfolio resolver. Synthetic text only, no parser/portfolio mocks, HTTP calls or database writes.

- Exact original parser blob `f390928ed1a000a9744ad4e6a5b7ed567d933d5a`: 55 tests, 21 passed, 34 failed.
- Patched parser blob `0acf63f1b897dde334670f266f221cae7da4c99a`: 55 tests, 55 passed, 0 failed, 0 skipped.
- New test blob `06509ab7c3f1349513ae42b96c86f92335d7c359`: 52 tests plus 3 unchanged existing credit-history tests.
- Current existing test blob verified as `a495ad09d3c1d2abd783256bf356fe5de1b0beaa`.
- Native portfolio subtree verified against current GitHub tree `2fd5524ce7ee01e4dd1b6f6f1f64346d58cbe162`; runtime contract blob `971b61b40e0ceaf9a7e655ea96c3a96a8135913c`.
- Strict standalone parser typecheck passed with installed TypeScript 5.8.3. This is not the locked TypeScript 5.9.3 project build.

Coverage includes unknown versus known zero, absent/present field headings, same-line and multiline values, history absence, reported delinquency, next-date isolation, explicit zero provenance, corporate NBKI regressions, two-obligation isolation, personal-source exclusion, explicitly scoped IP portfolio, serialization and unchanged principal/rate/contract fields.

## Boundaries

No PDF byte extraction, arbitrary PDF layout support, OCR, real-client file acceptance, original-file storage, Next.js build, browser test or all-19-block acceptance is claimed. The native tests start from synthetic extracted text. General multi-column layout parsing and other legacy summary completeness issues are outside this correction.

A fresh `npm view next@16.4.0 version --fetch-retries=0 --fetch-timeout=4000` failed with `EAI_AGAIN registry.npmjs.org`; a full locked-dependency install/build is still blocked in this execution environment. Do not promote based only on these native checks.

Remote commit must use the current parent tree and change only this parser, its new test and this report. Previous navigation, diagnostics, bank/date/balance and financial-number fixes are preserved. No staging/main/production ref update, deployment, Actions run, environment change, provider request, payment activation, database mutation or archive is included. Historical saved reports are not rewritten.

This fixes reproduced BKI corruption; it does not establish or fix the cause of the user's blank live analysis. Next acceptance gates remain locked-dependency build, authenticated workspace diagnostics and source-to-screen checks.
