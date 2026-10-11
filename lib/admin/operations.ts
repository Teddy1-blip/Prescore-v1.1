import type {PortableDatabase} from '../db/compatibility.ts';
import {logicalApplications} from './companies.ts';
import {pageRows,rows,CLOSED,type AdminQuery} from './resources.ts';
export async function brokerList(db:PortableDatabase,q:AdminQuery){
 const sql=`WITH apps AS (${logicalApplications}) SELECT aa.agent_code AS agentCode,aa.name,aa.user_email AS email,p.status,p.agency,p.city,p.curator_code AS curatorCode,
 (SELECT COUNT(DISTINCT l.company_inn) FROM agent_leads l WHERE l.agent_code=aa.agent_code AND l.company_inn<>'') AS clientCount,
 (SELECT COUNT(*) FROM apps ap WHERE ap.agent_code=aa.agent_code AND ap.status NOT IN (${CLOSED})) AS activeCount,
 (SELECT COUNT(*) FROM apps ap WHERE ap.agent_code=aa.agent_code AND ap.status IN ('Выдана','Закрыта')) AS closedCount,
 (SELECT COUNT(*) FROM agent_leads l WHERE l.agent_code=aa.agent_code AND l.source='Реферальная ссылка') AS referralCount,
 (SELECT SUM(ap.requested_amount * NULLIF(ap.reward_rate_bps,0)/10000.0) FROM agent_applications ap WHERE ap.agent_code=aa.agent_code) AS forecast,
 NULL AS accrued,aa.created_at AS createdAt FROM agent_accounts aa LEFT JOIN agent_partners p ON p.agent_code=aa.agent_code`;
 return pageRows(db,`SELECT * FROM (${sql}) AS broker ${q.search?'WHERE name ILIKE ? OR email ILIKE ? OR "agentCode" ILIKE ? OR agency ILIKE ?':''}`,q.search?Array(4).fill('%'+q.search+'%'):[],q,'"createdAt" DESC,"agentCode" ASC');
}
export const applicationProjection=`SELECT id,analysis_id AS analysisId,company_name AS companyName,company_inn AS companyInn,owner_email AS ownerEmail,agent_code AS broker,product,bank,amount,status,next_action AS nextAction,created_at AS createdAt,updated_at AS updatedAt FROM (${logicalApplications}) AS ap`;
export async function applicationList(db:PortableDatabase,q:AdminQuery){
 const where:string[]=[];const values:unknown[]=[];
 if(q.search){where.push('(company_name ILIKE ? OR company_inn ILIKE ? OR owner_email ILIKE ? OR id ILIKE ?)');values.push(...Array(4).fill('%'+q.search+'%'));}
 for(const [v,k] of [[q.status,'status'],[q.product,'product'],[q.company,'company_inn'],[q.agentCode,'agent_code']] as const){if(v){where.push(k+'=?');values.push(v);}}
 if(q.activity)where.push(`status ${q.activity==='active'?'NOT ':''}IN (${CLOSED})`);
 return pageRows(db,applicationProjection+(where.length?' WHERE '+where.join(' AND '):''),values,q,'"updatedAt" DESC,id DESC');
}
export const documentProjection=`SELECT d.id,d.company_inn AS companyInn,COALESCE(a.company_name,(SELECT l.company_name FROM agent_leads l WHERE l.company_inn=d.company_inn ORDER BY l.updated_at DESC LIMIT 1),'') AS companyName,d.analysis_id AS analysisId,d.application_id AS applicationId,d.category,d.file_name AS fileName,d.mime_type AS mime,d.size_bytes AS sizeBytes,d.uploaded_by AS uploadedBy,d.created_at AS createdAt,
 CASE WHEN d.storage_key<>'' THEN 'METADATA_PRESENT' WHEN d.content_base64<>'' THEN 'INLINE_PRESENT' ELSE 'UNAVAILABLE' END AS storageState,
 CASE WHEN (d.analysis_id<>'' AND NOT EXISTS(SELECT 1 FROM analyses a2 WHERE a2.id=d.analysis_id AND a2.company_inn=d.company_inn)) OR (d.application_id<>'' AND NOT EXISTS(SELECT 1 FROM (${logicalApplications}) AS ap WHERE ap.id=d.application_id AND ap.company_inn=d.company_inn)) THEN 'ORPHAN' WHEN d.analysis_id='' AND d.application_id='' THEN 'COMPANY_ONLY' ELSE 'ASSOCIATED' END AS associationState
 FROM client_documents d LEFT JOIN analyses a ON a.id=d.analysis_id`;
export async function documentList(db:PortableDatabase,q:AdminQuery){
 const where:string[]=[];const values:unknown[]=[];
 if(q.search){where.push('("companyInn" ILIKE ? OR "companyName" ILIKE ? OR "fileName" ILIKE ? OR "uploadedBy" ILIKE ?)');values.push(...Array(4).fill('%'+q.search+'%'));}
 for(const [v,k] of [[q.company,'"companyInn"'],[q.category,'category'],[q.uploadedBy,'"uploadedBy"'],[q.analysisId,'"analysisId"'],[q.applicationId,'"applicationId"']] as const){if(v){where.push(k+'=?');values.push(v);}}
 if(q.association)where.push(q.association==='orphan'?`"associationState"='ORPHAN'`:q.association==='analysis'?`"analysisId"<>''`:`"applicationId"<>''`);
 return pageRows(db,`SELECT * FROM (${documentProjection}) AS document ${where.length?'WHERE '+where.join(' AND '):''}`,values,q,'"createdAt" DESC,id DESC');
}
export async function applicationDetail(db:PortableDatabase,q:AdminQuery){
 if(!q.id)throw Error('INVALID_QUERY');
 const application=(await rows(db,applicationProjection+' WHERE id=?',[q.id]))[0];
 if(!application)return null;
 const [history,messages,documents]=await Promise.all([
 pageRows(db,`SELECT id,from_status AS fromStatus,to_status AS toStatus,actor_role AS actorRole,actor_email AS actorEmail,public_comment AS comment,created_at AS createdAt FROM application_status_history WHERE application_id=?`,[q.id],q,'"createdAt" ASC,id ASC'),
 pageRows(db,`SELECT id,author_role AS authorRole,author_name AS authorName,message,document_id AS documentId,created_at AS createdAt FROM application_messages WHERE application_id=?`,[q.id],q,'"createdAt" ASC,id ASC'),
 documentList(db,{...q,applicationId:q.id}),
 ]);
 return {application,history,messages,documents};
}
