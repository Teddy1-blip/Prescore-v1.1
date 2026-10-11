import type {PortableDatabase} from '../db/compatibility.ts';
import {pageRows,rows,safeMetadata,type AdminQuery} from './resources.ts';
import {partnerCommissions} from '../partner-commissions.ts';
import {RISK_RULE_REGISTRY} from '../credit-engine/risk/rules/registry.ts';
import {INDEX_POLICY} from '../credit-engine/index/policy.ts';
import {READINESS_POLICY} from '../credit-engine/readiness/policy.ts';
import {DEBT_CAPACITY_POLICY} from '../credit-engine/debt-capacity/policy.ts';
import {CREDIT_ASSESSMENT_POLICY_VERSION} from '../credit-engine/contracts/credit-assessment.ts';
import {PRODUCT_SELECTION_POLICY_VERSION} from '../credit-engine/contracts/product-selection.ts';
import {RECOMMENDATION_POLICY_VERSION} from '../credit-engine/contracts/recommendations.ts';
import {ACTION_PLAN_POLICY_VERSION} from '../credit-engine/contracts/action-plan.ts';
import {configuredProvider} from '../ai/providers/index.ts';
import catalog from '../db/catalog.json' with {type:'json'};
export const SAFE_MODULES=[['overview','CLIENT · Обзор'],['analysis','CLIENT · Загрузка выписок'],['report','CLIENT · Анализ Prescore'],['credit','CLIENT · Обязательства'],['company','CLIENT · Данные компании'],['offers','CLIENT · Финансирование'],['analyst','CLIENT · AI Analyst UI'],['applications','CLIENT · Заявки UI'],['documents','CLIENT · Документы UI'],['prospects','BROKER · Закупки и рабочие контакты']] as const;
export async function accessList(db:PortableDatabase,q:AdminQuery){
 const where:string[]=[];const values:unknown[]=[];
 if(q.search){where.push('(a.company_name ILIKE ? OR e.company_inn ILIKE ? OR e.user_email ILIKE ? OR e.analysis_id ILIKE ?)');values.push(...Array(4).fill('%'+q.search+'%'));}
 if(q.tier){where.push('e.tier=?');values.push(q.tier==='BASIC'?'FREE':'FULL');}
 const sql=`SELECT e.analysis_id AS analysisId,COALESCE(a.company_name,'') AS companyName,e.company_inn AS companyInn,e.user_email AS ownerEmail,e.tier,e.granted_by AS grantedBy,e.granted_at AS grantedAt,e.revoked_at AS revokedAt,e.payment_order_id AS paymentOrderId,
 CASE WHEN a.id IS NULL THEN 'ANALYSIS_MISSING' WHEN e.revoked_at<>'' THEN 'REVOKED' WHEN e.tier='FULL' THEN 'FULL_GRANTED' ELSE 'BASIC' END AS state,e.updated_at AS updatedAt FROM analysis_entitlements e LEFT JOIN analyses a ON a.id=e.analysis_id`;
 return pageRows(db,sql+(where.length?' WHERE '+where.join(' AND '):''),values,q,'"updatedAt" DESC,"analysisId" ASC');
}
export async function orderList(db:PortableDatabase,q:AdminQuery){
 const sql=`SELECT p.id,p.order_number AS orderNumber,p.company_name AS companyName,p.company_inn AS companyInn,p.user_email AS ownerEmail,p.amount,p.status,p.analysis_id AS analysisId,p.created_at AS createdAt,
 CASE WHEN a.id IS NULL THEN 'ANALYSIS_MISSING' WHEN e.revoked_at<>'' THEN 'REVOKED' WHEN e.tier='FULL' THEN 'FULL_GRANTED' ELSE 'BASIC' END AS accessState FROM payment_orders p LEFT JOIN analyses a ON a.id=p.analysis_id LEFT JOIN analysis_entitlements e ON e.analysis_id=p.analysis_id`;
 return pageRows(db,sql+(q.search?' WHERE p.company_name ILIKE ? OR p.company_inn ILIKE ? OR p.user_email ILIKE ? OR p.order_number ILIKE ?':''),q.search?Array(4).fill('%'+q.search+'%'):[],q,'"createdAt" DESC,id DESC');
}
export async function paymentList(db:PortableDatabase,q:AdminQuery){
 return pageRows(db,`SELECT id,subscription_id AS referenceId,amount,status,paid_at AS paidAt,created_at AS createdAt FROM payments ${q.search?'WHERE id ILIKE ? OR subscription_id ILIKE ?':''}`,q.search?Array(2).fill('%'+q.search+'%'):[],q,'"paidAt" DESC,id DESC');
}
export async function product(db:PortableDatabase){
 const saved=await rows(db,'SELECT module_key AS moduleKey,enabled,updated_at AS updatedAt FROM module_settings');
 const modules=SAFE_MODULES.map(([moduleKey,label])=>({moduleKey,label,enabled:1,...saved.find(r=>r.moduleKey===moduleKey)}));
 const policies=[['PRESCORE_INDEX','INDEX',INDEX_POLICY.version,'Индекс из canonical рисков и контекста'],['FINANCING_READINESS','READINESS',READINESS_POLICY.version,'Готовность на основе canonical индекса и ограничений'],['CREDIT_ASSESSMENT','ASSESSMENT',CREDIT_ASSESSMENT_POLICY_VERSION,'Структурированное кредитное заключение'],['DEBT_CAPACITY','CAPACITY',DEBT_CAPACITY_POLICY.version,'Обслуживание долга при достаточном подтверждении'],['PRODUCT_SELECTION','PRODUCT',PRODUCT_SELECTION_POLICY_VERSION,'Соответствие механики продукта'],['RECOMMENDATIONS','RECOMMENDATIONS',RECOMMENDATION_POLICY_VERSION,'Рекомендации по canonical findings'],['ACTION_PLAN','ACTION_PLAN',ACTION_PLAN_POLICY_VERSION,'План действий по canonical рекомендациям']].map(([code,layer,version,description])=>({code,layer,version,description,status:'READ_ONLY · PRE_CALIBRATION'}));
 const rules=[...policies,...RISK_RULE_REGISTRY.map(r=>({code:r.code,layer:r.domain,version:r.version,description:`${r.scope} · Источники фактов: ${r.requiredFactCodes.join(', ')}`,status:r.calibrationClass}))];
 const catalogs=partnerCommissions.map(r=>({code:r.id,layer:r.kind,description:r.bank+' · '+r.product,version:null,status:'CODE_CATALOG · READ_ONLY'}));
 return {modules,rules,catalogs,catalogState:'Реальные маршруты BROKER. Каталог хранится в коде; versioned contract редактирования через ADMIN отсутствует. Legacy control_settings не используются как governance Credit Engine.'};
}
export async function auditList(db:PortableDatabase,q:AdminQuery){
 const where:string[]=[];const values:unknown[]=[];
 for(const [v,k] of [[q.entityType,'entity_type'],[q.entityId,'entity_id'],[q.actorRole,'actor_role'],[q.actorEmail,'actor_email'],[q.action,'action']] as const){if(v){where.push(k+'=?');values.push(v);}}
 if(q.from){where.push('created_at>=?');values.push(q.from);}
 if(q.to){where.push('created_at<?');values.push(new Date(new Date(q.to).getTime()+86400000).toISOString().slice(0,10));}
 if(q.search){where.push('(entity_id ILIKE ? OR actor_email ILIKE ? OR action ILIKE ?)');values.push(...Array(3).fill('%'+q.search+'%'));}
 const page=await pageRows(db,`SELECT id,entity_type AS entityType,entity_id AS entityId,action,actor_role AS actorRole,actor_email AS actorEmail,metadata,created_at AS createdAt FROM audit_log ${where.length?'WHERE '+where.join(' AND '):''}`,values,q,'"createdAt" DESC,id DESC');
 page.items=page.items.map(r=>({...r,metadata:safeMetadata(r.metadata)}));return page;
}
export async function aiUsage(db:PortableDatabase){
 const [groups,daily]=await Promise.all([
 rows(db,`SELECT provider,model,COUNT(*) AS requests,SUM(success) AS success,SUM(CASE WHEN success=0 THEN 1 ELSE 0 END) AS failure,SUM(input_tokens) AS inputTokens,SUM(output_tokens) AS outputTokens,AVG(latency_ms) AS latencyMs FROM ai_usage GROUP BY provider,model ORDER BY requests DESC LIMIT 50`),
 rows(db,`SELECT substr(created_at,1,10) AS day,COUNT(*) AS count FROM ai_usage WHERE created_at>=? GROUP BY substr(created_at,1,10) ORDER BY day`,[new Date(Date.now()-30*86400000).toISOString()]),
 ]);return {groups,daily};
}
export async function systemStatus(db:PortableDatabase){
 await rows(db,'SELECT 1 AS reachable');
 const columns=await rows(db,`SELECT table_name AS tableName,column_name AS columnName FROM information_schema.columns WHERE table_schema=current_schema()`);
 const required=catalog.filter(t=>['analyses','agent_accounts','agent_leads','deals','agent_applications','client_documents','analysis_entitlements','audit_log','ai_usage','admin_analysis_observations'].includes(t.table));
 const missing=required.flatMap(t=>t.columns.filter(c=>!columns.some(r=>r.tableName===t.table&&r.columnName===c)).map(c=>t.table+'.'+c));
 let ai='UNAVAILABLE';try{if(configuredProvider())ai='CONFIGURED';}catch{/* invalid configuration remains unavailable */}
 const storage=(await rows(db,'SELECT COUNT(*) AS files,SUM(size_bytes) AS bytes FROM client_documents'))[0];
 const failed=(await rows(db,'SELECT COUNT(*) AS failures FROM ai_usage WHERE success=0'))[0].failures;
 const sha=process.env.PRESCORE_BUILD_SHA??process.env.GITHUB_SHA??null;
 return {database:'REACHABLE',schema:missing.length?'MIGRATION_REQUIRED':'COMPATIBLE',missingColumns:missing,buildSha:sha&&/^[a-f0-9]{40}$/.test(sha)?sha:null,ai,storageMetadata:storage,recordedAiFailures:failed,uptime:null};
}
export async function mutateAdmin(db:PortableDatabase,body:Record<string,unknown>,email:string){
 const now=new Date().toISOString();
 if(typeof body.enabled!=='boolean')return {status:400,error:'enabled должен быть boolean'};
 if(body.type==='module'){
  const key=String(body.moduleKey??'');const definition=SAFE_MODULES.find(([candidate])=>candidate===key);
  if(!definition)return {status:400,error:'Этот control недоступен для изменения'};
  await db.batch([
   db.prepare(`INSERT INTO module_settings(module_key,label,enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(module_key) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at`).bind(key,definition[1],body.enabled?1:0,now),
   db.prepare('INSERT INTO audit_log(id,entity_type,entity_id,action,actor_role,actor_email,metadata,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'MODULE_SETTING',key,'TOGGLE','ADMIN',email,JSON.stringify({enabled:body.enabled}),now),
  ]);return {status:200,ok:true};
 }
 if(body.type==='access'){
  const id=String(body.id??'');if(!id||id.length>180)return {status:400,error:'Укажите корректный analysisId'};
  const analysis=(await rows(db,'SELECT id,owner_email AS email,company_inn AS inn FROM analyses WHERE id=?',[id]))[0];
  if(!analysis)return {status:404,error:'Версия анализа не найдена'};
  const tier=body.enabled?'FULL':'FREE';
  await db.batch([
   db.prepare(`INSERT INTO analysis_entitlements(analysis_id,user_email,company_inn,tier,granted_by,granted_at,revoked_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(analysis_id) DO UPDATE SET tier=excluded.tier,granted_by=excluded.granted_by,granted_at=CASE WHEN excluded.tier='FULL' THEN excluded.granted_at ELSE analysis_entitlements.granted_at END,revoked_at=excluded.revoked_at,updated_at=excluded.updated_at`).bind(id,analysis.email,analysis.inn,tier,email,body.enabled?now:'',body.enabled?'':now,now),
   db.prepare('INSERT INTO audit_log(id,entity_type,entity_id,action,actor_role,actor_email,metadata,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'ANALYSIS_ENTITLEMENT',id,body.enabled?'GRANT_FULL':'REVOKE_FULL','ADMIN',email,JSON.stringify({tier,analysisId:id,companyInn:analysis.inn}),now),
  ]);return {status:200,ok:true,tier:tier==='FREE'?'BASIC':'FULL'};
 }
 return {status:400,error:'Операция не поддерживается'};
}
