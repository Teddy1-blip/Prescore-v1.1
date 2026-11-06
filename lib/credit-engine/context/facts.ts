import {freshness,RISK_SOURCE_FRESHNESS_DAYS} from '../risk/common.ts';
import {contractContext} from './procurement.ts';
import type {ContextShadowInput,ContextFactV1,ContextDomain,ContextConfidence,ContextValue,ContextSourceClass} from '../contracts/context.ts';
import type {MetricResult} from '../contracts/metrics.ts';
import {contextFact,id,unique,dateEligible,weakest,rank} from './common.ts';
import {available,temporalRiskFacts} from './temporal.ts';
import {caseFacts,normalizeContract} from './case.ts';
export function adaptContextFacts(input:ContextShadowInput){
 const {analysis:a,asOfDate:cutoff}=input,warnings:string[]=[],out:ContextFactV1[]=[];
 const blocked=new Set<string>();
 const sourceConfidence=new Map<string,ContextConfidence>();
 const scan=(x:unknown)=>{if(!x||typeof x!=='object')return;const o=x as Record<string,unknown>;if(typeof o.sourceId==='string')sourceConfidence.set(o.sourceId,typeof o.confidence==='number'?(o.confidence>=80?'HIGH':o.confidence>=50?'MEDIUM':'LOW'):'UNKNOWN');if(typeof o.sourceId==='string'&&!available(o,cutoff)){blocked.add(o.sourceId);warnings.push(`CONTEXT_FUTURE_INFORMATION_EXCLUDED:source:${o.sourceId}`);}for(const v of Object.values(o))if(v&&typeof v==='object')scan(v);};
 // Canonical source metadata only: never scan transactions or raw bureau rows.
 scan(a.sourceManifest);scan(input.companyProfile?.sourceManifest);scan(a.financialAnalysisV2?.history.map(h=>h.snapshot.source));scan(input.companyProfile?.financialAnalysisV2?.history.map(h=>h.snapshot.source));
 const p=input.companyProfile;
 const profileReady=!!p&&p.inn===a.companyInn&&dateEligible(p.fetchedAt,cutoff)&&!(p.failedMethods??[]).includes('company');
 if(p&&!dateEligible(p.fetchedAt,cutoff)){warnings.push('CONTEXT_FUTURE_INFORMATION_EXCLUDED:companyProfile');for(const s of p.sourceManifest?.external??[])blocked.add(s.sourceId);}
 const scopeExcluded=input.riskAssessment.facts.some(f=>f.semanticCode==='BKI_SCOPE_EXCLUDED'&&f.value===true)||!!a.creditHistory&&(a.creditHistory.affectsCompanyDebt!==true||a.creditHistory.subjectInn!==a.companyInn||/собствен|директор|поручител|owner|director|guarantor/i.test(a.creditHistory.relationshipToCompany??''));
 for(const f of temporalRiskFacts(input,warnings)){
  if(f.companyInn!==a.companyInn){warnings.push('CONTEXT_INPUT_MISMATCH:factCompany');continue;}
  if(f.semanticCode.startsWith('PORTFOLIO_')&&a.creditPortfolioV1&&(!dateEligible(a.creditPortfolioV1.asOfDate,cutoff)||!available(a.creditPortfolioV1,cutoff))||f.semanticCode.startsWith('BKI_')&&a.creditHistory&&!dateEligible(a.creditHistory.reportDate,cutoff)){warnings.push(`CONTEXT_FUTURE_INFORMATION_EXCLUDED:riskSource:${f.factId}`);continue;}
  if(f.sourceIds.some(s=>blocked.has(s))){warnings.push(`CONTEXT_FUTURE_INFORMATION_EXCLUDED:riskSource:${f.factId}`);continue;}
  if(scopeExcluded&&f.semanticCode.startsWith('BKI_')&&f.semanticCode!=='BKI_SCOPE_EXCLUDED')continue;
  const domain:ContextDomain=f.semanticCode.startsWith('BKI_')?'CREDIT_HISTORY':f.semanticCode.startsWith('PORTFOLIO_')?'DEBT_STRUCTURE':f.semanticCode.startsWith('FIN_')?'WORKING_CAPITAL':f.semanticCode.startsWith('BANK_')?'CASH_FLOW':f.domain==='LEGAL'?'LEGAL':'DATA_QUALITY';
  out.push(contextFact(a.companyInn,f.semanticCode,domain,f.value,{unit:f.unit,status:f.status,confidence:f.confidence,period:f.period,sourceIds:f.sourceIds,sourceMetricCodes:f.sourceMetricCode?[f.sourceMetricCode]:[],sourceRiskFactIds:[f.factId],portfolioObligationIds:f.portfolioObligationId?[f.portfolioObligationId]:[],reconciliationFindingIds:unique(f.evidence.flatMap(e=>e.reconciliationFindingId?[e.reconciliationFindingId]:[])),evidence:f.evidence.map(e=>({...e,sourceClass:'CANONICAL_OBSERVED'})),calculationBasis:f.calculationBasis,warnings:f.warnings,...(f.subjectKey||f.portfolioObligationId?{subjectKey:f.subjectKey??f.portfolioObligationId}:{})}));
 }
 const add=(code:string,domain:ContextDomain,value:ContextValue,sourceIds:string[],asOf:string|null,confidence:ContextConfidence='MEDIUM',extra:Partial<ContextFactV1>={})=>{
 confidence=weakest(confidence,...sourceIds.filter(s=>sourceConfidence.has(s)).map(s=>sourceConfidence.get(s)!));
 const sourceClass:ContextSourceClass=extra.sourceClass??'CANONICAL_OBSERVED';out.push(contextFact(a.companyInn,code,domain,value,{confidence,period:{from:null,to:null,asOf},sourceIds,evidence:sourceIds.map(s=>({evidenceId:id('context-evidence',code,s,asOf,value,extra.subjectKey??''),sourceId:s,sourceType:'CANONICAL',sourceClass,metricCode:extra.sourceMetricCodes?.[0]??null,factCode:code,portfolioObligationId:extra.portfolioObligationIds?.[0]??null,reconciliationFindingId:extra.reconciliationFindingIds?.[0]??null,value,unit:extra.unit??'TEXT',periodFrom:extra.period?.from??null,periodTo:extra.period?.to??null,asOf,confidence,calculationBasis:extra.calculationBasis??'Canonical observation; no risk adjustment'})),...extra}));};
 const bank=a.metricsV2,bs=a.sourceManifest?.bankStatements??[],bankReady=!!bank&&dateEligible(bank.period.to,cutoff)&&bs.length>0&&bs.every(s=>s.companyInn===a.companyInn&&s.status==='READY'&&!blocked.has(s.sourceId));
 if(bank&&!dateEligible(bank.period.to,cutoff))warnings.push('CONTEXT_FUTURE_INFORMATION_EXCLUDED:bankMetrics');
 const metrics:Array<[string,ContextDomain,MetricResult|undefined]>=[['OPERATING_VOLATILITY','OPERATING_PATTERN',bank?.operating.operatingReceiptsVolatility],['SEASONALITY_ELIGIBILITY','SEASONALITY',bank?.operating.seasonalityEligibility],['OPERATING_RECEIPTS','CASH_FLOW',bank?.operating.operatingCashReceipts],['GROSS_INFLOW','CASH_FLOW',bank?.cashFlow.grossExternalCashInflow],['SUPPLIER_TOP1','CUSTOMER_STRUCTURE',bank?.suppliers?.supplierTop1],['OWNER_FUNDING','CASH_FLOW',bank?.ownerFunding?.ownerContributionAmount],['OWNER_LOANS','CASH_FLOW',bank?.financing?.ownerLoanInflow],['OWNER_WITHDRAWALS','CASH_FLOW',bank?.ownerOutflows?.ownerWithdrawalAmount],['FACTORING_INFLOW','DEBT_STRUCTURE',bank?.financing?.factoringInflow],['TAX_PAYMENT_CONTINUITY','OPERATING_PATTERN',bank?.tax?.taxPaymentMonthShare],['CASH_AVERAGE_BALANCE','CASH_FLOW',bank?.liquidity.averageDailyBalance]];
 for(const [code,domain,m]of metrics){const ready=bankReady&&m&&(!m.periodTo||dateEligible(m.periodTo,cutoff));if(m?.periodTo&&!dateEligible(m.periodTo,cutoff))warnings.push(`CONTEXT_FUTURE_INFORMATION_EXCLUDED:metric:${code}`);add(code,domain,ready?m.value:null,ready?bs.map(s=>s.sourceId):[],ready?m.periodTo:null,m?.confidence??'UNKNOWN',{status:ready?m.status:'UNKNOWN',unit:m?.unit??'TEXT',sourceMetricCodes:m?[m.code]:[],calculationBasis:m?.calculationBasis??'Canonical metric unavailable; no reconstruction',warnings:m?.warnings??[]});}
 if(bankReady&&bank){add('BANK_FULL_MONTHS','OPERATING_PATTERN',bank.period.fullMonths,bs.map(s=>s.sourceId),bank.period.to,'MEDIUM',{unit:'MONTHS'});for(const m of bank.monthly??[]){const end=`${m.month}-01`;if(!dateEligible(end,cutoff)){warnings.push(`CONTEXT_FUTURE_INFORMATION_EXCLUDED:month:${m.month}`);continue;}add('MONTHLY_OPERATING_RECEIPTS','OPERATING_PATTERN',m.coverage==='FULL'?m.operatingReceipts:null,bs.map(s=>s.sourceId),bank.period.to,bank.operating.operatingCashReceipts?.confidence??'UNKNOWN',{unit:'RUB',subjectKey:m.month,status:m.coverage==='FULL'?'KNOWN':'UNKNOWN',warnings:m.coverage==='FULL'?[]:['MISSING_PARTIAL_MONTH_NOT_ZERO']});}}
 const ps=profileReady?(p!.sourceManifest?.external??[]).filter(s=>s.status==='READY'&&!blocked.has(s.sourceId)&&s.companyInn===a.companyInn):[],identityMethod=p?.inn.length===12?'entrepreneur':'company',
 profileIds=ps.filter(s=>!p?.externalFacts || p.externalFacts.inn===a.companyInn && p.externalFacts.receipts.some(r=>r.id===s.sourceId && r.method===identityMethod && r.status==='READY' && r.freshness!=='STALE' && freshness(r.retrievedAt?.slice(0,10),cutoff,RISK_SOURCE_FRESHNESS_DAYS.legal) && (!r.informationDate||freshness(r.informationDate,cutoff,RISK_SOURCE_FRESHNESS_DAYS.legal)))).filter(s=>s.sourceId.startsWith('external:'+identityMethod+':')||s.rawReference?.startsWith('external:/'+identityMethod+':')).map(s=>s.sourceId);
 for(const [code,key]of [['COMPANY_REGISTRATION_DATE','registrationDate'],['COMPANY_REGION','region'],['COMPANY_OKVED','okvedCode'],['COMPANY_STATUS','status']]as const)add(code,'BUSINESS_PROFILE',profileReady&&profileIds.length?p!.company[key]||null:null,profileIds,profileReady?p!.fetchedAt:null);
 const registered=profileReady&&profileIds.length?p!.company.registrationDate:null;
 let months:number|null=null;if(dateEligible(registered,cutoff)){const x=new Date(registered!),y=new Date(cutoff);months=(y.getUTCFullYear()-x.getUTCFullYear())*12+y.getUTCMonth()-x.getUTCMonth()-Number(y.getUTCDate()<x.getUTCDate());}
 add('COMPANY_AGE_MONTHS','BUSINESS_PROFILE',months,profileIds,profileReady?p!.fetchedAt:null,'MEDIUM',{unit:'MONTHS',sourceClass:'DERIVED_RELATIONSHIP',calculationBasis:'Completed calendar months from reported registration date to explicit asOfDate; no bank minimum age'});
 for(const row of p?.externalFacts?.procurement.items??p?.contracts?.items??[]) if(row.signedAt&&!dateEligible(row.signedAt,cutoff)) warnings.push('CONTEXT_FUTURE_INFORMATION_EXCLUDED:contract:'+row.number);
 const contracts=contractContext(p,a.companyInn,cutoff);
 const ids=contracts?.ids??[],at=contracts?.at??null;
 for(const [code,v] of [['CONTRACT_ACTIVITY_COUNT',contracts?.count],['ACTIVE_CONTRACT_COUNT',contracts?.activeCount],['ACTIVE_CONTRACT_AMOUNT',contracts?.activeAmount]] as const)
   add(code,'CONTRACTS',v??null,ids,at,'MEDIUM',{unit:code.endsWith('AMOUNT')?'RUB':'COUNT'});
 if(p?.externalFacts) add('PROCUREMENT_TOP_CUSTOMER_PERCENT','CONTRACTS',contracts?.share??null,ids,at,'MEDIUM',{unit:'PERCENT'});
 const items=contracts?.items??[];
 add('GOVERNMENT_CONTRACT_PRESENT','CONTRACTS',items.length?items.some(c=>/44|223|94/.test(c.law)):contracts?.complete?false:null,ids,at);
 const caseOut=caseFacts(input,warnings);out.push(...caseOut);
 const reference=caseOut.find(f=>f.semanticCode==='CASE_contractReference');
 if(reference){
   const matches=typeof reference.value==='string'?items.filter(c=>c.active&&normalizeContract(c.number)===normalizeContract(String(reference.value))):[];
   const matched=matches.length===1&&contracts?.complete?true:matches.length||!contracts?.complete||reference.status!=='KNOWN'?null:false;
   const matchIds=matches.length?unique(matches.map(c=>c.sourceId)):ids;
   if(p?.externalFacts && matched===true) matchIds.push(...reference.sourceIds);
   add('CASE_CONTRACT_MATCH','FINANCING_CASE',matched,matchIds,at,'MEDIUM',{
     sourceClass:'DOCUMENT_REPORTED',calculationBasis:'Exact active supplier contract number compared to separately recorded client declaration',
     warnings:matches.length>1?['CONTRACT_MATCH_AMBIGUOUS']:[]});
   if(p?.externalFacts && matched===true){const f=out.at(-1)!;f.evidence=[...f.evidence.filter(e=>!reference.sourceIds.includes(e.sourceId??'')),...reference.evidence];}

 }
 const direct=bankReady?bank?.customers.directGroups??[]:[];
 const largestShare=Math.max(0,...direct.map(g=>g.share));
 const relevantCustomers=p?.externalFacts?direct.filter(g=>g.share===largestShare&&g.share>0):direct;
 const confirmed=items.filter(c=>c.active && relevantCustomers.some(g=>c.customerInn?g.inn===c.customerInn:
   !p?.externalFacts && !!c.customer && g.displayName.trim().toUpperCase()===c.customer.trim().toUpperCase()));
 add('CONCENTRATION_CONTRACT_CONTEXT','CUSTOMER_STRUCTURE',confirmed.length?true:contracts?.complete&&bankReady?false:null,
   confirmed.length?unique([...confirmed.map(c=>c.sourceId),...bs.map(s=>s.sourceId)]):ids,at,p?.externalFacts?'MEDIUM':'LOW',
   {sourceClass:'DOCUMENT_REPORTED',calculationBasis:'Active supplier contract compared with a direct bank customer; historical profiles with a name-only match carry low confidence'});
 const portfolio=a.creditPortfolioV1;
 const portReady=portfolio&&portfolio.companyInn===a.companyInn&&dateEligible(portfolio.asOfDate,cutoff)&&available(portfolio,cutoff);
 if(portfolio&&!portReady)warnings.push('CONTEXT_PORTFOLIO_UNAVAILABLE_OR_FUTURE');
 if(portReady){for(const o of portfolio.obligations){if(o.status.value==='CLOSED')continue;const extra={subjectKey:o.obligationId,portfolioObligationIds:[o.obligationId]};add('OBLIGATION_TYPE','DEBT_STRUCTURE',o.type,o.sourceIds,portfolio.asOfDate,o.identityConfidence,extra);const m=o.currentTerms.maturityDate;add('OBLIGATION_MATURITY','DEBT_STRUCTURE',m.knowledge==='KNOWN'?m.value:null,o.sourceIds,portfolio.asOfDate,weakest(m.confidence,o.identityConfidence),{...extra,calculationBasis:'Known contractual maturity; future due date is not future knowledge'});for(const ev of o.schedule)add('SCHEDULE_DUE_DATE','DEBT_STRUCTURE',ev.dueDate,o.sourceIds,portfolio.asOfDate,o.identityConfidence,{...extra,subjectKey:`${o.obligationId}:${ev.scheduledEventId}`,calculationBasis:'Reported schedule event; no overdue inference'});}}
 const recon=a.reconciliationV1;
 if(recon?.companyInn===a.companyInn)for(const f of recon.findings){const eligible=available(f,cutoff)&&[...f.leftFacts,...f.rightFacts].every(v=>[v.period.from,v.period.to,v.period.asOf].every(d=>!d||dateEligible(d,cutoff))&&!v.sourceIds.some(s=>blocked.has(s)));if(!eligible){warnings.push(`CONTEXT_FUTURE_INFORMATION_EXCLUDED:reconciliation:${f.findingId}`);continue;}add('RECON_OUTCOME','DATA_QUALITY',f.outcome,unique([...f.leftFacts,...f.rightFacts].flatMap(v=>v.sourceIds)),cutoff,f.evidenceConfidence,{subjectKey:f.findingId,reconciliationFindingIds:[f.findingId],calculationBasis:`${f.nature}: ${f.calculationBasis}`});}
 const limited=out.filter(f=>rank(f.confidence)<2);
 add('CONTEXT_LOW_CONFIDENCE_COUNT','DATA_QUALITY',limited.length,unique(limited.flatMap(f=>f.sourceIds)),cutoff,'LOW',{unit:'COUNT',calculationBasis:'Count of context facts with LOW/UNKNOWN evidence confidence; limitation is not borrower weakness'});
 return {facts:out.sort((x,y)=>x.domain.localeCompare(y.domain)||x.semanticCode.localeCompare(y.semanticCode)||(x.subjectKey??'').localeCompare(y.subjectKey??'')||x.factId.localeCompare(y.factId)),warnings:unique(warnings)};
}
