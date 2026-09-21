/** Additional DRAFT cases for the EXISTING Block 8 Credit Lab.
 * Expectations are authored explicitly below, never copied from engine output.
 * This module has no network/database access and never rewrites Golden cases.
 */
import {readFileSync} from 'node:fs';
import {CREDIT_LAB_CASE_VERSION} from '../../../../lib/credit-engine/contracts/credit-lab.ts';
import {INVARIANTS} from '../../../../lib/credit-engine/credit-lab/validator.ts';
import {fact} from '../../../../lib/credit-engine/risk/common.ts';
import {directFacts, sourceMaterial, finances, snapshot, bki, row, portfolio,
  reconciliationFinding, date} from '../builders.mjs';
export const PACK_VERSION = 'PRESCORE-CREDIT-LAB-RU-DEVELOPMENT-1.0.0';
export const REFERENCE_SHA = '69ccc712ddd7adac00b25531083191267043fdb0';
const STOPS=['RISK-LEGAL-ENTITY-TERMINATED','RISK-LEGAL-LIQUIDATION-ACTIVE','RISK-LEGAL-BANKRUPTCY-ACTIVE'];
const required=(code,severity,scope='CREDIT_RISK',extra={})=>({code,level:'HARD',scope,severity,decisionImpact:scope==='GLOBAL_STOP'?'BLOCKING':scope==='INFORMATION'?'NON_BLOCKING':'REVIEW',...extra});
const status=(ruleCode,expected,subjectKey)=>({ruleCode,expected,level:'HARD',...(subjectKey?{subjectKey}:{})});
const expectedFact=(semanticCode,exactValue,extra={})=>({semanticCode,exactValue,level:'HARD',status:exactValue===null?'UNKNOWN':'KNOWN',...extra});
const direct=(values={},extras={})=>({kind:'RISK_FACTS',facts:directFacts(values).map(f=>extras[f.semanticCode] ? fact(f.companyInn,f.semanticCode,f.domain,f.value,{...f,...extras[f.semanticCode],factId:undefined,evidence:[]}) : f)});
const src=mutate=>{const m=sourceMaterial();mutate?.(m);return m;};
function definition(group,n,title,material,expectation={}) {
 const caseId=`CL-RU-DEV-${group}-${String(n).padStart(3,'0')}`;
 return {caseDefinition:{schemaVersion:CREDIT_LAB_CASE_VERSION,caseId,revision:1,title,
 description:`Синтетическая проверка: ${title}. Отдельный DRAFT, не изменение исходного Golden pack.`,
 origin:'SYNTHETIC',status:'DRAFT',reviewLevel:'INTERNAL_METHOD_REVIEW',partition:'GOLDEN_REGRESSION',
 subjectGroupId:`synthetic-dev:${caseId}`,country:'RU',asOfDate:date,
 tags:['RU','SYNTHETIC','DEVELOPMENT_V1',group],materialKind:material.kind,
 expectation:{requiredFindings:[],forbiddenFindingCodes:[],ruleStatuses:[],facts:[],summary:{},
 invariantCodes:[...INVARIANTS],notes:['Regression specification of approved behavior; not calibrated predictive truth.'],...expectation},
 review:{authoredByRole:'OTHER',reviewedByRole:'NONE',approvedAt:null,
 rationale:'Authored as a development candidate; human review is required before GOLDEN promotion.',
 labelBasis:['METHODOLOGY','FACTUAL_INVARIANT']},changeReason:null,warnings:['SYNTHETIC_NOT_REAL_BORROWER','NOT_GOLDEN_APPROVED']},material};
}
export function buildDevelopmentEntries(){
 const entries=[],counts={};
 const add=(g,t,m,e)=>entries.push(definition(g,counts[g]=(counts[g]??0)+1,t,m,e));
 const check=(g,t,v,c,s,scope='CREDIT_RISK',extra={})=>add(g,t,direct(v),{requiredFindings:[required(c,s,scope)],...extra});
 const clear=(g,t,v,c,extra={})=>add(g,t,direct(v),{forbiddenFindingCodes:[c],ruleStatuses:[status(c,'NOT_TRIGGERED')],...extra});
 const missing=(g,t,v,c,extra={})=>add(g,t,direct(v),{forbiddenFindingCodes:[c],ruleStatuses:[status(c,'INSUFFICIENT_DATA')],...extra});
 // 10 legal cases: lifecycle, uncertainty and informational events are distinct.
 add('LEGAL','Действующее лицо: ни одного подтверждённого глобального стопа',direct(),{forbiddenFindingCodes:STOPS,summary:{globalStopStatus:'NOT_TRIGGERED_WITH_AVAILABLE_DATA'}});
 add('LEGAL','Статус юридического лица неизвестен, а не действующий',direct({LEGAL_LIFECYCLE:null}),{forbiddenFindingCodes:STOPS,summary:{globalStopStatus:'INSUFFICIENT_DATA'},facts:[expectedFact('LEGAL_LIFECYCLE',null)]});
 check('LEGAL','Подтверждено прекращение деятельности',{LEGAL_LIFECYCLE:'TERMINATED'},STOPS[0],'CRITICAL','GLOBAL_STOP');
 check('LEGAL','Подтверждена ликвидация',{LEGAL_LIFECYCLE:'LIQUIDATION'},STOPS[1],'CRITICAL','GLOBAL_STOP');
 check('LEGAL','Подтверждена активная процедура банкротства',{LEGAL_LIFECYCLE:'BANKRUPTCY_ACTIVE'},STOPS[2],'CRITICAL','GLOBAL_STOP');
 clear('LEGAL','Адрес проверен: недостоверность не установлена',{LEGAL_ADDRESS_UNRELIABLE:false},'RISK-LEGAL-ADDRESS-UNRELIABLE');
 check('LEGAL','Недостоверность адреса не равна глобальному стопу',{LEGAL_ADDRESS_UNRELIABLE:true},'RISK-LEGAL-ADDRESS-UNRELIABLE','MEDIUM','CREDIT_RISK',{forbiddenFindingCodes:STOPS});
 check('LEGAL','Иск к компании не становится подтверждённым долгом',{LEGAL_DEFENDANT_CASES:2},'RISK-LEGAL-LITIGATION','INFO','INFORMATION',{forbiddenFindingCodes:STOPS});
 check('LEGAL','Сообщения о банкротстве требуют проверки статуса',{LEGAL_REGISTRY_REVIEW:2},'RISK-DATA-BANKRUPTCY-MESSAGES','MEDIUM','DATA_REVIEW',{forbiddenFindingCodes:STOPS});
 add('LEGAL','Низкая достоверность сведений о прекращении не даёт подтверждённый стоп',direct({LEGAL_LIFECYCLE:'TERMINATED'},{LEGAL_LIFECYCLE:{confidence:'LOW'}}),{forbiddenFindingCodes:STOPS,ruleStatuses:STOPS.map(c=>status(c,'INSUFFICIENT_DATA'))});
 // 24 financial cases. Explicit signs, boundaries, missing denominators and proxy semantics.
 clear('FIN','Положительный капитал',{FIN_EQUITY:5000000},'RISK-FIN-EQUITY-NON-POSITIVE');
 check('FIN','Подтверждённый нулевой капитал',{FIN_EQUITY:0},'RISK-FIN-EQUITY-NON-POSITIVE','HIGH');
 check('FIN','Отрицательный капитал',{FIN_EQUITY:-1000000},'RISK-FIN-EQUITY-NON-POSITIVE','CRITICAL');
 missing('FIN','Капитал отсутствует — не ноль',{FIN_EQUITY:null},'RISK-FIN-EQUITY-NON-POSITIVE',{facts:[expectedFact('FIN_EQUITY',null)]});
 check('FIN','Отрицательные чистые активы, сообщённые источником',{FIN_REPORTED_NET_ASSETS:-500000},'RISK-FIN-NET-ASSETS-NEGATIVE','CRITICAL');
 check('FIN','Отрицательная proxy-оценка при отсутствии сообщённых чистых активов',{FIN_REPORTED_NET_ASSETS:null,FIN_NET_ASSETS_PROXY:-500000},'RISK-FIN-NET-ASSETS-PROXY-NEGATIVE','HIGH');
 add('FIN','Сообщённые чистые активы имеют приоритет над proxy',direct({FIN_REPORTED_NET_ASSETS:1000000,FIN_NET_ASSETS_PROXY:-500000}),{forbiddenFindingCodes:['RISK-FIN-NET-ASSETS-PROXY-NEGATIVE'],ruleStatuses:[status('RISK-FIN-NET-ASSETS-PROXY-NEGATIVE','NOT_APPLICABLE')]});
 check('FIN','Выраженный дефицит текущей ликвидности',{FIN_CURRENT_RATIO:.6},'RISK-FIN-CURRENT-LIQUIDITY','HIGH');
 check('FIN','Умеренный дефицит текущей ликвидности',{FIN_CURRENT_RATIO:.9},'RISK-FIN-CURRENT-LIQUIDITY','MEDIUM');
 clear('FIN','Текущая ликвидность ровно 1',{FIN_CURRENT_RATIO:1},'RISK-FIN-CURRENT-LIQUIDITY');
 missing('FIN','Коэффициент ликвидности не рассчитан',{FIN_CURRENT_RATIO:null},'RISK-FIN-CURRENT-LIQUIDITY');
 check('FIN','Небольшой отрицательный оборотный капитал',{FIN_WORKING_CAPITAL:-500000,FIN_CURRENT_ASSETS:10000000},'RISK-FIN-WORKING-CAPITAL','MEDIUM');
 check('FIN','Существенный отрицательный оборотный капитал',{FIN_WORKING_CAPITAL:-3000000,FIN_CURRENT_ASSETS:10000000},'RISK-FIN-WORKING-CAPITAL','HIGH');
 clear('FIN','Нулевой оборотный капитал — не отрицательный',{FIN_WORKING_CAPITAL:0},'RISK-FIN-WORKING-CAPITAL');
 check('FIN','Единственный убыточный год',{FIN_ANNUAL_NET_PROFIT:-200000},'RISK-FIN-NET-LOSS-CURRENT','HIGH');
 add('FIN','Повторный убыток: не дублировать два итоговых фактора',direct({FIN_ANNUAL_NET_PROFIT:-300000,FIN_CONSECUTIVE_ANNUAL_LOSSES:2}),{requiredFindings:[required('RISK-FIN-NET-LOSS-REPEATED','CRITICAL')],forbiddenFindingCodes:['RISK-FIN-NET-LOSS-CURRENT'],ruleStatuses:[status('RISK-FIN-NET-LOSS-CURRENT','TRIGGERED')]});
 check('FIN','Сопоставимая годовая выручка снизилась на 30%',{FIN_ANNUAL_REVENUE_CHANGE:-30},'RISK-FIN-REVENUE-DECLINE','HIGH');
 check('FIN','Сопоставимая годовая выручка снизилась на 15%',{FIN_ANNUAL_REVENUE_CHANGE:-15},'RISK-FIN-REVENUE-DECLINE','MEDIUM');
 clear('FIN','Положительная годовая динамика',{FIN_ANNUAL_REVENUE_CHANGE:15},'RISK-FIN-REVENUE-DECLINE');
 missing('FIN','Несопоставимые периоды — нет процентного вывода',{FIN_ANNUAL_REVENUE_CHANGE:null},'RISK-FIN-REVENUE-DECLINE');
 check('FIN','Операционная прибыль не покрывает проценты',{FIN_INTEREST_COVERAGE:.7},'RISK-FIN-INTEREST-COVERAGE','HIGH');
 check('FIN','Небольшой запас покрытия процентов',{FIN_INTEREST_COVERAGE:1.2},'RISK-FIN-INTEREST-COVERAGE','MEDIUM');
 missing('FIN','Нет достоверного коэффициента покрытия процентов',{FIN_INTEREST_COVERAGE:null},'RISK-FIN-INTEREST-COVERAGE');
 add('FIN','Неизвестные финансовые значения не становятся отрицательными',direct({FIN_EQUITY:null,FIN_REPORTED_NET_ASSETS:null,FIN_NET_ASSETS_PROXY:null,FIN_CURRENT_RATIO:null,FIN_WORKING_CAPITAL:null,FIN_ANNUAL_NET_PROFIT:null,FIN_CONSECUTIVE_ANNUAL_LOSSES:null,FIN_ANNUAL_REVENUE_CHANGE:null,FIN_INTEREST_COVERAGE:null}),{forbiddenFindingCodes:['RISK-FIN-EQUITY-NON-POSITIVE','RISK-FIN-NET-ASSETS-NEGATIVE','RISK-FIN-CURRENT-LIQUIDITY','RISK-FIN-NET-LOSS-CURRENT','RISK-FIN-NET-LOSS-REPEATED','RISK-FIN-REVENUE-DECLINE','RISK-FIN-INTEREST-COVERAGE']});
 // 20 cash-flow cases: actual ratio boundaries plus identity/coverage controls.
 clear('CASH','Невысокое обслуживание долга',{BANK_DEBT_SERVICE_RATIO:.1},'RISK-CF-DEBT-SERVICE-BURDEN');
 clear('CASH','Долговое обслуживание ровно на нижней границе',{BANK_DEBT_SERVICE_RATIO:.25},'RISK-CF-DEBT-SERVICE-BURDEN');
 check('CASH','Умеренная нагрузка по денежному потоку',{BANK_DEBT_SERVICE_RATIO:.3},'RISK-CF-DEBT-SERVICE-BURDEN','MEDIUM');
 check('CASH','Долговое обслуживание ровно на верхней границе',{BANK_DEBT_SERVICE_RATIO:.4},'RISK-CF-DEBT-SERVICE-BURDEN','MEDIUM');
 check('CASH','Высокая нагрузка по денежному потоку',{BANK_DEBT_SERVICE_RATIO:.5},'RISK-CF-DEBT-SERVICE-BURDEN','HIGH');
 missing('CASH','Высокое наблюдаемое отношение при неизвестном покрытии',{BANK_DEBT_SERVICE_RATIO:.5,BANK_COVERAGE_ADEQUATE:null},'RISK-CF-DEBT-SERVICE-BURDEN');
 clear('CASH','Рост операционных поступлений',{BANK_OPERATING_TREND:10},'RISK-CF-OPERATING-RECEIPTS-DECLINE');
 check('CASH','Операционные поступления снижаются на 10%',{BANK_OPERATING_TREND:-10},'RISK-CF-OPERATING-RECEIPTS-DECLINE','MEDIUM');
 check('CASH','Операционные поступления снижаются на 25%',{BANK_OPERATING_TREND:-25},'RISK-CF-OPERATING-RECEIPTS-DECLINE','HIGH');
 missing('CASH','Нет сопоставимого денежного тренда',{BANK_OPERATING_TREND:null},'RISK-CF-OPERATING-RECEIPTS-DECLINE');
 clear('CASH','Распределённая база идентифицированных покупателей',{BANK_TOP1:.2},'RISK-CF-CUSTOMER-CONCENTRATION');
 check('CASH','Доля покупателя ровно 35%',{BANK_TOP1:.35},'RISK-CF-CUSTOMER-CONCENTRATION','MEDIUM');
 check('CASH','Доля покупателя ровно 50%',{BANK_TOP1:.5},'RISK-CF-CUSTOMER-CONCENTRATION','HIGH');
 missing('CASH','Неизвестные покупатели не превращаются в одного крупнейшего',{BANK_TOP1:.9,BANK_IDENTITY_COVERAGE:.4},'RISK-CF-CUSTOMER-CONCENTRATION');
 missing('CASH','Платформенные перечисления не равны одному конечному покупателю',{BANK_TOP1:.9,BANK_INTERMEDIATED_SHARE:.9},'RISK-CF-CUSTOMER-CONCENTRATION');
 check('CASH','Много неразобранных поступлений: качество данных',{BANK_UNKNOWN_INFLOW_SHARE:.3},'RISK-DATA-UNKNOWN-INFLOW-SHARE','HIGH','DATA_REVIEW');
 check('CASH','Неясные наличные и переводы физических лиц',{BANK_UNCLEAR_CASH_SHARE:.25},'RISK-DATA-CASH-INDIVIDUAL-TRACEABILITY','HIGH','DATA_REVIEW');
 check('CASH','Отрицательный восстановленный остаток — проверка сверки',{BANK_NEGATIVE_RECONSTRUCTED_DAYS:4},'RISK-DATA-BALANCE-RECONSTRUCTION','HIGH','DATA_REVIEW',{forbiddenFindingCodes:['RISK-CF-LIQUIDITY-STRESS']});
 check('CASH','Доказанная напряжённость ликвидности',{BANK_LOW_LIQUIDITY_SHARE:.2},'RISK-CF-LIQUIDITY-STRESS','HIGH');
 missing('CASH','Неизвестная ликвидность не равна стрессу',{BANK_LOW_LIQUIDITY_SHARE:null},'RISK-CF-LIQUIDITY-STRESS');
 // 20 BKI cases: zero, unknown, current vs historical and obligor separation.
 const CUR='RISK-BKI-CURRENT-OVERDUE',HIST='RISK-BKI-HISTORICAL-DELINQUENCY';
 add('BKI','Подтверждены отсутствие текущей и исторической просрочки',direct({BKI_OVERDUE:0,BKI_HISTORY_DAYS:0}),{forbiddenFindingCodes:[CUR,HIST],facts:[expectedFact('BKI_OVERDUE',0),expectedFact('BKI_HISTORY_DAYS',0)]});
 for(const [days,severity,reason] of [[0,'MEDIUM',null],[null,'MEDIUM',null],[1,'MEDIUM','DELINQUENCY_1_29'],[29,'MEDIUM','DELINQUENCY_1_29'],[30,'HIGH','DELINQUENCY_30_59'],[59,'HIGH','DELINQUENCY_30_59'],[60,'CRITICAL','DELINQUENCY_60_PLUS']]) {
  add('BKI',`Текущая просрочка: исторические дни ${days===null?'неизвестны':days}`,direct({BKI_OVERDUE:1000,BKI_HISTORY_DAYS:days}),{requiredFindings:[required(CUR,severity,'CREDIT_RISK',{reasonCodes:['CURRENT_OVERDUE',...(reason?[reason]:[])],...(!reason?{forbiddenReasonCodes:['DELINQUENCY_1_29','DELINQUENCY_30_59','DELINQUENCY_60_PLUS']}:{})})],forbiddenFindingCodes:[HIST],facts:[expectedFact('BKI_HISTORY_DAYS',days)]});
 }
 for(const [days,severity,scope] of [[1,'LOW','INFORMATION'],[29,'LOW','INFORMATION'],[30,'MEDIUM','CREDIT_RISK'],[59,'MEDIUM','CREDIT_RISK'],[60,'HIGH','CREDIT_RISK']])add('BKI',`Просрочки сейчас нет, исторический максимум ${days} дн.`,direct({BKI_OVERDUE:0,BKI_HISTORY_DAYS:days}),{requiredFindings:[required(HIST,severity,scope)],forbiddenFindingCodes:[CUR]});
 missing('BKI','Текущая просрочка неизвестна, история подтверждена нулём',{BKI_OVERDUE:null,BKI_HISTORY_DAYS:0},CUR,{facts:[expectedFact('BKI_OVERDUE',null)]});
 add('BKI','Текущая просрочка неизвестна, история 60 дней известна',direct({BKI_OVERDUE:null,BKI_HISTORY_DAYS:60}),{requiredFindings:[required(HIST,'HIGH')],forbiddenFindingCodes:[CUR]});
 add('BKI','Низкая достоверность бюро не повышается до подтверждённого риска',direct({BKI_OVERDUE:1000,BKI_HISTORY_DAYS:60},{BKI_OVERDUE:{confidence:'LOW'},BKI_HISTORY_DAYS:{confidence:'LOW'}}),{forbiddenFindingCodes:[CUR,HIST],ruleStatuses:[status(CUR,'INSUFFICIENT_DATA','synthetic-loan'),status(HIST,'INSUFFICIENT_DATA','synthetic-loan')]});
 add('BKI','Личная кредитная история собственника исключена из долга компании',src(m=>{m.analysis.creditHistory=bki({subjectInn:'9900000002',relationshipToCompany:'Собственник',affectsCompanyDebt:false,obligations:[row({overdueAmount:100000,maxDelinquencyDays:90})]});}),{forbiddenFindingCodes:[CUR,HIST],facts:[expectedFact('BKI_SCOPE_EXCLUDED',true)]});
 add('BKI','Два договора: просрочка относится только к одному',src(m=>{m.analysis.creditHistory=bki({obligations:[row({id:'synthetic-a',overdueAmount:0,maxDelinquencyDays:0}),row({id:'synthetic-b',overdueAmount:1000,maxDelinquencyDays:30})]});}),{requiredFindings:[required(CUR,'HIGH')],forbiddenFindingCodes:[HIST]});
 add('BKI','Устаревшая история: текущая просрочка неизвестна',src(m=>{m.analysis.creditHistory=bki({reportDate:'2024-01-01',obligations:[row({overdueAmount:1000,maxDelinquencyDays:60})]});}),{requiredFindings:[required(HIST,'HIGH'),required('RISK-DATA-SOURCE-STALE','MEDIUM','DATA_REVIEW')],forbiddenFindingCodes:[CUR],facts:[expectedFact('BKI_OVERDUE',null),expectedFact('BKI_HISTORY_DAYS',60,{confidence:'MEDIUM'})]});
 add('BKI','Поручительство остаётся условным обязательством',src(m=>{m.analysis.creditPortfolioV1=portfolio([row({role:'Поручитель',guaranteeAmount:1000000})]);}),{forbiddenFindingCodes:[CUR,'RISK-DATA-PORTFOLIO-OUTSTANDING-UNKNOWN'],facts:[expectedFact('PORTFOLIO_CONTINGENT_AMOUNT',1000000)]});
 // 16 quality cases: no credit penalty is invented from absent/ambiguous facts.
 const dataSpecs=[
 ['Неопознанное обязательство','PORTFOLIO_UNRESOLVED','RISK-DATA-PORTFOLIO-OBLIGATION-UNRESOLVED','HIGH',1],
 ['Неизвестный остаток долга','PORTFOLIO_UNKNOWN_FUNDED','RISK-DATA-PORTFOLIO-OUTSTANDING-UNKNOWN','MEDIUM',1],
 ['Конфликт сведений о долге','PORTFOLIO_CONFLICTS','RISK-DATA-PORTFOLIO-CONFLICT','HIGH',1],
 ['Новое обязательство','PORTFOLIO_NEW','RISK-DATA-NEW-OBLIGATION-DETECTED','MEDIUM',1],
 ['Несопоставленный долговой платёж','PORTFOLIO_UNMATCHED','RISK-DATA-DEBT-PAYMENT-UNMATCHED','MEDIUM',1],
 ['Платёж без разделения тела и процентов','PORTFOLIO_UNSPLIT','RISK-DATA-UNSPLIT-DEBT-SERVICE','MEDIUM',1],
 ['Несовпадение идентичности источников','RECON_IDENTITY_CONFLICTS','RISK-DATA-COMPANY-IDENTITY-CONFLICT','CRITICAL',1],
 ['Два источника расходятся по одному факту','RECON_SAME_FACT_CONFLICTS','RISK-DATA-FINANCIAL-SAME-FACT-CONFLICT','HIGH',1],
 ['Прочая сверка требует проверки','RECON_OTHER_REVIEW','RISK-DATA-RECONCILIATION-REVIEW','MEDIUM',1],
 ['Источник отсутствует','SOURCE_MISSING_COUNT','RISK-DATA-SOURCE-MISSING','MEDIUM',1],
 ['Источник устарел','SOURCE_STALE_COUNT','RISK-DATA-SOURCE-STALE','MEDIUM',1],
 ['Источник завершился ошибкой','SOURCE_FAILED_COUNT','RISK-DATA-SOURCE-FAILED','HIGH',1],
 ['Частичный месяц','BANK_COVERAGE_ISSUE','RISK-DATA-BANK-COVERAGE','MEDIUM',1],
 ['Пропущенный месяц','BANK_COVERAGE_ISSUE','RISK-DATA-BANK-COVERAGE','HIGH',2],
 ['Пересечение покрытия','BANK_COVERAGE_ISSUE','RISK-DATA-BANK-COVERAGE','HIGH',3],
 ['Низкая целостность источника','INTEGRITY_CONFIDENCE','RISK-DATA-SOURCE-INTEGRITY','HIGH',49],
 ];
 for(const [title,key,code,severity,value] of dataSpecs)check('DATA',title,{[key]:value},code,severity,'DATA_REVIEW',{forbiddenFindingCodes:STOPS});
 // 10 source-snapshot cases exercise actual source adapters, not precomputed findings.
 add('SOURCE','Полный синтетический набор через адаптеры',src(),{unexpectedFindings:'HARD',summary:{dataReviewRequired:false,globalStopStatus:'NOT_TRIGGERED_WITH_AVAILABLE_DATA'}});
 add('SOURCE','Отрицательный капитал из согласованного баланса',src(m=>{m.analysis.financialAnalysisV2=finances([snapshot(2025,{1300:-1000000,1500:9000000})]);}),{requiredFindings:[required('RISK-FIN-EQUITY-NON-POSITIVE','CRITICAL')],forbiddenFindingCodes:STOPS});
 add('SOURCE','Два последовательных убыточных годовых баланса',src(m=>{m.analysis.financialAnalysisV2=finances([snapshot(2024,{2400:-100000}),snapshot(2025,{2400:-200000})]);}),{requiredFindings:[required('RISK-FIN-NET-LOSS-REPEATED','CRITICAL')],forbiddenFindingCodes:['RISK-FIN-NET-LOSS-CURRENT']});
 add('SOURCE','Нет БФО: нельзя придумать капитал',src(m=>{delete m.analysis.financialAnalysisV2;delete m.analysis.sourceManifest.bfo;}),{facts:[expectedFact('FIN_EQUITY',null)],forbiddenFindingCodes:['RISK-FIN-EQUITY-NON-POSITIVE']});
 add('SOURCE','Нет правового профиля: статус не подтверждён',src(m=>{delete m.companyProfile;}),{forbiddenFindingCodes:STOPS,summary:{globalStopStatus:'INSUFFICIENT_DATA'}});
 add('SOURCE','Нет БКИ и портфеля: текущая просрочка не подтверждена нулём',src(m=>{delete m.analysis.creditHistory;delete m.analysis.creditPortfolioV1;delete m.analysis.sourceManifest.bki;}),{forbiddenFindingCodes:[CUR,HIST],ruleStatuses:[status(CUR,'INSUFFICIENT_DATA'),status(HIST,'INSUFFICIENT_DATA')]});
 add('SOURCE','Конфликт БФО и промежуточного источника',src(m=>{m.analysis.reconciliationV1.findings=[reconciliationFinding()];}),{requiredFindings:[required('RISK-DATA-FINANCIAL-SAME-FACT-CONFLICT','HIGH','DATA_REVIEW')],forbiddenFindingCodes:STOPS});
 add('SOURCE','Деньги и начисленная выручка — разные определения',src(m=>{m.analysis.reconciliationV1.findings=[reconciliationFinding('CASH_VS_ACCRUAL','RELATIONSHIP_OBSERVED')];}),{unexpectedFindings:'HARD',summary:{dataReviewRequired:false}});
 add('SOURCE','Слабая уверенность сверки сохраняется',src(m=>{m.analysis.reconciliationV1.findings=[reconciliationFinding('IDENTITY','CONFLICT','LOW')];}),{forbiddenFindingCodes:['RISK-DATA-COMPANY-IDENTITY-CONFLICT'],facts:[expectedFact('RECON_IDENTITY_CONFLICTS',1,{confidence:'LOW'})]});
 add('SOURCE','Несколько подтверждённых рисков и конфликт данных',src(m=>{m.analysis.financialAnalysisV2=finances([snapshot(2025,{1300:-1000000,1500:9000000})]);m.analysis.metricsV2.debtService.debtServiceToOperatingReceipts.value=.5;m.analysis.creditHistory=bki({obligations:[row({overdueAmount:1000,maxDelinquencyDays:60})]});m.analysis.reconciliationV1.findings=[reconciliationFinding()];}),{requiredFindings:[required('RISK-FIN-EQUITY-NON-POSITIVE','CRITICAL'),required('RISK-CF-DEBT-SERVICE-BURDEN','HIGH'),required(CUR,'CRITICAL'),required('RISK-DATA-FINANCIAL-SAME-FACT-CONFLICT','HIGH','DATA_REVIEW')],forbiddenFindingCodes:STOPS});
 if(entries.length!==100)throw new Error(`DEVELOPMENT_CASE_COUNT:${entries.length}`);
 return entries;
}
export function loadDevelopmentPack(){return {version:PACK_VERSION,revision:1,entries:buildDevelopmentEntries(),fingerprints:JSON.parse(readFileSync(new URL('./fingerprints.json',import.meta.url),'utf8'))};}
