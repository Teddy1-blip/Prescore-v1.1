import {randomUUID,createHash} from 'node:crypto';
import {documentStorage} from '../storage/documents.ts';
import {validateZipBudget} from '../release/archive-limits.ts';
import type {TransactionPool} from '../db/compatibility.ts';
import type {SourceEnvelope} from '../credit-engine/contracts/sources.ts';
import type {PrivateSource} from './dossier-sources.ts';
import {wordParagraphs} from '../document-poc/word-paragraphs.ts';
import {wordReviewPages} from '../document-poc/word-review.ts';
import {reviewFields} from '../document-poc/review-fields.ts';
import {mapPdfPages,extractDocumentText} from '../credit-engine/server/document-extraction.ts';
import {parseAuthoritativeBfoText,parseAuthoritativeQuarterlyText} from '../credit-engine/source-foundation.ts';
import {adaptFinancialReport} from '../credit-engine/financial-analysis/quarterly-adapter.ts';
import {calendarSheet} from './calendar-sheet.ts';
import {parseAccount51Card} from './account51-card.ts';
import {extractXlsxRows,extractXlsxSheets} from '../credit-engine/server/document-extraction.ts';
import {nativePartyLedger} from './one-c-ledger.ts';
import {selectAccountingSheet} from './accounting-xlsx-scope.ts';
import {parseLedger} from './ledger-import.ts';
import {withDossierSources} from './dossier-bank.ts';
import type {AnalysisResult} from '../prescore.ts';
import {parseQuarterlyReportText} from '../quarterly-report.ts';
import {OCR_MAX_BYTES,ocrFormat,nativeLayoutText} from '../document-poc/local-ocr.ts';
import {isOkbReport} from '../credit-history-okb.ts';
import {bureauRoles,readBureau,bureauEnvelope,bureauReview} from './bureau-review.ts';
import {parseCreditHistoryText} from '../credit-history.ts';
import {financialTableRows} from '../document-poc/financial-layout.ts';
import {validInn} from '../external/checko-inn.ts';
import {inspectSberBusinessWorkbook} from './bank-xlsx-intake.ts';
import {inspectQuestionnaireRows} from '../document-poc/bank-questionnaire.ts';
import {dossierTier} from './dossier-view.ts';
import {ownedDossier,saveDossier} from './dossier.ts';
export const uploadKinds=['BFO','QUARTERLY','BKI','COUNTERPARTIES','DEBT_LEDGER','CREDIT_DOCUMENT','COMMERCIAL_DOCUMENT','BFO_REVIEW','AUTO_BFO','ACCOUNT_51','CALENDAR_SHEET','BANK_XLSX','BANK_QUESTIONNAIRE'] as const;
type Kind=typeof uploadKinds[number];
export class InputError extends Error {}
export class FullRequired extends Error {}
export async function importSource(db:TransactionPool,owner:string,id:string,kind:Kind,file:File,selectedInn='',relationship:typeof bureauRoles[number]='Компания-заёмщик',isAdmin=false,identityConfirmed=false) {
  const dossier=id?await ownedDossier(db,owner,id):undefined;
  if(id&&!dossier)return null;
  if(kind==='CALENDAR_SHEET'&&(!dossier||await dossierTier(db,{email:owner,isAdmin},dossier)!=='FULL'))throw new FullRequired('Для импорта графика выберите компанию с полным доступом.');
  const ext=file.name.split('.').pop()?.toLowerCase()??'';
  const ledger=kind==='COUNTERPARTIES'||kind==='DEBT_LEDGER';
  const autoFinancial=kind==='AUTO_BFO';
  let reviewKind=kind==='CREDIT_DOCUMENT'||kind==='COMMERCIAL_DOCUMENT'||kind==='BFO_REVIEW';
  const image=['jpg','jpeg','png'].includes(ext);
  const allowed=kind==='BANK_XLSX'||kind==='BANK_QUESTIONNAIRE'?['xlsx']:kind==='CALENDAR_SHEET'?['xls','xlsx','csv']:kind==='ACCOUNT_51'?['xls','xlsx']:reviewKind||kind==='BKI'?['pdf','png','jpg','jpeg']:ledger?['xls','xlsx','csv']:['pdf','xls','xlsx','csv',...(autoFinancial?['png','jpg','jpeg']:[])];
  if(kind==='CREDIT_DOCUMENT'||kind==='COMMERCIAL_DOCUMENT')allowed.push('docx');
  if(!allowed.includes(ext)||file.name.length>180||!file.size||file.size>(kind==='BKI'?35:25)*1024*1024)throw new InputError('Проверьте размер и формат файла.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const hash=createHash('sha256').update(bytes).digest('hex');
  if(image||ext==='pdf'){
    let format;
    try{format=ocrFormat(bytes);}catch{throw new InputError('Содержимое не соответствует формату файла.');}
    if(format!==(image?(ext==='png'?'PNG':'JPEG'):'PDF'))throw new InputError('Содержимое не соответствует расширению файла.');
  }
  if(ext==='xlsx')try{validateZipBudget(bytes);}catch{throw new InputError('Проверьте размер и структуру архива XLSX.');}
  if(autoFinancial&&image){kind='BFO_REVIEW';reviewKind=true;}
  let text='';
  let bureauScan=kind==='BKI'&&image;
  let bureauReport;
  if(!reviewKind&&!bureauScan&&!['ACCOUNT_51','BANK_XLSX','BANK_QUESTIONNAIRE'].includes(kind))try{
    if(kind==='BKI'){
      const pages=await mapPdfPages(bytes.slice(),180,true,async content=>content);
      bureauScan=pages.some(content=>content.replace(/\s/g,'').length<25);
      text=pages.join('\n\f\n');
      if(!bureauScan){
        if(isOkbReport(text))text=await nativeLayoutText(bytes);
        try{
          bureauReport=parseCreditHistoryText(text,file.name);
          bureauScan=!bureauReport.obligations.length||!bureauReport.subjectInn||!bureauReport.reportDate;
        }catch{bureauScan=true;}
      }
    }else if(ledger&&ext==='xlsx'){
      const selected=selectAccountingSheet(extractXlsxSheets(bytes),'OSV');
      text=selected.rows.map(r=>r.join('\t')).join('\n');
    }else text=await extractDocumentText(file.name,ext==='pdf'?bytes.slice():bytes,'financial');
  }catch(error){
    if(ledger&&ext==='xlsx'&&error instanceof Error&&error.message.startsWith('ACCOUNTING_XLSX_'))
      throw new InputError('В книге XLSX должен быть ровно один лист ОСВ с однозначным счётом. Выберите отдельную ведомость.');
    if(autoFinancial&&ext==='pdf'){kind='BFO_REVIEW';reviewKind=true;}
    else throw new InputError('Не удалось прочитать документ. Для БКИ нужен отчёт НБКИ, ОКБ или СБ БКИ до 180 страниц.');
  }
  let financialReport;
  let detectedInn;
  if(kind==='AUTO_BFO'){
    try{
      const detected=parseQuarterlyReportText(text,file.name);
      detectedInn=detected.companyInn??undefined;
      if(detectedInn&&(dossier?.inn||selectedInn)&&detectedInn!==(dossier?.inn||selectedInn))
        throw new InputError('ИНН отчётности не совпадает с досье.');
      const period=detected.financialMetadataV2?.period.kind;
      const parser=period==='ANNUAL'?parseAuthoritativeBfoText:period==='INTERIM'?parseAuthoritativeQuarterlyText:null;
      if(!parser||!detectedInn)throw Error('UNCONFIRMED_PERIOD_OR_IDENTITY');
      financialReport=parser({text,fileName:file.name,analysisInn:detectedInn});
      kind=period==='ANNUAL'?'BFO':'QUARTERLY';
    }catch(error){
      if(error instanceof InputError)throw error;
      if(ext==='pdf'){kind='BFO_REVIEW';reviewKind=true;}
      else throw new InputError('Не удалось определить ИНН, период или строки отчётности. Проверьте исходную таблицу.');
    }
  }
  if(selectedInn&&!validInn(selectedInn))throw new InputError('Проверьте ИНН компании.');
  let inn:string|undefined=dossier?.inn||selectedInn||detectedInn;
  if(!inn&&bureauReport?.subjectType==='Физическое лицо'&&relationship!=='ИП-заёмщик')throw new InputError('Выберите досье компании для отчёта физического лица.');
  if(!inn){
    if(kind==='BFO'||kind==='QUARTERLY')inn=parseQuarterlyReportText(text,file.name).companyInn??undefined;
    else if(kind==='BKI')inn=bureauReport?.subjectInn;
    else if(ledger){
      const [head,...rows]=text.trim().replace(/^\uFEFF/,'').split(/\r?\n/);
      const col=head.split('\t').map(s=>s.trim()).indexOf('ИНН организации');
      const identities=new Set(rows.filter(r=>r.trim()).map(r=>r.split('\t')[col]?.trim()));
      if(identities.size===1)inn=[...identities][0];
    }
    if(!inn||!validInn(inn))throw new InputError('Для этого документа выберите досье по ИНН или загрузите файл с идентифицируемой организацией.');
  }
  if(kind==='QUARTERLY'&&await dossierTier(db,{email:owner,isAdmin},{inn})!=='FULL')throw new FullRequired('Для промежуточной отчётности нужен полный доступ.');
  if((reviewKind||bureauScan)&&ext!=='docx'&&file.size>OCR_MAX_BYTES)throw new InputError('Для распознавания нужен файл размером до 16 МБ.');
  const sourceId=kind.toLowerCase()+':'+hash, now=new Date().toISOString();
  const envelope:SourceEnvelope={sourceId,sourceType:ledger||reviewKind||['ACCOUNT_51','CALENDAR_SHEET','BANK_XLSX','BANK_QUESTIONNAIRE'].includes(kind)?'OTHER':kind as 'BFO'|'QUARTERLY'|'BKI',fileName:file.name,
    status:'READY',companyInn:inn,warnings:[],confidence:null,receivedAt:now,contentHash:hash,rawReference:'sha256:'+hash};
  const payload:PrivateSource={envelope};
  try{
    if(bureauScan){
      payload.relationship=relationship;
      payload.review={version:'PRESCORE-BKI-PARSER-2',status:'INCOMPLETE',fields:[],issues:[]};
      envelope.status='PROCESSING';
    }else if(reviewKind){
      const family=kind==='CREDIT_DOCUMENT'?'CREDIT':kind==='BFO_REVIEW'?'BFO':'COMMERCIAL';
      if(ext==='docx'){
        const paragraphs=wordParagraphs(bytes);
        // Route the document as one text, then bind each extracted fragment to its paragraph.
        const pages=wordReviewPages(paragraphs);
        const review=reviewFields(sourceId,pages,pages.length,family,'SINGLE',[]);
        for(const field of review.fields){
          const matches=field.fragment?paragraphs.filter(p=>p.text.includes(field.fragment!)):[];
          field.page=matches.length===1?matches[0].page:null;
        }
        review.anchor='paragraph';
        payload.review=review;
      }else if(image){
        payload.review=reviewFields(sourceId,[],1,family,'SINGLE');
      }else{
        const pages=await mapPdfPages(bytes.slice(),64,true,async(text,p,items)=>({tables:family==='BFO'?financialTableRows(items,p.pageNumber):[],page:p.pageNumber,logicalPage:p.pageNumber,method:text.trim()?'TEXT' as const:'UNREADABLE' as const,text}));
        payload.review=reviewFields(sourceId,pages,pages.length,family,'SINGLE',[],pages.flatMap(p=>p.tables));
        if(family==='BFO'&&!payload.review.fields.some(f=>/^\d{4}$/.test(f.key)&&f.value!==null))
          payload.review.status='INCOMPLETE';
      }
      envelope.status='PROCESSING';
    }else{
    if(kind==='BANK_XLSX'){
      const review=inspectSberBusinessWorkbook(extractXlsxSheets(bytes));
      if(review.format!=='SBER_BUSINESS_XLSX_WORKBOOK'||review.totalOperations<1)
        throw new InputError('Формат банковской XLSX не распознан или не содержит операций. Пока поддерживается предварительный разбор СберБизнес.');
      payload.bankXlsxReview={version:review.version,totalOperations:review.totalOperations,accounts:review.accountCount,warnings:review.warnings,
        sheets:review.sheets.filter(s=>s.preview.format!=='UNSUPPORTED').map(s=>({
          name:s.name,account:s.preview.account,periodFrom:s.preview.periodFrom,periodTo:s.preview.periodTo,
          operations:s.preview.operations.length,inMinor:s.preview.totalInMinor,outMinor:s.preview.totalOutMinor}))};
      Object.assign(envelope,{parserVersion:review.version,status:'PROCESSING',warnings:review.warnings});
    }else if(kind==='BANK_QUESTIONNAIRE'){
      if(!identityConfirmed)throw new InputError('Подтвердите право передать и обработать банковскую анкету.');
      const recognized=extractXlsxSheets(bytes).map(s=>({name:s.sheet,review:inspectQuestionnaireRows(s.rows)}))
        .filter(s=>s.review.kind==='BANK_QUESTIONNAIRE');
      if(!recognized.length)throw new InputError('Не удалось распознать структуру банковской анкеты XLSX.');
      const declared=new Set(recognized.flatMap(s=>s.review.fields.filter(f=>f.key==='COMPANY_INN').map(f=>f.raw.replace(/\s/g,''))));
      if(declared.size&&(declared.size!==1||!declared.has(inn)))
        throw new InputError('ИНН анкеты не совпадает с выбранным досье. Уточните источник.');
      payload.questionnaireReview={version:'PRESCORE-QUESTIONNAIRE-CELLS-0.1',
        sheets:recognized.map(s=>({name:s.name,fields:s.review.fields,issues:s.review.issues}))};
      Object.assign(envelope,{parserVersion:'PRESCORE-QUESTIONNAIRE-CELLS-0.1',status:'PROCESSING',
        warnings:recognized.flatMap(s=>s.review.issues)});
    }else if(kind==='CALENDAR_SHEET'){payload.calendarSheet=calendarSheet(text);envelope.status='PROCESSING';}
    else if(kind==='ACCOUNT_51'){
      const rows=ext==='xlsx'?selectAccountingSheet(extractXlsxSheets(bytes),'ACCOUNT_51').rows:(await extractDocumentText(file.name,bytes,'financial')).trimEnd().split(/\r?\n/).map(r=>r.split('\t'));
      const header=rows.findIndex(row=>String(row[0]??'').trim()==='Период');
      const identities=new Set(Array.from(rows.slice(0,header>=0?header:12).flat().join(' ').matchAll(/ИНН\s*[:№]?\s*(\d{10,12})\b/gi),m=>m[1]));
      if(identities.size && (identities.size!==1 || !identities.has(inn)))throw new InputError('ИНН карточки счёта 51 не совпадает с досье.');
      const card=parseAccount51Card(rows);
      const sum=(direction:'INFLOW'|'OUTFLOW')=>card.operations.filter(row=>row.direction===direction).reduce((total,row)=>total+Math.round(row.amount*100),0)/100;
      Object.assign(envelope,{periodFrom:card.periodFrom,periodTo:card.periodTo,parserVersion:'1C-ACCOUNT-51-V1',warnings:card.warnings});
      payload.account51={from:card.periodFrom,to:card.periodTo,opening:card.openingBalance,closing:card.closingBalance,inflow:sum('INFLOW'),outflow:sum('OUTFLOW'),entries:card.operations.length,requiresReview:!card.reconciled||card.closingBalance===null||card.openingBalance===null};
    }else if(ledger){
      const rows=text.split(/\r?\n/).map(r=>r.split('\t'));
      payload.ledger=nativePartyLedger(rows,inn,identityConfirmed,kind as 'COUNTERPARTIES'|'DEBT_LEDGER',file.name)??parseLedger(text,inn,kind as 'COUNTERPARTIES'|'DEBT_LEDGER');
    }
    else if(kind==='BKI'){
      const bki=readBureau(text,file.name,inn,relationship);
      payload.relationship=relationship;
      Object.assign(envelope,bureauEnvelope(payload,bki));
      payload.bki=bki;
    }else{
      const report=financialReport??(kind==='BFO'?parseAuthoritativeBfoText:parseAuthoritativeQuarterlyText)({text,fileName:file.name,analysisInn:inn});
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
    const prior=await tx.query(`SELECT source_id,source_type,payload FROM dossier_sources WHERE dossier_id=$1
      AND (source_id=$2 OR payload->'envelope'->>'contentHash'=$3) ORDER BY received_at,source_id LIMIT 1`,[id,sourceId,hash]);
    if(prior.rows.length){
      const existing=prior.rows[0] as {source_id:string;source_type:string;payload:PrivateSource};
      if(existing.source_type!==kind&&!([kind,existing.source_type].every(k=>['BFO','QUARTERLY','BFO_REVIEW'].includes(k))))
        throw new InputError('Этот оригинал уже сохранён в другом разделе досье.');
      // A mistaken relationship on an unconfirmed scan can be corrected without
      // importing a second report or changing any previously confirmed obligations.
      if(kind==='BKI'&&!existing.payload.bki&&existing.payload.relationship!==relationship){
        const payload={...existing.payload,relationship};
        if(payload.ocr&&payload.ocr.through===payload.ocr.total)payload.review=bureauReview(payload.ocr.pages,payload,payload.ocr.warnings);
        await tx.query('UPDATE dossier_sources SET payload=$1 WHERE dossier_id=$2 AND source_id=$3',[JSON.stringify(payload),id,existing.source_id]);
      }
      await tx.query('COMMIT');
      return {id:String(existing.source_id),dossierId:id,duplicate:true,pending:existing.payload.ocr?existing.payload.ocr.through<existing.payload.ocr.total:existing.payload.review?.status==='INCOMPLETE',layout:existing.payload.ocr?.layout};
    }
    const doc=randomUUID();
    const mime=image?(ext==='png'?'image/png':'image/jpeg'):ext==='xls'?'application/vnd.ms-excel':ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':ext==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':ext==='pdf'?'application/pdf':'text/csv';
    storageKey=(await storage.put(bytes,mime)).key;
    await tx.query(`INSERT INTO client_documents(id,company_inn,category,file_name,mime_type,size_bytes,content_base64,uploaded_by,owner_email,storage_key)
      VALUES($1,$2,$3,$4,$5,$6,'',$7,$7,$8)`,[doc,inn,kind,file.name,mime,bytes.length,owner,storageKey]);
    await tx.query('INSERT INTO dossier_sources(dossier_id,source_id,source_type,payload,document_id) VALUES($1,$2,$3,$4,$5)',[id,sourceId,kind,JSON.stringify(payload),doc]);
    // Update only the owner's latest working version. Previously issued report snapshots stay immutable.
    if(payload.snapshot || payload.bki?.affectsCompanyDebt || kind==='DEBT_LEDGER'||kind==='COUNTERPARTIES'&&payload.ledger?.some(r=>r.account.startsWith('76')&&r.contract&&r.component?.toLocaleLowerCase('ru')==='основной долг')){
      const current=(await tx.query("SELECT id,payload FROM analyses WHERE owner_email=$1 AND company_inn=$2 AND archive_state='ACTIVE' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE",[owner,inn])).rows[0];
      if(current){
        const bank=JSON.parse(String(current.payload)) as AnalysisResult;
        const next=withDossierSources(bank,[{id:sourceId,kind,documentId:doc,payload}]);
        await tx.query("UPDATE analyses SET payload=$1 WHERE id=$2 AND owner_email=$3 AND archive_state='ACTIVE'",[JSON.stringify(next),current.id,owner]);
      }
    }
    await tx.query('COMMIT');
    return {id:sourceId,dossierId:id,duplicate:false,pending:bureauScan||reviewKind&&ext!=='docx'&&(image||payload.review?.status==='INCOMPLETE')};
  }catch(error){
    await tx.query('ROLLBACK');
    if(storageKey && !(await db.query('SELECT id FROM client_documents WHERE storage_key=$1',[storageKey])).rows.length) await storage.delete(storageKey);
    throw error;
  }finally{tx.release();}
}
