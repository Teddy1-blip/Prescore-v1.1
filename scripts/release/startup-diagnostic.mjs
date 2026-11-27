import {createServer} from 'node:http';

export const STAGING_RELEASE_ID = 'PRESCORE-V1-RC3-20261019';
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,79}$/;
const SQL_ERRORS = new Map([
 ['28P01','DATABASE_AUTH_FAILED'],
 ['3D000','DATABASE_NAME_NOT_FOUND'],
 ['42501','DATABASE_PERMISSION_DENIED'],
 ['57P03','DATABASE_NOT_READY'],
 ['ENOTFOUND','DATABASE_HOST_NOT_FOUND'],
 ['EAI_AGAIN','DATABASE_DNS_TEMPORARY_FAILURE'],
 ['ECONNREFUSED','DATABASE_CONNECTION_REFUSED'],
 ['ETIMEDOUT','DATABASE_CONNECTION_TIMEOUT'],
 ['ERR_MODULE_NOT_FOUND','RUNTIME_MODULE_NOT_FOUND'],
 ['EACCES','FILESYSTEM_PERMISSION_DENIED'],
 ['EPERM','FILESYSTEM_PERMISSION_DENIED'],
 ['ECONNRESET','DATABASE_CONNECTION_RESET'],
 ['EPIPE','DATABASE_CONNECTION_CLOSED'],
 ['EHOSTUNREACH','DATABASE_HOST_UNREACHABLE'],
 ['ENETUNREACH','DATABASE_NETWORK_UNREACHABLE'],
 ['ENOENT','RUNTIME_FILE_NOT_FOUND'],
 ['ERR_PACKAGE_PATH_NOT_EXPORTED','RUNTIME_PACKAGE_EXPORT_MISSING'],
 ['ERR_IMPORT_ATTRIBUTE_MISSING','RUNTIME_IMPORT_ATTRIBUTE_MISSING'],
 ['ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING','RUNTIME_TYPE_STRIPPING_UNSUPPORTED'],
 ['ERR_REQUIRE_ESM','RUNTIME_MODULE_FORMAT_INVALID'],
 ['ERR_INVALID_PACKAGE_CONFIG','RUNTIME_PACKAGE_CONFIG_INVALID'],
 ['08000','DATABASE_CONNECTION_EXCEPTION'],
 ['08001','DATABASE_CONNECTION_UNAVAILABLE'],
 ['08003','DATABASE_CONNECTION_MISSING'],
 ['08004','DATABASE_CONNECTION_REJECTED'],
 ['08006','DATABASE_CONNECTION_FAILURE'],
 ['08007','DATABASE_TRANSACTION_STATE_UNKNOWN'],
 ['08P01','DATABASE_PROTOCOL_VIOLATION'],
 ['23502','DATABASE_NOT_NULL_VIOLATION'],
 ['23503','DATABASE_FOREIGN_KEY_VIOLATION'],
 ['23505','DATABASE_UNIQUE_VIOLATION'],
 ['23514','DATABASE_CHECK_VIOLATION'],
 ['25P02','DATABASE_TRANSACTION_ABORTED'],
 ['40001','DATABASE_SERIALIZATION_FAILURE'],
 ['40P01','DATABASE_DEADLOCK'],
 ['42601','DATABASE_SQL_SYNTAX_ERROR'],
 ['42701','DATABASE_DUPLICATE_COLUMN'],
 ['42703','DATABASE_UNDEFINED_COLUMN'],
 ['42710','DATABASE_DUPLICATE_OBJECT'],
 ['42P01','DATABASE_UNDEFINED_TABLE'],
 ['42P07','DATABASE_DUPLICATE_TABLE'],
 ['53100','DATABASE_DISK_FULL'],
 ['53200','DATABASE_OUT_OF_MEMORY'],
 ['53300','DATABASE_CONNECTION_LIMIT'],
 ['53400','DATABASE_CONFIGURATION_LIMIT'],
 ['55P03','DATABASE_LOCK_UNAVAILABLE'],
 ['57014','DATABASE_QUERY_CANCELLED'],
 ['57P01','DATABASE_ADMIN_SHUTDOWN'],
 ['57P02','DATABASE_CRASH_SHUTDOWN'],
 ['57P04','DATABASE_DROPPED'],
 ['58030','DATABASE_IO_ERROR'],
]);
// Public diagnostics contain only fixed labels/codes, never raw errors or SQL.
const STEPS = new Set(['ENVIRONMENT_IMPORT','ENVIRONMENT_VALIDATE','DB_CLIENT_IMPORT',
 'MIGRATIONS_IMPORT','READINESS_IMPORT','POOL_CREATE','MIGRATION_REGISTRY','MIGRATION_APPLY','READINESS_CHECK']);
const ERROR_TYPES = new Set(['Error','TypeError','SyntaxError','RangeError','ReferenceError','AggregateError']);
const CONNECTION_MESSAGES = new Map([
 ['Connection terminated unexpectedly','DATABASE_CONNECTION_TERMINATED'],
 ['Connection terminated','DATABASE_CONNECTION_TERMINATED'],
 ['Connection terminated due to connection timeout','DATABASE_CONNECTION_TIMEOUT'],
 ['timeout exceeded when trying to connect','DATABASE_CONNECTION_TIMEOUT'],
]);
// Bounded traversal also handles pg/Node wrapped errors without serializing them.
function errorChain(error) {
 const queue=[error],seen=new Set(),result=[];
 while(queue.length&&result.length<8){
  const item=queue.shift();
  if(!item||typeof item!=='object'||seen.has(item))continue;
  seen.add(item);result.push(item);
  if(item.cause)queue.push(item.cause);
  if(item instanceof AggregateError)queue.push(...item.errors.slice(0,4));
 }
 return result;
}
export function startupFailureDetails(error) {
 const chain=errorChain(error),coded=chain.find(item=>SQL_ERRORS.has(item.code));
 return {
  ...(ERROR_TYPES.has(error?.name)?{errorType:error.name}:{}),
  ...(coded?{nativeCode:coded.code}:{}),
 };
}
const safeString = value => typeof value === 'string' && SAFE_CODE.test(value) ? value : null;
export function classifyStartupFailure(error, fallback='OPERATION_FAILED') {
 const chain=errorChain(error);
 for(const item of chain){const mapped=SQL_ERRORS.get(item.code);if(mapped)return mapped;}
 for(const item of chain){
  const mapped=item instanceof Error?CONNECTION_MESSAGES.get(item.message):undefined;
  if(mapped)return mapped;
 }
 const message = error instanceof Error ? error.message : '';
 if (safeString(message) && /^(?:MIGRATION|SCHEMA|DATABASE|STORAGE|CONFIGURATION|BOOTSTRAP|VERIFIED|BACKUP|RESTORE|RC_)/.test(message)) return message;
 return safeString(fallback) ?? 'OPERATION_FAILED';
}
export function safeStartupReport({stage='BOOTSTRAP',code='OPERATION_FAILED',issues=[],step,nativeCode,errorType}={}) {
 const validStages = new Set(['BOOTSTRAP','CONFIGURATION','DATABASE_MIGRATION','READINESS','NEXT_SERVER']);
 return Object.freeze({
  version:'PRESCORE-STARTUP-DIAGNOSTIC-2',
  stage:validStages.has(stage)?stage:'BOOTSTRAP',
  ...(STEPS.has(step)?{step}:{}),
  ...(SQL_ERRORS.has(nativeCode)?{nativeCode}:{}),
  ...(ERROR_TYPES.has(errorType)?{errorType}:{}),
  code:safeString(code)??'OPERATION_FAILED',
  issues:Array.isArray(issues)?issues.slice(0,24).map(issue=>({
   variable:safeString(issue?.variable)??'UNKNOWN',
   code:safeString(issue?.code)??'CONFIGURATION_INVALID',
  })):[],
 });
}
export function startStartupDiagnosticServer(report,{host='0.0.0.0',port=3000}={}) {
 const diagnostic=safeStartupReport(report);
 const reply=(res,status,data,head=false)=>{
  const body=JSON.stringify(data);
  res.writeHead(status,{
   'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store',
   'X-Content-Type-Options':'nosniff',
   'X-Robots-Tag':'noindex, nofollow',
  });
  res.end(head?undefined:body);
 };
 const server=createServer((req,res)=>{
  const path=(req.url??'').split('?')[0];
  const head=req.method==='HEAD';
  if(req.method!=='GET'&&!head){reply(res,503,{error:'SERVICE_UNAVAILABLE'},head);return;}
  if(path==='/api/health'){
   reply(res,200,{alive:true,releaseId:STAGING_RELEASE_ID,startup:'FAILED',ready:false,diagnostic},head);
  }else if(path==='/api/ready'){
   reply(res,503,{ready:false,code:'STARTUP_REJECTED',diagnostic},head);
  }else{
   reply(res,503,{error:'SERVICE_UNAVAILABLE'},head);
  }
 });
 return new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(port,host,()=>{
   server.off('error',reject);
   resolve(server);
  });
 });
}
