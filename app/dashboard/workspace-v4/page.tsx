import { notFound } from "next/navigation";
import { loadBusiness, businessCatalog } from "../../../lib/credit-engine/credit-lab/business-corpus.mjs";
import { buildCanonicalCreditAnalysis } from "../../../lib/credit-engine/production/orchestrator.ts";
import { publicCanonicalModel } from "../../../lib/credit-engine/production/public-model.ts";
import { buildWorkspaceBasicV1, WORKSPACE_MODEL_VERSION, type WorkspaceModelV1 } from "../../../lib/workspace/model.ts";
import ClientHomeV4 from "../../components/workspace-v4/client-home.tsx";

export const dynamic="force-dynamic";

export default async function WorkspaceV4Page({searchParams}:{searchParams:Promise<{case?:string;mode?:string}>}){
  if(process.env.PRESCORE_BASE_URL?.replace(/\/$/, "")!=="https://prescore-staging-dorogovab.amvera.io") notFound();
  const q=await searchParams;
  const caseId=q.case??"CL-RU-BUS-001";
  const catalog=businessCatalog() as Array<{caseId:string}>;
  if(!catalog.some(c=>c.caseId===caseId)) notFound();
  const bundle=loadBusiness(caseId);
  const result=buildCanonicalCreditAnalysis(bundle.input);
  const full=publicCanonicalModel(result.model,result);
  const basic=buildWorkspaceBasicV1(bundle.input.analysis);
  const mode=q.mode==="basic"?"basic":"full";
  const model:WorkspaceModelV1={
    version:WORKSPACE_MODEL_VERSION,
    analysisId:bundle.input.analysis.id,
    tier:mode==="full"?"FULL":"FREE",
    accessRole:"owner",
    readOnly:false,
    basic,
    full:mode==="full"?{status:"READY",model:full}:{status:"LOCKED"},
  };
  return <ClientHomeV4 model={model} caseId={caseId} mode={mode}/>;
}
