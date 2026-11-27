import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {analyzeBankStatements,analysisForStorage,screenBankStatements} from '../../prescore.ts';
import {normalizeSnapshot} from '../financial-analysis/normalizer.ts';
const hash=x=>createHash('sha256').update(x).digest('hex');
function child(root,relative){const p=path.resolve(root,relative);if(!p.startsWith(path.resolve(root)+path.sep))throw Error('FIXTURE_PATH_ESCAPE');return p;}
function source(c,type,content,extra={}){return {sourceId:`synthetic:${c.caseId}:${type}:${hash(content)}`,sourceType:type,status:'READY',companyInn:c.companyInn,receivedAt:c.asOfDate,confidence:98,contentHash:hash(content),warnings:['SYNTHETIC_TEST_SOURCE'],...extra};}
export function buildBusinessInput(root,relative, suppliedFiles){
 const io=suppliedFiles ? {readFileSync:p=>{const v=suppliedFiles[path.relative(root,p).split(path.sep).join('/')];if(!v)throw Error('FIXTURE_FILE_MISSING');return Buffer.from(v);},existsSync:p=>!!suppliedFiles[path.relative(root,p).split(path.sep).join('/')],readdirSync:p=>Object.keys(suppliedFiles).filter(n=>n.startsWith(path.relative(root,p)+'/')).map(n=>n.split('/').at(-1))}:fs;
 const readJson=p=>JSON.parse(io.readFileSync(p).toString('utf8'));
 const dir=child(root,relative),c=readJson(path.join(dir,'case.json'));
 assert.equal(c.synthetic,true);assert.equal(c.origin,'SYNTHETIC');assert.match(c.companyInn,/^990000\d{4}$/);
 const statements=c.bankDocuments.map(d=>{
  const bytes=io.readFileSync(child(dir,d.path));assert.equal(hash(bytes),d.sha256Bytes);
  const text=new TextDecoder('windows-1251').decode(bytes);assert.equal(hash(text),d.sha256DecodedText);
  return {text,fileName:d.path,contentHash:hash(text),sourceId:`statement:${hash(text)}`};
 });
 const screening=screenBankStatements(statements);
 assert.ok(screening.accepted.length);
 const full=analyzeBankStatements(screening.accepted,{screeningResults:screening.screeningResults});
 // Supply explicit fixture receipt time. Do not change computed metrics/coverage.
 full.id=`synthetic-analysis:${c.caseId}`;full.createdAt=c.asOfDate+'T12:00:00.000Z';
 for(const s of full.sourceManifest?.bankStatements??[])s.receivedAt=c.asOfDate;
 const analysis=analysisForStorage(full);
 assert.equal(analysis.companyInn,c.companyInn);
 const bfoFiles=io.readdirSync(dir).filter(n=>/^bfo-.*\.json$/.test(n)).sort();
 if(bfoFiles.length){
  // Model one synthetic multi-year provider response, as one source batch.
  // The bundled annual observations keep their own accounting periods.
  const docs=bfoFiles.map(n=>readJson(child(dir,n))),batch=JSON.stringify(docs),s=source(c,'BFO',batch);
  analysis.sourceManifest.bfo=s;
  analysis.financialStatementsV2=docs.map(d=>normalizeSnapshot({source:s,period:d.period,rawLines:d.rawLines,scale:d.scale,reportedNetAssets:d.reportedNetAssets}));
 }
 const q=path.join(dir,'interim-2026-6m.json');
 if(io.existsSync(q)){
  const d=readJson(q),s=source(c,'QUARTERLY',JSON.stringify(d));analysis.sourceManifest.quarterly=s;
  analysis.financialStatementsV2=[...(analysis.financialStatementsV2??[]),normalizeSnapshot({source:s,period:d.period,rawLines:d.rawLines,scale:d.scale,reportedNetAssets:d.reportedNetAssets})];
 }
 const bki=path.join(dir,'bki-adapter-input.json');
 if(io.existsSync(bki)){const raw=readJson(bki);analysis.creditHistory=structuredClone(raw);analysis.sourceManifest.bki=source(c,'BKI',JSON.stringify(raw));
 // This fixture is an explicit reported-field JSON boundary, not a parser output with defaults.
 for(const o of analysis.creditHistory.obligations){const original=raw.obligations.find(x=>x.id===o.id);if(Object.hasOwn(original,'maxDelinquencyDays')&&typeof original.maxDelinquencyDays==='number')o.fieldProvenance={...o.fieldProvenance,maxDelinquencyDays:{origin:'REPORTED',value:original.maxDelinquencyDays,reference:analysis.sourceManifest.bki.sourceId+':'+o.id+':maxDelinquencyDays'}};}}
 const legal=path.join(dir,'legal-adapter-input.json');
 return {caseSpec:c,statements,full,input:{analysis,...(io.existsSync(legal)?{companyProfile:readJson(legal)}:{}),scenarios:readJson(path.join(dir,'scenarios.json'))}};
}
