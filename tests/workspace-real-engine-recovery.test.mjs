import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {analyzeBankStatements,analysisForStorage,screenBankStatements} from '../lib/prescore.ts';
import {parseAuthoritativeBfoText,parseAuthoritativeQuarterlyText,parseAuthoritativeCreditHistoryText,withRefreshedIntegrity} from '../lib/credit-engine/source-foundation.ts';
import {quarterlyFinancialShadow} from '../lib/credit-engine/financial-analysis/integration.ts';
import {loadWorkspaceModelV1} from '../lib/workspace/service.ts';

// Native parsers, normalization, metrics, canonical engines and workspace service.
// Persistence/auth boundaries are explicit in-memory readers; not a PostgreSQL,
// HTTP, PDF/XLSX extraction, external-provider or browser acceptance test.
const inn='9900000012',receivedAt='2026-08-05T00:00:00.000Z';
const hash=s=>createHash('sha256').update(s).digest('hex');
function statement(){return `1CClientBankExchange
ВерсияФормата=1.03
Кодировка=Windows
Отправитель=Банк Клиент Онлайн
ДатаНачала=01.07.2026
ДатаКонца=31.07.2026
РасчСчет=40702810111110000001
СекцияРасчСчет
ДатаНачала=01.07.2026
ДатаКонца=31.07.2026
РасчСчет=40702810111110000001
НачальныйОстаток=50000.00
ВсегоПоступило=100000.00
ВсегоСписано=0.00
КонечныйОстаток=150000.00
КонецРасчСчет
СекцияДокумент=Платежное поручение
Номер=1
Дата=15.07.2026
Сумма=100000.00
Плательщик=ООО СИНТЕТИЧЕСКИЙ ПОКУПАТЕЛЬ
ПлательщикИНН=9900000020
ПлательщикСчет=40702810999990000001
ПлательщикБанк1=АО Банк покупателя
Получатель=ООО СИНТЕТИЧЕСКИЙ ЗАЁМЩИК
ПолучательИНН=${inn}
ПолучательСчет=40702810111110000001
ПолучательБанк1=ПАО БАНК УРАЛСИБ
НазначениеПлатежа=Оплата по договору за выполненные работы
КонецДокумента
КонецФайла`;}
function bankAnalysis(){
 const text=statement(),contentHash=hash(text),input={fileName:'synthetic.txt',text,contentHash,sourceId:'statement:'+contentHash};
 const screened=screenBankStatements([input]);assert.equal(screened.accepted.length,1);
 const analysis=analyzeBankStatements(screened.accepted,{screeningResults:screened.screeningResults});
 analysis.createdAt=receivedAt;analysis.sourceManifest.bankStatements.forEach(s=>{s.receivedAt=receivedAt;});
 return JSON.parse(JSON.stringify(analysisForStorage(analysis)));
}
const operations={documents:{status:'NONE',count:0,analysisCount:0},applications:{status:'NONE',count:0,activeCount:0,statuses:[]}};
async function workspace(analysis,{tier='FULL',access='owner',authorized=true}={}){
 const payload=JSON.stringify(analysis),dependencies={
  readAccess:async()=>authorized?{access,row:{payload,companyInn:analysis.companyInn,ownerEmail:'synthetic@test.invalid'}}:null,
  readTier:async()=>tier,readProfile:async()=>undefined,readOperations:async()=>operations,
 };
 return loadWorkspaceModelV1(analysis.id,dependencies);
}
function financialText(period='2025 год',revenue=1300,companyInn=inn){return `Бухгалтерская отчетность за ${period}
Организация ООО СИНТЕТИЧЕСКИЙ ЗАЁМЩИК
ИНН ${companyInn}
Единица измерения: тыс. руб.
Внеоборотные активы 1100 100
Оборотные активы 1200 900
Дебиторская задолженность 1230 400
Денежные средства 1250 300
БАЛАНС 1600 1000
Капитал и резервы 1300 600
Долгосрочные обязательства 1400 100
Краткосрочные обязательства 1500 300
Кредиторская задолженность 1520 200
Выручка 2110 ${revenue}
Чистая прибыль 2400 130`;}
function attachFinancial(analysis,kind,text){
 const report=(kind==='BFO'?parseAuthoritativeBfoText:parseAuthoritativeQuarterlyText)({text,fileName:'synthetic.csv',analysisInn:analysis.companyInn});
 const source={sourceId:kind.toLowerCase()+':'+hash(text),sourceType:kind,status:'READY',companyInn:analysis.companyInn,receivedAt,confidence:report.parserConfidence,warnings:report.warnings,contentHash:hash(text),periodFrom:report.financialMetadataV2.period.from,periodTo:report.financialMetadataV2.period.to};
 const financial=quarterlyFinancialShadow(report,source,analysis.financialStatementsV2);
 assert.ok(financial.financialStatementsV2);assert.ok(financial.financialAnalysisV2);
 const ids=new Set(financial.financialStatementsV2.map(s=>s.sourceId));
 return JSON.parse(JSON.stringify(analysisForStorage(withRefreshedIntegrity({...analysis,...financial,...(kind==='QUARTERLY'?{quarterlyReport:report}:{}),sourceManifest:{...analysis.sourceManifest,[kind==='BFO'?'bfo':'quarterly']:source,financialUploads:[...(analysis.sourceManifest.financialUploads??[]).filter(s=>ids.has(s.sourceId)),source]}}))));
}
function bkiText(companyInn=inn){return ['Субъект: Кредитная история юридического лица','Наименование организации','ООО СИНТЕТИЧЕСКИЙ ЗАЁМЩИК','ИНН','Номер',companyInn,'Сводка Счета','Все счета Всего: 1','Открытых: 1','Субъект: Кредитная история юридического лица','Счет','Вид: Кредитная линия','Отношение: Заёмщик','Кредитор: Тест Банк  Финальн.платеж: 01-01-2028','Счет: SYNTHETIC-LOAN-1','Размер/лимит: 200000','Открыт: 01-01-2025','Полная стоимость: 19.5','Статус: Действующий','Задолж-сть: 120000','Просрочено: 0  След.платеж: 9000','Дата след.платежа: 01-11-2026','Последн.обновление: 01-08-2026','Просрочки (0 просроч.платежей)','При наличии вопросов обратитесь в НБКИ','Предоставлен 02-08-2026'].join('\n');}
function attachBki(analysis){const text=bkiText(),creditHistory=parseAuthoritativeCreditHistoryText({text,fileName:'synthetic.pdf',analysisInn:analysis.companyInn,relationship:'Компания-заёмщик'});return JSON.parse(JSON.stringify(analysisForStorage(withRefreshedIntegrity({...analysis,creditHistory,sourceManifest:{...analysis.sourceManifest,bki:{sourceId:'bki:'+hash(text),sourceType:'BKI',status:'READY',companyInn:inn,receivedAt,confidence:creditHistory.parserConfidence,warnings:creditHistory.warnings,contentHash:hash(text)}}}))));}
function metrics(period){return Object.fromEntries(period.groups.flatMap(g=>g.metrics).map(m=>[m.key,m.value]));}

test('native TXT → saved JSON → actual BASIC/FULL workspace preserves independently known bank figures',async()=>{
 const a=bankAnalysis(),basic=await workspace(a,{tier:'FREE'}),full=await workspace(a);
 assert.equal(basic.state,'READY_BASIC');assert.equal(basic.fullAvailability,'LOCKED');assert.equal('full'in basic,false);
 assert.equal(full.state,'READY_FULL');assert.equal(full.fullAvailability,'READY');
 for(const m of [basic,full])for(const [key,value]of Object.entries({grossInflow:100000,grossOutflow:0,netCashFlow:100000,operatingInflow:100000,endingBalance:150000,averageDailyBalance:104838.71,minimumDailyBalance:50000}))assert.equal(m.basic.bankingFacts[key].value,value,key);
 assert.deepEqual((await workspace(JSON.parse(JSON.stringify(a)))).full,full.full);
});
test('native annual BFO → replacement → corporate BKI → quarterly updates the same actual canonical model',async()=>{
 let a=bankAnalysis();const bankFacts=(await workspace(a)).basic.bankingFacts;
 a=attachFinancial(a,'BFO',financialText('2024 год',1000));
 a=attachFinancial(a,'BFO',financialText('2025 год',1200));
 a=attachFinancial(a,'BFO',financialText('2025 год',1300));
 let m=await workspace(a);assert.equal(m.state,'READY_FULL');assert.equal(m.full.report.financialAnalysis.history.length,2);
 const annual=m.full.report.financialAnalysis.history.find(h=>h.period.to==='2025-12-31');
 assert.equal(metrics(annual).REVENUE,1300000);assert.equal(metrics(annual).EQUITY,600000);assert.equal(metrics(annual).currentRatio,3);
 a=attachBki(a);m=await workspace(a);assert.equal(m.state,'READY_FULL');
 const o=m.full.report.analysisV3.portfolio[0];assert.equal(o.creditor.value,'Тест Банк');assert.equal(o.limit.value,200000);assert.equal(o.reportedPrincipal.value,120000);assert.equal(o.reportedPrincipal.asOf,'2026-08-02');assert.equal(o.principal.value,null);assert.equal(o.payment.value,9000);assert.equal(o.overdue.value,0);assert.equal(o.maturity.value,'2028-01-01');
 a=attachFinancial(a,'QUARTERLY',financialText('Январь - Март 2026 г.',300));m=await workspace(a);
 assert.equal(m.state,'READY_FULL');assert.equal(m.full.report.financialAnalysis.history.length,3);
 const interim=m.full.report.financialAnalysis.history.find(h=>h.period.kind==='INTERIM');assert.equal(metrics(interim).REVENUE,300000);assert.equal(interim.period.monthsCovered,3);
 assert.deepEqual(m.basic.bankingFacts,bankFacts);assert.deepEqual((await workspace(JSON.parse(JSON.stringify(a)))).full,m.full);
 const broker=await workspace(a,{access:'agent'});assert.equal(broker.access.readOnly,true);assert.deepEqual(broker.full,m.full);
});
test('foreign financial and credit source identity is rejected before attaching any results',()=>{
 const a=bankAnalysis(),before=JSON.stringify(a);
 assert.throws(()=>attachFinancial(a,'BFO',financialText('2025 год',1300,'9900000020')),/ИНН/);
 assert.throws(()=>parseAuthoritativeCreditHistoryText({text:bkiText('9900000020'),fileName:'synthetic.pdf',analysisInn:inn,relationship:'Компания-заёмщик'}),/ИНН/);
 assert.equal(JSON.stringify(a),before);
});
test('missing native bank metrics produce explicit diagnosis instead of a fabricated result',async()=>{
 const a=bankAnalysis();delete a.metricsV2;const result=await workspace(a);
 assert.equal(result.state,'READY_BASIC');assert.equal(result.fullAvailability,'UNAVAILABLE');assert.equal(result.diagnostic.reason,'BANK_METRICS_MISSING');assert.equal(result.basic.bankingFacts.grossInflow.value,null);assert.equal('full'in result,false);
});
test('no authorized analysis returns no bank or canonical data',async()=>{
 const result=await workspace(bankAnalysis(),{authorized:false});assert.equal(result.state,'NOT_FOUND');assert.equal('basic'in result,false);assert.equal('full'in result,false);assert.equal('diagnostic'in result,false);
});
