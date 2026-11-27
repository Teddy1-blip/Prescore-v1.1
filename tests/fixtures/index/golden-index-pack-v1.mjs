import {readFileSync} from 'node:fs';
import {baseline,finding,relation,removeCore,material,rawProfile} from './builders.mjs';
import {entries as contextEntries} from '../context/golden-context-pack-v1.mjs';
import {buildContextAssessment} from '../../../lib/credit-engine/context/engine.ts';
export const INDEX_PACK_VERSION='PRESCORE-INDEX-RU-GOLDEN-1.0.0';
export function entries(){const es=[];const add=(n,title,mutate,expected)=>{const x=baseline();mutate?.(x);es.push({caseId:`IDX-RU-${String(n).padStart(3,'0')}`,revision:1,title,input:x,expected:{invariants:true,...expected}});};
 add(1,'Healthy adequate core',null,{status:'CALCULATED',value:1000});
 for(const [n,severity,value]of [[2,'LOW',949],[3,'MEDIUM',849],[4,'HIGH',699],[5,'CRITICAL',549]])add(n,`Single ${severity} financial finding`,x=>finding(x,{severity}),{value,ceiling:value,components:[{component:'FINANCIAL_STRENGTH',scorePoints:400-({LOW:32,MEDIUM:72,HIGH:140,CRITICAL:240}[severity])}]});
 add(6,'Medium cash-flow risk',x=>finding(x,{domain:'CASH_FLOW',severity:'MEDIUM'}),{value:849,components:[{component:'OPERATING_BEHAVIOR',scorePoints:246}]});
 add(7,'Canonical CASH_FLOW debt-service burden routes to DEBT_CREDIT',null,{value:699,ceiling:699,requiredContributions:['RISK-CF-DEBT-SERVICE-BURDEN'],components:[{component:'DEBT_CREDIT',scorePoints:130},{component:'OPERATING_BEHAVIOR',scorePoints:300}]});
 {const m=material();m.analysis.metricsV2.debtService.debtServiceToOperatingReceipts.value=.5;es.at(-1).input=rawProfile(m);es.at(-1).revision=2;}
 add(8,'Critical company current BKI overdue',x=>finding(x,{domain:'CREDIT_HISTORY',severity:'CRITICAL',code:'RISK-BKI-CURRENT-OVERDUE'}),{value:549,requiredContributions:['RISK-BKI-CURRENT-OVERDUE']});
 add(9,'Historical company BKI delinquency',x=>finding(x,{domain:'CREDIT_HISTORY',code:'RISK-BKI-HISTORICAL-DELINQUENCY'}),{value:699});
 add(10,'Legal credit risk',x=>finding(x,{domain:'LEGAL'}),{value:699,components:[{component:'LEGAL_CORPORATE',scorePoints:65},{component:'FINANCIAL_STRENGTH',scorePoints:400}]});
 for(const [n,code]of [[11,'TERMINATED'],[12,'LIQUIDATION'],[13,'BANKRUPTCY']])add(n,`Global stop ${code}`,x=>finding(x,{domain:'LEGAL',scope:'GLOBAL_STOP',code:`RISK-LEGAL-${code}`,severity:'CRITICAL'}),{status:'NOT_RATABLE_GLOBAL_STOP',value:null});
 for(const[n,code]of [[14,'BANKRUPTCY-MESSAGES'],[15,'SOURCE-MISSING'],[16,'RECONCILIATION-CONFLICT'],[17,'SOURCE-STALE']])add(n,`${code} data review only`,x=>finding(x,{scope:'DATA_REVIEW',domain:'DATA_QUALITY',code,severity:'HIGH'}),{status:'PARTIAL',value:1000,forbiddenContributions:[code],relative:[{other:'IDX-RU-001',operator:'EQ',field:'value'}]});
 const compound=x=>{const f=finding(x,{id:'annual-decline',code:'RISK-FIN-REVENUE-DECLINE'});finding(x,{id:'financial-medium',code:'SYN-FIN-MEDIUM',severity:'MEDIUM'});finding(x,{id:'operating-high',code:'SYN-CASH-HIGH',domain:'CASH_FLOW'});finding(x,{id:'legal-medium',code:'SYN-LEGAL-MEDIUM',domain:'LEGAL',severity:'MEDIUM'});return f;};
 add(18,'Decline corroborated in profile below ceiling',x=>relation(x,compound(x),{effect:'CORROBORATES'}),{range:[0,699],modifiers:[{riskCode:'RISK-FIN-REVENUE-DECLINE',min:10,max:10}],relative:[{other:'IDX-RU-019',operator:'LT',field:'value'}]});
 add(19,'Same compound profile without corroboration',compound,{value:665});
 add(20,'Decline mitigated in same compound profile',x=>relation(x,compound(x)),{range:[665,699],relative:[{other:'IDX-RU-021',operator:'GT',field:'value'}]});
 add(21,'Same compound profile without mitigation',compound,{value:665});
 add(22,'Explanation is not numeric mitigation',x=>relation(x,compound(x),{effect:'EXPLAINS'}),{value:665,modifiers:[{riskCode:'RISK-FIN-REVENUE-DECLINE',min:0,max:0}]});
 add(23,'Forged client-declared HIGH mitigation ignored',x=>relation(x,compound(x),{sourceClass:'CLIENT_DECLARED'}),{value:665});
 add(24,'LOW confidence mitigation ignored',x=>relation(x,compound(x),{confidence:'LOW'}),{value:665});
 add(25,'Financial component cap',x=>{for(let i=0;i<4;i++)finding(x,{id:`f${i}`,code:`SYN-FIN-${i}`,severity:'CRITICAL'});},{components:[{component:'FINANCIAL_STRENGTH',scorePoints:0}],value:549});
 add(26,'Separate BKI obligations accumulate to cap',x=>{for(let i=0;i<4;i++)finding(x,{id:`d${i}`,code:'SYN-DEBT',domain:'CREDIT_HISTORY',severity:'CRITICAL',subjectKey:`loan:${i}`});},{components:[{component:'DEBT_CREDIT',scorePoints:0}],value:549});
 add(27,'Cross-domain compound risks',compound,{value:665});
 add(28,'Duplicate finding rejected',x=>{const f=finding(x);x.riskAssessment.findings.push(structuredClone(f));},{invalid:'DUPLICATE_FINDING_ID'});
 add(29,'Dangling Context target rejected',x=>{const r=relation(x,finding(x));r.targetRiskFindingIds=['absent'];},{invalid:'RELATION_LINEAGE'});
 add(30,'Future Context evidence rejected',x=>{relation(x,finding(x));x.contextAssessment.facts.at(-1).evidence[0].asOf='2027-01-01';},{invalid:'FUTURE_OR_INVALID_EVIDENCE_DATE'});
 const prior=(n)=>{const x=contextEntries().find(e=>e.caseId===`CTX-RU-${String(n).padStart(3,'0')}`).input;return {riskAssessment:x.riskAssessment,contextAssessment:buildContextAssessment(x),asOfDate:x.asOfDate};};
 for(const[n,priorN,title]of [[31,18,'Personal owner BKI excluded'],[32,13,'Guarantorship is not funded debt'],[33,14,'Bank guarantee is not funded principal']]){add(n,title,null,{value:1000});es.at(-1).input=prior(priorN);}
 add(34,'Missing bank coverage reduces adequacy not points',x=>{x.riskAssessment.facts.find(f=>f.semanticCode==='BANK_COVERAGE_ADEQUATE').value=false;},{status:'PARTIAL',value:1000,coverage:[{component:'OPERATING_BEHAVIOR',state:'LIMITED'}]});
 add(35,'Insufficient financial core',x=>removeCore(x,['FIN_EQUITY','FIN_CURRENT_RATIO','FIN_ANNUAL_REVENUE','FIN_ANNUAL_NET_PROFIT']),{status:'INSUFFICIENT_DATA',value:null});
 add(36,'Unknown global stop applicability cannot be complete',x=>x.riskAssessment.summary.globalStopStatus='INSUFFICIENT_DATA',{status:'PARTIAL',value:1000});
 add(37,'Reordered compound input',x=>{compound(x);x.riskAssessment.findings.reverse();x.riskAssessment.facts.reverse();x.contextAssessment.facts.reverse();x.contextAssessment.relations.reverse();},{value:665,relative:[{other:'IDX-RU-027',operator:'EQ',field:'value'}]});
 add(38,'Higher severity cannot improve Index',x=>finding(x,{severity:'CRITICAL'}),{value:549,relative:[{other:'IDX-RU-004',operator:'LT',field:'value'}]});
 add(39,'Multiple independent modifiers bounded',x=>{const f=compound(x);for(let i=0;i<4;i++)relation(x,f,{id:`mitigation-${i}`});},{modifiers:[{riskCode:'RISK-FIN-REVENUE-DECLINE',min:-15,max:-15}],range:[665,699]});
 add(40,'Real canonical multi-risk pipeline',null,{range:[0,699]});es.at(-1).input=prior(30);
 const defect=prior(16);es.push({caseId:'IDX-RU-DEFECT-001',revision:1,title:'Current overdue with reported historical zero',input:defect,expected:{invariants:true,value:849,requiredContributions:['RISK-BKI-CURRENT-OVERDUE'],forbiddenContributions:['RISK-BKI-HISTORICAL-DELINQUENCY'],defect:true}});
 return es;
}
export function loadIndexPack(){return {version:INDEX_PACK_VERSION,entries:entries(),fingerprints:JSON.parse(readFileSync(new URL('./fingerprints-stage5.json',import.meta.url),'utf8'))};}
