import {buildBankStatementMetricsV2} from '../../../lib/credit-engine/metrics/engine.ts';
import {material as sourceMaterial,input as contextInput,financingCase,field,inn,date,bkiFactsInput} from '../context/builders.mjs';
import {buildContextAssessment} from '../../../lib/credit-engine/context/engine.ts';
import {buildPrescoreIndex} from '../../../lib/credit-engine/index/engine.ts';
import {buildFinancingReadiness} from '../../../lib/credit-engine/readiness/engine.ts';
import {buildCreditAssessment} from '../../../lib/credit-engine/credit-assessment/engine.ts';
import {buildCreditPortfolio} from '../../../lib/credit-engine/credit-portfolio/resolver.ts';
import {reported,id} from '../../../lib/credit-engine/credit-portfolio/common.ts';
import {fromIndex as assessmentFromIndex,reorder as assessmentReorder} from '../credit-assessment/builders.mjs';
export {field,inn,date};
export function months(n=12){return Array.from({length:n},(_,i)=>{const d=new Date(Date.UTC(2026,6-n+i,1));return d.toISOString().slice(0,7);});}
function transaction(category,amount,month,n){const incoming=['SALE_PROCEEDS','BANK_LOAN_RECEIVED','OWNER_CONTRIBUTION','OWNER_LOAN_RECEIVED','FACTORING_PROCEEDS','ASSET_SALE_PROCEEDS'].includes(category);return {id:'cap-tx-'+n,canonicalTransactionId:'cap-tx-'+n,date:month+'-15',amount,direction:incoming?'in':'out',counterparty:'Синтетический контрагент',counterpartyInn:'9900000002',purpose:category,category:'other',account:'40702810000000000001',sourceId:'cap-bank',sourceFileName:'synthetic-capacity.txt',duplicateStatus:'NOT_DUPLICATE',classification:{version:'PRESCORE-TX-CLASSIFIER-2.0.0-SHADOW',family:'OTHER',primaryCategory:category,confidence:'HIGH',ruleCode:'SYNTHETIC-CAPACITY-CLASSIFICATION',evidence:[],alternatives:[],tags:[],requiresReview:false,ambiguityReasons:[]}};}
export function bank({operating=Array(12).fill(1000000),debt=operating.map(()=>0),coverage=operating.map(()=> 'FULL'),extraCategory,extraAmount=10000000,debtCategory='LOAN_PRINCIPAL_PAYMENT',quality=100}={}){
 const ms=months(operating.length),tx=[];for(let n=0;n<ms.length;n++){if(coverage[n]==='MISSING')continue;if(operating[n])tx.push(transaction('SALE_PROCEEDS',operating[n],ms[n],tx.length));if(debt[n])tx.push(transaction(debtCategory,debt[n],ms[n],tx.length));if(extraCategory)tx.push(transaction(extraCategory,extraAmount,ms[n],tx.length));}
 const calendar=ms.map((month,n)=>({month,status:coverage[n],daysCovered:coverage[n]==='MISSING'?0:30,calendarDays:30,sourceIds:coverage[n]==='MISSING'?[]:['cap-bank'],warnings:[]}));
 const from=ms[0]?ms[0]+'-01':date;
 return buildBankStatementMetricsV2({transactions:tx,periodFrom:from,periodTo:date,sourceManifest:{bankStatements:[{sourceId:'cap-bank',sourceType:'BANK_STATEMENT',status:'READY',companyInn:inn,receivedAt:date,confidence:quality,warnings:[],fieldAvailability:{openingBalance:'UNKNOWN',endingBalance:'UNKNOWN'}}]},integrity:{confidence:quality,completeness:quality,missingSources:[],failedSources:[],staleSources:[],warnings:[],integrityVersion:'PRESCORE-INTEGRITY-1',calendarCoverage:calendar,dataQuality:{confidence:quality,completeness:quality,fullMonths:coverage.filter(c=>c==='FULL').length,partialMonths:coverage.filter(c=>c==='PARTIAL').length,missingMonths:coverage.filter(c=>c==='MISSING').length,overlapMonths:coverage.filter(c=>c==='OVERLAP').length,sourceCount:1,knownFieldsRate:1,fieldKnownRates:{direction:1,counterparty:1,counterpartyInn:1,purpose:1,account:1,source:1},parserConfidence:quality,unknownClassificationRate:0,warnings:[]}}}).metricsV2;
}
export function evidence(label='schedule',at=date){return [{evidenceId:'synthetic:'+label,sourceKind:'DEBT_DOCUMENT',sourceId:'synthetic-document',observedAt:at,description:label}];}
export function portfolio({type='TERM_LOAN',payment=100000,due='2026-07-15',status='ACTIVE',noSchedule=false}={}){
 const hints={creditorInn:'9900000002',creditorName:'Синтетический банк',contractNumber:'CAP-1',productType:type};
 const observation=(fieldCode,value)=>({observationId:id('cap-obs',fieldCode,value),observationGroupId:'cap-group',companyInn:inn,obligationHints:hints,fieldCode,value,unit:typeof value==='number'?'RUB':'TEXT',knowledge:value===null?'UNKNOWN':'KNOWN',origin:'REPORTED',observedAt:date,effectiveFrom:null,effectiveTo:null,confidence:'HIGH',evidence:evidence(fieldCode),warnings:[]});
 const p=buildCreditPortfolio({companyInn:inn,asOfDate:date,paymentObservations:[],observations:[observation('status',status),observation('principalOutstanding',1000000),observation('annualRate',20),observation('nextPaymentAmount',payment),observation('nextPaymentDate',due)]});
 if(noSchedule)p.obligations[0].schedule=[];return p;
}
export const value=(v,confidence='HIGH')=>({...reported(v,date,evidence()),confidence});
export function compose(x){const p={...x,prescoreIndex:buildPrescoreIndex(x)};p.financingReadiness=buildFinancingReadiness(p);p.creditAssessment=buildCreditAssessment(p);return p;}
export function refresh(x){x.financingReadiness=buildFinancingReadiness(x);x.creditAssessment=buildCreditAssessment(x);return x;}
export function baseline(options={}){const b=bank(options),m=sourceMaterial();m.analysis.metricsV2=b;if(options.creditPortfolio)m.analysis.creditPortfolioV1=options.creditPortfolio;const c=options.caseFields?financingCase(options.caseFields):undefined,ctx=contextInput(m,c),up=compose({riskAssessment:ctx.riskAssessment,contextAssessment:buildContextAssessment(ctx),asOfDate:date});return {...up,bankMetrics:b,...(options.creditPortfolio?{creditPortfolio:options.creditPortfolio}:{})};}
export const scenario=(extra={})=>({scenarioId:'synthetic-annuity',annualRatePercent:12,termMonths:12,paymentFrequency:'MONTHLY',amortization:'ANNUITY',scenarioSource:'independently-specified-test-assumption',evidenceAsOf:date,confidence:'HIGH',...extra});
export function withScenario(extra={},options={}){return {...baseline(options),scenarios:[scenario(extra)]};}
export function upstream(n,options={}){const a=assessmentFromIndex(n);return {...a,creditAssessment:buildCreditAssessment(a),bankMetrics:bank(options)};}
export function defect(){const ctx=bkiFactsInput(1000,0);const x=compose({riskAssessment:ctx.riskAssessment,contextAssessment:buildContextAssessment(ctx),asOfDate:date});return {...x,bankMetrics:bank()};}
export function reorder(x){const y=assessmentReorder(x);y.bankMetrics.monthly.reverse();y.scenarios?.reverse();if(y.creditPortfolio){y.creditPortfolio.obligations.reverse();for(const o of y.creditPortfolio.obligations)o.schedule.reverse();}y.creditAssessment.drivers.reverse();y.creditAssessment.dimensions.reverse();for(const values of Object.values(y.creditAssessment.context))values.reverse();return y;}

// Controlled canonical-consumer boundary: rated upstream contract is held fixed while
// independently authored Block 4 cash history varies. Not a claim that the altered
// bank period itself produced that upstream assessment. Real pipeline is baseline().
export const cashBoundary=options=>upstream(1,options);
