import {createHash} from 'node:crypto';
import type {QueryExecutor} from '../db/compatibility.ts';
import {dossierTier,visibleProjection} from './dossier-view.ts';
import {stable} from '../credit-engine/credit-portfolio/common.ts';
type Owner={email:string;isAdmin:boolean};
type Company={id:string;inn:string};
export type DossierReport=Pick<Awaited<ReturnType<typeof visibleProjection>>,'financial'|'obligations'|'portfolioAsOf'|'claims'|'entitlement'|'sources'>&{name:string|null};
export async function issueDossierReport(db:QueryExecutor,user:Owner,company:Company){
 const result=await visibleProjection(db,user,company);
 const model:DossierReport={name:result.publicProfile?.company.name??null,financial:result.financial,obligations:result.obligations,portfolioAsOf:result.portfolioAsOf,
   claims:result.claims,entitlement:result.entitlement,sources:result.sources.filter(s=>s.kind!=='CALENDAR')};
 const id=createHash('sha256').update(stable([company.id,model])).digest('hex');
 await db.query('INSERT INTO dossier_reports(id,dossier_id,tier,public_model) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',[id,company.id,model.entitlement,JSON.stringify(model)]);
 return id;
}
export async function readDossierReport(db:QueryExecutor,user:Owner,company:Company,id:string){
 const tier=await dossierTier(db,user,company);
 const row=(await db.query("SELECT r.public_model FROM dossier_reports r JOIN company_dossiers d ON d.id=r.dossier_id WHERE r.id=$1 AND d.id=$2 AND d.owner_email=$3 AND (r.tier='BASIC' OR $4='FULL')",[id,company.id,user.email,tier])).rows[0];
 return row?.public_model as DossierReport|undefined;
}
