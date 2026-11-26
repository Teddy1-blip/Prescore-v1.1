import {randomUUID,createHash} from 'node:crypto';
import {documentStorage} from '../storage/documents.ts';
import {validateZipBudget} from '../release/archive-limits.ts';
import type {TransactionPool} from '../db/compatibility.ts';
import type {SourceEnvelope} from '../credit-engine/contracts/sources.ts';
import {dossierSources,type PrivateSource} from './dossier-sources.ts';
import {wordParagraphs} from '../document-poc/word-paragraphs.ts';
import {wordReviewPages} from '../document-poc/word-review.ts';
import {reviewFields} from '../document-poc/review-fields.ts';
import {mapPdfPages,extractDocumentText} from '../credit-engine/server/document-extraction.ts';
import {parseAuthoritativeBfoText,parseAuthoritativeQuarterlyText} from '../credit-engine/source-foundation.ts';
import {adaptFinancialReport} from '../credit-engine/financial-analysis/quarterly-adapter.ts';
import {calendarSheet} from './calendar-sheet.ts';
import {parseAccount51Card} from './account51-card.ts';
import {extractXlsxRows,extractXlsxSheets,extractLegacyXlsSheets} from '../credit-engine/server/document-extraction.ts';
import {nativePartyLedger} from './one-c-ledger.ts';
import {selectAccountingSheet} from './accounting-xlsx-scope.ts';
import {parseLedger} from './ledger-import.ts';
import {withDossierSources} from './dossier-bank.ts';
import type {AnalysisResult} from '../prescore.ts';
import {parseQuarterlyReportText} from '../quarterly-report.ts';
import {OCR_MAX_BYTES,BUREAU_MAX_PDF_PAGES,ocrFormat,nativeLayoutText} from '../document-poc/local-ocr.ts';
import {isOkbReport} from '../credit-history-okb.ts';
import {bureauRoles,readBureau,bureauEnvelope,bureauReview,modernNbkiSummaryReview} from './bureau-review.ts';
import {parseCreditHistoryText} from '../credit-history.ts';
import {financialTableRows} from '../document-poc/financial-layout.ts';
import {validInn} from '../external/checko-inn.ts';
import {inspectSberBusinessWorkbook} from './bank-xlsx-intake.ts';
import {compactBankXlsxSheets} from './bank-sources-adapter.ts';
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
  // Keep selected worksheet's source row map alongside its cell matrix.
  // Re-splitting a TSV transcript loses XLSX physical row identity and can
  // corrupt cell boundaries if 1C descriptions contain embedded newlines.
  let accountingSheet:ReturnType<typeof selectAccountingSheet>|null=null;
  let bureauScan=kind==='BKI'&&image;
  let bureauReport;
  let nativeNbkiPages:import('../document-poc/local-ocr.ts').OcrPage[]|null=null;
  if(!reviewKind&&!bureauScan&&!['ACCOUNT_51','BANK_XLSX','BANK_QUESTIONNAIRE'].includes(kind))try{
    if(kind==='BKI'){
      const pages=await mapPdfPages(bytes.slice(),BUREAU_MAX_PDF_PAGES,true,async content=>content);
      // Keep native text available for a read-only NBKI summary at upload time.
      // This does not mark any contractual debt as confirmed.
      if(/^\s*Субъект кредитной истории\s*$/im.test(pages[0]??'')&&/Кредитный отчет для субъекта/iu.test(pages[0]??''))
        nativeNbkiPages=pages.map((text,index)=>({text,page:index+1,logicalPage:index+1,segment:'FULL',method:'TEXT'}));
      bureauScan=pages.some(content=>content.replace(/\s/g,'').length<25);
      text=pages.join('\n\f\n');
      if(!bureauScan){
        if(isOkbReport(text))text=await nativeLayoutText(bytes);
        try{
          bureauReport=parseCreditHistoryText(text,file.name);
          bureauScan=!bureauReport.obligations.length||!bureauReport.subjectInn||!bureauReport.reportDate;
        }catch{bureauScan=true;}
      }
    }else if(ledger&&(ext==='xlsx'||ext==='xls')){
      accountingSheet=selectAccountingSheet(ext==='xlsx'?extractXlsxSheets(bytes):await extractLegacyXlsSheets(bytes),'OSV');
      text=accountingSheet.rows.map(r=>r.join('\t')).join('\n');
    }else text=await extractDocumentText(file.name,ext==='pdf'?bytes.slice():bytes,'financial');
  }catch(error){
    if(ledger&&(ext==='xlsx'||ext==='xls')&&error instanceof Error&&error.message.startsWith('ACCOUNTING_XLSX_'))
      throw new InputError('В книге Excel должен быть ровно один лист ОСВ с однозначным счётом. Выберите отдельную ведомость.');
    if(autoFinancial&&ext==='pdf'){kind='BFO_REVIEW';reviewKind=true;}
    else throw new InputError('Не удалось прочитать документ. Для БКИ нужен отчёт НБКИ, ОКБ или СБ БКИ до 256 страниц.',{cause:error});
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
      else throw new InputError('Не удалось определить ИНН, период или строки отчётности. Проверьте исходную таблицу.',{cause:error});
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
      payload.review=(nativeNbkiPages&&modernNbkiSummaryReview(nativeNbkiPages,payload))
        ||{version:'PRESCORE-BKI-PARSER-2',status:'INCOMPLETE',fields:[],issues:[]};
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
      const sheets=compactBankXlsxSheets(review);
      const fromDates=sheets.map(s=>s.periodFrom).filter((d):d is string=>Boolean(d)).sort();
      const toDates=sheets.map(s=>s.periodTo).filter((d):d is string=>Boolean(d)).sort();
      payload.bankXlsxReview={version:review.version,totalOperations:review.totalOperations,accounts:review.accountCount,warnings:review.warnings,sheets};
      Object.assign(envelope,{parserVersion:review.version,status:'READY',warnings:review.warnings,...(fromDates[0]?{periodFrom:fromDates[0]}:{}),...(toDates.at(-1)?{periodTo:toDates.at(-1)}:{}),});
    }else if(kind==='BANK_QUESTIONNAIRE'){
      if(!identityConfirmed)throw new InputError('Подтвердите право передать и обработать банковскую анкету.');
      const recognized=extractXlsxSheets(bytes).map(s=>({name:s.sheet,review:inspectQuestionnaireRows(s.rows,s.rowNumbers)}))
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
      const accountSheet=ext==='xlsx'?selectAccountingSheet(extractXlsxSheets(bytes),'ACCOUNT_51'):
        ext==='xls'?selectAccountingSheet(await extractLegacyXlsSheets(bytes),'ACCOUNT_51'):null;
      const rows=accountSheet?.rows??(await extractDocumentText(file.name,bytes,'financial')).trimEnd().split(/\r?\n/).map(r=>r.split('\t'));
      const header=rows.findIndex(row=>String(row[0]??'').trim()==='Период');
      const identities=new Set(Array.from(rows.slice(0,header>=0?header:12).flat().join(' ').matchAll(/ИНН\s*[:№]?\s*(\d{10,12})\b/gi),m=>m[1]));
      if(identities.size && (identities.size!==1 || !identities.has(inn)))throw new InputError('ИНН карточки счёта 51 не совпадает с досье.');
      const card=parseAccount51Card(rows,accountSheet?.rowNumbers);
      const sum=(direction:'INFLOW'|'OUTFLOW')=>card.operations.filter(row=>row.direction===direction).reduce((total,row)=>total+Math.round(row.amount*100),0)/100;
      Object.assign(envelope,{periodFrom:card.periodFrom,periodTo:card.periodTo,parserVersion:'1C-ACCOUNT-51-V1',warnings:card.warnings});
      payload.account51={from:card.periodFrom,to:card.periodTo,opening:card.openingBalance,closing:card.closingBalance,inflow:sum('INFLOW'),outflow:sum('OUTFLOW'),entries:card.operations.length,requiresReview:!card.reconciled||card.closingBalance===null||card.openingBalance===null};
      payload.account51Operations=card.operations;
    }else if(ledger){
      const rows=accountingSheet?.rows??text.split(/\r?\n/).map(r=>r.split('\t'));
      payload.ledger=nativePartyLedger(rows,inn,identityConfirmed,kind as 'COUNTERPARTIES'|'DEBT_LEDGER',file.name,accountingSheet?.rowNumbers)??parseLedger(text,inn,kind as 'COUNTERPARTIES'|'DEBT_LEDGER');
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
    throw new InputError('Не удалось подтвердить формат, ИНН или период документа. Проверьте выбранный файл.',{cause:error});
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
        else if(payload.review?.version==='PRESCORE-NBKI-STRUCTURE-0.1')
          payload.review=(nativeNbkiPages&&modernNbkiSummaryReview(nativeNbkiPages,payload))
            ||{version:'PRESCORE-BKI-PARSER-2',status:'INCOMPLETE',fields:[],issues:[]};
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
    const affectsAnalysis=Boolean(payload.snapshot || payload.bki?.affectsCompanyDebt || kind==='BANK_XLSX' || kind==='ACCOUNT_51' || kind==='DEBT_LEDGER'||kind==='COUNTERPARTIES'&&payload.ledger?.some(r=>r.account.startsWith('76')&&r.contract&&r.component?.toLocaleLowerCase('ru')==='основной долг'));
    const current=(await tx.query("SELECT id,payload FROM analyses WHERE owner_email=$1 AND company_inn=$2 AND archive_state='ACTIVE' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE",[owner,inn])).rows[0];
    if(current){
      if(affectsAnalysis){
        const bank=JSON.parse(String(current.payload)) as AnalysisResult;
        const next=withDossierSources(bank,[{id:sourceId,kind,documentId:doc,payload}]);
        await tx.query("UPDATE analyses SET payload=$1,period_from=$2,period_to=$3,score=$4,grade=$5,readiness=$6 WHERE id=$7 AND owner_email=$8 AND archive_state='ACTIVE'",[JSON.stringify(next),next.periodFrom,next.periodTo,next.score,next.grade,next.readiness,current.id,owner]);
      } else if(envelope.sourceType==='OTHER'){
        const bank=JSON.parse(String(current.payload)) as AnalysisResult;
        if(!bank.metricsV2){
          const existingExt=bank.sourceManifest?.external??[];
          if(!existingExt.some(s=>s.sourceId===envelope.sourceId)){
            const next:AnalysisResult={...bank,sourceManifest:{...(bank.sourceManifest??{}),bankStatements:bank.sourceManifest?.bankStatements??[],external:[...existingExt,envelope]}};
            await tx.query("UPDATE analyses SET payload=$1 WHERE id=$2 AND owner_email=$3 AND archive_state='ACTIVE'",[JSON.stringify(next),current.id,owner]);
          }
        }
      }
    } else {
      const allRows=await dossierSources(tx,owner,id);
      let companyName=allRows.flatMap(r=>r.payload.publicProfile?.company?.name?[r.payload.publicProfile.company.name]:[]).at(-1)??'';
      if(!companyName){
        try{
          const cached=(await tx.query('SELECT payload FROM checko_profiles WHERE inn=$1 LIMIT 1',[inn])).rows[0] as {payload?:string}|undefined;
          const parsed=cached?.payload?JSON.parse(cached.payload) as {company?:{name?:string}}:null;
          if(typeof parsed?.company?.name==='string'&&parsed.company.name.trim())companyName=parsed.company.name.trim();
        }catch{ /* fallback below */ }
      }
      if(!companyName)companyName=`Компания ИНН ${inn}`;
      const today=now.slice(0,10);
      const iso=(v?:string|null)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.slice(0,10))?v.slice(0,10):null;
      const toDate=iso(envelope.periodTo)??iso(payload.snapshot?.period.to)??iso(payload.snapshot?.period.asOf)??iso(payload.account51?.to)??iso(payload.bki?.reportDate)??today;
      const rawFrom=iso(envelope.periodFrom)??iso(payload.snapshot?.period.from)??iso(payload.account51?.from)??toDate;
      const fromDate=rawFrom<=toDate?rawFrom:toDate;
      const anchor:AnalysisResult={
        id:`dossier-${randomUUID()}`,
        companyName,
        companyInn:inn,
        fileName:file.name,
        sourceFiles:[file.name],
        bankNames:[],
        periodFrom:fromDate,
        periodTo:toDate,
        score:0,
        grade:'—',
        readiness:'Недостаточно данных',
        createdAt:now,
        metrics:{
          months:0,statements:0,accounts:0,transactions:0,grossInflow:0,operatingInflow:0,nonOperatingInflow:0,unknownInflow:0,
          inflow:0,outflow:0,avgMonthlyInflow:0,monthlyTrend:0,volatility:0,topOneConcentration:0,topThreeConcentration:0,
          topFiveConcentration:0,largeIncomingShare:0,taxRegularity:0,riskyOutflowShare:0,debtServiceShare:0,
          endingBalance:null,liquidityDays:null,averageDailyBalance:null,minimumDailyBalance:null,cashGapDays:null,negativeBalanceDays:null,
          seasonality:0,supplierPaymentRegularity:0,dataQuality:0,estimatedLimitMin:0,estimatedLimitMax:0,stressLimitMax:0,
          currentMonthlyDebtPayment:0,baseMonthlyPaymentCapacity:0,stressMonthlyPaymentCapacity:0,stressMonthlyInflow:0,
          referenceTermMonths:0,referenceAnnualRate:0,limitConfidence:0,
        },
        monthly:[],topCounterparties:[],factors:[],topRisks:[],strengths:[],evidence:[],recommendations:[],productFits:[],transactions:[],warnings:[],
        sourceManifest:{bankStatements:[],...(envelope.sourceType==='OTHER'?{external:[envelope]}:{})},
      };
      const next=withDossierSources(anchor,allRows);
      await tx.query(`INSERT INTO analyses (id, company_name, company_inn, file_name, period_from, period_to, score, grade, readiness, payload, owner_email, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [next.id,next.companyName,next.companyInn,next.fileName,next.periodFrom,next.periodTo,next.score,next.grade,next.readiness,JSON.stringify(next),owner,next.createdAt]);
    }
    await tx.query('COMMIT');
    return {id:sourceId,dossierId:id,duplicate:false,pending:bureauScan||reviewKind&&ext!=='docx'&&(image||payload.review?.status==='INCOMPLETE')};
  }catch(error){
    await tx.query('ROLLBACK');
    if(storageKey && !(await db.query('SELECT id FROM client_documents WHERE storage_key=$1',[storageKey])).rows.length) await storage.delete(storageKey);
    throw error;
  }finally{tx.release();}
}
