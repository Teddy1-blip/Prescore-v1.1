import {stagingOwnerWorkspace} from '../platform/staging-access.ts';
import type {SettlementState} from './settlement-events.ts';
import {createHash} from 'node:crypto';
import type {QueryExecutor} from '../db/compatibility.ts';
import {dossierTier,visibleProjection} from './dossier-view.ts';
import {stable} from '../credit-engine/credit-portfolio/common.ts';
import {resolveAnalysisTier,type EntitlementDatabase} from '../entitlements.ts';
import {readDecisionRevision,type DecisionRevisionDatabase} from '../credit-engine/production/decision-history.ts';
export type DossierDecisionRef={analysisId:string;snapshotId:string};
type Owner={email:string;isAdmin:boolean};
type Company={id:string;inn:string};
export type ReportSettlement=Pick<SettlementState,'party'|'contract'|'account'|'asOf'|'debit'|'credit'|'conflict'|'references'>;
export type DossierReport=Pick<Awaited<ReturnType<typeof visibleProjection>>,'financial'|'obligations'|'portfolioAsOf'|'claims'|'entitlement'|'sources'>&{name:string|null;matrix?:import('./statement-matrix.ts').StatementMatrix;decision?:DossierDecisionRef;settlements?:ReportSettlement[]};
/** Resolve the pinned edition through both the dossier owner and the current analysis entitlement. */
export async function ownedReportDecision(db:EntitlementDatabase & DecisionRevisionDatabase,user:Owner,company:Company,ref:DossierDecisionRef){
 if(typeof ref.analysisId!=='string'||!ref.analysisId||ref.analysisId.length>180||!/^sha256:[0-9a-f]{64}$/.test(ref.snapshotId))return null;
 const active=await db.prepare("SELECT id FROM analyses WHERE id=? AND owner_email=? AND company_inn=? AND archive_state='ACTIVE'")
   .bind(ref.analysisId,user.email,company.inn).first();
 if(!active)return null;
 const tier=await resolveAnalysisTier(db,{analysisId:ref.analysisId,userEmail:user.email,companyInn:company.inn,privileged:user.isAdmin,readOnly:true});
 if(tier!=='FULL')return null;
 const revision=await readDecisionRevision(db,ref.analysisId,ref.snapshotId);
 if(revision?.model.company.inn!==company.inn||revision.model.meta.snapshot?.snapshotId!==ref.snapshotId)return null;
 return revision;
}
export async function issueDossierReport(db:QueryExecutor,user:Owner,company:Company,decision?:DossierDecisionRef){
 const result=await visibleProjection(db,user,company,!decision);
 const model:DossierReport={...(decision?{decision}:{}),name:result.publicProfile?.company.name??null,...(result.matrix.periods.length?{matrix:result.matrix}:{}),financial:result.financial,obligations:result.obligations,portfolioAsOf:result.portfolioAsOf,
   claims:result.claims,entitlement:result.entitlement,sources:result.sources.filter(s=>s.kind!=='CALENDAR')};
 if(stagingOwnerWorkspace(user.email)&&result.settlements.length){
   model.settlements=result.settlements.map(({party,contract,account,asOf,debit,credit,conflict,references})=>
     ({party,contract,account,asOf,debit,credit,conflict,references}));
 }
 const id=createHash('sha256').update(stable([company.id,model])).digest('hex');
 await db.query('INSERT INTO dossier_reports(id,dossier_id,tier,public_model) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',[id,company.id,model.entitlement,JSON.stringify(model)]);
 return id;
}
export async function readDossierReport(db:QueryExecutor,user:Owner,company:Company,id:string){
 const tier=await dossierTier(db,user,company);
 const row=(await db.query("SELECT r.public_model FROM dossier_reports r JOIN company_dossiers d ON d.id=r.dossier_id WHERE r.id=$1 AND d.id=$2 AND d.owner_email=$3 AND (r.tier='BASIC' OR $4='FULL')",[id,company.id,user.email,tier])).rows[0];
 return row?.public_model as DossierReport|undefined;
}
