// These are owner-issued authorization events, not CRM metadata. The existing
// audit log is the durable event store; revocation is append-only and permanent
// for a grant ID. No legacy contact, application or consent string is a grant.
export const BROKER_AUTHORIZATION = 'BROKER_AUTHORIZATION_V1';
type Statement = {bind(...values:unknown[]):Statement;first<T=Record<string,unknown>>():Promise<T|null>;run():Promise<unknown>};
export type AuthorizationDB = {prepare(sql:string):Statement;batch(statements:Statement[]):Promise<Array<{results:unknown[]}>>};
export type AuthorizationPurpose = 'DOSSIER'|'REFERRAL';
const identifier=(value:string)=>{if(!/^[a-z][a-z0-9_]*$/i.test(value))throw Error('INVALID_SQL_ALIAS');return value;};

export function activeAuthorizationSQL(grant='g') {
 const g=identifier(grant);
 return `${g}.entity_type='${BROKER_AUTHORIZATION}' AND ${g}.actor_role='CLIENT'
  AND ${g}.created_at::timestamptz<=CURRENT_TIMESTAMP
  AND (${g}.metadata::jsonb->>'expiresAt')::timestamptz>CURRENT_TIMESTAMP
  AND NOT EXISTS (SELECT 1 FROM audit_log revoked WHERE revoked.entity_type='${BROKER_AUTHORIZATION}'
    AND revoked.action='REVOKE' AND revoked.entity_id=${g}.id)`;
}

// Parameter/expression is supplied only by server SQL, never a request string.
export function dossierAuthorizationSQL(analysis='a',brokerEmail='?') {
 const a=identifier(analysis);
 return `EXISTS (SELECT 1 FROM audit_log bg
  JOIN "user" owner_user ON owner_user.id=bg.metadata::jsonb->>'ownerUserId'
  JOIN "user" broker_user ON broker_user.id=bg.metadata::jsonb->>'brokerUserId'
  JOIN agent_accounts ba ON ba.agent_code=bg.metadata::jsonb->>'brokerCode' AND lower(ba.user_email)=lower(broker_user.email)
  WHERE ${activeAuthorizationSQL('bg')} AND bg.action='GRANT_DOSSIER' AND bg.entity_id=${a}.id
  AND owner_user."emailVerified" AND broker_user."emailVerified"
  AND lower(owner_user.email)=${a}.owner_email AND bg.actor_email=${a}.owner_email
  AND bg.metadata::jsonb->>'companyInn'=${a}.company_inn
  AND lower(broker_user.email)=${brokerEmail})`;
}

export function brokerApplicationSQL(application='ap',brokerEmail='?') {
 const ap=identifier(application);
 return `EXISTS (SELECT 1 FROM agent_accounts account WHERE account.agent_code=${ap}.agent_code AND lower(account.user_email)=${brokerEmail})
  AND ((${ap}.analysis_id='' AND NOT EXISTS (SELECT 1 FROM deals linked WHERE linked.id=${ap}.id AND linked.analysis_id<>''))
   OR EXISTS (SELECT 1 FROM analyses scope WHERE scope.id=${ap}.analysis_id AND scope.archive_state='ACTIVE'
    AND (scope.owner_email=${brokerEmail} OR ${dossierAuthorizationSQL('scope',brokerEmail)})))`;
}

export function documentBrokerSQL(document='d',brokerEmail='?') {
 const d=identifier(document);
 return `EXISTS (SELECT 1 FROM analyses scope WHERE scope.archive_state='ACTIVE'
  AND scope.company_inn=${d}.company_inn AND ${dossierAuthorizationSQL('scope',brokerEmail)}
  AND ((${d}.analysis_id=scope.id AND ${d}.owner_email=scope.owner_email)
   OR (${d}.analysis_id IN ('',scope.id) AND EXISTS (SELECT 1 FROM agent_applications document_app
     WHERE document_app.id=${d}.application_id AND document_app.analysis_id=scope.id
     AND (${d}.owner_email=scope.owner_email OR ${d}.owner_email=${brokerEmail})
     AND ${brokerApplicationSQL('document_app',brokerEmail)}))))`;
}

export function documentAccessSQL(document='d',email='actor.email') {
 const d=identifier(document);
 return `(${d}.owner_email=${email} OR ${documentBrokerSQL(d,email)}
  OR EXISTS(SELECT 1 FROM agent_applications own_app WHERE own_app.id=${d}.application_id
    AND own_app.analysis_id='' AND ${d}.analysis_id='' AND ${brokerApplicationSQL('own_app',email)})
  OR EXISTS(SELECT 1 FROM deals own_deal JOIN analyses own_analysis ON own_analysis.id=own_deal.analysis_id
    WHERE own_deal.id=${d}.application_id AND own_analysis.archive_state='ACTIVE'
    AND own_analysis.owner_email=${email} AND own_deal.owner_email=${email}
    AND ${d}.company_inn=own_analysis.company_inn AND ${d}.analysis_id IN ('',own_analysis.id)))`;
}

// Return one confirmed recipient or none. CRM ordering never resolves ambiguity.
export async function assignedBroker(db:AuthorizationDB,analysisId:string) {
 const result=await db.batch([db.prepare(`SELECT aa.agent_code AS code,aa.user_email AS email,a.company_inn AS inn
  FROM analyses a CROSS JOIN agent_accounts aa WHERE a.id=? AND a.archive_state='ACTIVE'
  AND ${dossierAuthorizationSQL('a','lower(aa.user_email)')}`).bind(analysisId)]);
 const rows=result[0].results as Array<{code:string;email:string;inn:string}>;
 return rows.length===1?rows[0]:null;
}

export async function listAuthorizations(db:AuthorizationDB,analysisId:string,email:string) {
 const analysis=await db.prepare("SELECT id,company_inn AS inn FROM analyses WHERE id=? AND owner_email=? AND archive_state='ACTIVE'").bind(analysisId,email).first<{id:string;inn:string}>();
 if(!analysis)return {status:404,error:'Анализ владельца не найден'};
 const rows=await db.batch([db.prepare(`SELECT g.id,g.action,g.entity_id AS resourceId,g.created_at AS grantedAt,
  g.metadata::jsonb->>'brokerCode' AS brokerCode,g.metadata::jsonb->>'brokerEmail' AS brokerEmail,
  g.metadata::jsonb->>'expiresAt' AS expiresAt,g.metadata::jsonb->>'curatorCode' AS curatorCode
  FROM audit_log g JOIN "user" u ON u.id=g.metadata::jsonb->>'ownerUserId'
  WHERE ${activeAuthorizationSQL()} AND g.actor_email=? AND lower(u.email)=? AND u."emailVerified"
  AND ((g.action='GRANT_DOSSIER' AND g.entity_id=?) OR (g.action='GRANT_REFERRAL' AND g.metadata::jsonb->>'companyInn'=?))
  ORDER BY g.created_at,g.id`).bind(email,email,analysisId,analysis.inn)]);
 return {status:200,grants:rows[0].results};
}

export async function authorizeBroker(request:Request,db:AuthorizationDB,user:{email:string},body:Record<string,unknown>) {
 try{if(!process.env.PRESCORE_BASE_URL||request.headers.get('origin')!==new URL(process.env.PRESCORE_BASE_URL).origin||request.headers.get('sec-fetch-site')==='cross-site')return {status:403,error:'Источник запроса не подтверждён'};}catch{return {status:503,error:'Настройка адреса недоступна'};}
 const analysisId=String(body.analysisId??'');
 const owner=await db.prepare(`SELECT u.id AS userId,a.company_inn AS inn FROM analyses a JOIN "user" u ON lower(u.email)=a.owner_email
  WHERE a.id=? AND a.owner_email=? AND a.archive_state='ACTIVE' AND u."emailVerified"`).bind(analysisId,user.email).first<{userId:string;inn:string}>();
 if(!owner)return {status:404,error:'Разрешение может выдать только владелец выбранного анализа'};
 if(body.operation==='revoke') {
  const id=String(body.grantId??'');
  const event=await db.prepare(`SELECT id FROM audit_log WHERE id=? AND entity_type='${BROKER_AUTHORIZATION}'
   AND action IN ('GRANT_DOSSIER','GRANT_REFERRAL') AND actor_email=? AND metadata::jsonb->>'ownerUserId'=?
   AND ((action='GRANT_DOSSIER' AND entity_id=?) OR (action='GRANT_REFERRAL' AND metadata::jsonb->>'companyInn'=?))`).bind(id,user.email,owner.userId,analysisId,owner.inn).first();
  if(!event)return {status:404,error:'Разрешение не найдено'};
  await db.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor_role,actor_email,metadata,created_at)
   VALUES(?,? ,?,'REVOKE','CLIENT',?,?,?) ON CONFLICT(id) DO NOTHING`)
   .bind('broker-revoke:'+id,BROKER_AUTHORIZATION,id,user.email,JSON.stringify({ownerUserId:owner.userId}),new Date().toISOString()).run();
  return {status:200,ok:true};
 }
 if(body.operation!=='grant'||!['DOSSIER','REFERRAL'].includes(String(body.purpose))||body.confirmed!==true)return {status:400,error:'Отдельно подтвердите вид разрешения'};
 const purpose=body.purpose as AuthorizationPurpose,brokerEmail=String(body.brokerEmail??'').trim().toLowerCase();
 const target=await db.prepare(`SELECT u.id AS userId,aa.agent_code AS code FROM agent_accounts aa JOIN "user" u ON lower(u.email)=lower(aa.user_email)
  WHERE lower(u.email)=? AND u."emailVerified" AND u.id<>?`).bind(brokerEmail,owner.userId).first<{userId:string;code:string}>();
 if(!target)return {status:404,error:'Подключённый брокер с подтверждённой почтой не найден'};
 const requestId=String(body.requestId??'');if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestId))return {status:400,error:'Некорректный идентификатор действия'};
 // Bounded owner-approved lifetime, not a browser-supplied active/role flag.
 const days=Number(body.days);if(!Number.isInteger(days)||days<1||days>365)return {status:400,error:'Срок разрешения — от 1 до 365 дней'};
 const id='broker-grant:'+requestId,resource=purpose==='DOSSIER'?analysisId:owner.userId+':'+owner.inn;
 const previous=await db.prepare('SELECT actor_email AS email,action,entity_id AS resource,metadata FROM audit_log WHERE id=?').bind(id).first<{email:string;action:string;resource:string;metadata:string}>();
 if(previous){const m=JSON.parse(previous.metadata);return previous.email===user.email&&previous.action==='GRANT_'+purpose&&previous.resource===resource&&m.brokerUserId===target.userId&&m.days===days?{status:200,ok:true,id,replayed:true}:{status:409,error:'Идентификатор действия уже использован'};}
 let curatorCode:string|null=null;
 if(purpose==='REFERRAL'){
  // A public invitation alone cannot appoint a curator. Require the invited
  // broker's own verified native self-connection event and the current chain.
  const curator=await db.prepare(`SELECT p.curator_code AS code FROM agent_partners p JOIN agent_accounts c ON c.agent_code=p.curator_code
   JOIN "user" cu ON lower(cu.email)=lower(c.user_email) AND cu."emailVerified"
   WHERE p.agent_code=? AND lower(p.email)=? AND p.status IN ('Активен','ACTIVE') AND p.curator_code<>p.agent_code
   AND EXISTS(SELECT 1 FROM audit_log proof WHERE proof.entity_type='AGENT_ACCOUNT' AND proof.entity_id=p.agent_code
    AND proof.action='SELF_CONNECT' AND proof.actor_email=? AND proof.created_at::timestamptz>=p.created_at::timestamptz)
   AND NOT EXISTS(SELECT 1 FROM agent_partners blocked WHERE blocked.agent_code=p.curator_code AND blocked.status IN ('BLOCKED','Заблокирован'))`)
   .bind(target.code,brokerEmail,brokerEmail).first<{code:string}>();curatorCode=curator?.code??null;
 }
 const now=new Date(),metadata=JSON.stringify({version:1,ownerUserId:owner.userId,brokerUserId:target.userId,brokerCode:target.code,brokerEmail,companyInn:owner.inn,analysisId:purpose==='DOSSIER'?analysisId:null,days,expiresAt:new Date(now.getTime()+days*86400000).toISOString(),curatorCode});
 const confirmation=db.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor_role,actor_email,metadata,created_at)
  SELECT ?,?,?,?,'CLIENT',?,?,? WHERE EXISTS(SELECT 1 FROM analyses a JOIN "user" u ON u.id=?
   WHERE a.id=? AND a.archive_state='ACTIVE' AND a.company_inn=? AND a.owner_email=? AND lower(u.email)=a.owner_email AND u."emailVerified")
  AND EXISTS(SELECT 1 FROM "user" u JOIN agent_accounts aa ON lower(aa.user_email)=lower(u.email)
   WHERE u.id=? AND u."emailVerified" AND lower(u.email)=? AND aa.agent_code=?) ON CONFLICT(id) DO NOTHING`)
  .bind(id,BROKER_AUTHORIZATION,resource,'GRANT_'+purpose,user.email,metadata,now.toISOString(),owner.userId,analysisId,owner.inn,user.email,target.userId,brokerEmail,target.code);
 // Publish a navigable CRM contact only after the owner confirmation is stored.
 // Its presence still grants no authority; every consumer reads the event above.
 const contact=db.prepare(`INSERT INTO agent_leads(id,agent_code,company_name,company_inn,email,source,status,consent_at,created_at,updated_at)
  SELECT ?,?,a.company_name,a.company_inn,?,'Подтверждено владельцем','Назначен владельцем',?,?,?
  FROM analyses a JOIN audit_log g ON g.id=? AND g.entity_id=a.id AND g.action='GRANT_DOSSIER'
  WHERE a.id=? AND a.owner_email=? AND g.metadata::jsonb->>'brokerUserId'=? AND ${activeAuthorizationSQL()}
  AND NOT EXISTS(SELECT 1 FROM agent_leads l WHERE l.agent_code=? AND l.company_inn=a.company_inn AND lower(l.email)=a.owner_email)
  ON CONFLICT(id) DO NOTHING`).bind('owner-assignment:'+owner.userId+':'+target.userId+':'+owner.inn,target.code,user.email,now.toISOString(),now.toISOString(),now.toISOString(),id,analysisId,user.email,target.userId,target.code);
 await db.batch(purpose==='DOSSIER'?[confirmation,contact]:[confirmation]);
 const saved=await db.prepare('SELECT metadata,action,entity_id AS resource,actor_email AS email FROM audit_log WHERE id=?').bind(id).first<{metadata:string;email:string;action:string;resource:string}>();
 if(!saved||saved.email!==user.email||saved.action!=='GRANT_'+purpose||saved.resource!==resource||JSON.parse(saved.metadata).brokerUserId!==target.userId||JSON.parse(saved.metadata).days!==days)return {status:409,error:'Конфликт подтверждения'};
 return {status:201,ok:true,id,curatorCode};
}

export async function confirmedReferralRows(tx:{query(sql:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[]}>},owner:string,inn:string) {
 return tx.query(`SELECT DISTINCT aa.agent_code,g.metadata::jsonb->>'curatorCode' AS curator_code
  FROM audit_log g JOIN "user" ou ON ou.id=g.metadata::jsonb->>'ownerUserId'
  JOIN "user" bu ON bu.id=g.metadata::jsonb->>'brokerUserId'
  JOIN agent_accounts aa ON lower(aa.user_email)=lower(bu.email) AND aa.agent_code=g.metadata::jsonb->>'brokerCode'
  LEFT JOIN agent_partners ap ON ap.agent_code=aa.agent_code
  WHERE ${activeAuthorizationSQL()} AND g.action='GRANT_REFERRAL' AND lower(ou.email)=$1 AND g.actor_email=$1
  AND ou."emailVerified" AND bu."emailVerified" AND g.metadata::jsonb->>'companyInn'=$2 AND g.entity_id=ou.id||':'||$2
  AND (ap.status IS NULL OR ap.status NOT IN ('BLOCKED','Заблокирован'))`,[owner,inn]);
}
