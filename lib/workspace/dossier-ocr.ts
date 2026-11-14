import type {QueryExecutor} from '../db/compatibility.ts';
import {recognizeLocalDocument,OCR_MAX_BYTES,type OcrPage,type OcrLayout} from '../document-poc/local-ocr.ts';
import {reviewFields} from '../document-poc/review-fields.ts';
import {documentStorage} from '../storage/documents.ts';
import type {PrivateSource} from './dossier-sources.ts';

type Progress={layout:OcrLayout;through:number;total:number;pages:OcrPage[];warnings:string[];version:string};
export type OcrProgress=Progress;
const families={CREDIT_DOCUMENT:'CREDIT',COMMERCIAL_DOCUMENT:'COMMERCIAL',BFO_REVIEW:'BFO'} as const;

// One bounded batch per request. A concurrent reviewer wins over OCR, and page text comes from storage.
export async function recognizeDossierBatch(db:QueryExecutor,owner:string,id:string,sourceId:string,layout:OcrLayout){
 const row=(await db.query(`SELECT s.source_type,s.payload,f.storage_key,f.size_bytes FROM dossier_sources s
   JOIN company_dossiers d ON d.id=s.dossier_id JOIN client_documents f ON f.id=s.document_id AND f.owner_email=d.owner_email
   WHERE d.id=$1 AND d.owner_email=$2 AND s.source_id=$3`,[id,owner,sourceId])).rows[0];
 const family=row&&families[row.source_type as keyof typeof families];
 if(!row||!family)return {status:404,error:'Документ недоступен.'};
 const payload=row.payload as PrivateSource,previous=payload.ocr;
 if(Object.keys(payload.verified??{}).length)return {status:409,error:'В документе уже есть подтверждённые поля.'};
 if(previous&&previous.layout!==layout)return {status:409,error:'Продолжите в выбранной раскладке страниц.'};
 if(previous&&previous.through===previous.total)return {status:200,through:previous.through,total:previous.total};
 if(!row.storage_key||Number(row.size_bytes)>OCR_MAX_BYTES)return {status:413,error:'Файл превышает лимит локального OCR.'};
 const bytes=await documentStorage().get(String(row.storage_key));
 if(bytes.length!==Number(row.size_bytes))return {status:409,error:'Оригинал не прошёл проверку размера.'};
 let batch;
 try{batch=await recognizeLocalDocument(bytes,{layout,fromPage:(previous?.through??0)+1});}
 catch(error){
   const reason=error instanceof Error?error.message:'';
   if(reason==='OCR_BUSY')return {status:429,error:'Сервер распознавания занят.'};
   if(['OCR_BINARY_UNAVAILABLE','OCR_PROCESS_TIMEOUT'].includes(reason))return {status:503,error:'Локальное распознавание временно недоступно.'};
   return {status:422,error:'Не удалось распознать страницы этого документа.'};
 }
 const progress:Progress={layout,through:batch.processedTo,total:batch.pageCount,version:batch.version,
   pages:[...(previous?.pages??[]),...batch.pages],warnings:[...new Set([...(previous?.warnings??[]),...batch.warnings])]};
 const update:Partial<PrivateSource>={ocr:progress};
 if(progress.through===progress.total)update.review=reviewFields(sourceId,progress.pages,progress.total,family,layout,progress.warnings);
 const saved=await db.query(`UPDATE dossier_sources SET payload=payload||$1::jsonb WHERE dossier_id=$2 AND source_id=$3
   AND coalesce((payload->'ocr'->>'through')::int,0)=$4 AND coalesce(payload->'verified','{}'::jsonb)='{}'::jsonb RETURNING source_id`,
   [JSON.stringify(update),id,sourceId,previous?.through??0]);
 return saved.rows.length?{status:200,through:progress.through,total:progress.total}:{status:409,error:'Документ изменился. Обновите досье.'};
}
