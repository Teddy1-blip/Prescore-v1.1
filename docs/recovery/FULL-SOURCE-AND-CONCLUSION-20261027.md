# FULL source metadata and conclusion renderer — 2026-10-27

Recovery parent: b1fefa891fcd83b14e7d8d373a88ff67840f4685.
Staging before delivery: c59059809cee6eb6d38fe6a4bc2f8ebba3a3a166.
Base tree: 957bd6749edaab3b83672a9b1f98e34c47f1b42b.
Observation: issue #11 comment 6429167265; build succeeded and READY, but the date in Documents and the key-constraint copy were not accepted.

## Causes reproduced in the actual target code

1. projectWorkspaceBasic already validates and returns BKI reportDate. loadWorkspaceModelV1 then replaces source availability in the FULL branch with canonical observations, dropping reportDate. The previous presentation test only exercised the basic projector, missing this replacement.
2. FullCreditAnalysis renders topConstraint.title/text directly in the conclusion hero. Other renderers already use publicText, so the same constraint had inconsistent user-visible wording.

## Narrow correction

- Keep canonical source observations authoritative. Copy only the already validated BKI report date into a FULL source row whose source ID matches the saved BKI manifest. A different source, missing date, invalid calendar date or conflicting/unknown subject remains unconfirmed. Do not use receipt, payment/maturity date or today's date as a replacement.
- Apply the existing publicText function to the conclusion's key-constraint title and description. Preserve the canonical strings, claim link, component selection, fallback text, index and financial values.

No parser, scoring policy, numeric calculation, canonical fixture/hash, migration, database record, auth/entitlement rule, dependency, Docker/build gate, configuration, DNS, payment or production deployment is changed. Existing saved analyses are read, not rewritten; no re-upload is required by this patch.

## Verification performed

Original target bytes were checked against Git blob IDs:
- lib/workspace/service.ts: a244253e18ebc2ae9f6c8add7b70f0f112a5a472
- app/components/workspace/client-analysis.tsx: 2f8262d58cb652c8738e30bcf76f93f70d44b227
Current supporting model, public copy, Documents renderer, diagnostics and hook files were also matched to their Git blobs. Local historical source archives supplied bytes only; their historical commit is not a delivery parent.

New tests execute the actual workspace service, basic projection, JSON serialization, Documents renderer and conclusion component. DB access, canonical calculation/public-report boundaries, JSX/React and unrelated child widgets are explicit synthetic stand-ins. This is not a live API, SQL, browser or financial-accuracy acceptance.

- Before correction: 18 new tests, 4 passed / 14 failed.
- After correction: the same 18 tests passed.
- New tests plus the existing 29 workspace diagnostic/hook tests: 47 passed, 0 failed, 0 skipped.
- Tests cover BASIC/FULL date parity, receipt separation, source-ID matching, rejected invalid/foreign dates, preserved canonical source set and financial values, denied access, broker read-only, all three constraint-selection paths, original claim links, input immutability and locked/empty states.
- node --check and TypeScript transpile diagnostics passed for the changed/new source files. Local Node is 22.16.0 and TypeScript is 5.8.3, not the locked full project toolchain.

The local tree is a verified subset, not a complete checkout of every dependency. Full ESLint is not installed here. Full current build/regression/Credit Lab/lint/artifact/PDF and authenticated UI verification remain mandatory in Amvera. The previously reported 6712/6712 belongs to the preceding revision, not this patch.

## Work acceptance — bounded, no duplicate build

After the existing webhook delivers this patch, identify its source and active revision. Do not manually repeat push/build/restart. Read build state/log once; if still running, record the latest confirmed stage/time and end the observation session without cancelling the Amvera build. No polling or repeated screenshot uploads.

After successful activation and READY, reuse analysis 992ab9e3-672e-4adf-955e-9a2c40e3ece3 without adding files or changing it. Check BKI report date 02.08.2026 in Documents, receipt separately, and the corrected title AND description in Conclusion -> Key constraint. Refresh and confirm unchanged amounts, historical/current debt distinction and claim link. If the date remains unconfirmed, record the safe source metadata from the owner-authorized workspace response; do not insert a date or modify stored payloads.

Other open acceptance items remain open: full PDF/bank-balance parity, concentration units, numerical index/capacity with sufficient sources, recommendation-trigger review, providers, real documents, broker/admin/billing, backups and production/domain. Dependency vulnerabilities reported by npm in the previous build still require separate triage; this patch does not resolve or waive them.
