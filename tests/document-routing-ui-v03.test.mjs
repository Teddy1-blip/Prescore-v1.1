import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=fs.readFileSync(new URL('../app/dashboard/document-ocr-preview.tsx',import.meta.url),'utf8');
test('OCR panel syntax compiles with JSX; this is not browser acceptance',()=>{
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true});
 assert.deepEqual((output.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
});
test('legacy panel no longer always invokes commercial parser',()=>{
 assert.match(source,/routing\.parser==='COMMERCIAL_CONTRACT'\?extractContractReview\(reviewPages\):null/);
 assert.doesNotMatch(source,/useMemo\(\(\)=>extractContractReview\(\[\.\.\.pages,\.\.\.extraPages\]\)/);
 assert.match(source,/totalPhysicalPages:total\|\|null/);
 assert.match(source,/extractionWarnings:scanWarnings/);
});
test('retry classification uses content, not category or filename',()=>{
 assert.match(source,/commercial=completedRouting\.parser==='COMMERCIAL_CONTRACT'/);
 assert.doesNotMatch(source,/commercial=\/.*category/);
 assert.match(source,/Использовать первый проход/);assert.match(source,/Использовать повторный проход/);
});
test('preview tells the truth about unconnected parsers and persistence',()=>{
 assert.match(source,/табличный анализатор ещё не подключён/);assert.match(source,/кредитных условий ещё не подключён/);
 assert.match(source,/не сохраняется после перезагрузки страницы/);
});
