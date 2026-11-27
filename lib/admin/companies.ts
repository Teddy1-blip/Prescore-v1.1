import {dossierAuthorizationSQL} from '../auth/broker-authorizations.ts';
import {fullMetadataPredicate} from '../billing/access-sql.ts';
import {observationJoin,observationColumns} from './observations.ts';
import {pageRows,rows,type AdminQuery,CLOSED} from './resources.ts';
import type {PortableDatabase} from '../db/compatibility.ts';
export const logicalApplications=`SELECT d.id,d.analysis_id,d.company_name,COALESCE(a.company_inn,l.company_inn,'') AS company_inn,COALESCE(NULLIF(d.owner_email,''),a.owner_email,l.email,'') AS owner_email,
 COALESCE(aa.agent_code,l.agent_code,'') AS agent_code,d.product,d.bank,d.amount,d.status AS status,d.next_action AS next_action,d.created_at,d.updated_at AS updated_at
 FROM deals d LEFT JOIN analyses a ON a.id=d.analysis_id LEFT JOIN agent_applications aa ON aa.id=d.id LEFT JOIN agent_leads l ON l.id=aa.lead_id
 UNION ALL SELECT aa.id,aa.analysis_id,aa.company_name,COALESCE(a.company_inn,l.company_inn,'') AS company_inn,COALESCE(a.owner_email,l.email,'') AS owner_email,aa.agent_code,aa.product,aa.bank,aa.requested_amount AS amount,aa.status,aa.next_action,aa.created_at,aa.updated_at
 FROM agent_applications aa LEFT JOIN analyses a ON a.id=aa.analysis_id LEFT JOIN agent_leads l ON l.id=aa.lead_id WHERE NOT EXISTS(SELECT 1 FROM deals d WHERE d.id=aa.id)`;
const companyBase=`WITH company_ids AS (SELECT company_inn FROM analyses UNION SELECT company_inn FROM agent_leads UNION SELECT company_inn FROM client_documents UNION SELECT company_inn FROM payment_orders), latest AS (SELECT a.*,ROW_NUMBER() OVER(PARTITION BY company_inn ORDER BY created_at DESC,id DESC) AS rn FROM analyses a), apps AS (${logicalApplications})
 SELECT c.company_inn AS inn,COALESCE(a.company_name,(SELECT l.company_name FROM agent_leads l WHERE l.company_inn=c.company_inn ORDER BY l.updated_at DESC LIMIT 1),(SELECT p.company_name FROM payment_orders p WHERE p.company_inn=c.company_inn ORDER BY p.created_at DESC LIMIT 1),'') AS name,
 COALESCE(a.owner_email,(SELECT l.email FROM agent_leads l WHERE l.company_inn=c.company_inn ORDER BY l.updated_at DESC LIMIT 1),(SELECT p.user_email FROM payment_orders p WHERE p.company_inn=c.company_inn ORDER BY p.created_at DESC LIMIT 1),'') AS ownerEmail,
 (SELECT COUNT(*) FROM analyses v WHERE v.company_inn=c.company_inn) AS analysisCount,a.id AS analysisId,a.created_at AS latestAt,a.period_from AS periodFrom,a.period_to AS periodTo,
 CASE WHEN ${fullMetadataPredicate} THEN 'FULL' WHEN a.id IS NOT NULL THEN 'BASIC' ELSE NULL END AS tier,
 (SELECT MIN(v.created_at) FROM (SELECT company_inn,created_at FROM analyses UNION ALL SELECT company_inn,created_at FROM agent_leads UNION ALL SELECT company_inn,created_at FROM client_documents UNION ALL SELECT company_inn,created_at FROM payment_orders) AS v WHERE v.company_inn=c.company_inn) AS createdAt,
 (SELECT string_agg(DISTINCT confirmed.agent_code,', ') FROM agent_accounts confirmed JOIN analyses scope ON scope.company_inn=c.company_inn AND scope.archive_state='ACTIVE' WHERE ${dossierAuthorizationSQL('scope','lower(confirmed.user_email)')}) AS broker,
 (SELECT COUNT(*) FROM client_documents d WHERE d.company_inn=c.company_inn) AS documentCount,
 (SELECT COUNT(*) FROM apps ap WHERE ap.company_inn=c.company_inn) AS applicationCount,
 ${observationColumns}
 FROM company_ids c LEFT JOIN latest a ON a.company_inn=c.company_inn AND a.rn=1 LEFT JOIN analysis_entitlements e ON e.analysis_id=a.id ${observationJoin} WHERE c.company_inn<>''`;
const analysisBase=`SELECT a.archive_state AS archiveState,a.archived_at AS archivedAt,a.id AS analysisId,a.company_name AS name,a.company_inn AS inn,a.owner_email AS ownerEmail,a.created_at AS createdAt,a.period_from AS periodFrom,a.period_to AS periodTo,
 CASE WHEN ${fullMetadataPredicate} THEN 'FULL' ELSE 'BASIC' END AS tier,
 (SELECT string_agg(DISTINCT confirmed.agent_code,', ') FROM agent_accounts confirmed WHERE ${dossierAuthorizationSQL('a','lower(confirmed.user_email)')}) AS broker,${observationColumns}
 FROM analyses a LEFT JOIN analysis_entitlements e ON e.analysis_id=a.id ${observationJoin}`;
export async function companyList(db:PortableDatabase,q:AdminQuery){
 const values:unknown[]=[];const where:string[]=[];
 if(q.search){where.push('(name ILIKE ? OR inn ILIKE ? OR "ownerEmail" ILIKE ?)');values.push(...Array(3).fill('%'+q.search+'%'));}
 if(q.tier){where.push('tier=?');values.push(q.tier);}
 if(q.broker)where.push(q.broker==='assigned'?"broker IS NOT NULL AND broker<>''":"(broker IS NULL OR broker='')");
 if(q.hasAnalysis)where.push(`"analysisCount" ${q.hasAnalysis==='yes'?'>0':'=0'}`);
 if(q.hasApplications)where.push(`"applicationCount" ${q.hasApplications==='yes'?'>0':'=0'}`);
 if(q.canonical){where.push('"canonicalState"=?');values.push(q.canonical);}
 if(q.sources){where.push('"sourceState"=?');values.push(q.sources==='unknown'?'UNKNOWN':'INCOMPLETE');}
 const order=q.sort==='name'?'name ASC,inn ASC':q.sort==='applications'?'"applicationCount" DESC,inn ASC':q.sort==='created'?'"createdAt" DESC NULLS LAST,inn ASC':'"latestAt" DESC NULLS LAST,inn ASC';
 return pageRows(db,`SELECT * FROM (${companyBase}) AS company ${where.length?'WHERE '+where.join(' AND '):''}`,values,q,order);
}
export async function analysisList(db:PortableDatabase,q:AdminQuery){
 const where:string[]=q.archive==='all'?[]:[q.archive==='archived'?`"archiveState"='LEGACY_PREPRODUCTION'`:`"archiveState"='ACTIVE'`];const values:unknown[]=[];
 if(q.search){where.push('(name ILIKE ? OR inn ILIKE ? OR "ownerEmail" ILIKE ? OR "analysisId" ILIKE ?)');values.push(...Array(4).fill('%'+q.search+'%'));}
 if(q.company){where.push('inn=?');values.push(q.company);}
 if(q.tier){where.push('tier=?');values.push(q.tier);}
 if(q.canonical){where.push('"canonicalState"=?');values.push(q.canonical);}
 if(q.sources){where.push('"sourceState"=?');values.push(q.sources==='unknown'?'UNKNOWN':'INCOMPLETE');}
 return pageRows(db,`SELECT * FROM (${analysisBase}) AS analysis ${where.length?'WHERE '+where.join(' AND '):''}`,values,q,'"createdAt" DESC,"analysisId" DESC');
}
export async function companyDetail(db:PortableDatabase,q:AdminQuery){
 if(!/^\d{10}(\d{2})?$/.test(q.id))throw Error('INVALID_QUERY');
 const company=(await rows(db,`SELECT * FROM (${companyBase}) AS company WHERE inn=?`,[q.id]))[0];
 if(!company)return null;
 const analyses=await analysisList(db,{...q,company:q.id});
 const applications=await pageRows(db,`SELECT id,company_name AS companyName,company_inn AS companyInn,owner_email AS ownerEmail,product,bank,status,next_action AS nextAction,agent_code AS broker,analysis_id AS analysisId,amount,created_at AS createdAt,updated_at AS updatedAt FROM (${logicalApplications}) AS ap WHERE company_inn=?`,[q.id],q,'"createdAt" DESC,id DESC');
 const documents=await pageRows(db,`SELECT id,company_inn AS companyInn,analysis_id AS analysisId,application_id AS applicationId,category,file_name AS fileName,mime_type AS mime,size_bytes AS sizeBytes,uploaded_by AS uploadedBy,created_at AS createdAt,CASE WHEN storage_key<>'' THEN 'METADATA_PRESENT' WHEN content_base64<>'' THEN 'INLINE_PRESENT' ELSE 'UNAVAILABLE' END AS storageState FROM client_documents WHERE company_inn=?`,[q.id],q,'"createdAt" DESC,id DESC');
 const audit=await pageRows(db,`SELECT id,entity_type AS entityType,entity_id AS entityId,action,actor_role AS actorRole,actor_email AS actorEmail,substr(metadata,1,4096) AS metadata,created_at AS createdAt FROM audit_log WHERE entity_id=? OR entity_id IN (SELECT id FROM analyses WHERE company_inn=?) OR entity_id IN (SELECT id FROM (${logicalApplications}) AS ap WHERE company_inn=?)`,[q.id,q.id,q.id],q,'"createdAt" DESC,id DESC');
 return {company,analyses,applications,documents,audit};
}
export async function logicalOverview(db:PortableDatabase){return rows(db,`SELECT status,COUNT(*) AS count FROM (${logicalApplications}) AS ap GROUP BY status`);}
export async function activeApplicationCount(db:PortableDatabase){return (await rows(db,`SELECT COUNT(*) AS count FROM (${logicalApplications}) AS ap WHERE status NOT IN (${CLOSED})`))[0].count;}
