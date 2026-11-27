// Offline only. Each input file is a read-only Wrangler D1 SELECT result for one table.
// Never connects to production or invokes Wrangler.
import {readFile,writeFile} from 'node:fs/promises';import {resolve,isAbsolute,join}from'node:path';
import catalog from'../../lib/db/catalog.json'with{type:'json'};
import{validateExport}from'../../lib/db/import-validation.ts';
const arg=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const directory=arg('directory'),output=arg('output');
if(!directory||!output||!isAbsolute(directory)||!isAbsolute(output))throw Error('Use --directory=/absolute/sanitized-export --output=/absolute/export.json');
const tables={};
for(const t of catalog){const value=JSON.parse(await readFile(join(resolve(directory),t.table+'.json'),'utf8'));const chunks=Array.isArray(value)?value:[value];
 if(chunks.some(x=>x.success===false||!Array.isArray(x.results)))throw Error('D1_EXPORT_SHAPE_INVALID');
 tables[t.table]=chunks.flatMap(x=>x.results);
}
const report=validateExport({tables});
console.log(JSON.stringify({counts:report.counts,errors:report.errors}));
if(!report.valid)process.exitCode=1;else await writeFile(output,JSON.stringify({format:'PRESCORE-D1-EXPORT-1',tables}),{mode:0o600,flag:'wx'});
