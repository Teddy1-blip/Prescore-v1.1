import type { PortableDatabase } from '../db/compatibility.ts';
export const ADMIN_VIEWS = ['overview','companies','brokers','analyses','applications','documents','access','product','system'] as const;
export type AdminView = typeof ADMIN_VIEWS[number];
export const CLOSED = "'Выдана','Отклонена','Закрыта','Отменена клиентом'";
export function parseAdminQuery(url: string) {
 const p = new URL(url).searchParams;
 const resource = p.get('resource') ?? 'overview';
 if (![...ADMIN_VIEWS,'audit','orders','payments','company','application','canonical','ai'].includes(resource)) throw Error('INVALID_QUERY');
 const integer = (key: string, fallback: number, max: number) => { const v=p.get(key); if(v===null)return fallback; if(!/^\d+$/.test(v)||Number(v)<1||Number(v)>max)throw Error('INVALID_QUERY'); return Number(v); };
 const text = (key: string, max=180) => { const v=(p.get(key)??'').trim(); if(v.length>max||/[\x00-\x1f]/.test(v))throw Error('INVALID_QUERY'); return v; };
 const q={resource,page:integer('page',1,100000),limit:integer('limit',20,50),search:text('search',120),id:text('id'),analysisId:text('analysisId'),applicationId:text('applicationId'),agentCode:text('agentCode'),tier:text('tier'),broker:text('broker'),status:text('status'),product:text('product'),company:text('company'),category:text('category'),uploadedBy:text('uploadedBy'),association:text('association'),activity:text('activity'),actorRole:text('actorRole'),actorEmail:text('actorEmail'),entityType:text('entityType'),entityId:text('entityId'),action:text('action'),from:text('from'),to:text('to'),sort:text('sort'),hasAnalysis:text('hasAnalysis'),hasApplications:text('hasApplications'),canonical:text('canonical'),sources:text('sources')};
 for(const [v,allowed] of [[q.tier,['','BASIC','FULL']],[q.association,['','analysis','application','orphan']],[q.activity,['','active','closed']],[q.broker,['','assigned','unassigned']],[q.sort,['','recent','created','applications','name']],[q.hasAnalysis,['','yes','no']],[q.hasApplications,['','yes','no']],[q.canonical,['','READY','UNAVAILABLE','UNKNOWN']],[q.sources,['','incomplete','unknown']]] as [string,string[]][]){if(!allowed.includes(v))throw Error('INVALID_QUERY');}
 for(const d of [q.from,q.to])if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||new Date(d).toISOString().slice(0,10)!==d))throw Error('INVALID_QUERY');
 if(q.from&&q.to&&q.from>q.to)throw Error('INVALID_QUERY');
 return q;
}
export type AdminQuery = ReturnType<typeof parseAdminQuery>;
export async function rows(db: PortableDatabase, sql: string, values: unknown[]=[]){return (await db.prepare(sql).bind(...values).all<Record<string,unknown>>()).results;}
export async function pageRows(db: PortableDatabase, sql: string, values: unknown[], q: AdminQuery, order: string) {
 const [items,count]=await Promise.all([rows(db,`SELECT * FROM (${sql}) AS result ORDER BY ${order} LIMIT ? OFFSET ?`,[...values,q.limit,(q.page-1)*q.limit]),rows(db,`SELECT COUNT(*) AS total FROM (${sql}) AS result`,values)]);
 return {items,page:q.page,limit:q.limit,total:Number(count[0]?.total??0)};
}
export function safeMetadata(input: unknown): unknown {
 let value: unknown=input;
 if(typeof input==='string'){try{value=JSON.parse(input);}catch{return '[Некорректная metadata]';}}
 // Allow operational scalar fields only; never serialize arbitrary nested documents/conversations.
 const allowed=new Set(['enabled','count','tier','previousTier','companyInn','analysisId','applicationId','orderId','agentCode','previousAgentCode','status','fromStatus','toStatus','reasonCode','category','fileName','sizeBytes']);
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(Object.entries(value).filter(([k,v])=>allowed.has(k)&&['string','number','boolean'].includes(typeof v)).map(([k,v])=>[k,typeof v==='string'?v.slice(0,180):v]));
}
export async function overview(db: PortableDatabase) {
 const [summary,daily,statuses,usage,tiers,storage,ai] = await Promise.all([
 rows(db,`SELECT (SELECT COUNT(DISTINCT company_inn) FROM analyses WHERE company_inn <> '') AS companies,
 (SELECT COUNT(*) FROM analyses) AS analyses,
 (SELECT COUNT(*) FROM analyses WHERE created_at >= ?) AS newAnalyses,
 (SELECT COUNT(*) FROM agent_accounts) AS brokers,
 (SELECT COUNT(*) FROM client_documents) AS documents,
 (SELECT COUNT(*) FROM ai_usage) AS aiRequests,
 (SELECT COUNT(*) FROM ai_usage WHERE success=1) AS aiSuccess,
 (SELECT COUNT(*) FROM ai_usage WHERE success=0) AS aiFailure,
 (SELECT SUM(amount) FROM payments WHERE status='Оплачен') AS confirmedRevenue`,[new Date(Date.now()-30*86400000).toISOString()]),
 rows(db,`SELECT substr(created_at,1,10) AS day,COUNT(*) AS count FROM analyses WHERE created_at >= ? GROUP BY substr(created_at,1,10) ORDER BY day`,[new Date(Date.now()-30*86400000).toISOString()]),
 rows(db,`SELECT status,COUNT(*) AS count FROM deals GROUP BY status ORDER BY count DESC`),
 rows(db,`SELECT product,COUNT(*) AS count FROM deals GROUP BY product ORDER BY count DESC LIMIT 20`),
 rows(db,`SELECT CASE WHEN e.tier='FULL' AND e.revoked_at='' THEN 'FULL' ELSE 'BASIC' END AS tier,COUNT(*) AS count FROM analyses a LEFT JOIN analysis_entitlements e ON e.analysis_id=a.id GROUP BY CASE WHEN e.tier='FULL' AND e.revoked_at='' THEN 'FULL' ELSE 'BASIC' END`),
 rows(db,`SELECT COUNT(*) AS files,SUM(size_bytes) AS bytes FROM client_documents`),
 rows(db,`SELECT provider,model,COUNT(*) AS requests,SUM(success) AS success,SUM(CASE WHEN success=0 THEN 1 ELSE 0 END) AS failure,SUM(input_tokens) AS inputTokens,SUM(output_tokens) AS outputTokens,AVG(latency_ms) AS latencyMs FROM ai_usage GROUP BY provider,model`),
 ]);
 return {summary:summary[0],daily,applicationStatuses:statuses,productUsage:usage,tiers,storage:storage[0],ai,canonicalAvailability:{state:'UNKNOWN',reason:'Summary is evaluated per analysis on demand'},sourceCompleteness:{state:'UNKNOWN',reason:'Source state is loaded with the canonical dossier'}};
}
