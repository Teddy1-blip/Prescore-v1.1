import ts from'typescript';import fs from'node:fs';
const raw=ts.readConfigFile('tsconfig.json',ts.sys.readFile);const cfg=ts.parseJsonConfigFileContent(raw.config,ts.sys,'.');const p=ts.createProgram(cfg.fileNames,{...cfg.options,noEmit:true,incremental:false});
const current=ts.getPreEmitDiagnostics(p).map(d=>({file:d.file?.fileName.replace(process.cwd()+'/','')||'',code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
const baseline=JSON.parse(fs.readFileSync('docs/platform-migration/typescript-baseline.json'));const counts=new Map();const key=d=>JSON.stringify(d);for(const d of baseline)counts.set(key(d),(counts.get(key(d))||0)+1);
const added=current.filter(d=>{const k=key(d),n=counts.get(k)||0;if(n){counts.set(k,n-1);return false;}return true;});
console.log(JSON.stringify({baseline:baseline.length,current:current.length,new:added.length,newDiagnostics:added},null,2));if(added.length)process.exitCode=1;
