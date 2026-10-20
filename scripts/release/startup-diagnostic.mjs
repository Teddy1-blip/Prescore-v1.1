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
]);
const safeString = value => typeof value === 'string' && SAFE_CODE.test(value) ? value : null;
export function classifyStartupFailure(error, fallback='OPERATION_FAILED') {
 const rawCode = error && typeof error === 'object' ? error.code : undefined;
 const mapped = SQL_ERRORS.get(rawCode);
 if (mapped) return mapped;
 const message = error instanceof Error ? error.message : '';
 if (safeString(message) && /^(?:MIGRATION|SCHEMA|DATABASE|STORAGE|CONFIGURATION|BOOTSTRAP|VERIFIED|BACKUP|RESTORE|RC_)/.test(message)) return message;
 return safeString(fallback) ?? 'OPERATION_FAILED';
}
export function safeStartupReport({stage='BOOTSTRAP',code='OPERATION_FAILED',issues=[]}={}) {
 const validStages = new Set(['BOOTSTRAP','CONFIGURATION','DATABASE_MIGRATION','READINESS','NEXT_SERVER']);
 return Object.freeze({
  stage:validStages.has(stage)?stage:'BOOTSTRAP',
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
