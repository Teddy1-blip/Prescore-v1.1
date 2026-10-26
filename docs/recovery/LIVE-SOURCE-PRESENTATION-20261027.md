# Live-source presentation repair — 2026-10-27

Recovery parent: 335320221589c24fa78decfaa91f923ffbe2d929.
Staging before delivery: ac38573da7d956eb170fe7393568bef6c133b629.
Source tree before repair: b27d9379aeb4527a5166d0841578cebf773dc091.
Scope: four application presentation/projection files, one focused test file, this report.
Status: candidate verified locally; full build and authenticated acceptance NOT confirmed.

## Visible changes

- Workspace source availability exposes an optional BKI reportDate from the saved creditHistory report for the same INN. Only a valid ISO calendar date is accepted. Missing or invalid dates remain null; upload timestamps, contractual dates and today's date are not substitutes. Source periods and stored source manifests are not rewritten.
- Documents displays the report date separately from receipt date. Additional dossier-file counters now explicitly explain that they are not counts of processed analytical sources. The counters themselves are not changed or fabricated.
- Financing distinguishes observed statement payments from the near-term basis. Both observed and scheduled amounts are visible by default in the existing expandable section, with their existing provenance. Zero observed payments are explicitly not proof of zero company debt. No value, capacity, coverage or schedule is recalculated.
- The existing publicText UI layer renders the misleading zero-principal recommendation title as a request to confirm the current principal balance, and clarifies historical balance versus zero arrears. The generic index phrase no longer asserts an index was calculated. The Action renderer uses the same public wording. The canonical recommendation registry, trigger eligibility, action IDs, clientText, model fingerprints and stored reports remain unchanged. This is a presentation correction, not a claim to have validated every recommendation trigger or AI response.

## Executed checks

All four original source files were verified against current Git blob IDs before patching: 875cce58597101639a98116a981f33cd5e08b8bf, 155e5769117210ca164b280e64d6f6020409ef7a, a874867a3d0f7c1cc622b5abb06f0cf1224d62c8, 3e3e1952b3ebee5ffd5c6f6beff8012bd3e8af30. A historical bundle and prior patch archive were only retrieval sources, not commit parents.

Node 22.16.0 and installed TypeScript 5.8.3 (not the locked project toolchain):
- 22 focused tests against old target files: 3 pass, 19 fail.
- The same tests against patched target files: 22 pass, 0 fail, 0 skipped.
- Tested report-date validation/identity, document-source output, receipt separation, both financing views, unknown versus zero, corrected public action text, unchanged canonical copy and input immutability.
- Actual target functions execute after TypeScript transpilation; React/JSX, imported child components and financialSources selection are explicit test stand-ins. These are not a browser, SQL integration, PDF export or a full current calculation replay.
- Syntax/transpile checks passed. Full npm install/build/lint/regression unavailable locally; npm registry DNS returned EAI_AGAIN. All existing Amvera build gates remain mandatory.

Uploaded blob bytes match locally tested files. No scoring formulas, policies, parser behavior, hashes/goldens, migrations, dependencies, Docker, runtime settings, DB, production, DNS or payment configuration are changed.

## Acceptance and remaining work

After the normal staging webhook build succeeds, reuse QA analysis 992ab9e3-672e-4adf-955e-9a2c40e3ece3 without uploading files again. Verify Documents shows BKI report date 02.08.2026 independently of receipt, financing bases are clearly labelled, values and historical/current distinctions are preserved, and corrected public wording appears in the plan. Capture any residual old label in other renderers instead of declaring all screens fixed. Confirm health/ready and retain all stored analyses.

Still open: the source-upload receipt's period wording, full PDF export/bank-balance parity, concentration-unit explanations, numerical Index/capacity acceptance with sufficient source coverage, canonical recommendation-trigger review and real-document/provider/broker/production acceptance. This patch is not a redesign or full 19-block acceptance.
