// Exercise the PDF engine copied into the standalone deployment, not the dev install.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]??'.next/standalone');
const pdfPath=path.join(root,'node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const canvasPath=path.join(root,'node_modules/@napi-rs/canvas/index.js');
if(!fs.realpathSync(pdfPath).startsWith(root+path.sep))throw Error('PDF_ARTIFACT_ESCAPES_STANDALONE');
for(const file of [pdfPath,canvasPath,path.join(root,'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')])if(!fs.existsSync(file))throw Error('PDF_RUNTIME_ARTIFACT_MISSING:'+path.relative(root,file));
const {getDocument}=await import(pathToFileURL(pdfPath).href);
if(typeof globalThis.DOMMatrix!=='function')throw Error('PDF_DOM_MATRIX_UNAVAILABLE');
const stream='BT /F1 12 Tf 40 100 Td (Prescore PDF extraction smoke) Tj ET';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
let pdf='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const document=await getDocument({data:new Uint8Array(Buffer.from(pdf)),isEvalSupported:false,useSystemFonts:true}).promise;
try{const page=await document.getPage(1);const content=await page.getTextContent();if(!content.items.some(i=>i.str==='Prescore PDF extraction smoke'))throw Error('PDF_TEXT_EXTRACTION_FAILED');}finally{await document.destroy();}
console.log('Standalone PDF text extraction PASS (DOMMatrix, native canvas, worker, text)');
