# Block 14 — Product Selection Engine v1

## Purpose and boundary

Product Selection identifies financing product families whose mechanics fit an
explicit financing purpose. It is an internal, pure SHADOW consumer of Risk,
Context, Index, Readiness, Credit Assessment and Debt Capacity. It does not rerun
these engines, require AnalysisResult, read transactions, apply legacy productFits,
change credit quality, implement bank eligibility or issue recommendations.

Approved parent: `b94678316fc44aa0ce9988a3d15d1b229ed00f6c`.
Candidate message: `Build Product Selection v1`. Main is not moved by delivery.

## Versions

- `PRESCORE-PRODUCT-SELECTION-1.0.0-SHADOW`
- `PRESCORE-PRODUCT-SELECTION-POLICY-1.0.0-PRE-CALIBRATION`
- `PRESCORE-PRODUCT-FAMILY-REGISTRY-1.0.0-PRE-CALIBRATION`
- Methodology: `PRESCORE_PRODUCT_MECHANICS_FIT_V1`
- Golden pack: `PRESCORE-PRODUCT-SELECTION-RU-GOLDEN-1.0.0`

Policy and product registry are separate, recursively frozen, validated against the
registered version and fingerprinted deterministically. Changing a mapping requires
an explicit versioned governance review. There is no empirical optimization claim.

## Contract and architecture

`ProductSelectionInputV1` accepts the six canonical assessments and explicit
`asOfDate`, plus optional company-level `CreditPortfolioV1`. `ProductSelectionV1`
preserves all four financing-case fact records, metadata/fingerprints of consumed
assessments, portfolio identity, per-input content fingerprints, candidates,
primary products, requested-product comparison, summary and warnings.

Modules separate contract, common primitives, registry, policy, validation, case
extraction, capacity alignment, portfolio exposure, evaluation, ranking, engine and
failure-isolated integration. Core imports no upstream build functions. It validates
canonical lineage but does not calculate Index, Readiness or Debt Capacity again.

`buildProductSelectionShadow(input)` returns optional `productSelectionV1` and
`productSelectionWarnings`. Invalid input produces
`PRODUCT_SELECTION_SHADOW_UNAVAILABLE`, without modifying inputs or authoritative
outputs. No production call site, endpoint, DB schema, UI, PDF or AI was changed.

## Product registry

| Family | Mechanics | Capacity relevance |
|---|---|---|
| TERM_LOAN | FUNDED_AMORTIZING | DIRECT_SERVICEABILITY |
| CREDIT_LINE | FUNDED_LINE | GENERIC_HEADROOM_SUPPORT |
| REVOLVING_CREDIT_LINE | FUNDED_REVOLVING | GENERIC_HEADROOM_SUPPORT |
| OVERDRAFT | FUNDED_REVOLVING_SHORT_LIQUIDITY | GENERIC_HEADROOM_SUPPORT |
| BANK_GUARANTEE | CONTINGENT | INDIRECT |
| FACTORING | RECEIVABLES_FINANCE | INDIRECT |
| LEASING | ASSET_FINANCE | DIRECT_SERVICEABILITY |

OTHER and UNKNOWN are valid requested inputs, not selectable products.
Guarantorship remains a portfolio exposure and never becomes a funded candidate.

| Purpose | Strong, in registry order | Moderate | Conditional | Weak |
|---|---|---|---|---|
| WORKING_CAPITAL | Revolver, line | Overdraft, term loan | Factoring | — |
| CONTRACT_EXECUTION | Guarantee, line | Term loan, revolver | Factoring | — |
| REFINANCING | Term loan | — | — | Line |
| INVESTMENT | Term loan | Leasing, line | — | — |
| EQUIPMENT | Leasing, term loan | Line | — | — |
| SEASONAL_NEED | Revolver, line | Overdraft, term loan | Factoring | — |
| LIQUIDITY_GAP | Overdraft, revolver, line | — | Factoring | Term loan |
| OTHER | — | — | — | All diagnostic entries |
| UNKNOWN | No meaningful selection | — | — | — |

Unlisted affinities are NOT_APPLICABLE. A declared seasonal need describes intent;
it does not establish seasonality. A contract-execution declaration without adequate
documentary support caps the guarantee at CONDITIONAL_MATCH. Exact canonical
CASE_CONTRACT_MATCH or an independently documented contract reference can support
guarantee/contract-line mechanics. Client declaration alone is not documentary proof.
Low-confidence evidence is not promoted; source IDs, fact IDs and relation IDs remain
traceable. Contract/customer name correspondence is only capped supporting context.

## Fit and ranking

Categorical fit order: STRONG_MATCH, MODERATE_MATCH, CONDITIONAL_MATCH, WEAK_MATCH,
NOT_APPLICABLE, UNKNOWN. There is no numeric productScore or hidden weighted sum.
Each purpose has a unique total registry order following fit level. This unique order
resolves all within-level ties before any capacity/evidence tie could occur; no
amount-sensitive alignment is used to move a product within that order.

All seven candidates remain visible. Up to three strong/moderate candidates are
primary. Conditional candidates can be primary only if there is no strong/moderate
candidate, with `ONLY_CONDITIONAL_PRODUCT_MATCHES_AVAILABLE`. Weak, unknown and
not-applicable candidates cannot be primary. Blocked selection has null ranks and
no primary products, rather than normal actionable ranking.

## Status, confidence and comparability

Statuses: ASSESSED, PARTIAL, INSUFFICIENT_DATA, NOT_RATABLE_GLOBAL_STOP.
Assessment global stop dominates; Assessment insufficiency or unknown/missing purpose
prevents meaningful selection. Partial Assessment/Readiness/Index or incomplete
Capacity caps selection at PARTIAL. OTHER purpose is at most PARTIAL. Missing amount,
term or requested product does not block generic mechanics.

Overall confidence cannot exceed Assessment or purpose confidence; primary candidate
confidence additionally reflects materially used facts and capacity/scenario evidence.
Candidate confidence cannot exceed any fact/evidence it uses. UNKNOWN remains unknown,
including explicit upstream UNKNOWN confidence even when status is otherwise assessed.
No confidence is a statement about credit quality or approval probability.

Comparability requires ASSESSED, comparable Assessment and Capacity, and adequately
known purpose. PARTIAL, INSUFFICIENT_DATA and GLOBAL_STOP are never comparable.

## Requested product, amount, term and urgency

Requested product is a separately preserved declaration. Alignment is
ALIGNED_WITH_PRIMARY, ALIGNED_WITH_CANDIDATE, CONDITIONAL,
NOT_ALIGNED_WITH_MODELED_PURPOSE or UNKNOWN. It never changes fit, rank or primary
selection. It does not suppress a better-fitting product.

Requested amount affects only applicable scenario alignment. `requestedAmountAlignment`
reports Block 13 coverage for compatible TERM_LOAN scenarios; unavailable/inconsistent
or mismatched-term coverage is UNKNOWN. Other families use NOT_APPLICABLE. Multiple
scenarios with different coverage do not produce one invented amount conclusion.

A larger requested amount never changes mechanical fit or ordering. No generic maximum
term, speed promise, bank age rule, OKVED rule or regional eligibility is introduced.
Index and Readiness levels are references, not product multipliers. DATA_REVIEW is not
a borrower weakness or product penalty. Context effects are not numerically reapplied.

## Capacity and principal reference

Capacity alignment: SUPPORTED, CONSTRAINED, UNKNOWN, INDIRECT_NOT_PRODUCT_LIMIT,
NOT_APPLICABLE. Known positive generic headroom supports funded serviceability, but
does not create fit for an unrelated purpose. Zero headroom caps funded families and
leasing at CONDITIONAL_MATCH, preserving weaker/not-applicable mechanics. It does not
exclude guarantees or factoring, whose generic capacity relevance is indirect.

Only TERM_LOAN can expose `principalReferences[].serviceablePrincipalEquivalent` copied
exactly from an explicit Block 13 ANNUITY scenario with a matching known requested term.
References preserve rate, term, scenario confidence, coverage and evidence IDs. Block 14
never computes a rate, principal amount or product limit. It does not use annuity
principal as a guarantee/overdraft/credit-line/factoring limit or leased asset price.
When requested amount exceeds every applicable modeled scenario, capacityAlignment may
be CONSTRAINED while intrinsic fit and ordering remain unchanged.

## Product-specific limitations and data requirements

Factoring compatible purposes remain conditional: existing FACTORING_INFLOW confirms
observed mechanics only. It does not prove available invoices, debtor eligibility,
assignability, recourse or a factoring limit. Marketplace flow never substitutes for
invoice evidence. Leasing supports equipment/investment mechanics but has no modeled
asset price, advance, residual value or product-specific term. Guarantees remain
contingent, including when funded headroom is zero.

Requirements have SATISFIED, MISSING, PARTIAL or NOT_APPLICABLE statuses:
FINANCING_PURPOSE_REQUIRED; CONTRACT_EVIDENCE_REQUIRED;
RECEIVABLES_OR_INVOICE_EVIDENCE_REQUIRED; ASSET_SPECIFICATION_REQUIRED;
DEBT_CAPACITY_REQUIRED_FOR_FUNDED_PRODUCT;
EXPLICIT_RATE_TERM_SCENARIO_REQUIRED_FOR_PRINCIPAL_REFERENCE;
PRODUCT_SPECIFIC_LIMIT_NOT_MODELED. Missing data is not borrower weakness.

## Portfolio exposure

Optional portfolio supplies informational current same-family exposure and obligation
IDs. Only known ACTIVE obligations establish current exposure; CLOSED are excluded;
unresolved status retains UNKNOWN (`null`). No supplied portfolio also yields null,
not an invented absence. Canonical CREDIT_LINE does not prove REVOLVING_CREDIT_LINE.
Existing exposure never prefers, penalizes or excludes a family. Guarantees and
GUARANTORSHIP are not mapped to funded loans. No portfolio balance is recalculated.

## Validation, time and purity

Fail closed on wrong company/cutoff, unsupported versions, fingerprint/reference
mismatches, malformed or duplicate canonical records, broken Assessment/Readiness/
Index lineage, impossible status/headroom combinations, invalid enums, negative
requests, non-finite values, malformed scenario terms/provenance/coverage, duplicated
portfolio IDs, dangling portfolio references and future evidence.

All knowledge/availability dates are compared with explicit asOfDate. Future known
contractual maturity, schedule due and effective dates are allowed. The core has no
machine clock, random IDs, network, database or LLM. Canonical input-array permutations
produce byte-identical outputs. Output-owned projections cannot mutate upstream data.

## Golden governance and tests

Golden expectations are authored from specification intent, never captured from engine
output. Each synthetic case has an ID, revision, lifecycle status, review label and
pinned input/expectation fingerprint. Fixture metadata describes this implementation's
methodology review, not external bank validation or user approval of the candidate.

The pack includes 60 original scenarios plus PRD-RU-DEFECT-001. Assertions cover status,
confidence, comparability, candidates, fit/rank/primary, capacity relevance/alignment,
requested-product comparison, reasons, requirements, exposure, scenario references,
forbidden numeric limits, summary, invariants and pairwise equality. Any changed fixture
requires deliberate fingerprint review. Earlier packs and fingerprints are untouched.

The permanent CL → CTX → IDX → RDY → CAS → CAP → PRD regression verifies current
overdue with KNOWN historical zero: MEDIUM current risk without any fabricated
DELINQUENCY_1_29/30_59/60_PLUS or historical-delinquency finding.

Dedicated suite additionally checks the full purpose × product × headroom matrix,
requested-product neutrality, portfolio status matrix, malformed-input rejection,
policy/registry governance, evidence confidence, deterministic reorder, immutability,
FREE/FULL and legacy production parity.

Commands:

```sh
node --experimental-strip-types --test tests/product-selection-v1.test.mjs
node --experimental-strip-types --test --test-concurrency=1 tests/*.test.mjs
npm run build
npm run lint
npm run validate:artifact
node node_modules/typescript/bin/tsc --noEmit --strict --allowImportingTsExtensions --moduleResolution bundler --module esnext --target es2022 --skipLibCheck lib/credit-engine/product-selection/*.ts
node --experimental-strip-types tests/fixtures/product-selection/benchmark.mjs
```

Run the Golden pack through `loadPack()` and `runProductPack()` from its fixture modules.
Benchmark covers 1,000 product evaluations, 200 source-to-product canonical pipelines,
1,000 registry/ranking evaluations, 1,000 expectation evaluations and 1,000 comparisons.
It separately reports validation, case extraction, registry evaluation, capacity
alignment, portfolio exposure, ranking and finalization fingerprint projection. These
are environment-dependent measurements, with no arbitrary millisecond gate.

## FREE/FULL and future seam

Pure SHADOW output may be attached internally to a FULL result. Existing FREE projection
excludes it and remains behavior-identical. No production analysis automatically calls
Block 14. Legacy productFits are regression-only, not the new methodology target.

Block 15 may consume ProductSelectionV1 together with Capacity, Assessment, Readiness,
Risk and Context. No apply/repay/wait action, recommendation or action plan is implemented.
No bank policy, approval probability, PD, recommended bank, product quote, public API,
DB migration, OCR, live bureau/provider integration, UI/PDF or deployment is included.

## Fingerprints

Registry: `product-family-registry:d9ebb0bc421534f338c4a83a5264586d`

Policy: `product-selection-policy:c7c24835390d0b52a1a9fe33dba66e54`

## Golden case inventory

| ID | Scenario |
|---|---|
| PRD-RU-001 | Working capital revolving mechanics |
| PRD-RU-002 | Liquidity gap short recurring financing |
| PRD-RU-003 | Declared seasonal need does not prove seasonality |
| PRD-RU-004 | Exact contract documentary match |
| PRD-RU-005 | No contract evidence limits guarantee |
| PRD-RU-006 | Refinancing term-loan mechanics |
| PRD-RU-007 | Investment mechanics |
| PRD-RU-008 | Equipment asset financing |
| PRD-RU-009 | Other purpose not modeled precisely |
| PRD-RU-010 | Unknown purpose blocks selection |
| PRD-RU-011 | Requested term loan aligned primary |
| PRD-RU-012 | Requested overdraft cannot lead investment |
| PRD-RU-013 | Unknown requested product neutral |
| PRD-RU-014 | Billion versus million order neutrality |
| PRD-RU-015 | Requested amount within explicit scenario |
| PRD-RU-016 | Above annuity equivalent constrains alignment only |
| PRD-RU-017 | Scenario term mismatch gives no principal reference |
| PRD-RU-018 | No explicit scenario invents no principal |
| PRD-RU-019 | Positive funded headroom support |
| PRD-RU-020 | Zero funded headroom conditional only |
| PRD-RU-021 | Low Readiness leaves intrinsic mechanics |
| PRD-RU-022 | High Readiness cannot cancel zero headroom |
| PRD-RU-023 | High Index neutral |
| PRD-RU-024 | Low Index neutral |
| PRD-RU-025 | Data review is not product penalty |
| PRD-RU-026 | Global stop blocks normal selection |
| PRD-RU-027 | Insufficient Assessment cannot be bypassed |
| PRD-RU-028 | Partial capacity caps completeness |
| PRD-RU-029 | Guarantee indirect despite zero headroom |
| PRD-RU-030 | Contingent amount no funded product limit |
| PRD-RU-031 | Guarantorship not funded family |
| PRD-RU-032 | Existing factoring flow is mechanics evidence |
| PRD-RU-033 | No invoices keeps factoring conditional |
| PRD-RU-034 | Factoring no annuity limit |
| PRD-RU-035 | Leasing serviceability not asset price |
| PRD-RU-036 | Overdraft no annuity limit |
| PRD-RU-037 | Line no annuity limit |
| PRD-RU-038 | Revolver no annuity limit |
| PRD-RU-039 | Guarantee no annuity limit |
| PRD-RU-040 | Term loan generic principal reference only |
| PRD-RU-041 | Immediate urgency conveys no approval speed |
| PRD-RU-042 | Young company no bank policy |
| PRD-RU-043 | Region neutral |
| PRD-RU-044 | OKVED neutral |
| PRD-RU-045 | Contract concentration context not bank approval |
| PRD-RU-046 | Marketplace flows do not force factoring |
| PRD-RU-047 | Existing same-family exposure informational |
| PRD-RU-048 | Closed loan not current exposure |
| PRD-RU-049 | Stable categorical ordering |
| PRD-RU-050 | All seven retained only three primary |
| PRD-RU-051 | Client-declared purpose confidence cap |
| PRD-RU-052 | Client-requested family not proof |
| PRD-RU-053 | Missing amount permits mechanics |
| PRD-RU-054 | Missing term permits mechanics |
| PRD-RU-055 | Missing purpose not guessed |
| PRD-RU-056 | Reordered input deterministic |
| PRD-RU-057 | All upstream inputs immutable |
| PRD-RU-058 | Real canonical working-capital source pipeline |
| PRD-RU-059 | Real canonical contract-execution pipeline |
| PRD-RU-060 | Current overdue historical zero preserves mechanics |
| PRD-RU-DEFECT-001 | Permanent current-overdue known-historical-zero chain |

## Measured performance

| Phase | Iterations | Total ms |
|---|---:|---:|
| validation | 1000 | 7029.95 |
| caseExtraction | 1000 | 0.41 |
| registryEvaluation | 1000 | 38.68 |
| capacityAlignment | 1000 | 1.75 |
| portfolioExposure | 1000 | 0.09 |
| candidateRanking | 1000 | 1.67 |
| finalizationFingerprintProjection | 1000 | 32008.84 |
| productSelection1000 | 1000 | 37875.41 |
| sourceCanonicalPipeline200 | 200 | 12084.11 |
| registryRanking1000 | 1000 | 36.60 |
| goldenExpectations1000 | 1000 | 69.90 |
| pairwiseComparisons1000 | 1000 | 6.74 |

Measurements were taken in the shared validation environment; concurrent workloads
can affect wall time. Finalization projection includes canonical upstream content
fingerprinting, which accounts for most measured engine time. No caching, hidden
state or timing-based acceptance gate is introduced.

## Final validation and delivery review

- Dedicated Block 14: 461 passed / 0 failed.
- Full repository: 3,401 passed / 0 failed, including the unchanged 2,940 baseline.
- Product Golden: 61 PASS / 0 REVIEW / 0 FAIL; permanent defect PASS.
- Prior Golden packs: Block 8 31, Block 9 31, Block 10 41, Block 11 41,
  Block 12 46, Block 13 55 PASS; no changed prior fingerprints or expectations.
- Build, lint, artifact validation and strict new-module typecheck: PASS.
- Repository TypeScript diagnostics: baseline 30 / current 30 / new 0.
- git diff --check: PASS. Only 19 new Block 14 files; zero approved files modified.
- Immutability, determinism, pairwise neutrality and FREE/FULL regression: PASS.
- Legacy parity: 872 / A / Высокая готовность / 1,283,000–2,636,000 RUB.
- Prior-block defects: NONE.
- One candidate commit directly on approved Block 13; no main update, merge,
  force, deployment or Block 15 work.

Golden fixtures were reviewed for actual scenario premises: marketplace context,
contract concentration context, and genuinely HIGH/LOW Readiness in the explicit
canonical scalar-boundary tests. Expectations were not copied from engine output.
Final accepted full regression was a separate complete TAP run after these reviews.
