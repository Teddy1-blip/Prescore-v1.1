# Document uploads v0.3 — phase 1: type routing and preview safety

Baseline: `ce5b4bed9e332f50009881692ccc9173b4c2d1c4`, `prescore-product-v1`.

## Delivered in this increment

- Three explicit upload contracts (BFO / CREDIT / COMMERCIAL), with separate field inventories and intended UI locations.
- Deterministic content-based preliminary classification. Filenames and dossier categories do not establish type.
- BFO is not an OSV, bank statement, credit report or tax declaration.
- Guarantees, surety, pledge, leasing and factoring never silently enter a standard loan parser.
- Supplements and unlinked schedules require parent/relationship review.
- Mixed families, different numbered main contracts, missing/unreadable/truncated pages and disagreeing OCR variants prevent parser dispatch.
- Exact repeated pages are deduplicated. Source input is not mutated.
- A dispatcher calls only the matching supplied specialized adapter; absent adapters and errors do not fall back to the commercial parser.
- Existing `/api/document-ocr` accepts optional expectedFamily, preserves authorization, and reports classification scope as CURRENT_OCR_BATCH. An incomplete batch never implies a complete document.
- Existing OCR preview now runs the commercial parser only after matching content classification. It shows an explicit status for BFO/credit documents instead of displaying commercial-contract fields for every PDF.
- A differing second OCR pass requires an explicit preview choice; it no longer silently wins by concatenation order.

## Not delivered / must not be claimed

This is NOT completion of the three-upload specification.

- Three independent product upload forms are not yet placed in Finance / Credit Portfolio / Counterparty card. The optional expectedFamily prop prepares the common preview for those separate entry points.
- BFO table parsing and credit-agreement parsing are not connected to this OCR preview. Existing source-upload and extraction code remains unchanged.
- No durable OCR job/result storage, field confirmations, version application or canonical financial imports were added. The UI explicitly states that this preview is not persistent.
- Layout selection remains manual; this increment does not claim automatic rotation/spread detection.
- Contract field extraction retains its earlier limitations. Content routing does not prove that values or legal conclusions are correct.
- No DeepSeek calls, paid OCR, migrations, deployment or credit-methodology changes.

## Validation executed locally

77 passed, 0 failed, 0 skipped across:
- `tests/document-routing-v03.test.mjs`: 49 synthetic content/routing cases.
- `tests/document-dispatch-v03.test.mjs`: 12 dispatch/error/isolation cases.
- `tests/document-routing-ui-v03.test.mjs`: 4 syntax/source guards (NOT browser acceptance).
- `tests/document-ocr-route-v02.test.mjs`: 8 endpoint tests with stubbed DB/storage/OCR (NOT a live database authorization audit).
- `tests/contract-facts-v02.test.mjs`: 4 existing extraction regression cases.

Strict standalone TypeScript check of the two new modules passed. Local environment: Node 22.16.0, TypeScript 5.8.3; project-pinned build was not run.

The complete repository, dependencies and running application are not available in this local checkout. Full Next.js build, full regression, browser acceptance and staging verification remain unperformed. This pass did not re-OCR Agreement 487 or transmit any client file.

## Next implementation increment

Place the three independent forms in their respective existing sections; connect existing BFO/credit adapters with verified source mappings; add server-persisted extraction/review state and explicit confirmations. Keep financial application separate and test it for versions, duplicates and tenant access before enabling it.
