import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {CONTEXT_ENGINE_VERSION,CONTEXT_RULES_VERSION,CONTEXT_METHODOLOGY,FINANCING_PURPOSES,REQUESTED_PRODUCTS,CASE_URGENCIES} from '../lib/credit-engine/contracts/context.ts';
import {buildContextAssessment,evaluateContextRules,constructContextRelations,summarizeContext} from '../lib/credit-engine/context/engine.ts';
import {buildContextShadow} from '../lib/credit-engine/context/integration.ts';
import {adaptContextFacts} from '../lib/credit-engine/context/facts.ts';
import {normalizeFinancingCase,normalizeContract} from '../lib/credit-engine/context/case.ts';
import {contextFact,rank,weakest,stable} from '../lib/credit-engine/context/common.ts';
import {CONTEXT_RULE_REGISTRY} from '../lib/credit-engine/context/rules/registry.ts';
import {loadContextGoldenPack} from './fixtures/context/golden-context-pack-v1.mjs';
import {checkContextCase,runContextPack,} from './fixtures/context/lab.mjs';
import {input,material,financingCase,field,date,inn,activeContract,bkiFactsInput} from './fixtures/context/builders.mjs';
import {loadGoldenPack} from './fixtures/credit-lab/golden-pack-v0.mjs';
import {runCreditLabPack} from '../lib/credit-engine/credit-lab/runner.ts';
import {analyzeBankStatement} from '../lib/prescore.ts';
import {block2StatementFixture} from './fixtures/block2-statements.mjs';
import {analysisView} from '../lib/entitlements.ts';
const pack=loadContextGoldenPack(),golden=runContextPack(pack),entry=n=>structuredClone(pack.entries.find(e=>e.caseId===`CTX-RU-${String(n).padStart(3,'0')}`));
const ctx=n=>buildContextAssessment(entry(n).input),find=(c,code)=>c.facts.find(f=>f.semanticCode===code);
for(const e of pack.entries){
 test(`Context Golden ${e.caseId}: ${e.title}`,()=>{const r=golden.find(r=>r.caseId===e.caseId);assert.equal(r.result,'PASS',JSON.stringify(r.mismatches));});
 test(`${e.caseId} risk immutable and semantic order stable`,()=>{const x=structuredClone(e.input),before=structuredClone(x),first=buildContextAssessment(x);assert.deepEqual(x,before);x.riskAssessment.facts.reverse();x.riskAssessment.findings.reverse();for(const f of x.riskAssessment.facts){f.evidence.reverse();f.sourceIds.reverse();}assert.deepEqual(buildContextAssessment(x),first);});
}
for(const rule of CONTEXT_RULE_REGISTRY){
 test(`${rule.code} absent required inputs cannot support relation`,()=>{const targets=rule.targetRiskCodes.map(code=>({code,findingId:code}));const es=evaluateContextRules([],targets,[rule]);assert.equal(es[0].status,'INSUFFICIENT_DATA');assert.deepEqual(constructContextRelations(es,[],targets,[rule]),[]);});
 test(`${rule.code} UNKNOWN inputs never become factual support`,()=>{const fs=rule.requiredInputs.map(code=>contextFact(inn,code,rule.domain,null,{subjectKey:'test'}));const targets=rule.targetRiskCodes.map(code=>({code,findingId:code}));assert.ok(evaluateContextRules(fs,targets,[rule]).every(e=>e.status==='INSUFFICIENT_DATA'));});
}
test('Context versions and meaningful registry unique',()=>{const c=ctx(1);assert.equal(c.version,CONTEXT_ENGINE_VERSION);assert.equal(c.ruleRegistryVersion,CONTEXT_RULES_VERSION);assert.equal(c.methodology,CONTEXT_METHODOLOGY);assert.equal(c.mode,'SHADOW');assert.equal(new Set(CONTEXT_RULE_REGISTRY.map(r=>r.code)).size,CONTEXT_RULE_REGISTRY.length);assert.ok(CONTEXT_RULE_REGISTRY.length>=25&&CONTEXT_RULE_REGISTRY.length<=40);});
for(const [key,values]of [['financingPurpose',FINANCING_PURPOSES],['requestedProduct',REQUESTED_PRODUCTS],['urgency',CASE_URGENCIES]])for(const value of values)test(`case enum ${key} ${value}`,()=>{const c=financingCase({[key]:field(value)});assert.equal(normalizeFinancingCase(c,inn,date)[key].value,value);});
for(const [key,values]of [['requestedAmount',[-1,NaN,Infinity,-Infinity,'1000',{}]],['requestedTermMonths',[-1,.5,NaN,Infinity,'12',{}]]])for(const [i,value]of values.entries())test(`case rejects invalid ${key} sample ${i}`,()=>assert.throws(()=>normalizeFinancingCase(financingCase({[key]:field(value)}),inn,date),/CONTEXT_CASE_NUMBER_INVALID/));
for(const key of ['financingPurpose','requestedProduct','urgency'])test(`unknown enum ${key} rejected`,()=>assert.throws(()=>normalizeFinancingCase(financingCase({[key]:field('INVALID')}),inn,date)));
for(const source of ['CLIENT_DECLARED','CANONICAL_OBSERVED','DOCUMENT_REPORTED','DERIVED_RELATIONSHIP'])test(`case input provenance ${source} cannot self-confirm`,()=>{const x=input(material(),financingCase({clientExplanation:field('Сезонность',{source,confidence:'HIGH'})}));const f=find(buildContextAssessment(x),'CASE_clientExplanation');assert.equal(f.sourceClass,'CLIENT_DECLARED');assert.equal(f.confidence,'MEDIUM');});
for(const status of ['UNKNOWN','NOT_APPLICABLE'])test(`case ${status} never retains amount`,()=>{const c=normalizeFinancingCase(financingCase({requestedAmount:field(1000,{status})}),inn,date);assert.equal(c.requestedAmount.value,null);});
test('explicit zero requested amount remains zero',()=>assert.equal(normalizeFinancingCase(financingCase({requestedAmount:field(0)}),inn,date).requestedAmount.value,0));
test('case normalizer pure',()=>{const c=financingCase(),before=structuredClone(c);normalizeFinancingCase(c,inn,date);assert.deepEqual(c,before);});
for(const [label,change]of [
 ['missing risk',x=>delete x.riskAssessment],['wrong risk company',x=>x.riskAssessment.companyInn='9900000002'],['wrong risk cutoff',x=>x.riskAssessment.asOfDate='2026-05-31'],['wrong profile company',x=>x.companyProfile.inn='9900000002'],['invalid cutoff',x=>x.asOfDate='2026-02-30'],['malformed findings',x=>x.riskAssessment.findings=null],['invalid risk version',x=>x.riskAssessment.version='NEW'],['duplicate fact',x=>x.riskAssessment.facts.push(x.riskAssessment.facts[0])],['malformed fact evidence',x=>x.riskAssessment.facts[0].evidence=null],['wrong fact company',x=>x.riskAssessment.facts[0].companyInn='9900000002']
])test(`integration rejects ${label}`,()=>{const x=input();change(x);const r=buildContextShadow(x);assert.equal(r.contextAssessmentV1,undefined);assert.ok(r.contextEngineWarnings.length);});
test('shadow builder failure isolated',()=>{const x=input(),before=structuredClone(x);assert.deepEqual(buildContextShadow(x,()=>{throw Error('test');}),{contextEngineWarnings:['CONTEXT_SHADOW_UNAVAILABLE']});assert.deepEqual(x,before);});
const futureTests=[
 ['risk period',x=>x.riskAssessment.facts[0].period.asOf='2027-01-01'],
 ['risk evidence',x=>x.riskAssessment.facts[0].evidence[0].asOf='2027-01-01'],
 ['source receipt',x=>x.analysis.sourceManifest.bankStatements[0].receivedAt='2027-01-01'],
 ['legal receipt',x=>x.companyProfile.fetchedAt='2027-01-01'],
 ['bank period',x=>x.analysis.metricsV2.period.to='2027-01-01'],
 ['metric period',x=>x.analysis.metricsV2.operating.operatingReceiptsVolatility.periodTo='2027-01-01'],
 ['future monthly',x=>x.analysis.metricsV2.monthly[0].month='2027-01'],
 ['portfolio snapshot',x=>x.analysis.creditPortfolioV1.asOfDate='2027-01-01'],
 ['case receipt',x=>{x.financingCase=financingCase({clientExplanation:field('Future',{evidenceAsOf:'2027-01-01'})});}],
 ['contract signed',x=>{activeContract({companyProfile:x.companyProfile});x.companyProfile.contracts.items[0].signedAt='2027-01-01';}],
 ['financial receipt',x=>x.analysis.financialAnalysisV2.history[0].snapshot.source.receivedAt='2027-01-01']
];
for(const [name,change]of futureTests)test(`future ${name} explicitly diagnosed`,()=>{const x=input();change(x);const c=buildContextAssessment(x);assert.ok(c.warnings.some(w=>/FUTURE|UNAVAILABLE/.test(w)));assert.ok(c.facts.every(f=>!f.period.asOf||f.period.asOf.slice(0,10)<=date));});
test('future reconciliation evidence excluded explicitly',()=>{const x=entry(19).input;x.analysis.reconciliationV1.findings[0].leftFacts[0].period.asOf='2027-01-01';const c=buildContextAssessment(x);assert.ok(c.warnings.some(w=>w.includes('reconciliation')));assert.ok(!c.relations.some(r=>r.code==='CTX-RECON-CONFLICT'));});
test('future contract execution allowed',()=>{const x=entry(27).input;assert.ok(buildContextAssessment(x).relations.some(r=>r.code==='CTX-CASE-CONFIRMED-CONTRACT'));});
test('future maturity contractual date retained',()=>{const c=ctx(11);assert.equal(find(c,'OBLIGATION_MATURITY').value,'2027-12-31');assert.ok(c.relations.some(r=>r.code==='CTX-MATURITY'));});
test('no raw transaction access',()=>{const x=input();Object.defineProperty(x.analysis,'transactions',{get(){throw Error('raw scan forbidden');}});assert.ok(buildContextAssessment(x));});
test('legacy score fields never read',()=>{const x=input();for(const k of ['score','grade','readiness','metrics','factors','recommendations','productFits'])Object.defineProperty(x.analysis,k,{get(){throw Error(`legacy ${k} forbidden`);}});assert.ok(buildContextAssessment(x));});
test('no hidden clock or random identity',()=>{const x=input(),before=buildContextAssessment(x),old=Date.now,rand=Math.random;try{Date.now=()=>{throw Error('clock');};Math.random=()=>{throw Error('random');};assert.deepEqual(buildContextAssessment(x),before);}finally{Date.now=old;Math.random=rand;}});
for(const key of ['score','contextScore','pd','approvalProbability','bankPolicy','products','recommendations','debtCapacity','readiness','limits'])test(`no ${key} output`,()=>assert.equal(key in ctx(30),false));
for(const confidence of ['HIGH','MEDIUM','LOW','UNKNOWN'])test(`reconciliation ${confidence} never promoted`,()=>{const x=entry(19).input;x.analysis.reconciliationV1.findings[0].evidenceConfidence=confidence;const c=buildContextAssessment(x);for(const r of c.relations.filter(r=>r.code==='CTX-RECON-CONFLICT'))assert.ok(rank(r.evidenceConfidence)<=rank(confidence));});
test('source envelope LOW caps company facts',()=>{const x=input();for(const s of x.companyProfile.sourceManifest.external)s.confidence=10;assert.equal(find(buildContextAssessment(x),'COMPANY_REGION').confidence,'LOW');});
test('missing evidence cannot become HIGH',()=>{const f=contextFact(inn,'TEST','DATA_QUALITY',0,{confidence:'HIGH'});assert.equal(f.value,0);assert.equal(f.confidence,'UNKNOWN');});
for(const value of [NaN,Infinity,-Infinity])test(`nonfinite fact rejected to UNKNOWN ${value}`,()=>{const f=contextFact(inn,'TEST','DATA_QUALITY',value);assert.equal(f.status,'UNKNOWN');assert.equal(f.value,null);});
test('weakest material confidence',()=>assert.equal(weakest('HIGH','LOW','MEDIUM'),'LOW'));
test('duplicate exact contracts cannot confirm',()=>{const x=entry(27).input;x.companyProfile.contracts.items.push(structuredClone(x.companyProfile.contracts.items[0]));const c=buildContextAssessment(x);assert.equal(find(c,'CASE_CONTRACT_MATCH').value,null);assert.ok(!c.relations.some(r=>r.code==='CTX-CASE-CONFIRMED-CONTRACT'));});
test('similar contract number never fuzzy matches',()=>{const x=entry(27).input;x.financingCase.contractReference.value='SYN-2026/10';assert.equal(find(buildContextAssessment(x),'CASE_CONTRACT_MATCH').value,false);});
test('normalized exact contract whitespace and marker',()=>assert.equal(normalizeContract(' № syn-2026/1  '),'SYN-2026/1'));
test('name-only contract evidence remains LOW',()=>assert.equal(ctx(7).relations.find(r=>r.code==='CTX-CONCENTRATION-CONTRACT').evidenceConfidence,'LOW'));
test('different customer contract no concentration explanation',()=>{const x=entry(7).input;x.companyProfile.contracts.items[0].customer='Иной синтетический заказчик';assert.ok(!buildContextAssessment(x).relations.some(r=>r.code==='CTX-CONCENTRATION-CONTRACT'));});
test('closed contract no active concentration explanation',()=>{const x=entry(7).input;x.companyProfile.contracts.items[0].status='COMPLETED';assert.ok(!buildContextAssessment(x).relations.some(r=>r.code==='CTX-CONCENTRATION-CONTRACT'));});
test('missing month is unknown not zero',()=>{const c=ctx(21),f=c.facts.find(f=>f.semanticCode==='MONTHLY_OPERATING_RECEIPTS'&&f.subjectKey==='2026-01');assert.equal(f.status,'UNKNOWN');assert.equal(f.value,null);});
test('same source cannot corroborate two independent lenses',()=>{const x=entry(2).input;const bank=x.riskAssessment.facts.find(f=>f.semanticCode==='BANK_OPERATING_TREND'),fin=x.riskAssessment.facts.find(f=>f.semanticCode==='FIN_ANNUAL_REVENUE_CHANGE');bank.sourceIds=fin.sourceIds;assert.ok(!buildContextAssessment(x).relations.some(r=>r.code==='CTX-REVENUE-CORROBORATION'));});
test('overlapping bank period cannot mitigate old annual decline',()=>{const x=entry(3).input;x.riskAssessment.facts.find(f=>f.semanticCode==='BANK_OPERATING_TREND').period.from='2025-01-01';assert.ok(!buildContextAssessment(x).relations.some(r=>r.code==='CTX-REVENUE-RECOVERY'));});
test('partial supplied coverage cannot mitigate liquidity',()=>{const x=entry(5).input;x.riskAssessment.facts.find(f=>f.semanticCode==='BANK_COVERAGE_ADEQUATE').value=false;assert.ok(!buildContextAssessment(x).relations.some(r=>r.code==='CTX-LIQUIDITY-CURRENT-CASH'));});
test('BKI history and current from different obligations never paired',()=>{const x=bkiFactsInput(0,60);x.riskAssessment.facts.find(f=>f.semanticCode==='BKI_OVERDUE').subjectKey='other-loan';assert.ok(!buildContextAssessment(x).relations.some(r=>r.code==='CTX-BKI-CURRENT-CLEAR'));});
test('unknown BKI zero cannot mitigate',()=>{const x=bkiFactsInput(null,60);assert.ok(!buildContextAssessment(x).relations.some(r=>r.code==='CTX-BKI-CURRENT-CLEAR'));});
for(const role of ['Собственник','Директор','Поручитель'])test(`personal ${role} cannot provide borrower context`,()=>{const x=bkiFactsInput(0,60);x.analysis.creditHistory.relationshipToCompany=role;const c=buildContextAssessment(x);assert.ok(!c.facts.some(f=>f.semanticCode==='BKI_OVERDUE'));assert.ok(!c.relations.some(r=>r.code==='CTX-BKI-CURRENT-CLEAR'));});
test('client claim HIGH cannot mitigate recovery',()=>{const x=entry(29).input;x.financingCase.clientExplanation.confidence='HIGH';const c=buildContextAssessment(x);assert.equal(find(c,'CASE_clientExplanation').confidence,'MEDIUM');assert.equal(c.relations.filter(r=>r.effect==='MITIGATES').length,0);});
test('requested overdraft is not recommended overdraft',()=>{const c=buildContextAssessment(input(material(),financingCase({requestedProduct:field('OVERDRAFT')})));assert.equal(find(c,'CASE_requestedProduct').value,'OVERDRAFT');assert.ok(!JSON.stringify(c).includes('OVERDRAFT_RECOMMENDED'));});
test('golden reviewer HARD mismatch fails',()=>{const e=entry(1);e.expected.requiredRelations=[{code:'CTX-NEVER'}];assert.equal(checkContextCase(e).result,'FAIL');});
test('golden reviewer REVIEW mismatch stays REVIEW',()=>{const e=entry(1);e.expected.requiredRelations=[{code:'CTX-BUSINESS-PROFILE',effect:'MITIGATES',level:'REVIEW'}];assert.equal(checkContextCase(e).result,'REVIEW');});
test('golden fingerprints prevent silent revisions',()=>{const p=structuredClone(pack);p.entries[0].title+='changed';assert.throws(()=>runContextPack(p),/FINGERPRINT/);});
test('expectations independently authored without context evaluator',()=>assert.doesNotMatch(readFileSync(new URL('./fixtures/context/golden-context-pack-v1.mjs',import.meta.url),'utf8'),/buildContextAssessment|evaluateContextRules/));
test('existing Credit Lab frozen 31 PASS',()=>{const r=runCreditLabPack(loadGoldenPack());assert.deepEqual([r.summary.passCount,r.summary.reviewCount,r.summary.failCount],[31,0,0]);});
test('authoritative parity and FREE FULL unchanged',()=>{const a=analyzeBankStatement(block2StatementFixture());assert.deepEqual([a.score,a.grade,a.readiness,a.metrics.estimatedLimitMin,a.metrics.estimatedLimitMax],[872,'A','Высокая готовность',1283000,2636000]);const before=analysisView(a,'FREE');const full={...a,...buildContextShadow(input())};assert.deepEqual(analysisView(full,'FREE'),before);assert.ok(analysisView(full,'FULL').contextAssessmentV1);});
test('summary counts distinct risk targets',()=>{const c=ctx(30);assert.equal(c.summary.riskFindingsWithContextCount,new Set(c.relations.flatMap(r=>r.targetRiskFindingIds)).size);assert.equal(c.summary.supportedRelationCount,c.relations.length);});
test('Context JSON round trip',()=>{const c=ctx(30);assert.deepEqual(JSON.parse(JSON.stringify(c)),c);});
test('representative Context performance',t=>{const x=entry(30).input,timings={adaptation:0,evaluation:0,relations:0,summary:0};for(let i=0;i<1000;i++){let now=performance.now();const {facts}=adaptContextFacts(x);timings.adaptation+=performance.now()-now;now=performance.now();const ev=evaluateContextRules(facts,x.riskAssessment.findings);timings.evaluation+=performance.now()-now;now=performance.now();const rel=constructContextRelations(ev,facts,x.riskAssessment.findings);timings.relations+=performance.now()-now;now=performance.now();summarizeContext(ev,rel,x.riskAssessment.findings.length);timings.summary+=performance.now()-now;}
 let now=performance.now();for(let i=0;i<200;i++)buildContextAssessment(input());const source200=performance.now()-now;now=performance.now();for(let i=0;i<1000;i++)buildContextAssessment({...x,financingCase:financingCase()});const financing1000=performance.now()-now;now=performance.now();const a=Array.from({length:100},()=>buildContextAssessment(x));assert.ok(a.every(c=>stable(c)===stable(a[0])));const determinism100=performance.now()-now;t.diagnostic(JSON.stringify({evaluations:1000,...Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,Number(v.toFixed(2))])),source200:Number(source200.toFixed(2)),financing1000:Number(financing1000.toFixed(2)),determinism100:Number(determinism100.toFixed(2))}));});
for(const [name,change]of [['severity',x=>x.riskAssessment.findings[0].severity='INVALID'],['scope',x=>x.riskAssessment.findings[0].scope='BANK_POLICY'],['impact',x=>x.riskAssessment.findings[0].decisionImpact='APPROVE'],['orphan lineage',x=>x.riskAssessment.findings[0].factIds=['absent']],['nonfinite fact',x=>x.riskAssessment.facts[0].value=Infinity],['summary',x=>x.riskAssessment.summary={}]])test(`malformed risk ${name} is isolated`,()=>{const x=entry(2).input;change(x);const r=buildContextShadow(x);assert.equal(r.contextAssessmentV1,undefined);assert.ok(r.contextEngineWarnings.includes('CONTEXT_RISK_INPUT_UNAVAILABLE'));});
test('source-confidence limitation produces review relation',()=>{const c=ctx(1);assert.ok(c.relations.some(r=>r.code==='CTX-SOURCE-CONFIDENCE'&&r.effect==='REQUIRES_REVIEW'));});
test('all relation targets resolve to unchanged input findings',()=>{const x=entry(30).input,c=buildContextAssessment(x);for(const r of c.relations)for(const fid of r.targetRiskFindingIds)assert.ok(x.riskAssessment.findings.some(f=>f.findingId===fid&&r.targetRiskCodes.includes(f.code)));});
