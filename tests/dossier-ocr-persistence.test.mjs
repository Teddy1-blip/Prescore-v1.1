import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {zipSync,strToU8} from 'fflate';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {syntheticPdf} from '../scripts/release/pdf-fixture.mjs';

const inn='5042149315';
const syntheticPages=[
 'Кредитный отчет\nот 16 июня 2026 года\nСубъект: юридическое лицо\nИНН организации: '+inn,
 'Сформирован 16 июня 2026    Действующие кредитные договоры\n'+
 '№   Источник данных/вид обязательств    Общая задолженность\n'+
 '1   Учебный банк   200 000 руб.   120 000 руб.   0 руб.\nДоговор займа (кредита)\n'+
 '1. Учебный банк - Договор займа (кредита)\n'+
 'Вид участия в сделке   Идентификатор сделки   Номер сделки\n'+
 'Заёмщик   12345678-1234-1234-1234-123456789abc   К-1',
 'Отчет предоставлен АО «ОКБ»',
 'Конец кредитного отчета',
].map((text,i)=>({page:i+1,logicalPage:i+1,segment:'FULL',method:'OCR',text}));

function questionnaireXlsx(){
 const xml=String.raw`<?xml version="1.0"?><worksheet><sheetData>
 <row r="1"><c r="A1" t="inlineStr"><is><t>Анкета-Заявка Клиента</t></is></c></row>
 <row r="5"><c r="A5" t="inlineStr"><is><t>1.4. ИНН</t></is></c>
 <c r="C5" t="inlineStr"><is><t>5042149315</t></is></c></row>
 <row r="23"><c r="A23" t="inlineStr"><is><t>1.12. Сумма кредитного продукта</t></is></c>
 <c r="C23" t="inlineStr"><is><t>1500000</t></is></c></row>
 </sheetData></worksheet>`;
 return zipSync({
  '[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'xl/worksheets/sheet1.xml':strToU8(xml),
  'xl/workbook.xml':strToU8('<workbook><sheets><sheet name="Анкета" sheetId="1"/></sheets></workbook>'),
 });
}

test('one owner dossier: scanned BKI resume, explicit confirmation, credit review, XLSX cell source and reopen',async()=>{
 const old=process.env.PRESCORE_STORAGE_ROOT;
 const root=await mkdtemp(join(tmpdir(),'prescore-intake-qa-'));
 process.env.PRESCORE_STORAGE_ROOT=root;
 let rt;
 try{
  rt=await createWorkspaceRuntime();
  const owner={email:'qa-reopen-owner@workspace.test',roles:['CLIENT','ADMIN']};
  const other={email:'qa-reopen-other@workspace.test',roles:['CLIENT']};
  const post=(body,user=owner)=>rt.request('/api/dossier',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},user);
  const read=async(user=owner)=>{
   const response=await rt.request('/api/dossier?id='+id,{},user);
   if(user===owner)assert.equal(response.status,200,await response.clone().text());
   return response;
  };
  const upload=async(kind,file,user=owner,confirmed=false)=>{
   const data=new FormData();data.set('id',id);data.set('kind',kind);data.set('file',file);
   if(confirmed)data.set('identityConfirmed','yes');
   return rt.request('/api/dossier',{method:'POST',body:data},user);
  };
  const create=await post({action:'save',inn});
  assert.equal(create.status,200,await create.clone().text());
  const id=(await create.json()).company.id;

  // A textless PDF is saved as a source awaiting OCR; the test injects synthetic
  // page results at the OCR boundary. No real customer files or OCR binaries.
  const bki=new File([syntheticPdf([' '])],'synthetic-bki.pdf',{type:'application/pdf'});
  const submitted=await upload('BKI',bki);
  assert.equal(submitted.status,201,await submitted.clone().text());
  const bkiSource=(await submitted.json()).id;
  assert.equal((await read(other)).status,404);
  assert.equal((await post({action:'confirm-bureau',id,sourceId:bkiSource})).status,409);
  assert.equal((await (await read()).json()).obligations.length,0);

  const local=rt.load('lib/document-poc/local-ocr.ts');
  const original=local.recognizeLocalDocument;
  const pagesSeen=[];
  local.recognizeLocalDocument=async(_bytes,options)=>{
   assert.equal(options.bureau,true);
   assert.equal(options.quality,'HIGH');
   pagesSeen.push(options.fromPage);
   const from=options.fromPage,until=from===1?3:4;
   return {version:'PRESCORE-LOCAL-OCR-0.3',documentId:'synthetic',
    pageCount:4,processedFrom:from,processedTo:until,layout:'SINGLE',
    quality:'HIGH',pages:syntheticPages.slice(from-1,until),warnings:[],
    outboundTransfer:false,creditEngineUpdated:false};
  };
  try{
   const request={action:'recognize',id,sourceId:bkiSource,layout:'SINGLE'};
   assert.equal((await post(request,other)).status,404);
   const first=await post(request);
   assert.equal(first.status,200,await first.clone().text());
   assert.deepEqual([...(await first.json()).through?[3]:[]],[3]);
   const halfway=(await read()).json();
   const draft=await halfway;
   assert.equal(draft.reviews.find(r=>r.id===bkiSource)?.ocr?.through,3);
   assert.equal(draft.obligations.length,0);
   assert.equal((await post({action:'confirm-bureau',id,sourceId:bkiSource})).status,409);
   const second=await post(request);
   assert.equal(second.status,200,await second.clone().text());
   assert.equal((await second.json()).through,4);
   assert.deepEqual(pagesSeen,[1,4]);
   const verifiedOCR=await(await read()).json();
   assert.equal(verifiedOCR.reviews.find(r=>r.id===bkiSource)?.status,'BUREAU_CONFIRM');
   assert.equal(verifiedOCR.obligations.length,0,'OCR alone must not create debt');
   assert.equal((await post({action:'confirm-bureau',id,sourceId:bkiSource},other)).status,404);
   const confirmation=await post({action:'confirm-bureau',id,sourceId:bkiSource});
   assert.equal(confirmation.status,200,await confirmation.clone().text());
   const reopened=await(await read()).json();
   assert.equal(reopened.reviews.find(r=>r.id===bkiSource)?.status,'BUREAU_CONFIRMED');
   assert.equal(reopened.bureauReports[0].obligations[0].total,120000);
   assert.equal(reopened.bureauReports[0].companyDebt,true);
   assert.equal((await post(request)).status,409,'confirmed OCR cannot be overwritten');
  }finally{
   local.recognizeLocalDocument=original;
  }
  assert.equal((await upload('BKI',bki)).status,200,'original deduplicates after reopen');
  const saved=(await(await read()).json()).sources.find(s=>s.id===bkiSource);
  const originalFile=await rt.request('/api/documents?download='+saved.documentId,{},owner);
  assert.equal(originalFile.status,200);
  assert.equal(Buffer.compare(Buffer.from(await originalFile.arrayBuffer()),Buffer.from(await bki.arrayBuffer())),0);
  assert.equal((await rt.request('/api/documents?download='+saved.documentId,{},other)).status,404);

  const agreement=new File([syntheticPdf([
   'Кредитный договор','Кредитор: Учебный банк','Заёмщик: Компания Тест',
   'ИНН заёмщика: '+inn,'Номер договора: К-1',
   'Дата договора: 2025-01-01','Валюта: RUB','Кредитный лимит: 100000',
   'Вид кредита: кредитная линия',
  ])],'synthetic-agreement.pdf',{type:'application/pdf'});
  const agreementResponse=await upload('CREDIT_DOCUMENT',agreement);
  assert.equal(agreementResponse.status,201,await agreementResponse.clone().text());
  const agreementSource=(await agreementResponse.json()).id;
  let contract=(await(await read()).json()).reviews.find(r=>r.id===agreementSource);
  assert.equal(contract.status,'READY_FOR_REVIEW');
  for(const key of ['borrower','borrower_inn','creditor','agreement_number','agreement_date','currency','credit_limit','product_type']){
   const f=contract.fields.find(f=>f.key===key);
   assert.ok(f?.value&&f.page===1&&f.fragment,key);
   const confirmed=await post({action:'verify-field',id,sourceId:agreementSource,field:key,value:f.value});
   assert.equal(confirmed.status,200,key+': '+await confirmed.clone().text());
  }
  contract=(await(await read()).json()).reviews.find(r=>r.id===agreementSource);
  assert.equal(contract.verified.credit_limit.value,'100000');
  assert.equal(contract.verified.credit_limit.page,1);
  assert.equal((await upload('CREDIT_DOCUMENT',agreement)).status,200);
  assert.equal((await post({action:'verify-field',id,sourceId:agreementSource,field:'credit_limit',value:'100000'},other)).status,404);

  const questionnaire=new File([questionnaireXlsx()],'synthetic-questionnaire.xlsx',{
   type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const qUpload=await upload('BANK_QUESTIONNAIRE',questionnaire,owner,true);
  assert.equal(qUpload.status,201,await qUpload.clone().text());
  const reopened=await(await read()).json();
  const questions=reopened.questionnaireReviews[0];
  assert.equal(questions.sheets[0].fields.find(f=>f.key==='COMPANY_INN')?.row,5);
  assert.equal(questions.sheets[0].fields.find(f=>f.key==='REQUESTED_AMOUNT')?.row,23);
  assert.equal(reopened.questionnaireReviews.length,1);
  assert.equal((await upload('BANK_QUESTIONNAIRE',questionnaire,owner,true)).status,200);
  assert.equal((await read(other)).status,404);
 }finally{
  if(rt)await rt.close();
  if(old===undefined)delete process.env.PRESCORE_STORAGE_ROOT;else process.env.PRESCORE_STORAGE_ROOT=old;
  await rm(root,{recursive:true,force:true});
 }
});
