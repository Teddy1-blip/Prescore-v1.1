# Workspace CLIENT/BROKER: SaaS density pass

Baseline: `debb9abe08414da29d3b9269c51931322d4c1337`, branch `workspace-client-broker-v1`.

Presentation only. The shared shell uses navy navigation, white work surfaces and a navy bank-data panel. Desktop spacing is tightened; body text and 44px controls remain. Mobile navigation is a compact, horizontally scrollable rail. ADMIN is unchanged; a future ADMIN design should reuse this Prescore SaaS system with greater information density.

## Data contract

- CLIENT and broker dossier continue to consume WorkspaceModelV1. No analytical legacy fallback.
- Turnover uses existing monthly external inflows/outflows. The chart shows at most the last 12 months; the existing disclosure retains all months and exact values. Solid and outline bars have a textual legend.
- Net flow is same-row inflows minus outflows, display only. A missing operand stays unknown. No storage, new canonical metric or credit conclusion.
- Payments display six existing classified categories, not all company expenses. Unknown and zero are separate text states; no fabricated slices.
- Concentration uses directCustomerTop1/Top3. RATIO is formatted as percent; PERCENT remains unchanged. Top1/Top3 overlap and must not be summed. No risk category.
- Broker portfolio divides leads into with/without analysis. Queue task count is separately labelled and is not a client share.
- Application distribution counts every actual status, including cancellations and unfamiliar statuses. The public list exposes current states, not transition history. No conversion/pipeline graph is inferred from that snapshot.

## QA

The feature-only workflow compares screenshots with the baseline above. Existing browser/access/operational checks remain. Additional checks cover tab keyboard navigation, ARIA, each chart at 1440/1024/768/390/360, unknown/zero/long values at 390/360, reduced motion and broker status counts.

Extreme chart states use synthetic, in-memory browser responses only; these overrides are removed before existing operational/canonical checks continue. No test override is persisted or shipped in product code. Production components render all screenshots. The workflow has no deploy job.
