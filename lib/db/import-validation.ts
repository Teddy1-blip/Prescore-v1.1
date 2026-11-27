import catalog from './catalog.json' with {type:'json'};
export type ExportTables=Record<string,Record<string,unknown>[]>;
export function validateExport(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('EXPORT_INVALID');
 const tables=(input as {tables?:unknown}).tables;if(!tables||typeof tables!=='object'||Array.isArray(tables))throw Error('EXPORT_TABLES_REQUIRED');
 const result=tables as ExportTables;const errors:string[]=[];const counts:Record<string,number>={};
 for(const [name,rows]of Object.entries(result)){
  const definition=catalog.find(c=>c.table===name);if(!definition){errors.push(`UNKNOWN_TABLE:${name}`);continue;}
  if(!Array.isArray(rows)){errors.push(`INVALID_ROWS:${name}`);continue;}counts[name]=rows.length;const seen=new Set();
  rows.forEach((row,index)=>{if(!row||typeof row!=='object'||Array.isArray(row)){errors.push(`INVALID_ROW:${name}:${index}`);return;}
   if(definition.columns.some(k=>!Object.hasOwn(row,k)))errors.push(`MISSING_COLUMN:${name}:${index}`);
   if(Object.keys(row).some(k=>!definition.columns.includes(k)))errors.push(`UNKNOWN_COLUMN:${name}:${index}`);
   if(Object.values(row).some(v=>v!==null&&typeof v!=='string'&&(typeof v!=='number'||!Number.isFinite(v)||!Number.isSafeInteger(v))))errors.push(`INVALID_VALUE:${name}:${index}`);
   const pk=definition.primaryKey.map(k=>row[k]);if(pk.some(x=>x===undefined||x===null||x===''))errors.push(`MISSING_ID:${name}:${index}`);
   const key=JSON.stringify(pk);if(seen.has(key))errors.push(`DUPLICATE_ID:${name}:${index}`);seen.add(key);
  });
 }
 for(const t of catalog)if(!Object.hasOwn(result,t.table))errors.push(`MISSING_TABLE:${t.table}`);
 if(errors.some(e=>/^(INVALID_ROWS|INVALID_ROW|MISSING_TABLE|UNKNOWN_TABLE):/.test(e)))return {tables:result,counts,errors,valid:false};
 const ids=(name:string)=>new Set((result[name]??[]).map(r=>r.id));
 for(const [table,column,target]of [['deals','analysis_id','analyses'],['ai_conversations','analysis_id','analyses'],['ai_messages','conversation_id','ai_conversations'],['analysis_entitlements','analysis_id','analyses'],['payments','subscription_id','subscriptions'],['agent_applications','lead_id','agent_leads'],['client_documents','analysis_id','analyses'],['payment_orders','analysis_id','analyses'],['application_messages','document_id','client_documents']] as const){const allowed=ids(target);(result[table]??[]).forEach((row,i)=>{if(row[column]&&!allowed.has(row[column]))errors.push(`ORPHAN:${table}:${column}:${i}`);});}
 const applications=new Set([...ids('deals'),...ids('agent_applications')]);
 for(const table of ['client_documents','application_messages','application_status_history']) (result[table]??[]).forEach((r,i)=>{if(r.application_id&&!applications.has(r.application_id))errors.push(`ORPHAN:${table}:application_id:${i}`);});
 const agents=new Set((result.agent_accounts??[]).map(r=>r.agent_code));
 for(const table of ['agent_leads','agent_applications','agent_prospects']) (result[table]??[]).forEach((r,i)=>{if(r.agent_code&&!agents.has(r.agent_code))errors.push(`ORPHAN:${table}:agent_code:${i}`);});
 for(const table of ['analyses','client_documents','ai_conversations']) (result[table]??[]).forEach((r,i)=>{if(typeof r.owner_email!=='string'||!r.owner_email.trim())errors.push(`OWNERSHIP_MISSING:${table}:${i}`);});
 const analyses=new Map((result.analyses??[]).map(r=>[r.id,r]));
 (result.analysis_entitlements??[]).forEach((r,i)=>{const a=analyses.get(r.analysis_id);if(a&&(r.user_email!==a.owner_email||r.company_inn!==a.company_inn))errors.push(`ENTITLEMENT_OWNER_MISMATCH:${i}`);});
 return {tables:result,counts,errors,valid:errors.length===0};
}
