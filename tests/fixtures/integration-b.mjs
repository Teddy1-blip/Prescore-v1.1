/** Offline, separately named source fixture. Never imports a runtime DB or provider. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {analyzeBankStatements,analysisForStorage,screenBankStatements} from '../../lib/prescore.ts';
import {normalizeSnapshot} from '../../lib/credit-engine/financial-analysis/normalizer.ts';
const root=new URL('./integration-b/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
const json=name=>JSON.parse(read(name));
const hash=value=>createHash('sha256').update(value).digest('hex');
export const integrationBManifest=json('manifest.json');
export function integrationBStatement(months=12){
 if(![1,5,6,12].includes(months))throw Error('UNSUPPORTED_SYNTHETIC_HISTORY');
 let text=read('bank-1-1.txt');
 if(months===12)return text;
 const month=7-months,start=`01.${String(month).padStart(2,'0')}.2026`;
 text=text.replace(/СекцияДокумент=[\s\S]*?КонецДокумента\r?\n/g,block=>{
  const date=/^Дата=(\d{2})\.(\d{2})\.(\d{4})/m.exec(block);
  return date&&`${date[3]}-${date[2]}-${date[1]}`>=`2026-${String(month).padStart(2,'0')}-01`?block:'';
 });
 return text.replaceAll('ДатаНачала=01.07.2025','ДатаНачала='+start)
  .replace('ВсегоПоступило=12000000.00',`ВсегоПоступило=${months*1000000}.00`)
  .replace('ВсегоСписано=10320000.00',`ВсегоСписано=${months*860000}.00`)
  .replace('КонечныйОстаток=11680000.00',`КонечныйОстаток=${10000000+months*140000}.00`);
}
export function integrationB({months=12,noLegal=false,unknownPrincipal=false,creditLimit=false,conflict=false,wrongProfile=false}={}){
 const {companyInn,asOfDate,id}=integrationBManifest;
 for(const [name,digest] of Object.entries(integrationBManifest.sources))if(hash(read(name))!==digest)throw Error('FIXTURE_SOURCE_HASH_MISMATCH:'+name);
 const statements=[{fileName:'SYNTHETIC-INTEGRATION-B.txt',text:integrationBStatement(months)}];
 const screening=screenBankStatements(statements);
 if(screening.accepted.length!==1)throw Error('FIXTURE_STATEMENT_REJECTED');
 const full=analyzeBankStatements(screening.accepted,{screeningResults:screening.screeningResults});
 full.id=`synthetic:${id}:${months}m`;full.createdAt=asOfDate+'T12:00:00.000Z';
 for(const source of full.sourceManifest.bankStatements)source.receivedAt=asOfDate;
 const analysis=analysisForStorage(full);
 const source=(type,body)=>({sourceId:`synthetic:${id}:${type}:${hash(JSON.stringify(body))}`,sourceType:type,status:'READY',companyInn,receivedAt:asOfDate,confidence:98,contentHash:hash(JSON.stringify(body)),warnings:['SYNTHETIC_OFFLINE_INTEGRATION_SOURCE']});
 const annual=[json('bfo-2024.json'),json('bfo-2025.json')],bfo=source('BFO',annual),quarterly=json('quarterly-2026-6m.json');
 if(conflict){quarterly.period=structuredClone(annual[1].period);quarterly.rawLines['1300']=4000000;quarterly.rawLines['1500']=4000000;}
 const interim=source('QUARTERLY',quarterly);
 analysis.sourceManifest.bfo=bfo;analysis.sourceManifest.quarterly=interim;
 analysis.financialStatementsV2=[...annual.map(d=>normalizeSnapshot({source:bfo,period:d.period,rawLines:d.rawLines,scale:d.scale,reportedNetAssets:d.reportedNetAssets})),normalizeSnapshot({source:interim,period:quarterly.period,rawLines:quarterly.rawLines,scale:quarterly.scale,reportedNetAssets:quarterly.reportedNetAssets})];
 const credit=json('bki-adapter-input.json');
 if(unknownPrincipal){credit.obligations[0].outstandingPrincipal=null;credit.obligations[0].totalOutstanding=null;}
 if(creditLimit){credit.obligations[0].product='Кредитная линия';credit.obligations[0].creditLimit=2500000;}
 const bki=source('BKI',credit);analysis.sourceManifest.bki=bki;analysis.creditHistory=credit;
 for(const obligation of credit.obligations)obligation.fieldProvenance={maxDelinquencyDays:{origin:'REPORTED',value:obligation.maxDelinquencyDays,reference:bki.sourceId+':'+obligation.id+':maxDelinquencyDays'}};
 const profile=noLegal?undefined:json('legal-adapter-input.json');
 if(wrongProfile)profile.inn='9900002914';
 const field=value=>({value,source:'CLIENT_DECLARED',status:'KNOWN',confidence:'MEDIUM',evidenceAsOf:asOfDate,warnings:['SYNTHETIC_CLIENT_DECLARATION_NOT_INDEPENDENT_PROOF']});
 return {statements,analysis,companyProfile:profile,financingCase:{caseId:'synthetic:integration-b-request',companyInn,asOfDate,requestedAmount:field(1000000),requestedTermMonths:field(12),financingPurpose:field('WORKING_CAPITAL'),requestedProduct:field('TERM_LOAN'),urgency:field('WITHIN_30_DAYS')},scenarios:[{scenarioId:'synthetic:integration-b-zero-rate',annualRatePercent:0,termMonths:12,paymentFrequency:'MONTHLY',amortization:'ANNUITY',scenarioSource:'Explicit synthetic zero-rate arithmetic check; not a lender offer',evidenceAsOf:asOfDate,confidence:'HIGH'}]};
}
