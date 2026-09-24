import {notFound} from 'next/navigation';
import {WorkspaceLab} from '../../workspace-v3/lab';
import {businessCatalog,loadBusiness} from '../../../lib/credit-engine/credit-lab/business-corpus.mjs';
import {buildCanonicalCreditAnalysis} from '../../../lib/credit-engine/production/orchestrator.ts';
import {publicCanonicalModel} from '../../../lib/credit-engine/production/public-model.ts';
export const dynamic='force-dynamic';
// Existing dashboard layout requires authentication. Synthetic view never accesses runtime DB.
export default async function Page({searchParams}:{searchParams:Promise<{case?:string;view?:string;role?:string}>}){
 if(process.env.PRESCORE_BASE_URL?.replace(/\/$/,'')!=='https://prescore-staging-dorogovab.amvera.io')notFound();
 const q=await searchParams;
 const models=Object.fromEntries(businessCatalog().map((c:{caseId:string})=>{const r=buildCanonicalCreditAnalysis(loadBusiness(c.caseId).input);return[c.caseId,publicCanonicalModel(r.model,r)];}));
 return <WorkspaceLab models={models} initialCase={q.case} initialView={q.view} initialRole={q.role==='BROKER'?'BROKER':'CLIENT'}/>;
}
