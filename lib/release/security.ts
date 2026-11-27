import {createHmac,randomUUID} from 'node:crypto';import type {QueryExecutor} from '../db/compatibility.ts';
export function correlationId(value:string|null){return value&&/^[A-Za-z0-9-]{8,80}$/.test(value)?value:randomUUID();}
export function safeErrorText(error:unknown,fallback='Не удалось выполнить операцию'){const code=error instanceof Error?error.message:'';return /^(?:INVALID|STORAGE|DOCUMENT|PAYMENT|PAYOUT|BILLING|ANALYSIS|REFUND|CURRENT_ACCEPTANCE|LEGAL|ATTRIBUTION|IDEMPOTENCY|PROVIDER|FINANCING|QUARTERLY|BKI|CREDIT_HISTORY|SOURCE|ATTACHMENT|AI|FORBIDDEN|COMPANY|ORDER|REASON|RETRY|RECONCILIATION)_[A-Z0-9_]{1,100}$/.test(code)?code:fallback;}
export function operationalLog(input:{event:string;result:string;correlationId?:string;entityId?:string;role?:string;durationMs?:number}){const clean={timestamp:new Date().toISOString(),level:input.result==='ERROR'?'error':'info',event:input.event.replace(/[^A-Z0-9_]/g,'').slice(0,80),result:input.result.replace(/[^A-Z0-9_]/g,'').slice(0,40),...(input.correlationId?{correlationId:correlationId(input.correlationId)}:{}),...(input.entityId&&/^[A-Za-z0-9_-]{1,100}$/.test(input.entityId)?{entityId:input.entityId}:{}),...(['CLIENT','AGENT','ADMIN','SYSTEM'].includes(input.role??'')?{role:input.role}:{}),...(Number.isFinite(input.durationMs)?{durationMs:Math.max(0,Math.round(input.durationMs!))}:{})};console.log(JSON.stringify(clean));return clean;}
export async function rateLimit(db:QueryExecutor,scope:string,identity:string,max:number,windowSeconds=60,now=Date.now()){const end=new Date((Math.floor(now/(windowSeconds*1000))+1)*windowSeconds*1000).toISOString();const bucket=createHmac('sha256',process.env.AUTH_SECRET??'isolated-rate-tests').update(scope+'\0'+identity+'\0'+end).digest('hex');const result=await db.query('INSERT INTO runtime_rate_limits(bucket,count,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET count=runtime_rate_limits.count+1 RETURNING count',[bucket,end]);await db.query('DELETE FROM runtime_rate_limits WHERE bucket IN(SELECT bucket FROM runtime_rate_limits WHERE expires_at<now() ORDER BY expires_at LIMIT 100)');return {allowed:Number(result.rows[0]?.count)<=max,retryAfter:Math.max(1,Math.ceil((Date.parse(end)-now)/1000))};}
export function requestBodyLimit(path:string){return path==='/api/analysis'?64*1024*1024:(path==='/api/source-documents'||path==='/api/dossier')?36*1024*1024:path==='/api/documents'?2*1024*1024:path==='/api/billing/notification'?16384:path==='/api/admin'||path==='/api/billing/admin'?16384:64*1024;}
export async function withinBodyLimit(request:Request,max:number){const declared=Number(request.headers.get('content-length')??0);if(declared>max||declared<0)return false;const stream=request.clone().body;if(!stream)return true;const reader=stream.getReader();let bytes=0;try{while(true){const next=await reader.read();if(next.done)return true;bytes+=next.value.byteLength;if(bytes>max){void reader.cancel();return false;}}}finally{reader.releaseLock();}}
export function securityHeaders(nonce:string,https:boolean){return {'Content-Security-Policy':`default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','X-Frame-Options':'DENY',...(https?{'Strict-Transport-Security':'max-age=31536000'}:{})};}

export async function recordOperation(db:QueryExecutor,event:string,result:string){await db.query('INSERT INTO runtime_operations(id,event,result) VALUES($1,$2,$3)',[randomUUID(),event.slice(0,80),result.slice(0,40)]);await db.query("DELETE FROM runtime_operations WHERE id IN(SELECT id FROM runtime_operations WHERE created_at<now()-interval '30 days' ORDER BY created_at LIMIT 100)");}
// A parser exception may include document text or an original file name.
// Only fixed, recognized failure codes and a UUID reach the operational log.
const uploadErrors = new Set([
 'OCR_BUSY','OCR_PAGE_RANGE','OCR_PAGE_LIMIT','OCR_SIZE_LIMIT','OCR_FORMAT_UNSUPPORTED',
 'OCR_PAGE_DIMENSIONS','OCR_PROCESS_TIMEOUT','OCR_BINARY_UNAVAILABLE','OCR_PROCESS_ERROR',
 'OCR_OUTPUT_LIMIT','OCR_CHUNK_TEXT_LIMIT','ENOENT','EACCES','ENOSPC','ENOMEM',
 'ECONNREFUSED','ETIMEDOUT','23505','23503','42501','42P01','42703',
 'UNCONFIRMED_PERIOD_OR_IDENTITY','DATABASE_CONFIGURATION_MISSING',
]);
export function logUploadFailure(stage:string, error:unknown, incomingId:string|null, fallback:'UNEXPECTED_ERROR'|'DOCUMENT_REJECTED'|'FULL_REQUIRED'='UNEXPECTED_ERROR') {
 const diagnosticId=correlationId(incomingId && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(incomingId)?incomingId:null);
 const cause=error instanceof Error && error.cause instanceof Error?error.cause:null;
 const codes=error instanceof Error?[error.message,(error as NodeJS.ErrnoException).code,cause?.message,(cause as NodeJS.ErrnoException|null)?.code]:[];
 const result=codes.find((code):code is string=>typeof code==='string'&&uploadErrors.has(code))
   ?? (error instanceof SyntaxError?'INVALID_SYNTAX':error instanceof TypeError?'TYPE_ERROR':fallback);
 const tool=error instanceof Error && 'tool' in error?error.tool:undefined;
 const event=typeof tool==='string'&&['pdfinfo','pdftotext','pdftoppm','tesseract'].includes(tool)?stage+'_'+tool.toUpperCase():stage;
 operationalLog({event,result,correlationId:diagnosticId});
 return diagnosticId;
}
