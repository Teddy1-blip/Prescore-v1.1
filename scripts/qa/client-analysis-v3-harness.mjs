import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const root=process.cwd(),out=path.resolve(process.argv[2]??'build/client-v3-browser/harness');fs.mkdirSync(out,{recursive:true});
const req=createRequire(root+'/package.json');
const {businessCatalog,loadBusiness}=await import(root+'/lib/credit-engine/credit-lab/business-corpus.mjs');
const {buildCanonicalCreditAnalysis}=await import(root+'/lib/credit-engine/production/orchestrator.ts');
const {publicCanonicalModel}=await import(root+'/lib/credit-engine/production/public-model.ts');
process.chdir(root);
for(const c of businessCatalog()){const r=buildCanonicalCreditAnalysis(loadBusiness(c.caseId).input);fs.writeFileSync(out+'/'+c.caseId+'.json',JSON.stringify(publicCanonicalModel(r.model,r)));}
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{AnalysisV3}from'./app/dashboard/report-v2/analysis-v3.tsx';import{PrintReport}from'./app/dashboard/report-v2/print-report.tsx';const q=new URLSearchParams(location.search),id=q.get('lab')||'CL-RU-BUS-001';fetch('/'+id+'.json').then(r=>r.json()).then(model=>createRoot(document.getElementById('root')).render(React.createElement(q.has('print')?PrintReport:AnalysisV3,{model,labId:id,realAnalysisId:q.get('analysisId')||undefined})));`;
await req('esbuild').build({stdin:{contents:entry,resolveDir:root,sourcefile:'local-qa.tsx',loader:'tsx'},bundle:true,jsx:'automatic',platform:'browser',outfile:out+'/bundle.js',define:{'process.env.NODE_ENV':'"production"'}});
fs.writeFileSync(out+'/index.html','<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/report-v2.css"><link rel="stylesheet" href="/analysis-v3.css"><style>body{margin:0}</style><title>LOCAL synthetic canonical QA</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
for(const n of ['analysis-v3.css','report-v2.css'])fs.copyFileSync(root+'/app/dashboard/report-v2/'+n,out+'/'+n);
fs.cpSync(root+'/public/report-v2',out+'/report-v2',{recursive:true});
console.log('24 synthetic canonical models; current screen and print renderers bundled.');
