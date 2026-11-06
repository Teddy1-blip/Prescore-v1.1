import type {ExplainabilityInputV1} from '../contracts/explainability.ts';
import type {SourceEnvelope} from '../contracts/sources.ts';

export type DecisionReceipt = Pick<SourceEnvelope, 'sourceId'|'sourceType'|'receivedAt'|'provider'|'upstream'|'direct'|'informationDate'> & {status?:SourceEnvelope['status']};
export function publicReceipt(s: SourceEnvelope): DecisionReceipt {
  const {sourceId,sourceType,receivedAt,provider,upstream,direct,status,informationDate}=s;
  return {sourceId,sourceType,receivedAt,...(provider?{provider}:{}),...(upstream?{upstream}:{}),
    ...(direct!==undefined?{direct}:{}),status,...(informationDate!==undefined?{informationDate}:{})};
}
type Node = {sourceIds?: string[]; riskFindingIds?: string[]; riskFactIds?: string[]; contextFactIds?: string[];
  contextRelationIds?: string[]; indexContributionIds?: string[]; capacityReferenceIds?: string[]; recommendationIds?: string[]};

// Resolve only the upstream edges declared by this calculation or claim.
export function receiptIds(x:ExplainabilityInputV1, path:string[], node:Node, direct:string[]) {
  const ids=new Set(direct), risk=new Set(node.riskFactIds), findings=new Set(node.riskFindingIds);
  const context=new Set(node.contextFactIds), relations=new Set(node.contextRelationIds);
  const capacity=new Set(node.capacityReferenceIds);
  const index=path[0]==='prescoreIndex', readiness=path.length===1&&path[0]==='financingReadiness';
  const component=path.find(k=>k.startsWith('@component:'))?.slice('@component:'.length);
  if(index||readiness){
    for(const c of x.prescoreIndex.coverage.components.filter(c=>!component||c.component===component))
      c.factIds.forEach(id=>risk.add(id));
    for(const c of x.prescoreIndex.contributions.filter(c=>!component||c.component===component)){
      findings.add(c.riskFindingId);c.contextRelationIds.forEach(id=>relations.add(id));
    }
    x.prescoreIndex.globalStopFindingIds.forEach(id=>findings.add(id));
  }
  if(readiness){
    x.financingReadiness.caseDefinition.facts.forEach(f=>context.add(f.factId));
    for(const c of x.financingReadiness.constraints){c.riskFindingIds.forEach(id=>findings.add(id));c.contextRelationIds.forEach(id=>relations.add(id));}
  }
  for(const r of x.contextAssessment.relations) if(relations.has(r.relationId)) r.contextFactIds.forEach(id=>context.add(id));
  for(const f of x.riskAssessment.findings) if(findings.has(f.findingId)) f.factIds.forEach(id=>risk.add(id));
  for(const f of x.riskAssessment.facts) if(risk.has(f.factId)) f.sourceIds.forEach(id=>ids.add(id));
  for(const f of x.contextAssessment.facts) if(context.has(f.factId)) f.sourceIds.forEach(id=>ids.add(id));
  const refs=x.debtCapacity.headlineCapacity.references.filter(r=>capacity.has(r.referenceId) || path[0]==='debtCapacity'&&path.length===1);
  if(refs.some(r=>r.kind==='BANK_MONTH'||r.kind==='BANK_METRIC')) for(const s of x.sourceReceipts??[]) if(s.sourceType==='BANK_STATEMENT' && s.status==='READY') ids.add(s.sourceId);
  for(const r of refs) if(r.obligationId) x.creditPortfolio?.obligations.find(o=>o.obligationId===r.obligationId)?.sourceIds.forEach(id=>ids.add(id));
  return [...ids].sort();
}
export function receiptLabel(s:DecisionReceipt) {
  const providers={CHECKO:'Checko', EIS_DIRECT:'ЕИС', FNS_DIRECT:'ФНС'};
  const authorities={FNS:'ФНС',FSSP:'ФССП',KAD:'КАД',INSPECTIONS:'реестр проверок',FEDRESURS:'Федресурс',EIS:'ЕИС',FAS:'ФАС',UNKNOWN:''};
  if(!s.provider) return '';
  return [providers[s.provider],s.direct?'прямой источник':s.upstream?authorities[s.upstream]:''].filter(Boolean).join(' · ');
}
