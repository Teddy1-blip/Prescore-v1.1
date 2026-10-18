import ts from'typescript';
const raw=ts.readConfigFile('tsconfig.json',ts.sys.readFile);const cfg=ts.parseJsonConfigFileContent(raw.config,ts.sys,'.');const p=ts.createProgram(cfg.fileNames,{...cfg.options,noEmit:true,incremental:false});
const current=ts.getPreEmitDiagnostics(p).map(d=>({file:d.file?.fileName.replace(process.cwd()+'/','')||'',code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
console.log(JSON.stringify({diagnostics:current.length,details:current},null,2));if(current.length)process.exitCode=1;
