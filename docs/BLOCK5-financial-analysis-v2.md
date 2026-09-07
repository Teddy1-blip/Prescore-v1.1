# Block 5 — Financial Statement Analysis Engine v2

Baseline: `85d33e987cba5acf388c380c8fe9b7e0d9211556` (Block 4).
Commit message: `Build Financial Statement Analysis Engine v2`.
Mode: SHADOW only. No authoritative scoring migration, branch update or deployment.

## A–B. Files and architecture

New contract: `lib/credit-engine/contracts/financial-statements.ts`.
New independent directory: `lib/credit-engine/financial-analysis/` containing
`normalizer.ts`, `periods.ts`, `checko-bfo-adapter.ts`, `quarterly-adapter.ts`,
`integrity.ts`, `metrics.ts`, `engine.ts`, `comparison.ts`, `integration.ts`.
Tests: `tests/financial-analysis-v2.test.mjs`.
Existing files receive only additive integration/metadata: `lib/quarterly-report.ts`,
`lib/company-profile.ts`, `lib/prescore.ts`, `app/api/checko/route.ts`,
`app/api/source-documents/route.ts`. This report is the final documentation file.

Flow: existing raw financial sources → adapters → canonical snapshots → integrity
→ metrics → period comparability/trends → confidence → legacy comparison.
No bank cash-flow/BFO or BKI/balance reconciliation (reserved for Block 6).

## C–F. Contract, adapters and known/unknown semantics

Versions: `PRESCORE-FINANCIAL-ANALYSIS-2.0.0-SHADOW` and
`PRESCORE-FS-NORMALIZER-2.0.0-SHADOW`.
Canonical values carry nullable RUB value, status, confidence, origin, raw code/value,
source ID/type and warnings. Snapshots retain the existing SourceEnvelope, including
status, fieldAvailability, rawReference and contentHash when present.
Balance and income fields map by RAS codes or confirmed quarterly labels with distinct provenance. Expense amounts are positive;
profits/losses keep their signs. Missing, blank, malformed and non-finite values are
not zeros. Known zero remains known. All required sum/ratio components must be present.

Checko reads raw `data[year][RAS code]`, retaining up to six latest available years
without filling gaps. The Checko /finances documented provider contract establishes
RUB, scale 1 for ordinary RAS amounts, without requiring unit fields in response meta
("Сумма, указанная в соответствующей строке отчетности, руб."). Explicit verified
metadata remains defensively validated; unsupported or invalid units produce UNKNOWN.
The generic normalizer still requires confirmed units. Supported scales: 1, 1000, 1000000 RUB.
Existing latestFinances, financial signals and FREE profile allowlists are unchanged.

Quarterly parsing adds optional metadata for raw coded lines, label-derived facts, explicit units, period
and reported net assets. Existing values, ratios, verdicts and factors remain unchanged.
The adapter ignores verdicts, factors, conclusion and advice. Old reports lacking
metadata load normally, but their v2 amounts remain unavailable where scale is unproven.
Reported net assets never inherit the legacy equity fallback; equity proxy is explicit.
Code extraction retains actual rawCode; label extraction uses rawLabel without rawCode.
Plain Cyrillic revenue labels are supported in v2 metadata without changing legacy regex behavior.
Checko line 3600 maps to REPORTED net assets with rawCode 3600; absent 3600 stays UNKNOWN.
Explicit 1–4 and I–IV quarter wording is standalone; three months remains cumulative YTD.
FREE upload responses omit the new parser metadata; FREE analysis omits v2 fields.

## G–H. Period methodology

Annual full years, cumulative YTD 3/6/9M and explicit standalone quarters are distinct.
12M becomes FULL_YEAR. Recognized January–March/June/September/December and half-year
labels are supported. A balance date alone does not prove a flow period.
Unknown boundaries remain unknown. Annual YoY requires adjacent years; interim YoY
requires equal duration/type and matching calendar span. Adjacent standalone quarters
are identified as sequential, not YoY. No automatic annualization.

## I–M. Metrics

Liquidity: current ratio; strict quick assets (receivables + short-term investments +
cash) / current liabilities; absolute liquidity; net working capital.
Capital: total liabilities and borrowings separately, equity/assets, liabilities/assets,
borrowings/assets, borrowings/equity, liabilities/equity, net debt and short-term debt share.
Non-positive equity denominators and zero denominators yield null with data warnings.
Profitability: gross, operating, pretax and net margins; ROA; ROE; operating profit /
reported interest expense. No EBITDA or net debt/EBITDA is invented.
Activity: asset, receivables and inventory turnover; DSO and DIO.
ROA/ROE and turnover ratios are full-year only. Interim DSO/DIO can use known actual
period days, with no annualization. Inventory turnover uses cost of sales, not revenue.
Asset and liability composition shares and period-specific payables/revenue are retained.

Opening/closing averages require an immediately preceding closing balance for the same
company/accounting standard. Missing or ambiguous opening data uses ending balance only
as an explicit PARTIAL fallback, capped at MEDIUM confidence. Interim YTD averages use
the start-of-year balance, not prior-year interim balances. Dependency values, IDs,
source IDs and fallback explanations are available in each period analysis.

## N–P. Trends, integrity and confidence

History preserves annual and interim snapshots separately. Eight trend families cover
revenue, net profit, assets, equity, borrowings, receivables, inventories and payables.
Absolute changes remain available for comparable periods; relative percentages require
a positive prior base and no sign crossing. Missing years are not treated as YoY.
Ambiguous prior periods suppress relative comparison instead of selecting silently.

Integrity checks asset components, equity/liability components, 1600/1700 and
revenue − positive cost of sales = gross profit. Tolerance is max(two source units,
0.1% of the largest equation component). Incomplete checks are explicitly flagged.
Mismatch lowers confidence, not financial strength. Core balance/income field coverage
is reported separately from equity/profit/working-capital signs. Derived confidence is
bounded by every required dependency, source/parser confidence and period quality.

## Q. Legacy comparison

Seven Checko mappings and five quarterly ratio mappings retain legacyValue, v2Value,
absoluteDiff, relativeDiff, definitionChanged and reason codes. Percentage conventions
are aligned for comparison (autonomy/return on sales), while v2 ratios remain ratios.
Changes in missing-data, denominator and period definitions are not called legacy errors.

## R–X. Verification

- Block 5 targeted tests: 140 passed, 0 failed.
- Full regression: 358 passed, 0 failed (218 existing tests retained).
- Approved parity: Index 872; grade A; readiness Высокая готовность;
  limits 1,283,000–2,636,000 RUB. Full authoritative output unchanged by shadow attachment.
- Quarterly candidate/corrected parser full-result comparison: five fixtures identical after
  excluding generated IDs/timestamps and the new optional metadata.
- Existing Checko latestFinances and profile/FREE-view integration verified offline.
- Build, lint, artifact validation and whitespace checks passed.
- Strict typecheck of the new financial integration module passed.
- Repository-wide typecheck retains 30 baseline diagnostics; no new diagnostics.
- Performance workload: 100 companies × 6 years = 600 analyses; about 186 ms in the
  full-suite run. Measurement only, no arbitrary time gate.

## Y. Known limitations

No live Checko calls or production upload tests were performed. Official-shaped Checko
responses without unit metadata are covered by offline regression fixtures. The established
legacy profile continues unchanged. Old cached profiles may lack v2 fields until refresh.
Quarterly coverage uses RAS codes and supported labels from existing readable-text
extraction, not OCR; uncertain periods/units are unavailable. Reported Checko net assets
require line 3600. No automatic equity substitution.
Annual BFO and quarterly results are wired into their existing separate source flows;
there is no new cross-source financial/bank reconciliation or data migration.
The local checkout was reconstructed from text sources; unchanged binary assets remain
in the base GitHub tree and are not replaced by this commit.

## Z. Git scope

The commit is built directly on the approved Block 4 GitHub tree, preserving all other
entries. Only the new financial modules/tests/report and five additive integration files
are included. Bank Statement Metrics v2 is byte-identical to the approved Block 4 blob.
Remote main must remain at the baseline SHA; no feature branch, force push, deployment,
Block 6 work or authoritative F-Score change is included.
