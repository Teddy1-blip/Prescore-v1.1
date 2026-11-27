import type {AnalysisResult} from '../prescore.ts';
import type {QueryExecutor} from '../db/compatibility.ts';
import type {SourceEnvelope} from '../credit-engine/contracts/sources.ts';
import {dossierPortfolioLabel} from '../credit-engine/explainability/receipts.ts';

export type ReadPortfolioReceipts=(owner:string,inn:string,sourceIds:string[])=>Promise<SourceEnvelope[]>;

export function portfolioReceiptReader(pool:QueryExecutor):ReadPortfolioReceipts{
  return async(owner,inn,sourceIds)=>{
    const result=await pool.query(
      `SELECT s.payload->'envelope' AS envelope FROM dossier_sources s
       JOIN company_dossiers d ON d.id=s.dossier_id
       WHERE d.owner_email=$1 AND d.company_inn=$2 AND s.source_id=ANY($3::text[])
       AND s.source_id=s.payload->'envelope'->>'sourceId' ORDER BY s.source_id`,
      [owner,inn,sourceIds]);
    return result.rows.map(row=>row.envelope as SourceEnvelope);
  };
}

// Earlier saved analyses kept the observation but omitted its original upload receipt.
// Recover only identities already used in this version. Never attach a newer dossier observation.
export async function restorePortfolioReceipts(analysis:AnalysisResult,owner:string,read:ReadPortfolioReceipts):Promise<AnalysisResult>{
  const manifest=analysis.sourceManifest;
  if(!manifest)return analysis;
  const present=new Set(manifest.external?.map(source=>source.sourceId));
  const missing=new Set<string>();
  for(const observation of analysis.creditPortfolioV1?.observationHistory??[]){
    if(observation.companyInn!==analysis.companyInn)continue;
    for(const {sourceId} of observation.evidence){
      if(sourceId && !present.has(sourceId) && dossierPortfolioLabel(sourceId))missing.add(sourceId);
    }
  }
  if(!missing.size)return analysis;
  const rows=await read(owner,analysis.companyInn,[...missing]);
  const receipts=rows.filter(s=>s.companyInn===analysis.companyInn && s.sourceType==='OTHER' && missing.has(s.sourceId))
    .map(s=>({...s,status:'READY' as const}));
  return receipts.length?{...analysis,sourceManifest:{...manifest,external:[...(manifest.external??[]),...receipts]}}:analysis;
}
