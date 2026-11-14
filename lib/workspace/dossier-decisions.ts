import type {SourceRow} from './dossier-sources.ts';
import type {ProfileRiskInput} from '../credit-engine/contracts/risk.ts';
import type {FinancialAnalysisV2} from '../credit-engine/contracts/financial-statements.ts';
import type {CreditPortfolioV1} from '../credit-engine/contracts/credit-portfolio.ts';
import {financialFacts} from '../credit-engine/risk/adapters/financial.ts';
import {legalFacts} from '../credit-engine/risk/adapters/legal.ts';
import {bkiFacts} from '../credit-engine/risk/adapters/bki.ts';
import {portfolioFacts} from '../credit-engine/risk/adapters/portfolio.ts';
import {evaluateRiskFacts} from '../credit-engine/risk/engine.ts';
import {buildContextAssessment} from '../credit-engine/context/engine.ts';
import {decisionStages} from '../credit-engine/production/orchestrator.ts';
import {buildExplainability} from '../credit-engine/explainability/engine.ts';
import {publicReceipt,type DecisionReceipt} from '../credit-engine/explainability/receipts.ts';

export function dossierDecisions(rows:SourceRow[],inn:string,financial:FinancialAnalysisV2|undefined,portfolio:CreditPortfolioV1,asOfDate:string){
 const profile=rows.flatMap(r=>r.payload.publicProfile??[]).at(-1);
 const bureau=rows.filter(r=>r.payload.bki).sort((a,b)=>a.payload.bki!.reportDate.localeCompare(b.payload.bki!.reportDate)||a.id.localeCompare(b.id)).at(-1);
 const input:ProfileRiskInput={analysis:{companyInn:inn,financialAnalysisV2:financial,creditPortfolioV1:portfolio,creditHistory:bureau?.payload.bki,
   sourceManifest:{bankStatements:[],bki:bureau?.payload.envelope,financialUploads:rows.filter(r=>r.payload.snapshot).map(r=>r.payload.envelope)}},companyProfile:profile,asOfDate};
 const financialInputs=financialFacts(input);
 const facts=[...financialInputs,...legalFacts(input,financialInputs),...bkiFacts(input),...portfolioFacts(input)];
 const risk=evaluateRiskFacts({companyInn:inn,asOfDate,facts});
 const context=buildContextAssessment({...input,riskAssessment:risk});
 const decisions=decisionStages(risk,context,portfolio,asOfDate);
 const receipts=new Map<string,DecisionReceipt>(rows.map(r=>[r.id,publicReceipt(r.payload.envelope)]));
 if(profile?.sourceManifest?.bfo){const s=profile.sourceManifest.bfo;receipts.set(s.sourceId,publicReceipt(s));}
 for(const s of profile?.sourceManifest?.external??[])receipts.set(s.sourceId,publicReceipt(s));
 for(const r of profile?.externalFacts?.receipts??[])if(r.retrievedAt)receipts.set(r.id,{sourceId:r.id,sourceType:r.provider==='CHECKO'?'CHECKO':'EIS',provider:r.provider,upstream:r.authority,direct:r.direct,receivedAt:r.retrievedAt,informationDate:r.informationDate});
 const explanation=buildExplainability({...decisions,sourceReceipts:[...receipts.values()]});
 return explanation.claims.flatMap(claim=>{
   const references=explanation.sourceReferences.filter(ref=>claim.sourceReferenceIds.includes(ref.sourceReferenceId));
   const sources=Array.from(new Map(references.flatMap(ref=>ref.receipts??[]).map(r=>[r.sourceId,r])).values());
   if(!sources.length||!['FINDING','DATA_LIMITATION','RECOMMENDATION','ACTION_PLAN','PRODUCT_FIT'].includes(claim.claimKind))return [];
   if(claim.claimKind==='PRODUCT_FIT'&&!decisions.productSelection.primaryCandidateProducts.some(f=>claim.productFamilies.includes(f)))return [];
   const findings=risk.findings.filter(f=>claim.riskFindingIds.includes(f.findingId));
   const ruleIds=findings.map(f=>f.code);
   const stage=claim.claimKind==='PRODUCT_FIT'?'product':claim.claimKind==='ACTION_PLAN'?'plan':claim.claimKind==='RECOMMENDATION'?'recommendation':findings.some(f=>decisions.creditAssessment.globalStop.findingIds.includes(f.findingId))?'stop':'expert';
   const plan=decisions.actionPlan.items.find(item=>claim.planItemIds.includes(item.planItemId));
   return [{id:claim.claimId,stage,ruleIds,claimCode:claim.claimCode,title:claim.titleRu,text:claim.textRu,sourceIds:sources.map(s=>s.sourceId),sources:sources.map(s=>({type:s.sourceType,date:s.informationDate??s.receivedAt.slice(0,10),periods:references.filter(ref=>ref.receipts?.some(r=>r.sourceId===s.sourceId)).flatMap(ref=>ref.periodFrom||ref.periodTo?[{from:ref.periodFrom,to:ref.periodTo,asOf:ref.asOf}]:[])})),horizon:plan?.horizon}];
 });
}
