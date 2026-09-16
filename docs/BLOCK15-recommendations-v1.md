# Block 15 — Recommendation Engine v1

## Scope and delivery base

Approved parent: `f3818bf2891cf98309e15109d224de46a28ae4ea` (`Build Product Selection v1`). This implementation is an additive internal SHADOW consumer. It does not change Blocks 1–14, legacy recommendations, scoring, readiness, estimated limits, product fits, APIs, UI, PDF or production processing. The candidate message is `Build Recommendation Engine v1`; its single parent is the approved Block 14 commit. Main is not advanced by this delivery.

Recommendations convert a supported finding into an identifiable action, evidence to collect, and a check on a later canonical rerun. They are not a bank decision, an approval forecast, another score, or a numbered action plan. Commercial usefulness comes from concrete actions and preserved source lineage, not a large list of generic tips.

## Contracts and architecture

`RecommendationInputV1` contains RiskAssessment, ContextAssessment, PrescoreIndex, FinancingReadiness, CreditAssessment, DebtCapacity, ProductSelection and an explicit `asOfDate`; CreditPortfolio is optional. There is no dependency on AnalysisResult, legacy score, legacy advice, raw transactions or a provider API.

The pure path is:

1. Validate canonical versions, company, cutoff, upstream references, Product Selection content fingerprints and available evidence dates.
2. Match explicit registry triggers against supplied canonical objects.
3. Materialize authored Russian action copy, current state, lineage, confidence and verification criteria.
4. Resolve explicit dedupe groups, source/subject boundaries and suppression.
5. Resolve existing action prerequisites; reject dangling references and cycles.
6. Rank categorically, retain the full set, and select at most ten primary IDs.
7. Return versioned SHADOW output with fingerprints, counts, warnings and groups.

No approved engine is rerun inside this path. Validators are reused as read-only contract checks. No dates come from a clock; no random ID, HTTP, database, OCR or LLM is used. IDs use company, definition, subject and source identity. Canonical unordered input sets are normalized; the authored order of action steps remains meaningful and unchanged.

The optional `buildRecommendationShadow` seam returns `recommendationSetV1` and `recommendationWarnings`. Failure returns no set and `RECOMMENDATION_SHADOW_UNAVAILABLE`, without modifying input. It is not wired into production AnalysisResult. A FULL projection can carry the optional field; the existing FREE projection excludes it and remains byte-for-byte equivalent in the parity test.

## Versions and governance

- Engine: `PRESCORE-RECOMMENDATIONS-1.0.0-SHADOW`.
- Policy: `PRESCORE-RECOMMENDATION-POLICY-1.0.0-PRE-CALIBRATION`.
- Registry: `PRESCORE-RECOMMENDATION-REGISTRY-1.0.0-PRE-CALIBRATION`.
- Methodology: `PRESCORE_ACTIONABLE_CREDIT_RECOMMENDATIONS_V1`.

Policy and registry are frozen, versioned and fingerprinted. The registry has **128 independently authored atomic action/artifact pairs**, distributed across seven source files. None is counted as an alias. Validation rejects insufficient counts, duplicate codes, normalized duplicate title/steps, duplicate trigger/action/verification signatures, unsupported triggers, missing copy/artifacts/criteria and invalid dependency graphs. Changing copy or rules changes the fingerprint. The PRODUCT_SPECIFIC_LIMIT_NOT_MODELED code is a capability limitation, not a missing field: its canonical NOT_APPLICABLE state may support conditional preparation of evidence for a relevant candidate, but never a PRODUCT_REQUIREMENT_SATISFIED criterion. Source rows are editorial content, not generated from engine results.

The audit checks 40/40 approved Risk rules, including all DATA_REVIEW rules, all seven Product Selection data requirements, capacity ZERO/PARTIAL/INSUFFICIENT_DATA, and case-definition fields. Unknown source codes cannot silently become registered actions.

Supported trigger classes are Risk finding/reason, DATA_REVIEW, Context relation/fact condition, Assessment limitation, Capacity status/headroom state, Product fit/data requirement, missing financing-case field, and Portfolio state. Trigger codes are explicitly registered. No product or component is inferred from arbitrary natural-language fragments. The Assessment limitation seam preserves limitation IDs and supporting references; it does not reinterpret coverage as borrower weakness.

## Status, actionability and ranking

Set status is GENERATED, PARTIAL, INSUFFICIENT_DATA or NOT_RATABLE_GLOBAL_STOP. Product ASSESSED and sufficient upstream evidence can produce GENERATED. Partial or weak relevant evidence caps actionability; insufficient upstream evidence remains insufficient. Comparable requires GENERATED plus comparable Product Selection and Credit Assessment.

Actionability is separate from priority and credit quality:

- ACTIONABLE: supported next action.
- VERIFY_FIRST: relevant evidence is weak, missing, a client declaration, or unresolved.
- CONDITIONAL: an explicit preceding event or agreement is required.
- BLOCKED_BY_DATA: a conflicting source prevents safe operational execution.

Remediability is DIRECT, INDIRECT, VERIFICATION_ONLY or NOT_REMOVABLE. Effort is LOW/MEDIUM/HIGH, without duration. Professional review is NONE, ACCOUNTING, LEGAL, FINANCIAL, CREDIT_BUREAU or MULTIPLE. The engine does not perform the professional review.

Priority is P0_CRITICAL/P1_HIGH/P2_MEDIUM/P3_LOW. It is categorical, not another score. Ranking uses priority, actionability, source severity, remediability, category, registry order, then stable ID. At most ten primary actions are selected; all remaining actions are retained, including the count of high-priority overflow. INFORMATION findings do not acquire critical remediation priority. Groups are DATA_FIRST, STOP_AND_VERIFY, DEBT_AND_BKI, CASH_FLOW, FINANCIAL_STATEMENTS, LEGAL, FINANCING_CASE and PRODUCT_PREPARATION.

## Evidence, verification and expected effects

Each recommendation retains definition/version, subject, source IDs, Risk finding/fact IDs, Context relation/fact IDs, Assessment driver/limitation IDs, Capacity references, Product families/requirements and Portfolio obligation IDs where relevant. Current state is copied from the matched canonical object, not reconstructed from legacy data. Confidence cannot exceed materially used findings/evidence; contract-context confidence additionally caps a contract-based explanation. Client declarations remain declarations.

Every action includes a Russian title, summary, concrete steps, completion artifacts, an explicit explanation of what Prescore will recheck, structured verification criteria, and possible analytical effects. Each of the 40 Risk codes has its own recheck description. Verification has two separate meanings: independent human review of the requested artifact, and a later canonical analytical check where supported. File receipt alone never clears a finding.

Effects are possible, not guaranteed: a specific finding may clear, data review may clear, confidence/capacity may improve, a case field may become complete, or a product data requirement may be satisfied. Some actions are verification-only or have no direct analytical effect. There is no numerical forecast of score gains, financing probability, loan limit or savings. No source data is changed by this engine.

## Current and historical BKI

A verified, identified, HIGH-confidence reported current overdue amount can support settlement. Unidentified, conflicted or weak evidence requires verification first. The six registry actions are conditional atoms, not an unconditional bundle: balance verification, creditor/contract identity, settlement, conditional restructuring if settlement is impossible, creditor posting confirmation, and BKI refresh after posting. Posting and refresh depend on preceding actions. A ZERO headroom observation can justify conditional discussion of servicing changes; it does not itself prove legal inability to pay.

Historical delinquency is NOT_REMOVABLE. Accuracy may be checked and a documented error may be disputed; accurate history must not be erased. Later payment does not rewrite historical origin. The current-overdue action does not invent current delinquency age from a historical maximum. `REC-RU-DEFECT-001` permanently preserves current overdue > 0 plus KNOWN historical days = 0: current finding MEDIUM, no historical remediation and no invented DELINQUENCY_1_29/30_59/60_PLUS.

## Domain actions

Financial actions distinguish equity, reported net assets and proxy; reconcile working capital, receivable dates, inventory composition, short liabilities, annual losses, revenue changes and interest expenses. Annual and interim periods remain distinct. Reported revenue is not bank cash receipts. Accounting/corporate changes require appropriate professional review and actual documents, never fictional entries or expense shifting.

Cash-flow actions identify changes in actual operating receipts, document unknown inflow origins and cash/individual-payment traceability, verify bank balance anchors, and reconcile payment timing. Concentration without contract context leads to dependency quantification and a documented customer pipeline; contract-supported concentration leads to contract-duration/payment/backlog documentation and monitoring. Marketplace flows are not direct customers. No artificial turnover or renaming loans as sales is suggested.

Portfolio actions preserve the obligation subject, even with several loans at one creditor. Identity, unknown balances, conflicts, new obligations and unmatched payments are factual verification tasks. Unsplit payments do not prove principal reduction. Guarantees and guarantorship are contingent, leasing remains separate and factoring requires recourse evidence. Known near-term payment checks consume the existing Capacity schedule references; Block 15 does not invent its own payment window, infer overdue from absent statements, or assign action deadlines.

Legal actions verify official lifecycle state, address, enforcement, litigation, bankruptcy-message context and inspection evidence. Global stops allow only verification, legal and data actions. There is no instruction to evade creditor rights, hide assets, backdate documents, or dispute truthful BKI history. Litigation or inspection alone does not create a new stop.

Financing-case actions cover purpose, amount, term, product preference, urgency and relevant contract/collateral support. A requested amount is a need, not capacity; requested product is intent, not selection proof. Product preparation is limited to relevant canonical candidates and actual missing/partial requirements: underlying guarantee contract and beneficiary conditions, receivable invoices/acceptance/assignment for factoring, asset specification for leasing, explicit rate/term scenario for a term loan, and documented cash cycles for lines/overdraft. No bank policy, bank choice or product-specific limit is produced.

ZERO capacity yields servicing verification and conditional discussion of existing schedules, without an exact new loan amount. PARTIAL/INSUFFICIENT capacity yields collection of missing bases. Weak data is not a borrower defect.

## Dedupe, suppression and prerequisites

Dedupe uses an explicit group plus compatible subject/source set, merges provenance and retains a suppression record. Bank month completion variants materialize one complete-period upload action. Distinct obligations or unrelated sources remain distinct. The explicit COMPLETE_BANK_PERIOD group collects all bank-period requirements for this company/cutoff into one complete-period request, including compatible Capacity coverage limitations, with unioned provenance. Similar words alone never merge actions.

Current-overdue remediation suppresses redundant same-subject historical remediation; repeated annual loss suppresses generic current-loss duplication. Already-suppressed upstream rule evaluations are recorded without inventing a presented Risk finding. Global stops suppress unrelated actions. Source conflicts block dependent operational execution, retain the action visibly as BLOCKED_BY_DATA and record why execution is suppressed. Identity verification precedes dependent unresolved-balance work where both are needed. No nonexistent prerequisite is invented for an already-verified identity.

## Golden methodology and testing

The pack contains **80 original synthetic cases plus REC-RU-DEFECT-001**. Expectations are independently authored required/forbidden action codes, fields, provenance, criteria, dependencies and counts. They are not copied from engine output. Fixture fingerprints cover authored material and expectations, not current recommendation results. The runner reports assertion mismatches; run comparison is deterministic.

The dedicated suite has **626 tests**: five distinct contracts across 81 scenarios, a four-part matrix for all 40 Risk rules, plus registry, safety, pairwise, temporal, dependency, expectation, parity and integration checks. The LOW-finding unit boundary is explicitly labeled: approved Risk often excludes LOW input, while these tests exercise a downstream consumer's refusal to promote evidence. The canonical pipeline Golden scenarios continue to use approved Risk/Context/Index/Readiness/Assessment/Capacity/Product engines.

Pairwise tests cover Index 900/600, requested amount 1m/100m, product preference, verified/conflicted overdue, contract/no-contract concentration, historical zero, source separation and same-bank obligation identity. Every Golden case checks upstream immutability, reordered-input byte determinism, source lineage and graph/primary integrity. The full defect chain remains present in all previous packs.

Run locally:

```sh
node --experimental-strip-types --test --test-reporter=tap tests/recommendations-v1.test.mjs
node --experimental-strip-types scripts/recommendation-lab.mjs
node --experimental-strip-types tests/fixtures/recommendations/coverage.mjs
node --experimental-strip-types tests/fixtures/recommendations/benchmark.mjs
node --experimental-strip-types --test --test-concurrency=1 --test-reporter=tap tests/*.test.mjs
npm run build
npm run lint
npm run validate:artifact
node node_modules/typescript/bin/tsc --noEmit --strict --allowImportingTsExtensions --moduleResolution bundler --module esnext --target es2022 --skipLibCheck lib/credit-engine/recommendations/*.ts
```

## Limitations and Block 16 boundary

No automatic verification of newly uploaded arbitrary documents, OCR, LLM extraction, professional accounting/legal service, persistent completion workflow, bank API, bank eligibility model, guarantee/factoring/leasing limit, approval probability, UI, notification, deployment or action timeline is implemented. Evidence collection may require independent manual review before canonical upstream engines can consume new facts. Provided statements may omit accounts. Unknown remains unknown. Recommendations cannot guarantee a changed analytical result or lending decision.

Block 16 may later consume priority, effort, dependencies, actionability, remediability and criteria and assign implementation horizons. This block does not implement that sequencing.

## Final validation

| Gate | Final result |
|---|---|
| Dedicated Block 15 | 626 passed / 0 failed |
| Full repository regression | 4,027 passed / 0 failed (3,401 baseline + 626 new) |
| Block 15 Golden | 81 PASS / 0 REVIEW / 0 FAIL |
| REC-RU-DEFECT-001 | PASS; historical-zero reason-code chain preserved |
| Block 8 / 9 / 10 Golden | 31 / 31 / 41 PASS |
| Block 11 / 12 / 13 / 14 Golden | 41 / 46 / 55 / 61 PASS |
| Build | PASS |
| Lint | PASS; no ESLint errors or warnings |
| Artifact validation | PASS; ESM Worker and manifest |
| Strict new-module TypeScript | PASS; zero diagnostics |
| Repository TS baseline / current / new | 30 / 30 / 0 |
| git diff --check | PASS |
| Input immutability / reorder determinism | PASS across every Golden case |
| Legacy parity | 872 / A / Высокая готовность / 1,283,000–2,636,000 RUB |
| FREE/FULL | Legacy FREE unchanged; optional details available only in FULL projection |
| Prior-block defects | NONE |

The full regression took 219.54 seconds. All 344 materialized approved blobs matched the parent SHA; 13 unmaterialized binary blobs are retained from the original GitHub base tree. The change adds 29 files and modifies no approved source file. Temporary logs and environment/build artifacts are excluded.

Files are grouped into the canonical contract; policy and registry with seven domain content files; trigger/validation/assembly/resolution/engine modules; internal shadow and lab seams; synthetic fixtures, fingerprints, coverage and benchmark; dedicated tests; CLI; and this document. Git delivery creates one commit object directly on the approved parent. Its SHA is reported separately after creation; no branch ref or deployment is changed.

## Registry distribution and reviewed action inventory

Policy fingerprint: `recommendation-policy:adfc49d7a644f4783228ffb1cbf95026`.
Registry fingerprint: `recommendation-registry:c15cd385636f9d03c11b274582330f73`.

| Registry section | Unique definitions |
|---|---:|
| FINANCIAL_STRUCTURE | 20 |
| CASH_FLOW_AND_OPERATIONS | 20 |
| DEBT_CREDIT_AND_PORTFOLIO | 24 |
| LEGAL_CORPORATE | 12 |
| DATA_QUALITY | 24 |
| FINANCING_CASE | 10 |
| PRODUCT_PREPARATION | 18 |

| Output category | Definitions |
|---|---:|
| CASH_FLOW_AND_OPERATIONS | 10 |
| CREDIT_HISTORY | 8 |
| CREDIT_PORTFOLIO | 6 |
| CUSTOMER_STRUCTURE | 4 |
| DATA_QUALITY | 37 |
| DEBT_SERVICE | 4 |
| FINANCIAL_STRUCTURE | 19 |
| FINANCING_CASE | 10 |
| LEGAL_CORPORATE | 11 |
| PRODUCT_PREPARATION | 18 |
| VERIFICATION | 1 |

Unmapped required codes: **none**.

| Definition | Registered triggers | Action | Completion artifact |
|---|---|---|---|
| `RECONCILE_EQUITY_COMPONENTS` | RISK-FIN-EQUITY-NON-POSITIVE | Сверить состав собственного капитала | Сверка строки 1300 с регистрами капитала |
| `ASSESS_CAPITAL_SUPPORT` | RISK-FIN-EQUITY-NON-POSITIVE | Оценить документально оформляемую поддержку собственников | Заключение о форме поддержки и документы фактически принятого решения |
| `REVIEW_ACCUMULATED_LOSS` | RISK-FIN-EQUITY-NON-POSITIVE | Разложить накопленный убыток по периодам | Расшифровка непокрытого убытка по годам |
| `VERIFY_REPORTED_NET_ASSETS` | RISK-FIN-NET-ASSETS-NEGATIVE | Проверить расчет заявленных чистых активов | Подписанный расчет чистых активов на отчетную дату |
| `REVIEW_NET_ASSETS_LEGAL_DUTIES` | RISK-FIN-NET-ASSETS-NEGATIVE | Проверить корпоративные обязанности при отрицательных чистых активах | Юридическое заключение по обязанностям общества |
| `OBTAIN_REPORTED_NET_ASSETS` | RISK-FIN-NET-ASSETS-PROXY-NEGATIVE | Получить отдельный расчет чистых активов вместо прокси | Расчет чистых активов с датой и источником |
| `BUILD_RECEIVABLES_AGING` | RISK-FIN-CURRENT-LIQUIDITY | Разделить дебиторскую задолженность по срокам оплаты | Реестр дебиторской задолженности с датами и первичными документами |
| `VERIFY_INVENTORY_REALIZABILITY` | RISK-FIN-CURRENT-LIQUIDITY | Проверить ликвидность запасов в оборотных активах | Инвентаризационная ведомость с оценкой реализуемости |
| `MAP_SHORT_LIABILITY_DATES` | RISK-FIN-CURRENT-LIQUIDITY | Уточнить сроки краткосрочных обязательств | Реестр краткосрочных обязательств с датами платежей |
| `RECONCILE_WORKING_CAPITAL` | RISK-FIN-WORKING-CAPITAL | Сверить дефицит оборотного капитала | Сверка строк 1200 и 1500 на единую дату |
| `NEGOTIATE_PAYABLE_TERMS` | RISK-FIN-WORKING-CAPITAL | Согласовать изменение сроков конкретной кредиторской задолженности | Подписанные соглашения об изменении сроков оплаты |
| `COLLECT_MATURE_RECEIVABLES` | RISK-FIN-WORKING-CAPITAL | Организовать сбор подтвержденной дебиторской задолженности | Акты сверки и подтверждения фактических поступлений |
| `EXPLAIN_CURRENT_LOSS` | RISK-FIN-NET-LOSS-CURRENT | Разложить текущий годовой убыток по статьям | Мост от выручки к чистому результату за отчетный год |
| `REVIEW_LOSS_CONTRACT_MARGIN` | RISK-FIN-NET-LOSS-CURRENT | Проверить маржинальность убыточных договоров | Расчет маржи по убыточным договорам |
| `ANALYZE_REPEATED_LOSSES` | RISK-FIN-NET-LOSS-REPEATED | Разобрать причины повторяющихся годовых убытков | Сопоставимая годовая расшифровка повторяющихся убытков |
| `ASSESS_RECURRING_COSTS` | RISK-FIN-NET-LOSS-REPEATED | Проверить управляемые постоянные затраты | Перечень подтвержденных постоянных затрат и решений по ним |
| `BRIDGE_ANNUAL_REVENUE` | RISK-FIN-REVENUE-DECLINE | Объяснить изменение годовой выручки по договорам | Мост изменения выручки по сопоставимым годам |
| `CONFIRM_REVENUE_BACKLOG` | RISK-FIN-REVENUE-DECLINE | Подтвердить оставшийся объем действующих заказов | Реестр подписанных заказов и неисполненных этапов |
| `RECONCILE_INTEREST_EXPENSE` | RISK-FIN-INTEREST-COVERAGE | Сверить процентные расходы по договорам | Сверка процентных расходов с кредитными договорами |
| `REVIEW_INTEREST_TERMS` | RISK-FIN-INTEREST-COVERAGE | Оценить возможность согласования процентных условий | Полученные предложения кредиторов с полными условиями |
| `RECONCILE_DEBT_SERVICE_COMPONENTS` | RISK-CF-DEBT-SERVICE-BURDEN | Сверить состав фактического обслуживания долга | Сверка долговых платежей с назначениями и договорами |
| `ALIGN_DEBT_SERVICE_RECEIPTS` | RISK-CF-DEBT-SERVICE-BURDEN | Сопоставить долговые платежи с операционными поступлениями | Таблица дат долговых платежей и операционных поступлений |
| `EXPLAIN_OPERATING_RECEIPTS` | RISK-CF-OPERATING-RECEIPTS-DECLINE | Разложить снижение операционных поступлений | Мост изменения операционных поступлений по покупателям |
| `RECONCILE_RECEIPTS_WITH_REVENUE` | RISK-CF-OPERATING-RECEIPTS-DECLINE | Сверить поступления с начисленной выручкой | Сверка поступлений, реализации и дебиторской задолженности |
| `DOCUMENT_CUSTOMER_PAYMENT_DELAYS` | RISK-CF-OPERATING-RECEIPTS-DECLINE | Подтвердить причины переноса оплат покупателей | Переписка и соглашения об изменении дат оплаты |
| `QUANTIFY_CUSTOMER_DEPENDENCY` | RISK-CF-CUSTOMER-CONCENTRATION | Оценить зависимость от крупнейшего прямого покупателя | Расчет зависимости от идентифицированного прямого покупателя |
| `DEVELOP_CUSTOMER_PIPELINE` | RISK-CF-CUSTOMER-CONCENTRATION | Сформировать проверяемый перечень альтернативных заказчиков | Реестр переговоров и подтвержденных новых договоров |
| `DOCUMENT_CONCENTRATION_CONTRACT` | RISK-CF-CUSTOMER-CONCENTRATION | Подтвердить условия крупного действующего договора | Действующий договор и подтвержденный остаток обязательств покупателя |
| `MONITOR_CONTRACT_RECEIPTS` | RISK-CF-CUSTOMER-CONCENTRATION | Сверять оплаты по крупному договору с его условиями | Сверка договорных этапов и фактических поступлений |
| `EXPLAIN_UNKNOWN_INFLOWS` | RISK-DATA-UNKNOWN-INFLOW-SHARE | Подтвердить экономическое основание неясных поступлений | Первичные документы по нераспознанным поступлениям |
| `IDENTIFY_UNKNOWN_PAYERS` | RISK-DATA-UNKNOWN-INFLOW-SHARE | Установить отправителей неидентифицированных поступлений | Подтвержденные реквизиты отправителей поступлений |
| `DOCUMENT_CASH_ORIGIN` | RISK-DATA-CASH-INDIVIDUAL-TRACEABILITY | Подтвердить происхождение внесенных наличных | Кассовые документы и основания внесения наличных |
| `DOCUMENT_INDIVIDUAL_TRANSFERS` | RISK-DATA-CASH-INDIVIDUAL-TRACEABILITY | Раскрыть основание переводов физических лиц | Реестр переводов физических лиц с подтвержденным основанием |
| `RECONCILE_BANK_ANCHORS` | RISK-DATA-BALANCE-RECONSTRUCTION | Сверить начальный и конечный банковские остатки | Банковские подтверждения остатков на границах периода |
| `CHECK_INTERNAL_TRANSFER_PAIRS` | RISK-DATA-BALANCE-RECONSTRUCTION | Проверить парность переводов между своими счетами | Сверка встречных внутренних переводов по счетам |
| `MAP_CONFIRMED_LIQUIDITY_GAPS` | RISK-CF-LIQUIDITY-STRESS | Уточнить причины дней с низкой ликвидностью | Расшифровка подтвержденных разрывов остатков и платежей |
| `AGREE_CUSTOMER_PAYMENT_STAGES` | RISK-CF-LIQUIDITY-STRESS | Обсудить документированные этапы оплаты с покупателями | Подписанные изменения этапов оплаты покупателей |
| `REVIEW_NONESSENTIAL_OUTFLOWS` | RISK-CF-LIQUIDITY-STRESS | Проверить переносимость необязательных выплат | Перечень допускающих перенос выплат с основаниями |
| `VERIFY_RECEIPTS_PERIOD_COVERAGE` | RISK-CF-OPERATING-RECEIPTS-DECLINE | Проверить сопоставимость периодов поступлений | Сверка полноты сопоставляемых периодов выписок |
| `DOCUMENT_PAYMENT_RESERVES` | RISK-CF-LIQUIDITY-STRESS | Подтвердить назначение денежных резервов | Расшифровка ограниченных и свободных денежных остатков |
| `VERIFY_CURRENT_OVERDUE_BALANCE` | RISK-BKI-CURRENT-OVERDUE | Сверить текущую просроченную сумму с кредитором | Расчет кредитора с датой и номером обязательства |
| `RECONCILE_CREDITOR_CONTRACT` | RISK-BKI-CURRENT-OVERDUE | Подтвердить кредитора и договор просроченного обязательства | Подтвержденное соответствие записи БКИ договору |
| `SETTLE_VALID_CURRENT_OVERDUE` | RISK-BKI-CURRENT-OVERDUE | Урегулировать подтвержденную текущую просрочку | Платежный документ и согласованное основание погашения |
| `FORMALIZE_RESTRUCTURING_IF_SETTLEMENT_NOT_POSSIBLE` | RISK-BKI-CURRENT-OVERDUE | Обсудить реструктуризацию при невозможности погашения | Соглашение кредитора об изменении обязательства при его заключении |
| `OBTAIN_CREDITOR_POSTING_CONFIRMATION` | RISK-BKI-CURRENT-OVERDUE | Получить подтверждение учета погашения кредитором | Подтверждение кредитора об учете исполнения |
| `REFRESH_COMPANY_BKI_AFTER_POSTING` | RISK-BKI-CURRENT-OVERDUE | Обновить БКИ компании после отражения исполнения | Новый отчет БКИ компании после учета исполнения |
| `VERIFY_HISTORICAL_DELINQUENCY` | RISK-BKI-HISTORICAL-DELINQUENCY | Проверить точность исторической просрочки | Документы проверки дат исторической просрочки |
| `MONITOR_SERVICING_AFTER_DELINQUENCY` | RISK-BKI-HISTORICAL-DELINQUENCY | Подтверждать обслуживание после исторической просрочки | Последующие платежные документы и отчеты кредитора |
| `IDENTIFY_PORTFOLIO_OBLIGATION` | RISK-DATA-PORTFOLIO-OBLIGATION-UNRESOLVED | Идентифицировать неразрешенное обязательство портфеля | Договор и идентификаторы конкретного обязательства |
| `CONFIRM_PORTFOLIO_OUTSTANDING` | RISK-DATA-PORTFOLIO-OUTSTANDING-UNKNOWN | Получить подтвержденный остаток по обязательству | Подтверждение кредитора об остатках долга |
| `RECONCILE_PORTFOLIO_CONFLICT` | RISK-DATA-PORTFOLIO-CONFLICT | Разрешить противоречие источников по обязательству | Акт сверки конфликтующих значений по обязательству |
| `CONFIRM_NEW_OBLIGATION_TERMS` | RISK-DATA-NEW-OBLIGATION-DETECTED | Подтвердить условия нового обязательства | Подписанный договор нового обязательства |
| `LINK_UNMATCHED_DEBT_PAYMENT` | RISK-DATA-DEBT-PAYMENT-UNMATCHED | Уточнить принадлежность долгового платежа | Подтверждение принадлежности платежа договору |
| `SPLIT_REPORTED_DEBT_SERVICE` | RISK-DATA-UNSPLIT-DEBT-SERVICE | Получить подтвержденный состав долгового платежа | Разбивка кредитора по компонентам платежа |
| `VERIFY_NEAR_PAYMENT_SCHEDULE` | NEAR_PAYMENT | Подтвердить ближайший договорный платеж | Актуальный график конкретного обязательства |
| `CONFIRM_GUARANTEE_EXPIRY` | BANK_GUARANTEE | Подтвердить срок и условия действующей гарантии | Текст гарантии и подтвержденные изменения |
| `CONFIRM_GUARANTORSHIP_SCOPE` | GUARANTORSHIP | Подтвердить объем поручительства компании | Договор поручительства и пределы ответственности |
| `RECONCILE_LEASE_SCHEDULE` | LEASING | Сверить оставшиеся лизинговые платежи | Подтвержденный график лизинговых платежей |
| `VERIFY_FACTORING_RECOURSE` | FACTORING | Уточнить регресс и комиссии по факторингу | Договор факторинга с условиями регресса |
| `CONFIRM_LINE_UTILIZATION` | LIMIT_UNKNOWN | Сверить лимит и использование кредитной линии | Подтвержденные лимит и использование линии |
| `VERIFY_ZERO_HEADROOM_SERVICE` | ZERO | Проверить нагрузку при нулевом расчетном запасе обслуживания | Подтвержденные графики и сверка учтенной нагрузки |
| `ASSESS_SERVICE_RESTRUCTURING` | ZERO, RISK-CF-DEBT-SERVICE-BURDEN | Оценить изменение графиков при нулевом запасе обслуживания | Документированные варианты изменения графиков |
| `COMPLETE_CAPACITY_EVIDENCE` | PARTIAL | Дополнить основания частичного расчета обслуживания | Подтверждения по ограничениям частичного расчета |
| `RESTORE_CAPACITY_INPUTS` | INSUFFICIENT_DATA | Собрать недостающие данные для расчета обслуживания | Подтвержденные графики и перечень учтенных обязательств |
| `VERIFY_ENTITY_TERMINATION` | RISK-LEGAL-ENTITY-TERMINATED | Проверить запись о прекращении юридического лица | Актуальная выписка с записью о прекращении |
| `REVIEW_TERMINATION_REMEDY` | RISK-LEGAL-ENTITY-TERMINATED | Получить правовую оценку записи о прекращении | Юридическое заключение о достоверности записи и допустимых действиях |
| `VERIFY_LIQUIDATION_STAGE` | RISK-LEGAL-LIQUIDATION-ACTIVE | Подтвердить актуальную стадию ликвидации | Реестровая выписка и решение о ликвидации |
| `REVIEW_LIQUIDATOR_AUTHORITY` | RISK-LEGAL-LIQUIDATION-ACTIVE | Проверить полномочия представителя при ликвидации | Подтверждение полномочий ликвидатора |
| `VERIFY_BANKRUPTCY_PROCEDURE` | RISK-LEGAL-BANKRUPTCY-ACTIVE | Подтвердить действующую процедуру банкротства | Судебный акт и актуальные сведения о процедуре |
| `REVIEW_BANKRUPTCY_AUTHORITY` | RISK-LEGAL-BANKRUPTCY-ACTIVE | Согласовать правовые действия с уполномоченным специалистом | Заключение о полномочиях и действующих ограничениях |
| `VERIFY_REGISTERED_ADDRESS` | RISK-LEGAL-ADDRESS-UNRELIABLE | Подтвердить достоверность адреса компании | Документы адреса и подтверждение обращения при выявленной ошибке |
| `RECONCILE_ENFORCEMENT_BALANCE` | RISK-LEGAL-ACTIVE-ENFORCEMENT | Сверить действующие исполнительные производства | Актуальные постановления и сверка сумм производства |
| `DOCUMENT_ENFORCEMENT_RESOLUTION` | RISK-LEGAL-ACTIVE-ENFORCEMENT | Подтвердить результат исполнения требований | Официальное подтверждение изменения статуса производства |
| `DOCUMENT_LITIGATION_STAGE` | RISK-LEGAL-LITIGATION | Уточнить стадию и предмет судебного спора | Карточка дела, судебные акты и правовое пояснение |
| `VERIFY_BANKRUPTCY_MESSAGE_CONTEXT` | RISK-DATA-BANKRUPTCY-MESSAGES | Проверить принадлежность и содержание сообщения о банкротстве | Исходное сообщение и подтверждение его правового контекста |
| `DOCUMENT_INSPECTION_OUTCOME` | RISK-LEGAL-INSPECTION-OBSERVATION | Подтвердить итог проверки и исполнение предписаний | Акт проверки и документы исполнения предписаний |
| `RECONCILE_COMPANY_IDENTITY` | RISK-DATA-COMPANY-IDENTITY-CONFLICT | Разрешить расхождение идентификаторов компании | Подтвержденное соответствие источников компании |
| `VERIFY_SOURCE_SUBJECT_ROLE` | RISK-DATA-COMPANY-IDENTITY-CONFLICT | Уточнить роль субъекта спорного источника | Документированная роль субъекта каждого спорного источника |
| `RECONCILE_SAME_FINANCIAL_FACT` | RISK-DATA-FINANCIAL-SAME-FACT-CONFLICT | Сверить противоречащие значения одного финансового факта | Сверка конфликтующих значений одного факта |
| `CONFIRM_REPORT_REVISION` | RISK-DATA-FINANCIAL-SAME-FACT-CONFLICT | Подтвердить действующую редакцию отчетности | Подтвержденная редакция финансовой отчетности |
| `EXPLAIN_CROSS_SOURCE_DIFFERENCE` | RISK-DATA-RECONCILIATION-REVIEW | Объяснить межисточниковое расхождение | Документированная сверка межисточникового расхождения |
| `VERIFY_RECONCILIATION_SCOPE` | RISK-DATA-RECONCILIATION-REVIEW | Проверить охват источников при сверке | Подтвержденные границы охвата сверяемых источников |
| `OBTAIN_MISSING_SOURCE` | RISK-DATA-SOURCE-MISSING | Получить отсутствующий источник анализа | Недостающий источник с идентификатором компании и периодом |
| `UPLOAD_COMPLETE_BANK_STATEMENT_PERIOD` | RISK-DATA-SOURCE-MISSING, PARTIAL, INSUFFICIENT_DATA | Предоставить полный период банковских выписок | Полный комплект выписок с границами периода и счетами |
| `REFRESH_STALE_SOURCE` | RISK-DATA-SOURCE-STALE | Обновить устаревший источник | Обновленный источник с датой наблюдения |
| `CONFIRM_SOURCE_OBSERVATION_DATE` | RISK-DATA-SOURCE-STALE | Подтвердить дату наблюдения устаревших данных | Подтверждение дат отчета и его получения |
| `REPLACE_UNREADABLE_SOURCE` | RISK-DATA-SOURCE-FAILED | Повторно предоставить читаемый исходный документ | Читаемый оригинал ранее не обработанного источника |
| `CHECK_DOCUMENT_COMPLETENESS` | RISK-DATA-SOURCE-FAILED | Проверить комплектность неуспешно обработанного файла | Полный документ с сохраненными листами и страницами |
| `RESTORE_MISSING_BANK_MONTHS` | RISK-DATA-BANK-COVERAGE | Дополнить отсутствующие месяцы выписок | Выписки за выявленные отсутствующие месяцы |
| `COMPLETE_PARTIAL_BANK_MONTH` | RISK-DATA-BANK-COVERAGE | Дополнить неполный месяц банковских данных | Полная выписка за частично представленный месяц |
| `RECONCILE_OVERLAPPING_STATEMENTS` | RISK-DATA-BANK-COVERAGE | Устранить неоднозначность перекрывающихся выписок | Сверка перекрытий и подтвержденный комплект выписок |
| `VERIFY_LOW_INTEGRITY_SOURCE` | RISK-DATA-SOURCE-INTEGRITY | Подтвердить достоверность проблемного источника | Оригинал и сверка отмеченных ошибок целостности |
| `CONFIRM_SOURCE_UNITS` | RISK-DATA-SOURCE-INTEGRITY | Подтвердить единицы финансовых данных | Фрагмент оригинала с подтвержденной единицей измерения |
| `CONFIRM_PORTFOLIO_VALUE_DATE` | RISK-DATA-PORTFOLIO-CONFLICT | Подтвердить даты конфликтующих долговых значений | Подтвержденные даты и понятия долговых значений |
| `OBTAIN_STABLE_AGREEMENT_REFERENCE` | RISK-DATA-PORTFOLIO-OBLIGATION-UNRESOLVED | Получить устойчивый идентификатор обязательства | Устойчивый идентификатор договора или счета |
| `VERIFY_ZERO_DEBT_SUPPORT` | RISK-DATA-PORTFOLIO-OUTSTANDING-UNKNOWN | Проверить основание нулевого остатка долга | Подтверждение явно заявленного остатка кредитором |
| `OBTAIN_PAYMENT_REFERENCE` | RISK-DATA-DEBT-PAYMENT-UNMATCHED | Получить полное назначение долгового платежа | Полный платежный документ с договорной ссылкой |
| `VERIFY_CREDITOR_POSTING_DATE` | RISK-DATA-UNSPLIT-DEBT-SERVICE | Подтвердить дату учета долгового платежа | Подтверждение даты учета платежа кредитором |
| `VERIFY_INFLOW_SOURCE_LINEAGE` | RISK-DATA-UNKNOWN-INFLOW-SHARE | Восстановить происхождение неясной записи поступления | Ссылка на исходную банковскую запись и ее реквизиты |
| `RECONCILE_CASH_CUSTODY` | RISK-DATA-CASH-INDIVIDUAL-TRACEABILITY | Сверить движение наличных с ответственными документами | Сверка кассовой цепочки и подтверждающих документов |
| `DEFINE_FINANCING_PURPOSE` | financingPurpose | Указать экономическую цель финансирования | Заполненная цель с описанием финансируемой потребности |
| `DEFINE_REQUESTED_AMOUNT` | requestedAmount | Указать запрашиваемую сумму и ее расчет | Расчет заявленной потребности в финансировании |
| `DEFINE_REQUESTED_TERM` | requestedTermMonths | Указать срок потребности в финансировании | Заявленный срок и его экономическое основание |
| `DEFINE_REQUESTED_PRODUCT` | requestedProduct | Уточнить предпочтительный продукт как пожелание | Зафиксированное предпочтение клиента по продукту |
| `DEFINE_CASE_URGENCY` | urgency | Указать срочность финансовой потребности | Заполненная срочность потребности клиента |
| `LINK_CASE_CONTRACT` | contractReference | Связать контрактную потребность с договором | Ссылка на договор и подтверждение его действительности |
| `DESCRIBE_DECLARED_COLLATERAL` | collateralInformation | Уточнить заявленное обеспечение, если оно относится к запросу | Сведения об обеспечении и правоустанавливающие документы |
| `CLARIFY_PRODUCT_PURPOSE_MISMATCH` | NOT_ALIGNED_WITH_MODELED_PURPOSE | Уточнить расхождение цели и запрошенного продукта | Уточненный запрос с объяснением цели и продукта |
| `SUPPORT_CLIENT_DECLARATION` | CLIENT_DECLARED | Подтвердить существенные заявления клиента источниками | Документы, подтверждающие существенные заявления клиента |
| `SEPARATE_REQUEST_FROM_CAPACITY` | INSUFFICIENT_DATA | Отделить запрошенную сумму от доказанного обслуживания | Запрос с явным разделением потребности и расчетных ограничений |
| `SPECIFY_PRODUCT_PURPOSE` | FINANCING_PURPOSE_REQUIRED | Подтвердить цель для оценки механики продукта | Описание подтвержденной цели продуктового запроса |
| `PREPARE_GUARANTEE_CONTRACT` | CONTRACT_EVIDENCE_REQUIRED | Подготовить основной контракт для гарантии | Основной контракт с реквизитами бенефициара |
| `CONFIRM_GUARANTEE_WORDING` | CONTRACT_EVIDENCE_REQUIRED | Уточнить требуемые условия гарантии | Требования бенефициара к тексту гарантии |
| `PREPARE_FACTORING_RECEIVABLES` | RECEIVABLES_OR_INVOICE_EVIDENCE_REQUIRED | Подготовить подтвержденный реестр уступаемых требований | Реестр дебиторских требований с первичными документами |
| `VERIFY_RECEIVABLE_ACCEPTANCE` | RECEIVABLES_OR_INVOICE_EVIDENCE_REQUIRED | Подтвердить принятие поставки дебитором | Подтверждения принятия поставок дебиторами |
| `CHECK_ASSIGNMENT_RESTRICTIONS` | RECEIVABLES_OR_INVOICE_EVIDENCE_REQUIRED | Проверить договорные ограничения уступки | Правовая проверка условий уступки требований |
| `PREPARE_LEASE_ASSET_SPEC` | ASSET_SPECIFICATION_REQUIRED | Подготовить спецификацию предмета лизинга | Спецификация предмета лизинга и предложение поставщика |
| `DOCUMENT_LEASE_ASSET_USE` | ASSET_SPECIFICATION_REQUIRED | Обосновать использование предмета лизинга | Описание использования объекта с техническими требованиями |
| `COMPLETE_FUNDED_SERVICE_EVIDENCE` | DEBT_CAPACITY_REQUIRED_FOR_FUNDED_PRODUCT | Подтвердить обслуживание для денежного продукта | Подтвержденные входные данные обслуживания для денежного продукта |
| `DEFINE_RATE_TERM_SCENARIO` | EXPLICIT_RATE_TERM_SCENARIO_REQUIRED_FOR_PRINCIPAL_REFERENCE | Задать явные ставку и срок расчетного сценария | Явные параметры расчетного сценария с источником предположений |
| `VERIFY_SCENARIO_TERM_ALIGNMENT` | EXPLICIT_RATE_TERM_SCENARIO_REQUIRED_FOR_PRINCIPAL_REFERENCE | Согласовать срок сценария со сроком запроса | Сверка сроков запроса и расчетного сценария |
| `DOCUMENT_LINE_DRAW_REPAY_CYCLE` | PRODUCT_SPECIFIC_LIMIT_NOT_MODELED | Описать цикл выборки и погашения линии | Описание цикла выборки и погашения кредитной линии |
| `DOCUMENT_REVOLVING_CYCLES` | PRODUCT_SPECIFIC_LIMIT_NOT_MODELED | Подтвердить повторяемость оборотного цикла | Подтвержденные повторяющиеся оборотные циклы |
| `DOCUMENT_OVERDRAFT_GAP` | PRODUCT_SPECIFIC_LIMIT_NOT_MODELED | Подтвердить краткий разрыв поступлений и оплат | Подтвержденный кассовый цикл по расчетному счету |
| `DOCUMENT_GUARANTEE_COMMISSION` | PRODUCT_SPECIFIC_LIMIT_NOT_MODELED | Уточнить комиссии и обеспечение гарантии | Документированные комиссии и условия обеспечения гарантии |
| `DOCUMENT_FACTORING_FEES_RECOURSE` | PRODUCT_SPECIFIC_LIMIT_NOT_MODELED | Уточнить факторинговые комиссии и регресс | Документированные условия факторинга по требованиям |
| `DOCUMENT_LEASE_ADVANCE_SCHEDULE` | PRODUCT_SPECIFIC_LIMIT_NOT_MODELED | Уточнить аванс и полный график лизинга | Предложение с авансом и полным графиком лизинга |
| `PREPARE_TERM_LOAN_USE_OF_FUNDS` | CONDITIONAL_MATCH | Подтвердить целевое использование срочного кредита | Расшифровка целевых расходов и подтверждающие основания |

## Golden case inventory

| Case | Independent scenario |
|---|---|
| REC-RU-001 | Отрицательный капитал: сверка и документированная поддержка |
| REC-RU-002 | Известный нулевой капитал |
| REC-RU-003 | Reported отрицательные чистые активы |
| REC-RU-004 | Прокси не становится reported net assets |
| REC-RU-005 | Низкая текущая ликвидность |
| REC-RU-006 | Отрицательный оборотный капитал |
| REC-RU-007 | Материальный дефицит оборотного капитала |
| REC-RU-008 | Годовой убыток: расшифровка результата |
| REC-RU-009 | Повторяющиеся убытки подавляют повтор общей расшифровки |
| REC-RU-010 | Среднее снижение годовой выручки |
| REC-RU-011 | Высокое снижение выручки |
| REC-RU-012 | Недостаточное покрытие процентов |
| REC-RU-013 | Средняя нагрузка обслуживания |
| REC-RU-014 | Высокая нагрузка обслуживания |
| REC-RU-015 | Снижение операционных поступлений |
| REC-RU-016 | Прямая концентрация без договорного контекста |
| REC-RU-017 | Концентрация с действующим договором |
| REC-RU-018 | Площадка не становится прямым клиентом |
| REC-RU-019 | Неясные поступления: первичное основание |
| REC-RU-020 | Наличные и физические лица: прослеживаемость |
| REC-RU-021 | Ошибка реконструкции остатков |
| REC-RU-022 | Низкие остатки: документированный разрыв |
| REC-RU-023 | Выручка и поступления остаются разными понятиями |
| REC-RU-024 | LOW evidence не становится операционным предписанием |
| REC-RU-025 | Подтвержденная текущая просрочка: урегулирование |
| REC-RU-026 | Неидентифицированная просрочка: сначала проверка |
| REC-RU-027 | Достоверная историческая просрочка 10 дней неизменяема |
| REC-RU-028 | Достоверная историческая просрочка 40 дней неизменяема |
| REC-RU-029 | Достоверная историческая просрочка 60 дней неизменяема |
| REC-RU-030 | Текущая просрочка при историческом максимуме ноль |
| REC-RU-031 | Та же просрочка не создает дублирующую историческую ремедиацию |
| REC-RU-032 | Нулевой запас обслуживания |
| REC-RU-033 | Частичная capacity требует подтверждений |
| REC-RU-034 | Недостаточная история capacity |
| REC-RU-035 | Неразрешенная идентичность |
| REC-RU-036 | Неизвестный остаток |
| REC-RU-037 | Конфликт остатка |
| REC-RU-038 | Новое обязательство |
| REC-RU-039 | Несопоставленный платеж |
| REC-RU-040 | Неразделенный платеж |
| REC-RU-041 | Ближайший известный платеж |
| REC-RU-042 | Гарантия остается условной |
| REC-RU-043 | Поручительство отдельно от собственного кредита |
| REC-RU-044 | Закрытое обязательство не требует текущего платежа |
| REC-RU-045 | Прекращение компании |
| REC-RU-046 | Ликвидация |
| REC-RU-047 | Банкротство |
| REC-RU-048 | Недостоверный адрес |
| REC-RU-049 | Существенное исполнительное производство |
| REC-RU-050 | Информационный уровень исполнения |
| REC-RU-051 | Судебный спор не равен доказанному долгу |
| REC-RU-052 | Сообщение о банкротстве требует проверки контекста |
| REC-RU-053 | Проверка и исполнение предписаний |
| REC-RU-054 | Конфликт компании P0 |
| REC-RU-055 | Конфликт одного финансового факта |
| REC-RU-056 | Межисточниковая проверка |
| REC-RU-057 | Отсутствующий источник |
| REC-RU-058 | Устаревший источник |
| REC-RU-059 | Неуспешный источник |
| REC-RU-060 | Отсутствующий месяц |
| REC-RU-061 | Неполный месяц |
| REC-RU-062 | Перекрытие выписок |
| REC-RU-063 | Низкая целостность источника |
| REC-RU-064 | Несколько оснований одного комплекта выписок |
| REC-RU-065 | Не определена цель |
| REC-RU-066 | Не определена сумма |
| REC-RU-067 | Не определен срок |
| REC-RU-068 | Не определено предпочтение продукта |
| REC-RU-069 | Контрактная цель без договора |
| REC-RU-070 | Факторинг без реестра требований |
| REC-RU-071 | Лизинг без спецификации |
| REC-RU-072 | Денежный продукт при неизвестной capacity |
| REC-RU-073 | Срочный кредит без явного сценария |
| REC-RU-074 | Запрошенный продукт расходится с целью |
| REC-RU-075 | Низкий Index сам не создает действия |
| REC-RU-076 | Высокий Index не означает подать заявку |
| REC-RU-077 | Заявление клиента не становится доказательством |
| REC-RU-078 | Перестановка входных наборов |
| REC-RU-079 | Реалистичный набор нескольких рисков |
| REC-RU-080 | Полный набор сохранен при десяти первичных |
| REC-RU-DEFECT-001 | Постоянная цепочка regression: overdue >0, historical max =0 KNOWN, без выдуманных диапазонов дней |

## Performance

Benchmark counts: 1,000 engine runs, 200 complete canonical pipeline runs, 1,000 registry matches, 1,000 dedupe/suppression passes and 1,000 expectation evaluations, with separate validation, assembly, copy, dependency, ranking and finalization measurements. Timings are observations from this environment, not a hard acceptance threshold.

| Phase | Iterations | Total ms | Mean ms |
|---|---:|---:|---:|
| inputValidation | 1000 | 39313.14 | 39.3131 |
| registryMatching | 1000 | 898.91 | 0.8989 |
| actionAssembly | 1000 | 120.15 | 0.1202 |
| copyMaterialization | 1000 | 348.25 | 0.3483 |
| dedupeAndSuppression | 1000 | 275.53 | 0.2755 |
| dependencyValidation | 1000 | 3.25 | 0.0032 |
| ranking | 1000 | 8.63 | 0.0086 |
| finalizationFingerprints | 1000 | 31488.36 | 31.4884 |
| recommendationEngine | 1000 | 83182.91 | 83.1829 |
| canonicalRiskToRecommendationsPipeline | 200 | 26942.32 | 134.7116 |
| expectationEvaluation | 1000 | 3.33 | 0.0033 |

Measured with Node 24.19.0, with no concurrent repository test run. Validation and content fingerprints dominate elapsed time. No hard timing gate is imposed. These measurements describe the synthetic workload, not a production latency guarantee.
