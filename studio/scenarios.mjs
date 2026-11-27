import {readFileSync} from 'node:fs';
import {integrationB} from '../tests/fixtures/integration-b.mjs';
import {statementFixture} from '../tests/fixtures/block1-statements.mjs';
import {analyzeBankStatements,analysisForStorage} from '../lib/prescore.ts';
import {normalizeSnapshot} from '../lib/credit-engine/financial-analysis/normalizer.ts';
import {requireThat,shape,digest} from './methodology.mjs';
export const companies=[{id:'integration-b',name:'Интеграция Б',inn:'9900002906'},{id:'lab-service',name:'Сервис Лаб',inn:'9900002914'}];
const raw=JSON.parse(readFileSync(new URL('../tests/fixtures/integration-b/quarterly-2026-6m.json',import.meta.url),'utf8'));
export function scenario(company=companies[0].id){return {company,financial:true,bki:company===companies[0].id,lines:Object.fromEntries(['1200','1500','1210','1250','1230'].map(k=>[k,raw.rawLines[k]]))};}
export function verifyScenario(s){
  shape(s,['company','financial','bki','lines']);requireThat(companies.some(c=>c.id===s.company)&&typeof s.financial==='boolean'&&typeof s.bki==='boolean'&&(s.company==='integration-b'||!s.bki),'Некорректные источники или компания');
  shape(s.lines,Object.keys(scenario().lines));requireThat(Object.values(s.lines).every(n=>n===null||Number.isSafeInteger(n)&&Math.abs(n)<=1e13),'Сумма должна быть целым количеством рублей или пустым значением');
}
function serviceCompany() {
  const firm=companies[1], text=statementFixture({inn:firm.inn,company:'Синтетическая компания «Сервис Лаб»',periodFrom:'01.06.2026',periodTo:'30.06.2026',transactionDate:'15.06.2026'});
  const a=analyzeBankStatements([{fileName:'synthetic-service.txt',text}]);a.id='synthetic:studio-service';a.createdAt='2026-06-30T12:00:00.000Z';
  for(const src of a.sourceManifest.bankStatements)src.receivedAt='2026-06-30';
  return {analysis:analysisForStorage(a)};
}
export function makeInput(s){
  verifyScenario(s);const x=s.company==='integration-b'?integrationB():serviceCompany(),a=x.analysis;
  if(!s.bki){delete a.creditHistory;delete a.sourceManifest.bki;delete a.creditPortfolioV1;}
  if(!s.financial){delete a.financialStatementsV2;delete a.financialAnalysisV2;delete a.sourceManifest.bfo;delete a.sourceManifest.quarterly;}
  else if(s.company!=='integration-b'||digest(s.lines)!==digest(scenario().lines)){
    const rawLines={...raw.rawLines,...s.lines}, hash=digest({period:raw.period,rawLines,company:s.company,reportedNetAssets:raw.reportedNetAssets});
    const source={sourceId:'synthetic:studio:'+hash,contentHash:hash,sourceType:'QUARTERLY',companyInn:a.companyInn,status:'READY',receivedAt:raw.receivedAt,confidence:98,warnings:['SYNTHETIC_STUDIO']};
    a.sourceManifest.quarterly=source;
    a.financialStatementsV2=[...(a.financialStatementsV2||[]).filter(v=>v.sourceType!=='QUARTERLY'),normalizeSnapshot({source,period:raw.period,scale:raw.scale,rawLines,reportedNetAssets:raw.reportedNetAssets})];
  }
  delete x.statements;return x;
}
