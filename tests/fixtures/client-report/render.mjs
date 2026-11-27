import {registerHooks,createRequire} from 'node:module';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),ts=require('typescript');
registerHooks({load(url,context,next){if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:ts.transpileModule(fs.readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};return next(url,context);}});
const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
const {ClientReportShell}=await import('../../../app/dashboard/report-v2/client-report.tsx');
const {PrintReport}=await import('../../../app/dashboard/report-v2/print-report.tsx');
export const renderReport=(model,print=false)=>renderToStaticMarkup(React.createElement(print?PrintReport:ClientReportShell,{model}));
export function renderDocument(model,print=false){return '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prescore · внутренний просмотр</title><style>body{margin:0}'+fs.readFileSync(new URL('../../../app/dashboard/report-v2/report-v2.css',import.meta.url),'utf8')+'</style><body>'+renderReport(model,print)+'</body></html>';}
