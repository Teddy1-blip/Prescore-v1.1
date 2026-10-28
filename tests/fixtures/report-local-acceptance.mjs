// Isolated source scenario resembling the accepted live controls, never a live payload.
import {integrationB} from './integration-b.mjs';
import {loadWorkspaceModelV1} from '../../lib/workspace/service.ts';
export async function reportAcceptanceModel(){
 const {analysis}=integrationB({noLegal:true});
 analysis.id='synthetic:report-local-acceptance';analysis.createdAt='2026-10-28T07:00:00.000Z';
 analysis.financialStatementsV2=analysis.financialStatementsV2.filter(s=>s.period.year!==2024);
 for(const source of [...analysis.sourceManifest.bankStatements,analysis.sourceManifest.bfo,analysis.sourceManifest.quarterly,analysis.sourceManifest.bki])source.receivedAt='2026-10-28';
 return loadWorkspaceModelV1(analysis.id,{readAccess:async()=>({access:'owner',row:{payload:JSON.stringify(analysis),companyInn:analysis.companyInn,ownerEmail:'isolated@example.invalid'}}),readTier:async()=>'FULL',readProfile:async()=>undefined,readOperations:async()=>({})});
}
