import assert from 'node:assert/strict';
import test from 'node:test';
import {analysisForStorage,analyzeBankStatements} from '../lib/prescore.ts';
import {buildDossierAnchorAnalysis,withDossierSources} from '../lib/workspace/dossier-bank.ts';
import {BANK_XLSX_ADAPTER_WARNING,compactBankXlsxSheets} from '../lib/workspace/bank-sources-adapter.ts';
import {inspectSberBusinessWorkbook} from '../lib/workspace/bank-xlsx-intake.ts';
import {statementFixture} from './fixtures/block1-statements.mjs';

const inn='5032333146';
function source(name='May',verifiedForAnalysis=true){
 const row=length=>Array(length).fill('');
 const pre=row(22);pre[2]='ПАО СБЕРБАНК';pre[5]='СберБизнес';
 const owner=row(22);owner[12]='40702810205500005040';owner[3]='Российский рубль';
 const header=row(22);header[2]='Дата проводки';header[10]='Сумма по дебету';header[14]='Сумма по кредиту';header[15]='№ документа';header[21]='Назначение платежа';
 const sub=row(22),inflow=row(22),outflow=row(22);
 const month=name==='June'?'06':'05';
 inflow[2]=`2025-${month}-01 09:00:00`;inflow[14]='1234.50';inflow[15]='001';inflow[21]='Оплата по договору';
 outflow[2]=`2025-${month}-02 12:00:00`;outflow[10]='200.75';outflow[15]='002';outflow[21]='Оплата услуг';
 const review=inspectSberBusinessWorkbook([{sheet:name,rows:[pre,owner,header,sub,inflow,outflow]}]);
 const id='bank_xlsx:'+name.toLowerCase().replace(/\s/g,'-');
 return {id,kind:'BANK_XLSX',documentId:id,payload:{
  envelope:{sourceId:id,sourceType:'OTHER',fileName:name+'.xlsx',companyInn:inn,receivedAt:'2025-06-01T00:00:00.000Z',status:'READY',warnings:review.warnings,confidence:null,contentHash:'hash-'+name},
  bankXlsxReview:{version:review.version,totalOperations:review.totalOperations,accounts:review.accountCount,warnings:review.warnings,verifiedForAnalysis,sheets:compactBankXlsxSheets(review)},
 }};
}
function anchor(){
 return buildDossierAnchorAnalysis({companyInn:inn,companyName:'Test Company',fileName:'dossier',periodFrom:'2025-05-01',periodTo:'2025-05-02',createdAt:'2025-06-01T00:00:00.000Z'});
}

test('unverified SberBusiness XLSX stays outside canonical bank metrics',()=>{
 const result=withDossierSources(anchor(),[source('May',false)]);
 assert.equal(result.metricsV2,undefined);
 assert.equal(result.sourceManifest.bankStatements.length,0);
});

test('verified XLSX uses the canonical pipeline and combines later workbook periods',()=>{
 const first=source('May'),second=source('June');
 const initial=withDossierSources(anchor(),[first]);
 const combined=withDossierSources(initial,[first,second]);
 assert.ok(combined.metricsV2);
 assert.ok(combined.warnings.includes(BANK_XLSX_ADAPTER_WARNING));
 assert.deepEqual(combined.sourceManifest.bankStatements.map(s=>s.sourceId).sort(),[first.id,second.id].sort());
});

test('overlapping account periods from separate XLSX uploads stay out of scoring',()=>{
 const first=source('May'),duplicatePeriod=source('May copy');
 const result=withDossierSources(anchor(),[first,duplicatePeriod]);
 assert.equal(result.metricsV2,undefined);
 assert.equal(result.warnings.includes(BANK_XLSX_ADAPTER_WARNING),false);
});

test('verified XLSX remains a comparison source when TXT metrics already exist',()=>{
 const bank=analysisForStorage(analyzeBankStatements([{fileName:'statement.txt',text:statementFixture({inn})}]));
 const result=withDossierSources(bank,[source()]);
 assert.equal(result.warnings.includes(BANK_XLSX_ADAPTER_WARNING),false);
 assert.ok(result.metricsV2);
});
