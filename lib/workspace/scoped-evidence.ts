import type {WorkspaceModelV1} from './model.ts';

export type SourceScope='home'|'bfo'|'obligations'|'counterparties';
export function scopedEvidence(full:WorkspaceModelV1['full'],scope:SourceScope) {
  const report=full?.report, canonical=full?.canonical;
  const claims=canonical?.explainability?.claims??[];
  const refs=canonical?.explainability?.sourceReferences??[];
  function matches(claimId:string){
    if(scope==='home')return true;
    const claim=claims.find(c=>c.claimId===claimId);
    if(!claim)return false;
    return refs.some(ref=>claim.sourceReferenceIds.includes(ref.sourceReferenceId)&&ref.receipts?.some(receipt=>
      receipt.status==='READY'&&(scope==='bfo'?['BFO','QUARTERLY'].includes(receipt.sourceType):
      scope==='obligations'?receipt.sourceType==='BKI'||(claim.portfolioObligationIds.length>0 && claim.sourceIds.includes(receipt.sourceId)):
      false)));
  }
  const sections=(report?.detailedSections??[]).map(s=>({...s,factors:s.factors.filter(f=>matches(f.claimId))})).filter(s=>s.factors.length);
  const stop=canonical?.creditAssessment?.globalStop;
  const factors=[...(report?.primaryFactors??[]),...(report?.readiness.constraints??[]),...sections.flatMap(s=>s.factors)];
  const stopFactor=stop?.status==='PRESENT'?factors.find(f=>matches(f.claimId)&&claims.find(c=>c.claimId===f.claimId)?.riskFindingIds.some(id=>stop.findingIds.includes(id))):undefined;
  const recommendation=[...(report?.recommendations.primary??[]),...(report?.recommendations.backlog??[])].find(item=>matches(item.claimId));
  const action=report?.actionPlan.horizons.flatMap(h=>h.items).find(item=>matches(item.claimId));
  return {sections,stopFactor,recommendation,action};
}
