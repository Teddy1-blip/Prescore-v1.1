# Workspace V3 — staging acceptance

## Route and component audit

| Existing route | Workspace V3 use | Retained behavior |
| --- | --- | --- |
| /dashboard | CLIENT shell, canonical home, primary Analysis, obligations, financing, documents, applications | Existing workspace handlers, versions, FREE/FULL, module controls |
| /dashboard/report-v2?analysisId=… | Same accepted Analysis V3 + Expertise inside shared shell | Ownership/assignment, FULL before calculation, diagnostic state, print route |
| /agent | BROKER work queues, clients, applications, documents/expectations, funnel, income, referrals | Actual AGENT role, own portfolio only, status handlers, forms, chat, reward calculations |
| /agent/prospects | Shared shell, existing prospect tool | Existing import/filter/match/CRM handlers |
| /dashboard/workspace-lab | Authenticated exact-staging-only source-computed synthetic review | No DB access or write actions; 24 original source bundles |
| /admin, auth, checkout, application chat | No routing or authorization changes | Existing protected implementations |

Shared primitives: sidebar/mobile disclosure, shell, company/version selector, semantic pills, canonical values, source cards, next action, responsive tables. Existing dashboard.css and agent.css intentionally retained pending human acceptance. Scoped workspace styles do not target ADMIN.

## Calculated limit audit

`agent_applications.calculated_limit` is returned as `calculatedLimit` by `/api/agent`. The existing agent form initializes this field from the entered requested amount. Workspace deal/application and matched guarantee draft creation also initialize it from the requested amount. It is used in `applicationForecast` with the existing average partner commission rate. It is not an authoritative canonical capacity result and does not prove a bank-approved limit. Existing stored values and forecast calculations are unchanged. The UI labels it **База прогноза вознаграждения · legacy**; the form labels its amount **Запрашиваемая сумма**. No annuity scenario principal is substituted.

## Analytical boundary

New home, portfolio, financing, broker summaries and queues consume `ClientReportModelV1`/AnalysisV3 presentation only. `/api/workspace-report` calls the existing `loadCanonicalReport`, ownership/assignment query and read-only entitlement resolver. FREE is checked before payload parsing, profile access or calculation. Missing and incompatible data remain unavailable; there is no fallback to legacy score/grade/estimated limit. Requests are private/no-store and broker loading is limited to three concurrent requests.

Raw exceptions, runtime secrets and saved financial inputs are not included in new diagnostics. No schema setup, migration, entitlement grant or analysis update is introduced by the new route. Existing operational APIs remain unchanged.

## Remaining legacy dependencies

- Statement upload, BKI detail/export, quarterly/profile tools, partner catalog, documents, CRM/chat and referral/prospect handlers are retained.
- The old partner catalog is explicitly identified as using previous selection parameters; it does not define the new canonical financing headline.
- Legacy credit analyst remains explicitly separate from Expertise; no Block 19 call is added.
- Old unused dashboard report/overview helpers and their CSS remain available in source during migration; the main analytical route uses Analysis V3.
- Company/profile drilldowns retain their existing external-provider behavior; no provider calls were made for real companies during acceptance.

## Future Block 19 boundary

The later Block 19 insertion point is a separate optional presentation section after Expertise in report-v2. It must consume the already computed, authorized public canonical model. Workspace does not implement this section, request AI generation, or let AI modify canonical calculations.

## Evidence distinctions

1. Unit/integration tests assert source-computed projections and unchanged canonical models for all 24 bundles; existing Golden31/DRAFT100, methodology, SQL authorization, entitlement, docs and chat tests remain required.
2. Browser CI exercises production renderers against isolated synthetic operational responses, all required widths, keyboard, reduced motion, browser-native 200%, print, and application handler payloads. This is not proof of authenticated live writes or real bank data.
3. Authenticated live staging review uses the separate source-computed synthetic workspace. Real dossiers and DB contents are not modified. Human acceptance remains open after rollout.
