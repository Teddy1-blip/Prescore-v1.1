import type {QueryExecutor} from '../db/compatibility.ts';
import {dossierSources,sourceProjection} from './dossier-sources.ts';
import {stagingFullAccessEnabled} from '../platform/staging-access.ts';
import {profileView} from '../external/checko-profile.ts';
export async function dossierTier(pool:QueryExecutor,user:{email:string;isAdmin:boolean},company:{inn:string}){
 const full=user.isAdmin||stagingFullAccessEnabled()||(await pool.query(`SELECT 1 FROM billing_subscriptions s JOIN billing_periods p ON p.subscription_id=s.id
    WHERE s.owner_email=$1 AND s.company_inn=$2 AND s.status='ACTIVE' AND p.status='ACTIVE' AND now()>=s.access_from AND now()<s.access_until AND now()>=p.starts_at AND now()<p.ends_at LIMIT 1`,[user.email,company.inn])).rows.length>0;
 return full?'FULL' as const:'BASIC' as const;
}
export async function visibleProjection(pool:QueryExecutor,user:{email:string;isAdmin:boolean},company:{id:string;inn:string}){
  const rows=await dossierSources(pool,user.email,company.id);
  const tier=await dossierTier(pool,user,company),entitled=tier==='FULL';
  const result=sourceProjection(rows,company.inn,entitled);
  if(!entitled){result.claims=[];result.lines=result.lines.filter(s=>result.sources.some(r=>r.documentId&&r.id===s.sourceId));}
  if(!entitled && result.financial){
    const uploaded=new Set(rows.filter(r=>r.payload.snapshot).map(r=>r.payload.snapshot!.snapshotId));
    result.financial.history=result.financial.history.filter(p=>uploaded.has(p.id));
    result.financial.trends=[];
    for(const period of result.financial.history)period.groups=period.groups.filter(g=>g.key==='amounts');
  }
  const saved=rows.filter(r=>r.kind==='CHECKO').at(-1)?.payload.publicProfile;
  return {...result,publicProfile:saved?profileView(saved,entitled?'FULL':'FREE'):null,entitlement:tier};
}
