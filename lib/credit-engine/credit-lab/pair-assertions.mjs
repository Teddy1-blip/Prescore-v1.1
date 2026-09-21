import assert from 'node:assert/strict';
import {loadBusiness,corpusFiles} from './business-corpus.mjs';
import {analyzeBankStatements,analysisForStorage} from '../../prescore.ts';
import {buildCanonicalCreditAnalysis} from '../production/orchestrator.ts';
import {normalizeSnapshot} from '../financial-analysis/normalizer.ts';
import {principalEquivalent} from '../debt-capacity/scenarios.ts';
const eq=(a,b)=>assert.deepEqual(a,b);
const economic=a=>({operating:a.metricsV2.operating.operatingCashReceipts.value,inflow:a.metricsV2.cashFlow.grossExternalCashInflow.value,outflow:a.metricsV2.cashFlow.grossExternalCashOutflow.value,monthly:a.metricsV2.monthly.map(x=>[x.month,x.operatingReceipts]),customers:a.metricsV2.customers.directCustomerTop1.value});
export function pairAssertions(){
 const rows=[];const check=(id,fn)=>{try{fn();rows.push({id,status:'PASS'});}catch(e){rows.push({id,status:'FAIL',classification:e.code==='ERR_ASSERTION'?'PRIOR_BLOCK_DEFECT_FOUND':'TEST_IMPLEMENTATION_ERROR',expected:e.expected??'Independent invariant',actual:e.actual??e.message});}};
 const b=loadBusiness('CL-RU-BUS-001'),r=buildCanonicalCreditAnalysis(b.input);
 check('SOURCE_ORDER_PERMUTATION',()=>{const x=loadBusiness('CL-RU-BUS-010');eq(economic(analyzeBankStatements([...x.statements].reverse())),economic(x.full));});
 check('EXACT_DUPLICATE_ECONOMIC_IDEMPOTENCE',()=>eq(economic(analyzeBankStatements([...b.statements,...b.statements])),economic(b.full)));
 check('OWN_TRANSFER_ECONOMIC_NEUTRALITY',()=>eq(economic(loadBusiness('CL-RU-BUS-010').full),economic(b.full)));
 check('DISJOINT_FILE_SPLIT',()=>{
  const text=b.statements[0].text,header=text.slice(0,text.indexOf('СекцияДокумент='));
  const blocks=[...text.matchAll(/СекцияДокумент=[\s\S]*?КонецДокумента\r?\n/g)].map(x=>x[0]);
  const halves=[blocks.slice(0,blocks.length/2),blocks.slice(blocks.length/2)];
  let opening=10000000;
  const files=halves.map((docs,i)=>{let incoming=0,outgoing=0;for(const doc of docs){const amount=Number(doc.match(/^Сумма=(.+)$/m)[1]);if(/^ДатаПоступило=/m.test(doc))incoming+=amount;else outgoing+=amount;}
   const h=header.replace(/ДатаНачала=.+/g,'ДатаНачала='+(i?'01.01.2026':'01.07.2025')).replace(/ДатаКонца=.+/g,'ДатаКонца='+(i?'30.06.2026':'31.12.2025')).replace(/НачальныйОстаток=.+/,'НачальныйОстаток='+opening.toFixed(2)).replace(/ВсегоПоступило=.+/,'ВсегоПоступило='+incoming.toFixed(2)).replace(/ВсегоСписано=.+/,'ВсегоСписано='+outgoing.toFixed(2)).replace(/КонечныйОстаток=.+/,'КонечныйОстаток='+(opening+incoming-outgoing).toFixed(2));opening+=incoming-outgoing;return{text:h+docs.join('')+'КонецФайла\r\n',fileName:`synthetic-half-${i}.txt`};});
  const split=analyzeBankStatements(files);eq(economic(split),economic(b.full));eq(split.metricsV2.period,b.full.metricsV2.period);
 });
 check('EXPLICIT_RUB_THOUSANDS_SCALE',()=>{const raw=JSON.parse(Buffer.from(corpusFiles()['CL-RU-BUS-001/bfo-2025.json']).toString());const source=b.input.analysis.sourceManifest.bfo;const rub=normalizeSnapshot({...raw,source});const thousands=normalizeSnapshot({...raw,rawLines:Object.fromEntries(Object.entries(raw.rawLines).map(([k,v])=>[k,Number(v)/1000])),scale:1000,reportedNetAssets:raw.reportedNetAssets==null?raw.reportedNetAssets:raw.reportedNetAssets/1000,source});const values=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,{value:v.value,status:v.status}]));eq(values(thousands.balance),values(rub.balance));eq(values(thousands.income),values(rub.income));});
 check('EXPLICIT_ASOF_REPEAT_AND_INPUT_IMMUTABILITY',()=>{const before=JSON.stringify(b.input);eq(buildCanonicalCreditAnalysis(b.input),r);eq(JSON.stringify(b.input),before);eq(r.asOfDate,b.caseSpec.asOfDate);});
 check('TRUNCATED_DISPLAY_NEVER_RECOMPUTED',()=>{const x=loadBusiness('CL-RU-BUS-024');eq(x.full.transactions.length,12072);eq(analysisForStorage(x.full).transactions.length,10000);const original=buildCanonicalCreditAnalysis(x.input);x.input.analysis.transactions=[];eq(buildCanonicalCreditAnalysis(x.input),original);});
 check('SCENARIO_ZERO_RATE',()=>{const x=structuredClone(b.input);x.scenarios=x.scenarios.map(s=>({...s,annualRatePercent:0}));const d=buildCanonicalCreditAnalysis(x).debtCapacity;for(const s of d.scenarioResults)eq(s.prudentialPrincipalEquivalent,s.prudentialMonthlyPaymentCapacity*s.termMonths);eq(principalEquivalent(100000,0,12),1200000);});
 check('NO_HIDDEN_SCENARIO_DEFAULT',()=>{const x=structuredClone(b.input);delete x.scenarios;eq(buildCanonicalCreditAnalysis(x).debtCapacity.scenarioResults,[]);});
 check('UNKNOWN_NO_INVENTED_PRINCIPAL',()=>{const d=buildCanonicalCreditAnalysis(loadBusiness('CL-RU-BUS-016').input).debtCapacity;eq(d.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,null);for(const s of d.scenarioResults)eq(s.prudentialPrincipalEquivalent,null);});
 check('ANNUAL_INTERIM_NOT_COMPARABLE',()=>{const x=buildCanonicalCreditAnalysis(loadBusiness('CL-RU-BUS-019').input);assert.ok(!x.riskAssessment.findings.some(f=>f.code==='RISK-FIN-REVENUE-DECLINE'));});
 // Production currently derives its asOf from the latest included source; there is no
 // caller-specified historical cutoff. Do not simulate an API the contract lacks.
 rows.push({id:'HISTORICAL_ASOF_FUTURE_SOURCE_EXCLUSION',status:'NOT_RUN',reason:'Production input has no caller-specified historical asOf; a source-selection contract is required. Current-source receipt dates alone do not prove absence of future leakage.'});
 return rows;
}
