import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { fact, id, weakest } from "../lib/credit-engine/risk/common.ts";
import { evaluateRiskFacts, summarizeRiskAssessment } from "../lib/credit-engine/risk/engine.ts";
import { RISK_RULE_REGISTRY } from "../lib/credit-engine/risk/rules/registry.ts";
import { adaptRiskFacts } from "../lib/credit-engine/risk/facts.ts";
import { buildRiskShadow } from "../lib/credit-engine/risk/integration.ts";
import { bankFacts } from "../lib/credit-engine/risk/adapters/bank.ts";
import { financialFacts } from "../lib/credit-engine/risk/adapters/financial.ts";
import { legalFacts, normalizeLifecycle } from "../lib/credit-engine/risk/adapters/legal.ts";
import { bkiFacts } from "../lib/credit-engine/risk/adapters/bki.ts";
import { portfolioFacts } from "../lib/credit-engine/risk/adapters/portfolio.ts";
import { reconciliationFacts } from "../lib/credit-engine/risk/adapters/reconciliation.ts";
import { integrityFacts } from "../lib/credit-engine/risk/adapters/integrity.ts";
import { analyzeBankStatement, analysisForStorage } from "../lib/prescore.ts";
import { analysisView } from "../lib/entitlements.ts";
import { block2StatementFixture } from "./fixtures/block2-statements.mjs";
import { normalizeSnapshot } from "../lib/credit-engine/financial-analysis/normalizer.ts";
import { annualPeriod, parseFinancialPeriod } from "../lib/credit-engine/financial-analysis/periods.ts";
import { buildFinancialAnalysis } from "../lib/credit-engine/financial-analysis/engine.ts";
import { buildCreditPortfolio } from "../lib/credit-engine/credit-portfolio/resolver.ts";
import { adaptUploadedBki } from "../lib/credit-engine/credit-portfolio/bki-adapter.ts";
const inn = "7701234567", date = "2026-06-30";
const source = (sourceType = "BANK_STATEMENT", extra = {}) => ({ sourceId: `${sourceType}:fixture`, sourceType, status: "READY", companyInn: inn, receivedAt: date, confidence: 98, warnings: [], ...extra });
const F = (code, value, extra = {}) => fact(inn, code, code.startsWith("FIN_") ? "FINANCIAL" : code.startsWith("BKI_") ? "CREDIT_HISTORY" : "DATA_QUALITY", value, { period: { from: null, to: null, asOf: date }, sourceIds: ["source:1"], sourceTypes: ["OTHER"], ...extra });
const run = (facts, rules) => evaluateRiskFacts({ companyInn: inn, asOfDate: date, facts }, rules);
const evaluation = (p, code) => p.evaluations.find(e => e.ruleCode === code);
const finding = (p, code) => p.findings.find(e => e.code === code);
const single = (code, values, extras = {}) => run(Object.entries(values).map(([c,v]) => F(c,v,extras)), RISK_RULE_REGISTRY.filter(r => r.code === code));
const base = analyzeBankStatement(block2StatementFixture(), "risk-parity.txt");
function analysis(extra = {}) { return { ...structuredClone(base), companyInn: inn, periodTo: date, sourceManifest: { bankStatements: [source()] }, ...extra }; }
const input = (a = analysis(), p) => ({ analysis: a, companyProfile: p, asOfDate: date });
function profile(extra = {}) { return { inn, fetchedAt: date, failedMethods: [], company: { status: "Действующее", addressUnreliable: false }, legal: { bankruptcyMessages: 0 }, signals: [], sourceManifest: { external: ["company","enforcements","legal-cases","inspections","fedresurs","bankruptcy-messages"].map(e => source("CHECKO", { sourceId: `external:${e}:fixture`, rawReference: `external:/${e}:${date}`, confidence: null })) }, enforcementItems: [], legalCaseItems: [], inspectionItems: [], registryMessages: [], ...extra }; }
function bank(extra = {}) {
 const b = structuredClone(base.metricsV2); b.period = { from: "2026-01-01", to: date, fullMonths: 6, partialMonths: 0, missingMonths: 0, overlapMonths: 0 };
 for (const group of Object.values(b)) if(group && typeof group === 'object' && !Array.isArray(group)) for(const m of Object.values(group)) if(m && typeof m === 'object' && 'code' in m) Object.assign(m,{status:'KNOWN',confidence:'HIGH',value:0,periodFrom:'2026-01-01',periodTo:date,warnings:[]});
 b.customers.directCustomerConcentrationCoverage.value = 1; b.customers.directCustomerIdentityCoverage.value = 1; b.quality.unknownInflowShare = 0; return Object.assign(b,extra);
}
const raw = { "1600": 10000, "1100": 4000, "1200": 6000, "1300": 5000, "1400": 2000, "1500": 3000, "1700": 10000, "2110": 12000, "2200": 3000, "2330": -100, "2400": 2300 };
const snap = (year = 2025, values = {}, extra = {}) => normalizeSnapshot({ source: source("BFO", { sourceId: `bfo:${year}` }), period: annualPeriod(year), rawLines: { ...raw, ...values }, scale: 1, ...extra });
const fin = (snapshots = [snap(2024), snap()]) => buildFinancialAnalysis(snapshots);
const obligation = (extra = {}) => ({ id: "sb-1", creditor: "Банк", product: "Срочный кредит", role: "Заёмщик", status: "Действующий", openedAt: "2025-01-01", scheduledCloseAt: "2027-12-31", outstandingPrincipal: 5000000, totalOutstanding: 5100000, originalAmount: 6000000, accountNumber: "ACC-1", annualRate: 20, overdueAmount: 1000, maxDelinquencyDays: 60, monthlyPayment: null, nextPaymentAmount: null, nextPaymentDate: "", creditLimit: null, guaranteeAmount: null, collateral: "", ...extra });
const bki = (extra = {}) => ({ source: "СБ БКИ", subjectType: "Юридическое лицо", subjectInn: inn, relationshipToCompany: "Компания-заёмщик", affectsCompanyDebt: true, reportDate: date, parserConfidence: 98, obligations: [obligation()], warnings: [], summary: {}, ...extra });
function portfolio(rows = [obligation()]) { const snapshot = adaptUploadedBki(bki({obligations:rows}), {companyInn:inn,source:source("BKI")}); return buildCreditPortfolio({companyInn:inn,asOfDate:date,creditHistorySnapshots:[snapshot],paymentObservations:[]}); }

test("risk versions and SHADOW mode", () => {const p=run([]);assert.equal(p.version,"PRESCORE-RISK-ENGINE-1.0.0-SHADOW");assert.equal(p.ruleRegistryVersion,"PRESCORE-RISK-RULES-1.0.0-PRE-CALIBRATION");assert.equal(p.mode,"SHADOW");});
for (const status of ["KNOWN","UNKNOWN","PARTIAL","NOT_APPLICABLE"]) test(`canonical fact ${status}`,()=>{const f=F("X",0,{status});assert.equal(f.status,status);assert.equal(f.value,["UNKNOWN","NOT_APPLICABLE"].includes(status)?null:0);});
for (const origin of ["REPORTED","DERIVED","PROXY"]) test(`fact origin ${origin} retained`,()=>assert.equal(F("X",1,{origin}).origin,origin));
for (const c of ["HIGH","MEDIUM","LOW","UNKNOWN"]) test(`weakest confidence ${c}`,()=>assert.equal(weakest("HIGH",c),c));
test("nonfinite adapter input becomes unknown",()=>assert.equal(F("X",Infinity).status,"UNKNOWN"));
test("nonfinite core input rejected",()=>assert.throws(()=>run([{...F("X",1),value:NaN}]),/INVALID/));
test("known zero never missing",()=>assert.equal(F("X",0).status,"KNOWN"));
test("known false retained",()=>assert.equal(F("X",false).value,false));
test("missing fact not zero",()=>assert.equal(F("X",null).value,null));
test("fact evidence retained",()=>assert.equal(F("X",3).evidence[0].value,3));
test("fact ID deterministic",()=>assert.equal(F("X",3).factId,F("X",3).factId));
test("unknown legal data means insufficient global status",()=>assert.equal(run([]).summary.globalStopStatus,"INSUFFICIENT_DATA"));
test("known active lifecycle means no available stop",()=>assert.equal(run([F("LEGAL_LIFECYCLE","ACTIVE")]).summary.globalStopStatus,"NOT_TRIGGERED_WITH_AVAILABLE_DATA"));
test("no company mixing",()=>assert.throws(()=>run([F("X",1,{companyInn:"7701234568"})]),/INVALID/));
test("invalid explicit date rejected",()=>assert.throws(()=>evaluateRiskFacts({companyInn:inn,asOfDate:"",facts:[]}),/INVALID/));
test("future adverse fact not used",()=>assert.equal(single("RISK-FIN-EQUITY-NON-POSITIVE",{FIN_EQUITY:-1},{period:{from:null,to:null,asOf:"2027-01-01"}}).findings.length,0));
test("identical facts deduplicated",()=>assert.equal(run([F("X",1),F("X",1)]).facts.length,1));
test("conflicting fact ID rejected",()=>assert.throws(()=>run([F("X",1),{...F("X",1),value:2}]),/CONFLICT/));
for(const r of RISK_RULE_REGISTRY) test(`${r.code} missing inputs audited`,()=>{const p=run([], [r]);assert.equal(p.evaluations.length,1);assert.equal(p.evaluations[0].status,"INSUFFICIENT_DATA");assert.equal(p.findings.length,0);});

const boundaries = [
 ["RISK-FIN-EQUITY-NON-POSITIVE","FIN_EQUITY",[[-1,"CRITICAL"],[0,"HIGH"],[1,null]]],
 ["RISK-FIN-NET-ASSETS-NEGATIVE","FIN_REPORTED_NET_ASSETS",[[-1,"CRITICAL"],[0,null],[1,null]]],
 ["RISK-FIN-CURRENT-LIQUIDITY","FIN_CURRENT_RATIO",[[.79,"HIGH"],[.8,"MEDIUM"],[.99,"MEDIUM"],[1,null]]],
 ["RISK-FIN-INTEREST-COVERAGE","FIN_INTEREST_COVERAGE",[[.99,"HIGH"],[1,"MEDIUM"],[1.49,"MEDIUM"],[1.5,null]]],
 ["RISK-FIN-REVENUE-DECLINE","FIN_ANNUAL_REVENUE_CHANGE",[[-9.9,null],[-10,"MEDIUM"],[-24.9,"MEDIUM"],[-25,"HIGH"]]],
 ["RISK-CF-DEBT-SERVICE-BURDEN","BANK_DEBT_SERVICE_RATIO",[[.249,null],[.25,null],[.4,"MEDIUM"],[.401,"HIGH"]]],
 ["RISK-CF-OPERATING-RECEIPTS-DECLINE","BANK_OPERATING_TREND",[[-9.9,null],[-10,"MEDIUM"],[-24.9,"MEDIUM"],[-25,"HIGH"]]],
 ["RISK-DATA-UNKNOWN-INFLOW-SHARE","BANK_UNKNOWN_INFLOW_SHARE",[[.099,null],[.1,"MEDIUM"],[.199,"MEDIUM"],[.2,"HIGH"]]],
 ["RISK-DATA-CASH-INDIVIDUAL-TRACEABILITY","BANK_UNCLEAR_CASH_SHARE",[[.099,null],[.1,"MEDIUM"],[.199,"MEDIUM"],[.2,"HIGH"]]],
 ["RISK-CF-LIQUIDITY-STRESS","BANK_LOW_LIQUIDITY_SHARE",[[.099,null],[.1,"MEDIUM"],[.199,"MEDIUM"],[.2,"HIGH"]]],
 ["RISK-DATA-SOURCE-INTEGRITY","INTEGRITY_CONFIDENCE",[[49,"HIGH"],[50,"MEDIUM"],[69,"MEDIUM"],[70,null]]],
 ["RISK-FIN-NET-LOSS-CURRENT","FIN_ANNUAL_NET_PROFIT",[[-1,"HIGH"],[0,null],[1,null]]],
 ["RISK-FIN-NET-LOSS-REPEATED","FIN_CONSECUTIVE_ANNUAL_LOSSES",[[0,null],[1,null],[2,"CRITICAL"]]],
];
for(const [code,key,cases] of boundaries)for(const [value,severity] of cases)test(`${code} boundary ${value}`,()=>{const p=single(code,{[key]:value,BANK_COVERAGE_ADEQUATE:true});assert.equal(p.findings[0]?.severity??null,severity);assert.equal(p.evaluations[0].status,severity?"TRIGGERED":"NOT_TRIGGERED");if(severity){assert.ok(p.findings[0].threshold);assert.notEqual(p.findings[0].decisionImpact,"BLOCKING");}});
for(const [n,severity] of [[-.199,"MEDIUM"],[-.2,"HIGH"],[0,null]])test(`working-capital ratio ${n}`,()=>{const p=single("RISK-FIN-WORKING-CAPITAL",{FIN_WORKING_CAPITAL:100*n,FIN_CURRENT_ASSETS:100});assert.equal(p.findings[0]?.severity??null,severity);if(severity==="HIGH")assert.equal(p.findings[0].unit,"RATIO");});
for(const assets of [null,0,-1])test(`working capital no denominator ${assets}`,()=>assert.equal(single("RISK-FIN-WORKING-CAPITAL",{FIN_WORKING_CAPITAL:-20,FIN_CURRENT_ASSETS:assets}).findings[0].severity,"MEDIUM"));
for(const [top,severity] of [[.349,null],[.35,"MEDIUM"],[.499,"MEDIUM"],[.5,"HIGH"]])test(`direct concentration ${top}`,()=>assert.equal(single("RISK-CF-CUSTOMER-CONCENTRATION",{BANK_TOP1:top,BANK_CONCENTRATION_COVERAGE:1,BANK_IDENTITY_COVERAGE:1,BANK_INTERMEDIATED_SHARE:0}).findings[0]?.severity??null,severity));
for(const code of ["BANK_CONCENTRATION_COVERAGE","BANK_IDENTITY_COVERAGE"])for(const coverage of [.799,.8])test(`${code} ${coverage}`,()=>assert.equal(single("RISK-CF-CUSTOMER-CONCENTRATION",{BANK_TOP1:.7,BANK_CONCENTRATION_COVERAGE:1,BANK_IDENTITY_COVERAGE:1,BANK_INTERMEDIATED_SHARE:0,[code]:coverage}).evaluations[0].status,coverage<.8?"INSUFFICIENT_DATA":"TRIGGERED"));
test("intermediary majority not direct customer risk",()=>assert.equal(single("RISK-CF-CUSTOMER-CONCENTRATION",{BANK_TOP1:.9,BANK_CONCENTRATION_COVERAGE:1,BANK_IDENTITY_COVERAGE:1,BANK_INTERMEDIATED_SHARE:.8}).evaluations[0].status,"INSUFFICIENT_DATA"));
for(const [c,expected] of [["HIGH","TRIGGERED"],["MEDIUM","TRIGGERED"],["LOW","INSUFFICIENT_DATA"],["UNKNOWN","INSUFFICIENT_DATA"]])test(`adverse equity confidence ${c}`,()=>{const p=single("RISK-FIN-EQUITY-NON-POSITIVE",{FIN_EQUITY:-1},{confidence:c});assert.equal(p.evaluations[0].status,expected);if(p.findings.length)assert.equal(p.findings[0].evidenceConfidence,c);});
for(const status of ["UNKNOWN","PARTIAL","NOT_APPLICABLE"])test(`equity ${status} cannot clear`,()=>assert.equal(single("RISK-FIN-EQUITY-NON-POSITIVE",{FIN_EQUITY:0},{status}).evaluations[0].status,status==="NOT_APPLICABLE"?"NOT_APPLICABLE":"INSUFFICIENT_DATA"));
for(const [state,code] of [["TERMINATED","RISK-LEGAL-ENTITY-TERMINATED"],["LIQUIDATION","RISK-LEGAL-LIQUIDATION-ACTIVE"],["BANKRUPTCY_ACTIVE","RISK-LEGAL-BANKRUPTCY-ACTIVE"]])test(`explicit global state ${state}`,()=>{const p=run([F("LEGAL_LIFECYCLE",state)]);assert.equal(finding(p,code).decisionImpact,"BLOCKING");assert.equal(p.summary.globalStopStatus,"TRIGGERED");assert.ok(p.findings.filter(f=>f.decisionImpact==="BLOCKING").every(f=>f.scope==="GLOBAL_STOP"));});
for(const raw of ["ликвидировано","ликвидирована","прекратило деятельность"])test(`lifecycle normalized ${raw}`,()=>assert.equal(normalizeLifecycle(raw),"TERMINATED"));
for(const raw of ["", "Ранее была ликвидация", "намерение подать на банкротство", "банкротство завершено"])test(`noncurrent or ambiguous legal text ${raw}`,()=>assert.ok(["UNKNOWN","OTHER"].includes(normalizeLifecycle(raw))));
test("low-confidence liquidation cannot block",()=>assert.equal(run([F("LEGAL_LIFECYCLE","LIQUIDATION",{confidence:"LOW"})]).summary.globalStopStatus,"INSUFFICIENT_DATA"));
test("negative equity is never global stop",()=>assert.equal(run([F("FIN_EQUITY",-1)]).summary.globalStopCount,0));
test("proxy net assets lower labelled finding",()=>{const p=run([F("FIN_NET_ASSETS_PROXY",-100,{origin:"PROXY"})]);assert.equal(finding(p,"RISK-FIN-NET-ASSETS-PROXY-NEGATIVE").origin,"PROXY");assert.equal(finding(p,"RISK-FIN-NET-ASSETS-PROXY-NEGATIVE").severity,"HIGH");});
test("reported positive net assets prevents proxy substitute",()=>assert.equal(run([F("FIN_NET_ASSETS_PROXY",-100,{origin:"PROXY"}),F("FIN_REPORTED_NET_ASSETS",10)]).findings.length,0));
for(const [ratio,severity] of [[.009,"LOW"],[.01,"MEDIUM"],[.049,"MEDIUM"],[.05,"HIGH"]])test(`enforcement ratio ${ratio}`,()=>{const p=single("RISK-LEGAL-ACTIVE-ENFORCEMENT",{LEGAL_ACTIVE_ENFORCEMENT_AMOUNT:100,LEGAL_ENFORCEMENT_REVENUE_RATIO:ratio});assert.equal(p.findings[0].severity,severity);assert.notEqual(p.findings[0].scope,"GLOBAL_STOP");});
test("enforcement without revenue stays factual information",()=>assert.equal(single("RISK-LEGAL-ACTIVE-ENFORCEMENT",{LEGAL_ACTIVE_ENFORCEMENT_AMOUNT:100}).findings[0].scope,"INFORMATION"));
test("address unreliable is medium credit review",()=>assert.equal(single("RISK-LEGAL-ADDRESS-UNRELIABLE",{LEGAL_ADDRESS_UNRELIABLE:true}).findings[0].severity,"MEDIUM"));
for(const [code,key] of [["RISK-LEGAL-LITIGATION","LEGAL_DEFENDANT_CASES"],["RISK-DATA-BANKRUPTCY-MESSAGES","LEGAL_REGISTRY_REVIEW"],["RISK-LEGAL-INSPECTION-OBSERVATION","LEGAL_VIOLATIONS_REPORTED"]])test(`${code} no universal stop`,()=>assert.notEqual(single(code,{[key]:1}).findings[0].scope,"GLOBAL_STOP"));
for(const [days,severity] of [[1,"MEDIUM"],[29,"MEDIUM"],[30,"HIGH"],[59,"HIGH"],[60,"CRITICAL"],[null,"MEDIUM"]])test(`current overdue days ${days}`,()=>assert.equal(single("RISK-BKI-CURRENT-OVERDUE",{BKI_OVERDUE:10,BKI_HISTORY_DAYS:days},{subjectKey:"loan"}).findings[0].severity,severity));
for(const [days,severity] of [[0,null],[1,"LOW"],[29,"LOW"],[30,"MEDIUM"],[59,"MEDIUM"],[60,"HIGH"]])test(`historical delinquency ${days}`,()=>assert.equal(single("RISK-BKI-HISTORICAL-DELINQUENCY",{BKI_HISTORY_DAYS:days},{subjectKey:"loan"}).findings[0]?.severity??null,severity));
test("explicit zero overdue clears only current rule",()=>assert.equal(single("RISK-BKI-CURRENT-OVERDUE",{BKI_OVERDUE:0},{subjectKey:"loan"}).evaluations[0].status,"NOT_TRIGGERED"));
test("current overdue suppresses same-obligation history, keeps evaluation",()=>{const p=run([F("BKI_OVERDUE",10,{subjectKey:"loan"}),F("BKI_HISTORY_DAYS",60,{subjectKey:"loan"})]);assert.ok(evaluation(p,"RISK-BKI-HISTORICAL-DELINQUENCY").suppressedBy);assert.equal(p.findings.filter(f=>f.domain==="CREDIT_HISTORY").length,1);});
test("repeated loss suppresses current presentation only",()=>{const p=run([F("FIN_ANNUAL_NET_PROFIT",-10),F("FIN_CONSECUTIVE_ANNUAL_LOSSES",2)]);assert.equal(evaluation(p,"RISK-FIN-NET-LOSS-CURRENT").status,"TRIGGERED");assert.ok(evaluation(p,"RISK-FIN-NET-LOSS-CURRENT").suppressedBy);assert.equal(p.findings.filter(f=>f.code.startsWith("RISK-FIN-NET-LOSS")).length,1);});

// Adapters and safety boundaries exercise actual canonical source outputs.
test("bank adapter uses v2 debt ratio instead of legacy metric",()=>{const b=bank();b.debtService.debtServiceToOperatingReceipts.value=.5;const a=analysis({metricsV2:b,metrics:{...base.metrics,debtServiceShare:0}});assert.equal(bankFacts(input(a)).find(f=>f.semanticCode==="BANK_DEBT_SERVICE_RATIO").value,.5);});
for(const status of ["partialMonths","missingMonths","overlapMonths"])test(`${status} prevents bank economic clear`,()=>{const b=bank();b.period[status]=1;const p=run(bankFacts(input(analysis({metricsV2:b}))));assert.equal(evaluation(p,"RISK-CF-DEBT-SERVICE-BURDEN").status,"INSUFFICIENT_DATA");});
test("bank trend canonical PERCENT recognized",()=>{const b=bank();b.operating.operatingReceiptsTrend.value=-30;assert.equal(finding(run(bankFacts(input(analysis({metricsV2:b})))),"RISK-CF-OPERATING-RECEIPTS-DECLINE").severity,"HIGH");});
test("incompatible trend unit not redefined",()=>{const b=bank();b.operating.operatingReceiptsTrend.unit="RATIO";assert.equal(evaluation(run(bankFacts(input(analysis({metricsV2:b})))),"RISK-CF-OPERATING-RECEIPTS-DECLINE").status,"NOT_APPLICABLE");});
test("bank zero denominator UNKNOWN remains insufficient",()=>{const b=bank();b.debtService.debtServiceToOperatingReceipts.value=null;b.debtService.debtServiceToOperatingReceipts.status="UNKNOWN";assert.equal(evaluation(run(bankFacts(input(analysis({metricsV2:b})))),"RISK-CF-DEBT-SERVICE-BURDEN").status,"INSUFFICIENT_DATA");});
test("liquidity denominator from confirmed inclusive reconstruction period",()=>{const b=bank();b.liquidity.lowLiquidityDays.value=37;assert.ok(bankFacts(input(analysis({metricsV2:b}))).find(f=>f.semanticCode==="BANK_LOW_LIQUIDITY_SHARE").value>.2);});
test("liquidity mismatch prevents credit interpretation",()=>{const b=bank();b.liquidity.lowLiquidityDays.warnings=["BALANCE_RECONCILIATION_MISMATCH"];assert.equal(bankFacts(input(analysis({metricsV2:b}))).find(f=>f.semanticCode==="BANK_LOW_LIQUIDITY_SHARE").status,"UNKNOWN");});
test("negative reconstruction days only data review",()=>{const b=bank();b.liquidity.negativeReconstructedBalanceDays.value=4;const f=finding(run(bankFacts(input(analysis({metricsV2:b})))),"RISK-DATA-BALANCE-RECONSTRUCTION");assert.equal(f.scope,"DATA_REVIEW");});
test("bank adapter never reads raw transactions",()=>{const a=analysis({metricsV2:bank()});Object.defineProperty(a,"transactions",{get(){throw Error("raw transaction read")}});assert.ok(bankFacts(input(a)).length);});
test("old bank period not current",()=>{const b=bank();b.period.to="2024-12-31";assert.equal(bankFacts(input(analysis({metricsV2:b}))).find(f=>f.semanticCode==="BANK_DEBT_SERVICE_RATIO").status,"UNKNOWN");});
test("financial adapter uses actual Block 5 ratio",()=>{const a=analysis({financialAnalysisV2:fin()});assert.equal(financialFacts(input(a)).find(f=>f.semanticCode==="FIN_CURRENT_RATIO").value,2);});
test("financial adapter no legacy fallback",()=>{const p=profile({finances:{equity:-999}});assert.equal(financialFacts(input(analysis({financialAnalysisV2:undefined}),p)).find(f=>f.semanticCode==="FIN_EQUITY").status,"UNKNOWN");});
test("annual comparable revenue trend used",()=>{const a=analysis({financialAnalysisV2:fin([snap(2024,{2110:12000}),snap(2025,{2110:9000})])});assert.equal(financialFacts(input(a)).find(f=>f.semanticCode==="FIN_ANNUAL_REVENUE_CHANGE").value,-25);});
test("interim not used as annual revenue growth",()=>{const s=snap(2026,{2110:100},{period:parseFinancialPeriod("за 3 месяца 2026 года")});const a=analysis({financialAnalysisV2:fin([snap(2025),s])});assert.equal(financialFacts(input(a)).find(f=>f.semanticCode==="FIN_ANNUAL_REVENUE_CHANGE").status,"UNKNOWN");});
test("two actual annual losses detected",()=>{const a=analysis({financialAnalysisV2:fin([snap(2024,{2400:-50}),snap(2025,{2400:-100})])});assert.equal(financialFacts(input(a)).find(f=>f.semanticCode==="FIN_CONSECUTIVE_ANNUAL_LOSSES").value,2);});
test("nonconsecutive annual losses not repeated",()=>{const a=analysis({financialAnalysisV2:fin([snap(2023,{2400:-50}),snap(2025,{2400:-100})])});assert.equal(financialFacts(input(a)).find(f=>f.semanticCode==="FIN_CONSECUTIVE_ANNUAL_LOSSES").status,"UNKNOWN");});
test("reported net assets and proxy distinct actual adapter",()=>{const a=analysis({financialAnalysisV2:fin([snap(2025,{1300:-10},{reportedNetAssets:20})])});const facts=financialFacts(input(a));assert.equal(facts.find(f=>f.semanticCode==="FIN_NET_ASSETS_PROXY").origin,"PROXY");assert.equal(facts.find(f=>f.semanticCode==="FIN_REPORTED_NET_ASSETS").origin,"REPORTED");});
test("interest denominator missing respects Block 5",()=>{const a=analysis({financialAnalysisV2:fin([snap(2025,{2330:null})])});assert.equal(financialFacts(input(a)).find(f=>f.semanticCode==="FIN_INTEREST_COVERAGE").value,null);});
test("explicit current legal source permits factual stop",()=>{const p=profile();p.company.status="Ликвидировано";assert.equal(run(legalFacts(input(analysis(),p),[])).summary.globalStopCount,1);});
for(const status of ["FAILED","STALE","EMPTY"])test(`${status} lifecycle source never clear`,()=>{const p=profile();p.sourceManifest.external[0].status=status;assert.equal(run(legalFacts(input(analysis(),p),[])).summary.globalStopStatus,"INSUFFICIENT_DATA");});
test("old profile lifecycle cannot block",()=>{const p=profile({fetchedAt:"2024-01-01"});p.company.status="Ликвидировано";assert.equal(run(legalFacts(input(analysis(),p),[])).summary.globalStopCount,0);});
test("bankruptcy count alone only data review",()=>{const p=profile({legal:{bankruptcyMessages:5},registryMessages:undefined});const r=run(legalFacts(input(analysis(),p),[]));assert.equal(r.summary.globalStopCount,0);assert.equal(finding(r,"RISK-DATA-BANKRUPTCY-MESSAGES").scope,"DATA_REVIEW");});
test("legal adapter never consumes legacy signals",()=>{const p=profile();Object.defineProperty(p,"signals",{get(){throw Error("signals read")}});assert.ok(legalFacts(input(analysis(),p),[]).length);});
test("enforcement excludes inactive history",()=>{const p=profile({enforcementItems:[{number:"1",date:"2026-06-01",active:false,amount:100000},{number:"2",date:"2026-06-01",active:true,amount:500}]});assert.equal(legalFacts(input(analysis(),p),[]).find(f=>f.semanticCode==="LEGAL_ACTIVE_ENFORCEMENT_AMOUNT").value,500);});
test("unknown active enforcement amount no fake total",()=>{const p=profile({enforcementItems:[{number:"1",date:"2026-06-01",active:true,amount:null}]});assert.equal(legalFacts(input(analysis(),p),[]).find(f=>f.semanticCode==="LEGAL_ACTIVE_ENFORCEMENT_AMOUNT").value,null);});
test("claim count not confirmed liability",()=>{const p=profile({legalCaseItems:[{number:"1",date:"2026-01-01",role:"DEFENDANT",amount:5000000}]});const r=run(legalFacts(input(analysis(),p),[]));assert.equal(finding(r,"RISK-LEGAL-LITIGATION").scope,"INFORMATION");});
test("inspection count alone not adverse",()=>{const p=profile({legal:{inspections:100},inspectionItems:[]});assert.equal(run(legalFacts(input(analysis(),p),[])).findings.length,0);});
for(const relation of ["Собственник","Директор","Поручитель"])test(`personal BKI ${relation} excluded`,()=>{const a=analysis({creditHistory:bki({relationshipToCompany:relation,subjectInn:"770123456789",affectsCompanyDebt:false}),sourceManifest:{bankStatements:[],bki:source("BKI")}});assert.equal(run(bkiFacts(input(a))).summary.creditRiskCount,0);});
test("company BKI overdue supported through existing adapter",()=>{const a=analysis({creditHistory:bki(),sourceManifest:{bankStatements:[],bki:source("BKI")}});assert.equal(finding(run(bkiFacts(input(a))),"RISK-BKI-CURRENT-OVERDUE").severity,"CRITICAL");});
test("legacy unconfirmed BKI zero not known",()=>{const a=analysis({creditHistory:bki({obligations:[obligation({overdueAmount:0})]}),sourceManifest:{bankStatements:[],bki:source("BKI")}});assert.equal(bkiFacts(input(a)).find(f=>f.semanticCode==="BKI_OVERDUE").status,"UNKNOWN");});
test("old BKI not current overdue",()=>{const a=analysis({creditHistory:bki({reportDate:"2024-01-01"}),sourceManifest:{bankStatements:[],bki:source("BKI")}});assert.equal(evaluation(run(bkiFacts(input(a))),"RISK-BKI-CURRENT-OVERDUE").status,"INSUFFICIENT_DATA");});
for(const role of ["Поручитель","Гарант"])test(`company ${role} no borrower BKI risk`,()=>{const a=analysis({creditHistory:bki({obligations:[obligation({role})]}),sourceManifest:{bankStatements:[],bki:source("BKI")}});assert.equal(bkiFacts(input(a)).length,0);});
for(const [key,n,code] of [["PORTFOLIO_UNRESOLVED",1,"RISK-DATA-PORTFOLIO-OBLIGATION-UNRESOLVED"],["PORTFOLIO_UNKNOWN_FUNDED",1,"RISK-DATA-PORTFOLIO-OUTSTANDING-UNKNOWN"],["PORTFOLIO_CONFLICTS",1,"RISK-DATA-PORTFOLIO-CONFLICT"],["PORTFOLIO_NEW",1,"RISK-DATA-NEW-OBLIGATION-DETECTED"],["PORTFOLIO_UNMATCHED",1,"RISK-DATA-DEBT-PAYMENT-UNMATCHED"],["PORTFOLIO_UNSPLIT",1,"RISK-DATA-UNSPLIT-DEBT-SERVICE"]])test(`${code} data only`,()=>assert.equal(single(code,{[key]:n}).findings[0].scope,"DATA_REVIEW"));
test("actual unknown funded portfolio principal data review",()=>{const p=portfolio([obligation({outstandingPrincipal:null})]);assert.equal(portfolioFacts(input(analysis({creditPortfolioV1:p}))).find(f=>f.semanticCode==="PORTFOLIO_UNKNOWN_FUNDED").value,1);});
for(const product of ["Банковская гарантия","Лизинг","Факторинг"])test(`${product} excluded from unknown funded count`,()=>{const p=portfolio([obligation({product,outstandingPrincipal:null})]);assert.equal(portfolioFacts(input(analysis({creditPortfolioV1:p}))).find(f=>f.semanticCode==="PORTFOLIO_UNKNOWN_FUNDED").value,0);});
test("guarantorship remains contingent in risk facts",()=>{const p=portfolio([obligation({role:"Поручитель",guaranteeAmount:100000})]);assert.equal(portfolioFacts(input(analysis({creditPortfolioV1:p}))).filter(f=>f.semanticCode==="PORTFOLIO_FUNDED_PRINCIPAL").length,0);});
test("portfolio asOf mismatch not current knowledge",()=>{const p=portfolio();p.asOfDate="2025-12-31";assert.equal(portfolioFacts(input(analysis({creditPortfolioV1:p}))).find(f=>f.semanticCode==="PORTFOLIO_UNKNOWN_FUNDED").status,"UNKNOWN");});
const reconFinding=(nature,outcome,extra={})=>({findingId:id("recon",nature,outcome),nature,outcome,requiresDataReview:outcome==="CONFLICT",leftFacts:[{sourceType:"BFO",sourceIds:["bfo"]}],rightFacts:[{sourceType:"QUARTERLY",sourceIds:["q"]}],evidenceConfidence:"HIGH",calculationBasis:"canonical fixture",reasonCodes:[],...extra});
for(const [nature,outcome,expected] of [["IDENTITY","CONFLICT","CRITICAL"],["SAME_FACT","CONFLICT","HIGH"],["SAME_FACT","WITHIN_TOLERANCE",null],["SAME_FACT","AGREES",null],["CASH_VS_ACCRUAL","RELATIONSHIP_OBSERVED",null],["STOCK_VS_STOCK","RELATIONSHIP_OBSERVED",null]])test(`reconciliation ${nature}/${outcome}`,()=>{const a=analysis({reconciliationV1:{companyInn:inn,findings:[reconFinding(nature,outcome)]}});const p=run(reconciliationFacts(input(a)));assert.equal(p.findings[0]?.severity??null,expected);if(expected)assert.equal(p.findings[0].scope,"DATA_REVIEW");});
for(const [family,field] of [["BKI","bki"],["BFO","bfo"],["QUARTERLY","quarterly"]])test(`missing ${family} not credit risk`,()=>{const a=analysis();delete a.sourceManifest[field];const p=run(integrityFacts(input(a)));assert.equal(p.summary.creditRiskCount,0);assert.ok(finding(p,"RISK-DATA-SOURCE-MISSING"));});
for(const status of ["STALE","FAILED"])test(`${status} source recorded separately`,()=>{const a=analysis({sourceManifest:{bankStatements:[source("BANK_STATEMENT",{status})]}});assert.equal(integrityFacts(input(a)).find(f=>f.semanticCode===`SOURCE_${status}_COUNT`).value,1);});
for(const [field,n,reason] of [["partialMonths",1,"PARTIAL_BANK_MONTH"],["missingMonths",1,"MISSING_BANK_MONTH"],["overlapMonths",1,"OVERLAP_BANK_MONTH"]])test(`coverage observation ${field}`,()=>{const b=bank();b.period[field]=n;assert.ok(finding(run(integrityFacts(input(analysis({metricsV2:b})))),"RISK-DATA-BANK-COVERAGE").reasonCodes.includes(reason));});
for(const [key,value] of [["COMPANY_AGE_MONTHS",3],["COMPANY_AGE_MONTHS",9],["OKVED","64.9"],["REGION","X"],["CITIZENSHIP","X"],["SHAREHOLDER_NATIONALITY","X"],["BKI_SCORE",1],["BKI_INQUIRIES",100],["BKI_SELF_BAN",true],["PORTFOLIO_ANNUAL_RATE",100],["PORTFOLIO_AVAILABLE_LIMIT",1000000],["PORTFOLIO_MATURITY","2026-07-01"],["FIN_ANNUAL_REVENUE",1]])test(`${key} no invented bank policy or product rule`,()=>assert.equal(run([F(key,value)]).findings.length,0));
test("no BANK_POLICY scope or score output",()=>{const p=run([F("FIN_EQUITY",-100)]);assert.equal(p.findings.some(f=>f.scope==="BANK_POLICY"),false);for(const key of ["score","riskScore","pd","penalty","recommendations"])assert.equal(key in p,false);});
test("suppression does not cross bureau obligations",()=>{const p=run([F("BKI_OVERDUE",10,{subjectKey:"a"}),F("BKI_HISTORY_DAYS",60,{subjectKey:"a"}),F("BKI_OVERDUE",0,{subjectKey:"b"}),F("BKI_HISTORY_DAYS",60,{subjectKey:"b"})]);assert.equal(p.findings.filter(f=>f.domain==="CREDIT_HISTORY").length,2);});
test("stable finding order and IDs across input reorder",()=>{const facts=[F("FIN_EQUITY",-1),F("LEGAL_LIFECYCLE","TERMINATED"),F("SOURCE_FAILED_COUNT",1)];assert.deepEqual(run(facts),run([...facts].reverse()));});
test("one severity band per rule",()=>assert.equal(single("RISK-CF-DEBT-SERVICE-BURDEN",{BANK_DEBT_SERVICE_RATIO:.6,BANK_COVERAGE_ADEQUATE:true}).findings.length,1));
test("FREE projection unchanged with full risk details",()=>{const a=analysis();const before=analysisView(a,"FREE");const fields=buildRiskShadow(input(a));assert.deepEqual(analysisView({...a,...fields},"FREE"),before);});
test("FULL retains risk assessment and storage JSON",()=>{const a=analysis();const fields=buildRiskShadow(input(a));assert.ok(fields.riskAssessmentV1);assert.deepEqual(analysisView({...a,...fields},"FULL").riskAssessmentV1,fields.riskAssessmentV1);assert.ok(analysisForStorage({...a,...fields}).riskAssessmentV1);});
test("old analysis without optional risk loads",()=>{const a=analysis();delete a.riskAssessmentV1;delete a.riskComparison;delete a.riskEngineWarnings;assert.equal(analysisView(a,"FULL").score,872);});
test("shadow adapter failure isolated",()=>{const a=analysis(),before=structuredClone(a);const r=buildRiskShadow(input(a),{adapt(){throw Error("adapter failure")}});assert.equal(r.riskAssessmentV1,undefined);assert.deepEqual(r.riskEngineWarnings,["RISK_ENGINE_SHADOW_UNAVAILABLE"]);assert.deepEqual(a,before);});
test("shadow rule failure isolated",()=>{const a=analysis();const rules=[{...RISK_RULE_REGISTRY[0],evaluate(){throw Error("rule failure")}}];assert.equal(buildRiskShadow(input(a),{rules}).riskAssessmentV1,undefined);});
test("invalid asOf fails shadow safely",()=>assert.deepEqual(buildRiskShadow({...input(),asOfDate:"invalid"}).riskEngineWarnings,["RISK_ENGINE_SHADOW_UNAVAILABLE"]));
test("authoritative parity 872 A readiness limits",()=>{const a=analysis(),r={...a,...buildRiskShadow(input(a))};assert.equal(r.score,872);assert.equal(r.grade,"A");assert.equal(r.readiness,"Высокая готовность");assert.equal(r.metrics.estimatedLimitMin,1283000);assert.equal(r.metrics.estimatedLimitMax,2636000);assert.deepEqual(r.reconciliationV1,a.reconciliationV1);assert.deepEqual(r.creditPortfolioV1,a.creditPortfolioV1);assert.deepEqual(r.factors,a.factors);});
test("risk adaptation and evaluation do not mutate analysis/profile",()=>{const a=analysis({financialAnalysisV2:fin()}),p=profile(),before=structuredClone({a,p});buildRiskShadow(input(a,p));assert.deepEqual({a,p},before);});
test("low evidence confidence cannot be promoted in fact",()=>{const evidence=F("X",1,{confidence:"LOW"}).evidence;assert.equal(F("Y",1,{confidence:"HIGH",evidence}).confidence,"LOW");});
test("all numeric economic thresholds expose methodology",()=>{for(const r of RISK_RULE_REGISTRY.filter(r=>r.calibrationClass==="PRE_CREDIT_LAB")){assert.ok(r.thresholds.length);for(const t of r.thresholds)assert.ok(t.methodology);}});
test("core deterministic without machine clock",()=>{const old=Date.now;Date.now=()=>{throw Error("clock")};try{assert.deepEqual(run([F("FIN_EQUITY",-1)]),run([F("FIN_EQUITY",-1)]));}finally{Date.now=old;}});

test("direct low-confidence evidence cannot create global stop",()=>{const f=F("LEGAL_LIFECYCLE","TERMINATED");f.evidence[0].confidence="LOW";assert.equal(run([f]).summary.globalStopCount,0);assert.equal(run([f]).summary.globalStopStatus,"INSUFFICIENT_DATA");});
test("incompatible canonical unit never compares ratio to percent",()=>{const f=F("BANK_DEBT_SERVICE_RATIO",50,{unit:"PERCENT"});const r=run([f,F("BANK_COVERAGE_ADEQUATE",true)]);assert.equal(evaluation(r,"RISK-CF-DEBT-SERVICE-BURDEN").status,"INSUFFICIENT_DATA");});
test("measured partial identity coverage at 80 percent supports adverse concentration",()=>{const b=bank();b.customers.directCustomerIdentityCoverage.status="PARTIAL";b.customers.directCustomerIdentityCoverage.value=.8;b.customers.directCustomerTop1.status="PARTIAL";b.customers.directCustomerTop1.value=.5;assert.equal(finding(run(bankFacts(input(analysis({metricsV2:b})))),"RISK-CF-CUSTOMER-CONCENTRATION").severity,"HIGH");});
test("partial Top1 below threshold cannot clear concentration",()=>{const b=bank();b.customers.directCustomerTop1.status="PARTIAL";b.customers.directCustomerTop1.value=.2;assert.equal(evaluation(run(bankFacts(input(analysis({metricsV2:b})))),"RISK-CF-CUSTOMER-CONCENTRATION").status,"INSUFFICIENT_DATA");});
test("historical annual profit evidence keeps its actual amount",()=>{const fs=financialFacts(input(analysis({financialAnalysisV2:fin([snap(2024,{2400:-50}),snap(2025,{2400:-100})])})));const f=fs.find(f=>f.semanticCode==="FIN_PRIOR_ANNUAL_NET_PROFIT");assert.equal(f.evidence[0].value,-50);assert.equal(f.status,"KNOWN");});
test("conflicting same-period financial sources are retained not selected silently",()=>{const a=analysis({financialAnalysisV2:fin([snap(2025,{1300:5000})])});const p=profile({financialAnalysisV2:fin([snap(2025,{1300:-5000},{source:source("BFO",{sourceId:"bfo:other"})})])});const f=financialFacts(input(a,p)).find(f=>f.semanticCode==="FIN_EQUITY");assert.equal(f.status,"UNKNOWN");assert.ok(f.warnings.includes("DATA_CONFLICT"));assert.deepEqual(new Set(f.evidence.map(e=>e.value)),new Set([5000,-5000]));});
test("future active enforcement cannot produce known zero",()=>{const p=profile({enforcementItems:[{number:"future",date:"2027-01-01",active:true,amount:1000}]});assert.equal(legalFacts(input(analysis(),p),[]).find(f=>f.semanticCode==="LEGAL_ACTIVE_ENFORCEMENT_AMOUNT").status,"UNKNOWN");});
test("bankruptcy aggregate with empty detail is still review evidence",()=>{const p=profile({legal:{bankruptcyMessages:5},registryMessages:[]});const r=run(legalFacts(input(analysis(),p),[]));assert.equal(r.summary.globalStopCount,0);assert.ok(finding(r,"RISK-DATA-BANKRUPTCY-MESSAGES"));});
test("portfolio fact evidence refers to the actual value source",()=>{const p=portfolio();const o=p.obligations[0];const f=portfolioFacts(input(analysis({creditPortfolioV1:p}))).find(f=>f.semanticCode==="PORTFOLIO_FUNDED_PRINCIPAL");assert.equal(f.evidence[0].portfolioObligationId,o.obligationId);assert.equal(f.evidence[0].sourceId,o.currentPosition.principalOutstanding.evidence[0].sourceId);});
test("summary function reproduces engine output",()=>{const p=run([F("FIN_EQUITY",-1)]);assert.deepEqual(summarizeRiskAssessment(p.facts,p.evaluations,p.findings),p.summary);});

test("representative 1000-company performance: adaptation, registry, summary",t=>{
 const rows=Array.from({length:12},(_,i)=>obligation({id:`sb-${i+1}`,accountNumber:`ACC-${i+1}`,originalAmount:6000000+i*10000}));
 const a=analysis({metricsV2:bank(),financialAnalysisV2:fin([snap(2023),snap(2024),snap(2025)]),creditHistory:bki({obligations:rows}),creditPortfolioV1:portfolio(rows),sourceManifest:{bankStatements:[source()],bki:source("BKI"),bfo:source("BFO")},reconciliationV1:{companyInn:inn,findings:Array.from({length:20},(_,i)=>reconFinding("SAME_FACT",i%2?"AGREES":"CONFLICT",{findingId:`recon:${i}`}))}});
 const p=profile();let adaptation=0,evaluationMs=0,summaryMs=0,totalFacts=0,totalEvaluations=0,minFacts=Infinity,maxFacts=0;
 for(let i=0;i<1000;i++){
  const companyInn=String(7701000000+i);const aa=structuredClone(a),pp=structuredClone(p);
  aa.companyInn=companyInn;aa.creditHistory.subjectInn=companyInn;aa.creditPortfolioV1.companyInn=companyInn;aa.creditPortfolioV1.portfolioId=`portfolio:${companyInn}`;aa.reconciliationV1.companyInn=companyInn;pp.inn=companyInn;
  for(const o of aa.creditPortfolioV1.obligations)o.companyInn=companyInn;
  for(const s of [...aa.sourceManifest.bankStatements,aa.sourceManifest.bki,aa.sourceManifest.bfo,...pp.sourceManifest.external])s.companyInn=companyInn;
  for(const h of aa.financialAnalysisV2.history){h.snapshot.companyInn=companyInn;h.snapshot.source.companyInn=companyInn;}
  const start=performance.now(),facts=adaptRiskFacts({analysis:aa,companyProfile:pp,asOfDate:date}),adapted=performance.now();
  const risk=evaluateRiskFacts({companyInn,asOfDate:date,facts}),evaluated=performance.now();
  const summary=summarizeRiskAssessment(risk.facts,risk.evaluations,risk.findings),summarized=performance.now();
  adaptation+=adapted-start;evaluationMs+=evaluated-adapted;summaryMs+=summarized-evaluated;totalFacts+=facts.length;totalEvaluations+=risk.evaluations.length;minFacts=Math.min(minFacts,facts.length);maxFacts=Math.max(maxFacts,facts.length);
  assert.equal(summary.evaluatedRuleCount,risk.evaluations.length);assert.equal(risk.companyInn,companyInn);assert.ok(facts.length>=80&&facts.length<=150);
 }
 t.diagnostic(JSON.stringify({companies:1000,obligationsPerCompany:12,financialPeriods:3,reconciliationFindings:20,minFacts,maxFacts,totalFacts,totalEvaluations,adaptationMs:Number(adaptation.toFixed(2)),evaluationIncludingSummaryMs:Number(evaluationMs.toFixed(2)),standaloneSummaryMs:Number(summaryMs.toFixed(2))}));
});

test("wrong scalar type does not clear boolean rule",()=>assert.equal(single("RISK-LEGAL-ADDRESS-UNRELIABLE",{LEGAL_ADDRESS_UNRELIABLE:"false"},{unit:"BOOLEAN"}).evaluations[0].status,"INSUFFICIENT_DATA"));
test("missing compact payment observations do not become known zero",()=>{const p=portfolio();p.warnings.push("PAYMENT_OBSERVATIONS_UNAVAILABLE");const fs=portfolioFacts(input(analysis({creditPortfolioV1:p})));assert.equal(fs.find(f=>f.semanticCode==="PORTFOLIO_UNSPLIT").status,"UNKNOWN");assert.equal(fs.find(f=>f.semanticCode==="PORTFOLIO_UNMATCHED").status,"UNKNOWN");});

// Final correction review: preserve reconciliation confidence and historical BKI semantics.
for(const [nature,code,ruleCode] of [["IDENTITY","RECON_IDENTITY_CONFLICTS","RISK-DATA-COMPANY-IDENTITY-CONFLICT"],["SAME_FACT","RECON_SAME_FACT_CONFLICTS","RISK-DATA-FINANCIAL-SAME-FACT-CONFLICT"]]){
 for(const confidence of ["HIGH","MEDIUM","LOW"]){
  test(`${nature} reconciliation ${confidence} propagates to fact, evidence and rule`,()=>{
   const a=analysis({reconciliationV1:{companyInn:inn,findings:[reconFinding(nature,"CONFLICT",{evidenceConfidence:confidence})]}});
   const facts=reconciliationFacts(input(a)),f=facts.find(f=>f.semanticCode===code),r=run(facts);
   assert.equal(f.confidence,confidence);assert.equal(f.evidence[0].confidence,confidence);
   assert.equal(evaluation(r,ruleCode).status,confidence==="LOW"?"INSUFFICIENT_DATA":"TRIGGERED");
   if(confidence!=="LOW")assert.equal(finding(r,ruleCode).evidenceConfidence,confidence);
  });
 }
 test(`${nature} mixed HIGH MEDIUM aggregate uses weakest confidence`,()=>{
  const findings=[reconFinding(nature,"CONFLICT",{findingId:"high",evidenceConfidence:"HIGH"}),reconFinding(nature,"CONFLICT",{findingId:"medium",evidenceConfidence:"MEDIUM"})];
  const f=reconciliationFacts(input(analysis({reconciliationV1:{companyInn:inn,findings}}))).find(f=>f.semanticCode===code);
  assert.equal(f.value,2);assert.equal(f.confidence,"MEDIUM");assert.deepEqual(f.evidence.map(e=>e.confidence),["HIGH","MEDIUM"]);
 });
}
const bureauReviewInput=(report={},envelope={})=>input(analysis({creditHistory:bki(report),sourceManifest:{bankStatements:[],bki:source("BKI",envelope)}}));
test("fresh actual BKI retains current overdue and same-obligation suppression",()=>{
 const fs=bkiFacts(bureauReviewInput()),r=run(fs);assert.equal(fs.find(f=>f.semanticCode==="BKI_OVERDUE").status,"KNOWN");
 assert.equal(finding(r,"RISK-BKI-CURRENT-OVERDUE").severity,"CRITICAL");assert.ok(evaluation(r,"RISK-BKI-HISTORICAL-DELINQUENCY").suppressedBy);
 assert.match(fs.find(f=>f.semanticCode==="BKI_HISTORY_DAYS").calculationBasis,/historical maximum/);
});
test("old READY bureau preserves historical sixty-day evidence, not current overdue",()=>{
 const i=bureauReviewInput({reportDate:"2024-01-01"}),fs=bkiFacts(i),h=fs.find(f=>f.semanticCode==="BKI_HISTORY_DAYS"),current=fs.find(f=>f.semanticCode==="BKI_OVERDUE"),r=run(fs);
 assert.equal(current.status,"UNKNOWN");assert.equal(current.value,null);assert.equal(finding(r,"RISK-BKI-CURRENT-OVERDUE"),undefined);
 assert.equal(h.status,"KNOWN");assert.equal(h.value,60);assert.equal(h.confidence,"MEDIUM");assert.equal(h.evidence[0].confidence,"MEDIUM");assert.equal(h.period.asOf,"2024-01-01");assert.equal(h.evidence[0].asOf,"2024-01-01");assert.ok(h.warnings.includes("HISTORICAL_BKI_SOURCE_STALE"));
 assert.equal(finding(r,"RISK-BKI-HISTORICAL-DELINQUENCY").evidenceConfidence,"MEDIUM");assert.equal(evaluation(r,"RISK-BKI-HISTORICAL-DELINQUENCY").suppressedBy,undefined);
 assert.equal(finding(run(integrityFacts(i)),"RISK-DATA-SOURCE-STALE").scope,"DATA_REVIEW");
});
test("explicit STALE bureau retains existing LOW confidence without promotion",()=>{
 const fs=bkiFacts(bureauReviewInput({reportDate:"2024-01-01"},{status:"STALE"})),h=fs.find(f=>f.semanticCode==="BKI_HISTORY_DAYS");assert.equal(h.status,"KNOWN");assert.equal(h.confidence,"LOW");assert.equal(h.evidence[0].confidence,"LOW");assert.ok(h.warnings.includes("HISTORICAL_BKI_SOURCE_STALE"));assert.equal(evaluation(run(fs),"RISK-BKI-HISTORICAL-DELINQUENCY").status,"INSUFFICIENT_DATA");
});
for(const historical of [null,0])test(`old BKI historical ${historical} does not invent knowledge`,()=>{
 const fs=bkiFacts(bureauReviewInput({reportDate:"2024-01-01",obligations:[obligation({maxDelinquencyDays:historical,overdueAmount:0})]}));
 assert.equal(fs.find(f=>f.semanticCode==="BKI_HISTORY_DAYS").status,"UNKNOWN");assert.equal(fs.find(f=>f.semanticCode==="BKI_OVERDUE").status,"UNKNOWN");assert.equal(run(fs).summary.creditRiskCount,0);
});
for(const status of ["FAILED","EMPTY","NOT_REQUESTED"])test(`${status} BKI cannot establish historical borrower risk`,()=>{
 const fs=bkiFacts(bureauReviewInput({reportDate:"2024-01-01"},{status}));assert.equal(fs.find(f=>f.semanticCode==="BKI_HISTORY_DAYS").status,"UNKNOWN");assert.equal(run(fs).summary.creditRiskCount,0);
});
for(const reportDate of ["invalid","2026-02-30","2027-01-01"])test(`invalid/future BKI date ${reportDate} cannot establish history`,()=>{
 const fs=bkiFacts(bureauReviewInput({reportDate}));assert.equal(fs.find(f=>f.semanticCode==="BKI_HISTORY_DAYS").status,"UNKNOWN");assert.equal(run(fs).summary.creditRiskCount,0);
});
for(const [report,envelope] of [[{subjectInn:"7701999999"},{}],[{relationshipToCompany:"Собственник",affectsCompanyDebt:false},{}],[{},{companyInn:"7701999999"}]])test(`old BKI wrong scope ${JSON.stringify({report,envelope})} excludes borrower history`,()=>{
 const fs=bkiFacts(bureauReviewInput({reportDate:"2024-01-01",...report},envelope));assert.equal(fs.some(f=>f.semanticCode==="BKI_HISTORY_DAYS"),false);assert.equal(run(fs).summary.creditRiskCount,0);
});
for(const [reportDate,current] of [["2026-04-01",true],["2026-03-31",false]])test(`90-day BKI applicability boundary ${reportDate}`,()=>{
 const fs=bkiFacts(bureauReviewInput({reportDate}));assert.equal(fs.find(f=>f.semanticCode==="BKI_OVERDUE").status,current?"KNOWN":"UNKNOWN");assert.equal(fs.find(f=>f.semanticCode==="BKI_HISTORY_DAYS").confidence,current?"HIGH":"MEDIUM");
});

// Targeted hotfix: a confirmed historical zero is not a 1–29 day delinquency.
for(const [days,severity,historyReason] of [[0,"MEDIUM",null],[null,"MEDIUM",null],[1,"MEDIUM","DELINQUENCY_1_29"],[29,"MEDIUM","DELINQUENCY_1_29"],[30,"HIGH","DELINQUENCY_30_59"],[59,"HIGH","DELINQUENCY_30_59"],[60,"CRITICAL","DELINQUENCY_60_PLUS"]]){
 test(`BKI reason hotfix: overdue 1000, history ${days}`,()=>{
  const r=run([F("BKI_OVERDUE",1000,{subjectKey:"hotfix-loan"}),F("BKI_HISTORY_DAYS",days,{subjectKey:"hotfix-loan"})]);
  const current=finding(r,"RISK-BKI-CURRENT-OVERDUE");
  assert.equal(evaluation(r,"RISK-BKI-CURRENT-OVERDUE").status,"TRIGGERED");assert.equal(current.scope,"CREDIT_RISK");assert.equal(current.severity,severity);
  assert.deepEqual(current.reasonCodes.filter(code=>code!=="PRE_CREDIT_LAB_THRESHOLD").sort(),["CURRENT_OVERDUE",...(historyReason?[historyReason]:[])].sort());
  assert.equal(r.findings.some(f=>f.scope==="DATA_REVIEW"),false);
  if(days===0)assert.equal(evaluation(r,"RISK-BKI-HISTORICAL-DELINQUENCY").status,"NOT_TRIGGERED");
 });
}
test("BKI reason hotfix: both confirmed zeros do not trigger either rule",()=>{
 const r=run([F("BKI_OVERDUE",0,{subjectKey:"hotfix-loan"}),F("BKI_HISTORY_DAYS",0,{subjectKey:"hotfix-loan"})]);
 for(const code of ["RISK-BKI-CURRENT-OVERDUE","RISK-BKI-HISTORICAL-DELINQUENCY"])assert.equal(evaluation(r,code).status,"NOT_TRIGGERED");
 assert.equal(r.findings.length,0);
});
test("BKI reason hotfix: historical suppression retains audit and severity",()=>{
 const fs=[F("BKI_OVERDUE",1000,{subjectKey:"hotfix-loan"}),F("BKI_HISTORY_DAYS",60,{subjectKey:"hotfix-loan"})],r=run(fs);
 const current=finding(r,"RISK-BKI-CURRENT-OVERDUE"),history=evaluation(r,"RISK-BKI-HISTORICAL-DELINQUENCY");
 assert.equal(current.severity,"CRITICAL");assert.equal(history.status,"TRIGGERED");assert.equal(history.suppressedBy,current.findingId);assert.equal(finding(r,"RISK-BKI-HISTORICAL-DELINQUENCY"),undefined);
 const separate=run(fs,RISK_RULE_REGISTRY.filter(rule=>rule.code==="RISK-BKI-HISTORICAL-DELINQUENCY"));assert.equal(separate.findings[0].severity,"HIGH");assert.equal(separate.findings[0].scope,"CREDIT_RISK");
});
