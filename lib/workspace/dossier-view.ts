import type {QueryExecutor} from '../db/compatibility.ts';
import {dossierSources,sourceProjection} from './dossier-sources.ts';
import {stagingFullAccessEnabled} from '../platform/staging-access.ts';
import {ownerPreviewFullAccess} from '../platform/owner-preview-access.ts';
import {profileView} from '../external/checko-profile.ts';
export async function dossierTier(pool:QueryExecutor,user:{email:string;isAdmin:boolean},company:{inn:string}){
 const full=user.isAdmin||ownerPreviewFullAccess(user.email)||stagingFullAccessEnabled()||(await pool.query(`SELECT 1 FROM billing_subscriptions s JOIN billing_periods p ON p.subscription_id=s.id
    WHERE s.owner_email=$1 AND s.company_inn=$2 AND s.status='ACTIVE' AND p.status='ACTIVE' AND now()>=s.access_from AND now()<s.access_until AND now()>=p.starts_at AND now()<p.ends_at LIMIT 1`,[user.email,company.inn])).rows.length>0;
 return full?'FULL' as const:'BASIC' as const;
}
export async function visibleProjection(pool:QueryExecutor,user:{email:string;isAdmin:boolean},company:{id:string;inn:string}){
  const rows=await dossierSources(pool,user.email,company.id);
  const tier=await dossierTier(pool,user,company),entitled=tier==='FULL';
  const result=sourceProjection(rows,company.inn,entitled);
  if(!entitled){
    result.claims=[];
    result.settlements=result.settlements.map(p=>({...p,history:p.history.filter(e=>e.kind!=='TASK'&&e.kind!=='PROMISE')}));
    result.bureauReports=[]; result.obligations=[]; result.schedule=[]; result.calendar=[]; result.portfolioAsOf=null;
    result.ledger=result.ledger.filter(row=>row.kind==='COUNTERPARTIES');
    result.reviews=result.reviews.filter(review=>!rows.some(r=>r.id===review.id&&['BKI','CREDIT_DOCUMENT'].includes(r.kind)));
    const annual=result.financial?.history.filter(p=>p.period.kind==='ANNUAL')??[];
    const ids=new Set(annual.map(p=>p.id));
    result.lines=result.lines.filter(s=>ids.has(s.id));
    if(result.financial){
      result.financial.history=annual;
      const freeRatios=new Set(['currentRatio','netMargin']);
      for(const period of annual){
        period.groups=period.groups.map(g=>g.key==='amounts'?g:{...g,metrics:g.metrics.filter(m=>freeRatios.has(m.key))}).filter(g=>g.metrics.length);
      }
      const metrics=new Set(annual.flatMap(p=>p.groups.flatMap(g=>g.metrics.map(m=>m.key))));
      result.financial.trends=result.financial.trends.filter(t=>ids.has(t.currentId)&&t.previousId!==null&&ids.has(t.previousId)&&metrics.has(t.absolute.key)&&t.comparability.startsWith('COMPARABLE'));
    }
  }
  const saved=rows.filter(r=>r.kind==='CHECKO').at(-1)?.payload.publicProfile;
  return {...result,publicProfile:saved?profileView(saved,entitled?'FULL':'FREE'):null,entitlement:tier};
}
