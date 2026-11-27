# Screen/state acceptance

Environment: isolated synthetic runtime using production components and actual route handlers. Final `Prescore product QA`, `Prescore Product Polish QA`, and `Prescore RC1` runs must all succeed for the same SHA. Six required sizes: 1440×900, 1280×800, 1024×768, 768×1024, 390×844, 360×800. Native Chromium 200% zoom is exercised through X11 keys, with DPR and layout-width assertions (not CSS zoom).

| Surface | Data/permission states | Loading/error/retry | Functional/reload proof | Evidence |
|---|---|---|---|---|
| CLIENT shell/overview | No analysis, bank-only, enriched, BASIC, FULL, unavailable, read-only | Initial failure, retained model during refresh, failed refresh | Selected analysis/URL, invalid ID, no implicit fallback | client-product-browser; workspace-model-v1; source browser |
| CLIENT analysis | Credit Lab 001/010/011/013/016/017/022, known/partial/unknown/conflict | Locked vs temporarily unavailable | Tabs, claims/evidence, source dates, canonical values | client-analysis-v3-browser; client-product-browser |
| Finances | Empty BFO, annual/interim, positive/negative/zero/unknown, partial ratios | Unsupported/invalid source cannot replace saved data | Financial period replacement/history, keyboard table alternative | financial-analysis-v2; polish-source-enrichment |
| Obligations | Absent KИ, known source amounts, missing fields, personal report, zero overdue | Missing current balance shown separately from dated reported balance | Corporate PDF → portfolio → reload; same broker model | credit-history; credit-portfolio-v1; source browser |
| Financing | No scenario, explicit requested terms, zero rate, unsupported capacity | Save failure/retry | Request persistence and canonical product context | client-product-browser; client-product |
| Source documents | Supported/duplicate/mismatched/empty/corrupt/oversized/unsupported | File retained after failed validation; saved-but-refresh-failed distinct | BFO/КИ/quarterly file controls, canonical refresh, double-save guard | source browser; client-source-workflow; source enrichment |
| Generic documents | No files, company/analysis filters, read-only | Upload/read failures | Actual storage, downloads, metadata; no automatic scoring | workspace-product-review; RC1 storage/E2E |
| Applications/chat | Empty/active/terminal/read-only | Pending/double-submit/error, retained list/search | Create/status/cancel, messages and attachments, reload | client-product-browser; broker-product-browser; RC1 E2E |
| AI | FULL/BASIC/unavailable, local/mocked provider | Provider timeout/error without fabricated answer | Current canonical context, persisted history, sanitized source details | ai-context; source enrichment; RC1 E2E |
| Billing | Synthetic Fake only, unavailable/live-unconfigured states | Existing guarded lifecycle | Orders/entitlements/commissions/refunds; reload | billing-browser; billing test suite; RC1 |
| BROKER dashboard/list | Assigned clients, no analysis, filters, queue | Fetch failure with retry | New lead and analysis ownership | broker-product-browser; broker-product |
| BROKER dossier | Same canonical data as owner; mutation controls absent | Explicit refresh and failure notice | URL section, source-rich finances/КИ/docs, reload | source browser; broker-product-browser |
| BROKER pipeline/partnership | Operational status columns, empty columns, separate commissions | Existing operational error handling | Status/chat/attachment persistence; no foreign-client access | broker-product-browser; billing-browser |
| Print/PDF | Canonical FULL; source appendix; partial/unknown dated values | Missing source stated without zero | Each incremental stage generates a new PDF from persisted model | source browser; client-analysis-v3-browser; RC1 |
| ADMIN | Existing permissions, observations and operations | Regression only | No new product behavior | admin-product-browser; admin-product |

Keyboard: named file inputs, consent, buttons, anchor source actions, native dialogs/Escape, visible focus, tab navigation and numeric table. No source form appears to assigned BROKER. Remaining format boundaries are in SOURCE-ACCEPTANCE-MATRIX.md. Final status is reported with exact-SHA CI evidence rather than a blanket per-cell claim.
