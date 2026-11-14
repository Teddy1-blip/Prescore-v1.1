import {randomUUID,createHash} from 'node:crypto';
import {documentStorage} from '../storage/documents.ts';
import {validateZipBudget} from '../release/archive-limits.ts';
import type {TransactionPool} from '../db/compatibility.ts';
import type {SourceEnvelope} from '../credit-engine/contracts/sources.ts';
import type {PrivateSource} from './dossier-sources.ts';
import {reviewFields} from '../document-poc/review-fields.ts';
import {mapPdfPages,extractDocumentText} from '../credit-engine/server/document-extraction.ts';
import {parseAuthoritativeBfoText,parseAuthoritativeQuarterlyText,parseAuthoritativeCreditHistoryText} from '../credit-engine/source-foundation.ts';
import {adaptFinancialReport} from '../credit-engine/financial-analysis/quarterly-adapter.ts';
import {parseLedger} from './ledger-import.ts';
import {withDossierSources} from './dossier-bank.ts';
import type {AnalysisResult} from '../prescore.ts';
import {ownedDossier} from './dossier.ts';
export const uploadKinds=['BFO','QUARTERLY','BKI','COUNTERPARTIES','DEBT_LEDGER','CREDIT_DOCUMENT','COMMERCIAL_DOCUMENT','BFO_REVIEW'] as const;
type Kind=typeof uploadKinds[number];
export class InputError extends Error {}
export async function importSource(db:TransactionPool,owner:string,id:string,kind:Kind,file:File) {
  const dossier=await ownedDossier(db,owner,id);
  if(!dossier)return null;
  const ext=file.name.split('.').pop()?.toLowerCase()??'';
  const ledger=kind==='COUNTERPARTIES'||kind==='DEBT_LEDGER';
  const reviewKind=kind==='CREDIT_DOCUMENT'||kind==='COMMERCIAL_DOCUMENT'||kind==='BFO_REVIEW';
  const allowed=kind==='BKI'||reviewKind?['pdf']:ledger?['xlsx','csv']:['pdf','xlsx','csv'];
  if(!allowed.includes(ext)||file.name.length>180||!file.size||file.size>(kind==='BKI'?35:25)*1024*1024)throw new InputError('Проверьте размер и формат файла.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const hash=createHash('sha256').update(bytes).digest('hex');
  const sourceId=kind.toLowerCase()+':'+hash, now=new Date().toISOString(),inn=dossier.inn;
  const envelope:SourceEnvelope={sourceId,sourceType:ledger||reviewKind?'OTHER':kind as 'BFO'|'QUARTERLY'|'BKI',fileName:file.name,
    status:'READY',companyInn:inn,warnings:[],confidence:null,receivedAt:now,contentHash:hash,rawReference:'sha256:'+hash};
  const payload:PrivateSource={envelope};
  try{
    if(ext==='xlsx')validateZipBudget(bytes);
    if(reviewKind){
      const family=kind==='CREDIT_DOCUMENT'?'CREDIT':kind==='BFO_REVIEW'?'BFO':'COMMERCIAL';
      const pages=await mapPdfPages(bytes.slice(),64,true,async(text,p)=>({page:p.pageNumber,logicalPage:p.pageNumber,method:text.trim()?'TEXT' as const:'UNREADABLE' as const,text}));
      payload.review=reviewFields(sourceId,pages,pages.length,family,'SINGLE');
      envelope.status='PROCESSING';
    }else{
    const text=await extractDocumentText(file.name,ext==='pdf'?bytes.slice():bytes,kind==='BKI'?'bureau':'financial');
    if(ledger)payload.ledger=parseLedger(text,inn,kind);
    else if(kind==='BKI'){
      const bki=parseAuthoritativeCreditHistoryText({text,fileName:file.name,analysisInn:inn,relationship:'Не указано'});
      if(bki.subjectInn!==inn||!bki.affectsCompanyDebt||!bki.reportDate)throw new InputError('Для самостоятельного портфеля требуется корпоративный отчёт БКИ с ИНН и датой.');
      Object.assign(envelope,{periodTo:bki.reportDate,confidence:bki.parserConfidence,warnings:bki.warnings,parserVersion:'PRESCORE-BKI-PARSER-1'});
      payload.bki=bki;
    }else{
      const report=(kind==='BFO'?parseAuthoritativeBfoText:parseAuthoritativeQuarterlyText)({text,fileName:file.name,analysisInn:inn});
      Object.assign(envelope,{periodFrom:report.financialMetadataV2?.period.from,periodTo:report.financialMetadataV2?.period.to,
        confidence:report.parserConfidence,warnings:report.warnings,parserVersion:kind==='BFO'?'PRESCORE-BFO-UPLOAD-1':'PRESCORE-QUARTERLY-PARSER-1'});
      payload.snapshot=adaptFinancialReport(report,envelope);
    }
    }
  }catch(error){
    if(error instanceof InputError)throw error;
    throw new InputError('Не удалось подтвердить формат, ИНН или период документа. Проверьте выбранный файл.');
  }
  const tx=await db.connect();
  const storage=documentStorage();let storageKey:string|undefined;
  try{
    await tx.query('BEGIN');
    await tx.query('SELECT id FROM company_dossiers WHERE id=$1 AND owner_email=$2 FOR UPDATE',[id,owner]);
    const prior=await tx.query('SELECT document_id FROM dossier_sources WHERE dossier_id=$1 AND source_id=$2',[id,sourceId]);
    if(prior.rows.length){await tx.query('COMMIT');return {id:sourceId,duplicate:true};}
    const doc=randomUUID();
    const mime=ext==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':ext==='pdf'?'application/pdf':'text/csv';
    storageKey=(await storage.put(bytes,mime)).key;
    await tx.query(`INSERT INTO client_documents(id,company_inn,category,file_name,mime_type,size_bytes,content_base64,uploaded_by,owner_email,storage_key)
      VALUES($1,$2,$3,$4,$5,$6,'',$7,$7,$8)`,[doc,inn,kind,file.name,mime,bytes.length,owner,storageKey]);
    await tx.query('INSERT INTO dossier_sources(dossier_id,source_id,source_type,payload,document_id) VALUES($1,$2,$3,$4,$5)',[id,sourceId,kind,JSON.stringify(payload),doc]);
    // Update only the owner's latest working version. Previously issued report snapshots stay immutable.
    if(payload.snapshot || payload.bki){
      const current=(await tx.query("SELECT id,payload FROM analyses WHERE owner_email=$1 AND company_inn=$2 AND archive_state='ACTIVE' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE",[owner,inn])).rows[0];
      if(current){
        const bank=JSON.parse(String(current.payload)) as AnalysisResult;
        const next=withDossierSources(bank,[{id:sourceId,kind,documentId:doc,payload}]);
        await tx.query("UPDATE analyses SET payload=$1 WHERE id=$2 AND owner_email=$3 AND archive_state='ACTIVE'",[JSON.stringify(next),current.id,owner]);
      }
    }
    await tx.query('COMMIT');
    return {id:sourceId,duplicate:false};
  }catch(error){
    await tx.query('ROLLBACK');
    if(storageKey && !(await db.query('SELECT id FROM client_documents WHERE storage_key=$1',[storageKey])).rows.length) await storage.delete(storageKey);
    throw error;
  }finally{tx.release();}
}
