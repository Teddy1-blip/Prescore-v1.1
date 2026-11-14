import {randomUUID,createHash} from 'node:crypto';
import {documentStorage} from '../storage/documents.ts';
import {validateZipBudget} from '../release/archive-limits.ts';
import type {TransactionPool} from '../db/compatibility.ts';
import type {SourceEnvelope} from '../credit-engine/contracts/sources.ts';
import type {PrivateSource} from './dossier-sources.ts';
import {wordParagraphs} from '../document-poc/word-paragraphs.ts';
import {reviewFields} from '../document-poc/review-fields.ts';
import {mapPdfPages,extractDocumentText} from '../credit-engine/server/document-extraction.ts';
import {parseAuthoritativeBfoText,parseAuthoritativeQuarterlyText,parseAuthoritativeCreditHistoryText} from '../credit-engine/source-foundation.ts';
import {adaptFinancialReport} from '../credit-engine/financial-analysis/quarterly-adapter.ts';
import {parseLedger} from './ledger-import.ts';
import {withDossierSources} from './dossier-bank.ts';
import type {AnalysisResult} from '../prescore.ts';
import {parseQuarterlyReportText} from '../quarterly-report.ts';
import {parseCreditHistoryText} from '../credit-history.ts';
import {financialTableRows} from '../document-poc/financial-layout.ts';
import {validInn} from '../external/checko-inn.ts';
import {ownedDossier,saveDossier} from './dossier.ts';
export const uploadKinds=['BFO','QUARTERLY','BKI','COUNTERPARTIES','DEBT_LEDGER','CREDIT_DOCUMENT','COMMERCIAL_DOCUMENT','BFO_REVIEW'] as const;
type Kind=typeof uploadKinds[number];
export class InputError extends Error {}
export async function importSource(db:TransactionPool,owner:string,id:string,kind:Kind,file:File) {
  const dossier=id?await ownedDossier(db,owner,id):undefined;
  if(id&&!dossier)return null;
  const ext=file.name.split('.').pop()?.toLowerCase()??'';
  const ledger=kind==='COUNTERPARTIES'||kind==='DEBT_LEDGER';
  const reviewKind=kind==='CREDIT_DOCUMENT'||kind==='COMMERCIAL_DOCUMENT'||kind==='BFO_REVIEW';
  const allowed=kind==='CREDIT_DOCUMENT'||kind==='COMMERCIAL_DOCUMENT'?['pdf','docx']:kind==='BKI'||reviewKind?['pdf']:ledger?['xls','xlsx','csv']:['pdf','xls','xlsx','csv'];
  if(!allowed.includes(ext)||file.name.length>180||!file.size||file.size>(kind==='BKI'?35:25)*1024*1024)throw new InputError('Проверьте размер и формат файла.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const hash=createHash('sha256').update(bytes).digest('hex');
  if(ext==='xlsx')try{validateZipBudget(bytes);}catch{throw new InputError('Проверьте размер и структуру архива XLSX.');}
  let text='';
  if(!reviewKind)try{text=await extractDocumentText(file.name,ext==='pdf'?bytes.slice():bytes,kind==='BKI'?'bureau':'financial');}catch{throw new InputError('Не удалось прочитать документ.');}
  let inn=dossier?.inn;
  if(!inn){
    if(kind==='BFO'||kind==='QUARTERLY')inn=parseQuarterlyReportText(text,file.name).companyInn??undefined;
    else if(kind==='BKI')inn=parseCreditHistoryText(text,file.name).subjectInn??undefined;
    else if(ledger){
      const [head,...rows]=text.trim().replace(/^\uFEFF/,'').split(/\r?\n/);
      const col=head.split('\t').map(s=>s.trim()).indexOf('ИНН организации');
      const identities=new Set(rows.filter(r=>r.trim()).map(r=>r.split('\t')[col]?.trim()));
      if(identities.size===1)inn=[...identities][0];
    }
    if(!inn||!validInn(inn))throw new InputError('Для этого документа выберите досье по ИНН или загрузите файл с идентифицируемой организацией.');
  }
  const sourceId=kind.toLowerCase()+':'+hash, now=new Date().toISOString();
  const envelope:SourceEnvelope={sourceId,sourceType:ledger||reviewKind?'OTHER':kind as 'BFO'|'QUARTERLY'|'BKI',fileName:file.name,
    status:'READY',companyInn:inn,warnings:[],confidence:null,receivedAt:now,contentHash:hash,rawReference:'sha256:'+hash};
  const payload:PrivateSource={envelope};
  try{
    if(reviewKind){
      const family=kind==='CREDIT_DOCUMENT'?'CREDIT':kind==='BFO_REVIEW'?'BFO':'COMMERCIAL';
      if(ext==='docx'){
        const paragraphs=wordParagraphs(bytes);
        // Route the document as one text, then bind each extracted fragment to its paragraph.
        const page={page:1,logicalPage:1,method:'TEXT' as const,text:paragraphs.map(p=>p.text).join('\n')};
        const review=reviewFields(sourceId,[page],1,family,'SINGLE',[]);
        for(const field of review.fields){
          const matches=field.fragment?paragraphs.filter(p=>p.text.includes(field.fragment!)):[];
          field.page=matches.length===1?matches[0].page:null;
        }
        review.anchor='paragraph';
        payload.review=review;
      }else{
        const pages=await mapPdfPages(bytes.slice(),64,true,async(text,p,items)=>({tables:family==='BFO'?financialTableRows(items,p.pageNumber):[],page:p.pageNumber,logicalPage:p.pageNumber,method:text.trim()?'TEXT' as const:'UNREADABLE' as const,text}));
        payload.review=reviewFields(sourceId,pages,pages.length,family,'SINGLE',[],pages.flatMap(p=>p.tables));
      }
      envelope.status='PROCESSING';
    }else{
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
    if(!id)id=(await saveDossier(tx,owner,inn)).id;
    await tx.query('SELECT id FROM company_dossiers WHERE id=$1 AND owner_email=$2 FOR UPDATE',[id,owner]);
    const prior=await tx.query('SELECT document_id FROM dossier_sources WHERE dossier_id=$1 AND source_id=$2',[id,sourceId]);
    if(prior.rows.length){await tx.query('COMMIT');return {id:sourceId,dossierId:id,duplicate:true};}
    const doc=randomUUID();
    const mime=ext==='xls'?'application/vnd.ms-excel':ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':ext==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':ext==='pdf'?'application/pdf':'text/csv';
    storageKey=(await storage.put(bytes,mime)).key;
    await tx.query(`INSERT INTO client_documents(id,company_inn,category,file_name,mime_type,size_bytes,content_base64,uploaded_by,owner_email,storage_key)
      VALUES($1,$2,$3,$4,$5,$6,'',$7,$7,$8)`,[doc,inn,kind,file.name,mime,bytes.length,owner,storageKey]);
    await tx.query('INSERT INTO dossier_sources(dossier_id,source_id,source_type,payload,document_id) VALUES($1,$2,$3,$4,$5)',[id,sourceId,kind,JSON.stringify(payload),doc]);
    // Update only the owner's latest working version. Previously issued report snapshots stay immutable.
    if(payload.snapshot || payload.bki || kind==='DEBT_LEDGER'){
      const current=(await tx.query("SELECT id,payload FROM analyses WHERE owner_email=$1 AND company_inn=$2 AND archive_state='ACTIVE' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE",[owner,inn])).rows[0];
      if(current){
        const bank=JSON.parse(String(current.payload)) as AnalysisResult;
        const next=withDossierSources(bank,[{id:sourceId,kind,documentId:doc,payload}]);
        await tx.query("UPDATE analyses SET payload=$1 WHERE id=$2 AND owner_email=$3 AND archive_state='ACTIVE'",[JSON.stringify(next),current.id,owner]);
      }
    }
    await tx.query('COMMIT');
    return {id:sourceId,dossierId:id,duplicate:false};
  }catch(error){
    await tx.query('ROLLBACK');
    if(storageKey && !(await db.query('SELECT id FROM client_documents WHERE storage_key=$1',[storageKey])).rows.length) await storage.delete(storageKey);
    throw error;
  }finally{tx.release();}
}
