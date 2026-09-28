# Workspace product review — issue #5

Candidate is restricted to `workspace-client-broker-v1`; reviewed presentation baseline is `e2c02e8409269f8c83768f05e3a430a414d793a0`. No deployment is part of this review. All QA companies, documents and messages are synthetic.

## Meaning of the displayed fields

| Field | Source and meaning | Client presentation |
|---|---|---|
| `report.hero.headline / summary` | Public report adapter uses explainability executive-summary headline and profile summary. These are the canonical warning/conclusion, not a UI marketing headline. | Preserved verbatim. |
| `canonical.prescoreIndex.value / status`, `report.index.status` | Canonical index and its calculation status. A high number may coexist with PARTIAL; null is not zero. Public adapter translates status. | Original number, nearby prominent translated calculation status; explicit no-approval promise. Null: «Не определён». |
| `report.readiness` | Public financing-readiness level, explanation and constraints; independent from the index number. | Separate «Готовность к финансированию» and existing explanation. |
| `basic.sources.completeness` | `analysis.integrity.completeness`, calculated in `source-foundation.ts`: 65% known transaction-field rate (direction, counterparty, INN, purpose, account, source) and 35% calendar coverage within the statement period, rounded/clamped. Does not measure completeness of all credit inputs. | «Заполненность банковских данных» with explicit scope; in source details, not next to Index. |
| `canonical.debtCapacity.headlineCapacity...prudential` | Canonical prudent additional monthly debt-service capacity; not principal/approved limit. Public capacity status remains separate. | «Расчётный запас для нового платежа», unchanged amount and nearby status. Unknown remains unknown. |
| Source availability `READY` | Manifest says source processed; does not prove that every analytical conclusion used it. | «Обработан» plus explanation; not «Учтено». |
| `basic.sources.missingSources` | Saved integrity list; aliases map to source names, identical requirements deduplicated. | Specific names, one neutral explanation for unknown codes, details link when full report exists. |

## Input inconsistency retained for review

`business-input.mjs` builds statement integrity before attaching the synthetic normalized BFO/BKI bundle. In synthetic cases 001, 011, 013, 017, 022, the saved `integrity.missingSources` contains BFO and BKI while `sourceManifest.bfo.status` and `.bki.status` are READY. The read model faithfully projects both. Case 016 has no READY BFO/BKI bundle. The UI explicitly exposes this disagreement; this task does not rewrite input integrity, contracts, methodology or lab expectations.

| Synthetic case | Index | Status | Banking completeness |
|---|---:|---|---:|
| 001 | 1000 | PARTIAL | 100% |
| 011 | unknown | INSUFFICIENT_DATA | 82% |
| 013 | 849 | PARTIAL | 100% |
| 016 | unknown | INSUFFICIENT_DATA | 100% |
| 017 | unknown | NOT_RATABLE_GLOBAL_STOP | 100% |
| 022 | unknown | INSUFFICIENT_DATA | 100% |

Reproduce with `node --experimental-strip-types scripts/qa/workspace-field-audit.mjs <output.json>`. Uses saved-analysis inputs, without lab-only credit scenarios.

## Verification boundaries

- Targeted tests exercise actual API handlers and isolated PostgreSQL-compatible storage, public rendering, all six source cases, unavailable calculation, owner/broker operations and unchanged canonical values.
- Browser workflow uses actual production components with isolated authorization and synthetic storage. Before screenshots compile the reviewed commit; after screenshots compile the exact candidate. Both use the same isolated API and data. No duplicate product frontend route is introduced.
- Full-unavailable fixture uses a mismatching source INN to exercise the existing canonical failure path while retaining known banking metrics. No entitlement policy changes.
- Browser output records action outcomes; first-viewport and full-page PNGs are separate. The print output is the existing PrintReport component. Native zoom is headed Chromium controlled via X11, with DPR and CSS zoom assertions.
- Live staging acceptance: NOT_RUN. Paid external providers: NOT_RUN. Human visual acceptance remains pending.
- Golden/DRAFT expectations, canonical formulas, ownership/entitlement policy, database schema and migrations are unchanged.
