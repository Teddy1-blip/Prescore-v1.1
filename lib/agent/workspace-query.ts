import {clientSelect, applicationSelect} from './scoped-sql';
import {documentAccessSQL,dossierAuthorizationSQL} from '../auth/broker-authorizations';
import {averagePartnerCommissionRate} from '../partner-commissions';
import {closedStatuses} from './workflow';

type Row=Record<string,unknown>;
type Statement={bind:(...args:unknown[])=>Statement;run:()=>Promise<unknown>;first:<T=Row>()=>Promise<T|null>};
type DB={prepare:(sql:string)=>Statement;batch:(statements:Statement[])=>Promise<{results:unknown[]}[]>};
type Page={page:number;limit:number;offset:number};
const terminal=closedStatuses.map(s=>"'"+s+"'").join(',');
const clients='WITH clients AS ('+clientSelect+'), apps AS ('+applicationSelect+') ';
const applicationBase='WITH apps AS ('+applicationSelect+') ';
const unavailable=()=>Response.json({error:'Запись недоступна в этом кабинете.'},{status:404});
export async function agentWorkspaceProjection(db:DB,email:string,code:string,params:URLSearchParams,page:Page,info:object) {
  const surface=params.get('surface'),id=params.get('id')??'';
  const auth=[email,code],both=[...auth,...auth];
  const read=async(sql:string,args:unknown[]=[]) => (await db.batch([db.prepare(sql).bind(...args)]))[0].results as Row[];
  const paged=async(sql:string,args:unknown[])=>{
    const rows=await read(sql+' LIMIT ? OFFSET ?',[...args,page.limit+1,page.offset]);
    return {items:rows.slice(0,page.limit),hasNext:rows.length>page.limit};
  };
  const result=(data:object)=>Response.json({...info,asOf:new Date().toISOString(),...data},{headers:{'Cache-Control':'private, no-store'}});
  if(surface==='shell'||surface==='partners')return result({});
  if(surface==='home'){
    const [metrics]=await read(clients+`SELECT (SELECT COUNT(*) FROM clients) AS clients,
      (SELECT COUNT(*) FROM clients WHERE "analysisId" IS NOT NULL) AS analyzed,
      COUNT(*) FILTER (WHERE status NOT IN (${terminal})) AS active,
      COUNT(*) FILTER (WHERE status IN ('Требуются документы','Подготовка документов')) AS documents,
      COUNT(*) FILTER (WHERE status IN ('Одобрена','Выдана')) AS approved,
      SUM("calculatedLimit") AS forecastBase FROM apps`,both);
    const leads=await read(clients+'SELECT * FROM clients ORDER BY "updatedAt" DESC,id DESC LIMIT 8',both);
    const pending=await read(clients+'SELECT * FROM clients WHERE "analysisId" IS NULL ORDER BY "updatedAt",id LIMIT 8',both);
    const applications=await read(applicationBase+`SELECT * FROM apps WHERE status NOT IN (${terminal})
      ORDER BY CASE WHEN status='Требуются документы' THEN 0 ELSE 1 END,"updatedAt",id LIMIT 12`,auth);
    const events=await read(applicationBase+`SELECT h.application_id AS applicationId,a."companyName",h.to_status AS status,h.created_at AS createdAt
      FROM application_status_history h JOIN apps a ON a.id=h.application_id ORDER BY h.created_at DESC,h.id DESC LIMIT 12`,auth);
    return result({metrics,forecast:Number(metrics.forecastBase)*averagePartnerCommissionRate,leads,pending,applications,events});
  }
  if(surface==='clients'||surface==='applications'||surface==='pipeline'){
    const q='%'+(params.get('q')??'').trim().toLowerCase()+'%',filter=params.get('filter')??'';
    const leadFilter=filter==='ready'?' AND c."analysisId" IS NOT NULL':filter==='missing'?' AND c."analysisId" IS NULL':'';
    const leadStatus=params.get('status')||'';
    const l=surface==='applications'?{items:[],hasNext:false}:await paged(clients+`SELECT c.*,
      (SELECT COUNT(*) FROM apps a WHERE a."leadId"=c.id AND a.status NOT IN (${terminal})) AS activeCount,
      (SELECT bs.status FROM billing_subscriptions bs WHERE bs.company_inn=c."companyInn" AND bs.status='ACTIVE' AND bs.access_until>now()
        AND EXISTS (SELECT 1 FROM billing_orders bo JOIN billing_periods bp ON bp.order_id=bo.id WHERE bp.subscription_id=bs.id
          AND bo.broker_code=? AND bo.status='PAID' AND bp.status='ACTIVE' AND bp.starts_at<=now() AND bp.ends_at>now())
          AND bs.access_from<=now() LIMIT 1) AS activeSubscription,
      (SELECT a."nextAction" FROM apps a WHERE a."leadId"=c.id AND a.status NOT IN (${terminal}) ORDER BY a."updatedAt" DESC,a.id LIMIT 1) AS nextAction
      FROM clients c WHERE lower(concat_ws(' ',c."companyName",c."companyInn",c."contactName",c.phone,c.email)) LIKE ?
      AND (?='' OR c.status=?)`+leadFilter+' ORDER BY c."updatedAt" DESC,c.id DESC',[...both,code,q,leadStatus,leadStatus]);
    const appFilter=filter==='active'?' AND status NOT IN ('+terminal+')':filter==='closed'?' AND status IN ('+terminal+')':filter==='documents'?" AND status IN ('Требуются документы','Подготовка документов')":filter==='approved'?" AND status IN ('Одобрена','Выдана')":'';
    const a=surface==='clients'?{items:[],hasNext:false}:await paged(applicationBase+`SELECT * FROM apps WHERE lower(concat_ws(' ',"companyName",bank,product)) LIKE ?
      AND (?='' OR status=?)`+appFilter+' ORDER BY "updatedAt" DESC,id DESC',[...auth,q,leadStatus,leadStatus]);
    return result({leads:l.items,applications:a.items,hasNext:l.hasNext||a.hasNext});
  }
  if(surface==='client'){
    // Legacy bookmarks identify the exact analysis. Never substitute another analysis for an unavailable bookmark.
    const analysisKey=params.get('analysisId')??'';
    const analysisSQL=`SELECT a.id,a.company_inn AS companyInn,a.company_name AS companyName,a.created_at AS createdAt
      FROM analyses a CROSS JOIN (SELECT ?::text AS email) actor WHERE a.archive_state='ACTIVE'
      AND (a.owner_email=actor.email OR ${dossierAuthorizationSQL('a','actor.email')})`;
    let [lead]=await read(clients+'SELECT * FROM clients WHERE id=?',[...both,id]);
    if(!lead && analysisKey===id){
      const [analysis]=await read(analysisSQL+' AND a.id=?',[email,id]);
      if(!analysis)return unavailable();
      [lead]=await read(clients+'SELECT * FROM clients WHERE "companyInn"=? ORDER BY "updatedAt" DESC,id LIMIT 1',[...both,analysis.companyInn]);
      if(!lead)return result({lead:null,analyses:[analysis],applications:[],hasNext:false});
    }
    if(!lead)return unavailable();
    const analyses=await read(analysisSQL+' AND a.company_inn=? ORDER BY a.created_at DESC,a.id',[email,lead.companyInn]);
    if(analysisKey && !analyses.some(a=>a.id===analysisKey))return unavailable();
    const a=await paged(applicationBase+'SELECT * FROM apps WHERE "leadId"=? ORDER BY "updatedAt" DESC,id DESC',[...auth,lead.id]);
    return result({lead,analyses,applications:a.items,hasNext:a.hasNext});
  }
  if(surface==='application'){
    const [application]=await read(applicationBase+'SELECT * FROM apps WHERE id=?',[...auth,id]);
    if(!application)return unavailable();
    const [lead]=await read(clients+'SELECT * FROM clients WHERE id=?',[...both,application.leadId]);
    const history=await read(applicationBase+`SELECT h.id,h.from_status AS fromStatus,h.to_status AS toStatus,
      h.public_comment AS comment,h.created_at AS createdAt FROM application_status_history h JOIN apps a ON a.id=h.application_id
      WHERE a.id=? ORDER BY h.created_at DESC,h.id DESC`,[...auth,id]);
    return result({application,lead,history});
  }
  if(surface==='network'){
    const agents=await paged(`SELECT p.agent_code AS agentCode,p.name,p.agency,p.city,
      (SELECT COUNT(*) FROM agent_leads l WHERE l.agent_code=p.agent_code) AS clientsCount,
      (SELECT COUNT(DISTINCT bs.id) FROM billing_subscriptions bs JOIN billing_periods bp ON bp.subscription_id=bs.id
       JOIN billing_orders bo ON bo.id=bp.order_id WHERE bo.broker_code=p.agent_code AND bo.curator_code=p.curator_code
       AND bo.status='PAID' AND bp.status='ACTIVE' AND bp.starts_at<=now() AND bp.ends_at>now()
       AND bs.status='ACTIVE' AND bs.access_from<=now() AND bs.access_until>now()) AS activeSubscriptions,
      (SELECT SUM(c.amount_minor+c.adjustment_minor-c.reversal_minor) FROM billing_commissions c JOIN billing_orders bo ON bo.id=c.order_id
       WHERE c.beneficiary_code=p.curator_code AND c.role='CURATOR' AND bo.broker_code=p.agent_code) AS accruedMinor
      FROM agent_partners p WHERE p.curator_code=? ORDER BY p.created_at DESC,p.agent_code`,[code]);
    return result({agents:agents.items,hasNext:agents.hasNext,referralPath:'/agent-ref/'+encodeURIComponent(code)});
  }
  if(surface==='documents'){
    const q='%'+(params.get('q')??'').toLowerCase().trim()+'%';
    const docs=await paged(clients+`SELECT d.id,d.file_name AS fileName,d.category,d.status,d.uploaded_by AS uploadedBy,
      d.created_at AS createdAt,d.application_id AS applicationId,d.analysis_id AS analysisId,
      COALESCE(a."companyName",l."companyName") AS companyName,COALESCE(a."leadId",l.id) AS clientId
      FROM client_documents d CROSS JOIN (SELECT ?::text AS email) actor
      LEFT JOIN apps a ON a.id=d.application_id
      LEFT JOIN LATERAL (SELECT * FROM clients c WHERE c."companyInn"=d.company_inn ORDER BY c."updatedAt" DESC,c.id LIMIT 1) l ON true
      WHERE (a.id IS NOT NULL OR l.id IS NOT NULL) AND ${documentAccessSQL('d','actor.email')}
      AND lower(concat_ws(' ',a."companyName",l."companyName",d.company_inn,d.file_name,d.category)) LIKE ?
      ORDER BY d.created_at DESC,d.id DESC`,[...both,email,q]);
    return result({documents:docs.items,hasNext:docs.hasNext});
  }
  if(surface==='notifications'){
    const e=await paged(applicationBase+`SELECT h.id,h.application_id AS applicationId,a."companyName",h.to_status AS status,h.created_at AS createdAt
      FROM application_status_history h JOIN apps a ON a.id=h.application_id ORDER BY h.created_at DESC,h.id DESC`,auth);
    return result({events:e.items,hasNext:e.hasNext});
  }
  return Response.json({error:'Неизвестный раздел кабинета'},{status:400});
}
