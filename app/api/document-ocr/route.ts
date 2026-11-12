/** Authenticated, tenant-scoped OCR preview. Original documents never reach AI providers. */
import {documentAccessSQL} from '../../../lib/auth/broker-authorizations';
import {getRuntime} from '../../../lib/platform/runtime';
import {documentStorage} from '../../../lib/storage/documents';
import {recognizeLocalDocument,OCR_MAX_BYTES,OCR_BATCH_PAGES,type OcrLayout} from '../../../lib/document-poc/local-ocr';
import {contractEvidence} from '../../../lib/document-poc/financial-terms';
import {requireApiUser,unauthorized} from '../api-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Statement={bind:(...values:unknown[])=>Statement};
type DB={prepare:(sql:string)=>Statement;batch:(queries:Statement[])=>Promise<Array<{results:unknown[]}>>};
type DocumentRow={id:string;fileName:string;mimeType:string;sizeBytes:number;contentBase64:string;storageKey:string;category:string};
const error=(status:number,message:string)=>Response.json({error:message},{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 const user=await requireApiUser();
 if(!user)return unauthorized();
 const origin=request.headers.get('origin');
 if(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==new URL(request.url).origin))return error(403,'Недопустимый источник запроса');
 try{
  const body=await request.json() as {documentId?:unknown;fromPage?:unknown;toPage?:unknown;layout?:unknown;quality?:unknown};
  const id=String(body?.documentId??'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return error(400,'Нужен идентификатор документа');
  const fromPage=body.fromPage??1,toPage=body.toPage??(Number(fromPage)+OCR_BATCH_PAGES-1),layout=body.layout??'SINGLE',quality=body.quality??'STANDARD';
  if(!Number.isSafeInteger(fromPage)||!Number.isSafeInteger(toPage)||Number(fromPage)<1||Number(toPage)<Number(fromPage)||Number(toPage)-Number(fromPage)+1>OCR_BATCH_PAGES||!['SINGLE','TWO_UP_ROTATED'].includes(String(layout))||!['STANDARD','HIGH'].includes(String(quality)))return error(400,'Некорректные параметры страниц OCR');
  const db=getRuntime().DB as unknown as DB;
  const query=db.prepare(`SELECT d.id,d.file_name AS "fileName",d.mime_type AS "mimeType",d.size_bytes AS "sizeBytes",d.content_base64 AS "contentBase64",d.storage_key AS "storageKey",d.category
   FROM client_documents d CROSS JOIN (SELECT ?::text AS email) actor
   WHERE d.id=? AND (?=1 OR ${documentAccessSQL('d','actor.email')}) LIMIT 1`)
   .bind(user.email,id,user.isAdmin?1:0);
  const rows=await db.batch([query]);
  const doc=(rows[0]?.results as DocumentRow[]|undefined)?.[0];
  if(!doc)return error(404,'Документ недоступен');
  if(!/\.pdf$/i.test(doc.fileName))return error(415,'OCR поддерживает PDF в кабинете');
  if(!doc.sizeBytes||doc.sizeBytes>OCR_MAX_BYTES)return error(413,'Документ слишком большой для OCR');
  const bytes=doc.contentBase64?new Uint8Array(Buffer.from(doc.contentBase64,'base64')):await documentStorage().get(doc.storageKey);
  if(bytes.byteLength!==doc.sizeBytes)return error(409,'Повреждённый документ');
  const result=await recognizeLocalDocument(bytes,{fromPage:Number(fromPage),toPage:Number(toPage),layout:layout as OcrLayout,quality:quality as 'STANDARD'|'HIGH'});
  const contract=/(?:контракт|договор|акт|упд)/iu.test(doc.category+' '+doc.fileName);
  const hints=contract?contractEvidence(result.pages):[];
  return Response.json({status:'PREVIEW',documentId:doc.id,fileName:doc.fileName,documentCategory:doc.category,ocr:result,hints,
   warnings:['OCR_REQUIRES_HUMAN_REVIEW','NO_FOREIGN_TRANSMISSION','NOT_IMPORTED_INTO_CREDIT_ENGINE',...result.warnings]},
   {headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){
  const code=e instanceof Error?e.message:'';
  if(code==='OCR_BUSY')return error(429,'Сервер OCR занят, повторите запрос позже');
  if(code==='OCR_PAGE_RANGE'||code==='OCR_PAGE_LIMIT'||code==='OCR_SIZE_LIMIT'||code==='OCR_FORMAT_UNSUPPORTED'||code==='OCR_PAGE_DIMENSIONS')return error(400,'Формат, число страниц или размер документа не поддерживается');
  if(code==='OCR_BINARY_UNAVAILABLE'||code==='OCR_PROCESS_TIMEOUT')return error(503,'Локальное распознавание временно недоступно или превысило лимит времени');
  return error(422,'Не удалось распознать документ');
 }
}
