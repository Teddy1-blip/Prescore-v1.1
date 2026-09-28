import ts from 'typescript';import fs from 'node:fs';import path from 'node:path';
const roots=['lib/db','lib/auth','lib/storage','lib/ai/providers','lib/platform','app/components/ui-v2'];
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){if(e.name!=='legacy')walk(p);}else if(/\.tsx?$/.test(p))files.push(p);}}
roots.forEach(walk);
const options={noEmit:true,strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,allowImportingTsExtensions:true,resolveJsonModule:true};
const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram(files,options));
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));
console.log(JSON.stringify({modules:files.length,diagnostics:diagnostics.length}));if(diagnostics.length)process.exitCode=1;
