/** CPU-only local OCR preview. No AI calls, no remote transfer, no credit writes. */
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export const OCR_MAX_BYTES=16*1024*1024;
export const OCR_MAX_PDF_PAGES=64;
export const OCR_BATCH_PAGES=3; // synchronous HTTP work is bounded
const MAX_PAGE_CHARS=26_000,MAX_CHUNK_CHARS=175_000,MAX_PROCESS_BYTES=3_000_000;
const MAX_PROCESS_MS=45_000;
const dpiFor=(quality:'STANDARD'|'HIGH')=>quality==='HIGH'?220:150;
let active=false;

export type OcrLayout='SINGLE'|'TWO_UP_ROTATED';
export type OcrPage={page:number;segment:'FULL'|'LEFT'|'RIGHT';logicalPage:number;method:'TEXT'|'OCR'|'UNREADABLE';text:string};
export type OcrResult={version:'PRESCORE-LOCAL-OCR-0.2';documentId:string;documentType:'PDF'|'IMAGE';pageCount:number;processedFrom:number;processedTo:number;layout:OcrLayout;quality:'STANDARD'|'HIGH';pages:OcrPage[];warnings:string[];outboundTransfer:false;creditEngineUpdated:false};
export type OcrOptions={fromPage?:number;toPage?:number;layout?:OcrLayout;quality?:'STANDARD'|'HIGH';maxBatchPages?:number};

function format(bytes:Uint8Array):'PDF'|'PNG'|'JPEG'{
 const h=Buffer.from(bytes.subarray(0,8));
 if(h.subarray(0,5).toString()==='%PDF-')return 'PDF';
 if(h.equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'PNG';
 if(h[0]===255&&h[1]===216&&h[2]===255)return 'JPEG';
 throw Error('OCR_FORMAT_UNSUPPORTED');
}
async function exec(name:'pdfinfo'|'pdftotext'|'pdftoppm'|'tesseract',args:string[],maxBytes=MAX_PROCESS_BYTES){
 return new Promise<string>((resolve,reject)=>{
  const child=spawn(name,args,{
    shell:false,
    stdio:['ignore','pipe','pipe'],
    env:{
      NODE_ENV:process.env.NODE_ENV ?? 'production',
      PATH:process.env.PATH ?? '/usr/bin:/bin',
      OMP_THREAD_LIMIT:'1',
      OMP_NUM_THREADS:'1',
    },
  });
  let stdout='',count=0,settled=false;
  const finish=(err?:Error)=>{
    if(settled)return;
    settled=true;
    clearTimeout(timer);
    if(err)reject(err);
    else resolve(stdout);
  };
  const timer=setTimeout(()=>{child.kill('SIGKILL');finish(Error('OCR_PROCESS_TIMEOUT'))},MAX_PROCESS_MS);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',(chunk:string)=>{count+=Buffer.byteLength(chunk);if(count>maxBytes){child.kill('SIGKILL');finish(Error('OCR_OUTPUT_LIMIT'));return;}stdout+=chunk});
  // Error output may include confidential document metadata. Never retain it.
  let stderrBytes=0;
  child.stderr.on('data',(chunk:Buffer)=>{stderrBytes+=chunk.length;if(stderrBytes>65536){child.kill('SIGKILL');finish(Error('OCR_PROCESS_ERROR'))}});
  child.once('error',()=>finish(Error('OCR_BINARY_UNAVAILABLE')));
  child.once('close',code=>finish(code===0?undefined:Error('OCR_PROCESS_ERROR')));
 });
}
function pageSize(info:string,page:number,dpi:number):{w:number;h:number}{
 const line=info.split('\n').find(x=>new RegExp(`^Page\\s+${page}\\s+size:`).test(x));
 const source=line??info.split('\n').find(x=>/^Page size:/.test(x))??'';
 const m=source.match(/size:\s*([\d.]+)\s*x\s*([\d.]+)\s*pts/i);
 if(!m)throw Error('OCR_PAGE_DIMENSIONS');
 const w=Number(m[1])*dpi/72,h=Number(m[2])*dpi/72;
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<300||h<300||w*h>25_000_000)throw Error('OCR_PAGE_DIMENSIONS');
 return {w:Math.ceil(w),h:Math.ceil(h)};
}
async function renderAndRead(source:string,dir:string,page:number,segment:'FULL'|'LEFT'|'RIGHT',dpi:number,bounds?:{x:number;y:number;width:number;height:number}){
 const prefix=join(dir,`sheet-${page}-${segment}`);
 const args=['-f',String(page),'-l',String(page),'-singlefile','-r',String(dpi),'-gray','-png'];
 if(bounds)args.push('-x',String(bounds.x),'-y',String(bounds.y),'-W',String(bounds.width),'-H',String(bounds.height));
 await exec('pdftoppm',[...args,source,prefix],15_000);
 const text=await exec('tesseract',[prefix+'.png','stdout','-l','rus+eng','--psm','1'],MAX_PROCESS_BYTES);
 return text;
}
export async function recognizeLocalDocument(bytes:Uint8Array,options:OcrOptions={}):Promise<OcrResult>{
 if(bytes.length===0||bytes.length>OCR_MAX_BYTES)throw Error('OCR_SIZE_LIMIT');
 const kind=format(bytes),layout=options.layout??'SINGLE',quality=options.quality??'STANDARD',dpi=dpiFor(quality);
 if(!['SINGLE','TWO_UP_ROTATED'].includes(layout))throw Error('OCR_LAYOUT_INVALID');
 if(!['STANDARD','HIGH'].includes(quality))throw Error('OCR_QUALITY_INVALID');
 if(active)throw Error('OCR_BUSY');
 active=true;
 let dir:string|undefined;
 try{
  const documentId=createHash('sha256').update(bytes).digest('hex');
  dir=await mkdtemp(join(tmpdir(),'prescore-ocr-'));
  const source=join(dir,kind==='PDF'?'source.pdf':kind==='PNG'?'source.png':'source.jpg');
  await writeFile(source,bytes,{mode:0o600,flag:'wx'});
  const info=kind==='PDF'?await exec('pdfinfo',['-f','1','-l',String(OCR_MAX_PDF_PAGES),source],20000):'';
  const count=kind==='PDF'?Number(info.match(/^Pages:\s*(\d+)\s*$/m)?.[1]):1;
  if(!Number.isSafeInteger(count)||count<1||count>OCR_MAX_PDF_PAGES)throw Error('OCR_PAGE_LIMIT');
  const from=options.fromPage??1,to=options.toPage??Math.min(count,from+OCR_BATCH_PAGES-1);
  const maxBatch=options.maxBatchPages??OCR_BATCH_PAGES;
  if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<1||to>count||from>to||to-from+1>maxBatch||maxBatch>OCR_MAX_PDF_PAGES)throw Error('OCR_PAGE_RANGE');
  const pages:OcrPage[]=[],warnings:string[]=[];
  let chars=0;
  for(let page=from;page<=to;page++){
   const append=(text:string,segment:OcrPage['segment'],logicalPage:number,method:OcrPage['method'])=>{
    if(text.length>MAX_PAGE_CHARS){text=text.slice(0,MAX_PAGE_CHARS);warnings.push('OCR_PAGE_TRUNCATED:'+page+':'+segment)}
    chars+=text.length;if(chars>MAX_CHUNK_CHARS)throw Error('OCR_CHUNK_TEXT_LIMIT');
    if(!text.trim())warnings.push('OCR_UNREADABLE:'+page+':'+segment);
    pages.push({page,segment,logicalPage,method:method==='TEXT'||text.trim()?method:'UNREADABLE',text:text.trim()});
   };
   if(kind!=='PDF'){
    const text=await exec('tesseract',[source,'stdout','-l','rus+eng','--psm','1']);
    append(text,'FULL',1,'OCR');continue;
   }
   const native=await exec('pdftotext',['-f',String(page),'-l',String(page),'-layout','-nopgbrk',source,'-'],MAX_PROCESS_BYTES);
   if(native.replace(/\s/g,'').length>=70){append(native,'FULL',page,'TEXT');continue;}
   pageSize(info,page,dpi); // Reject pathological PDF page sizes before rendering.
   if(layout==='TWO_UP_ROTATED'){
    // Two physical portrait half-sheets become left/right pages after auto rotation.
    // On clockwise-rotated spreads, the lower original half is the left/first page.
    const {w,h}=pageSize(info,page,dpi),half=Math.floor(h/2);
    const slices=[{segment:'LEFT' as const,y:half,height:h-half,logicalPage:2*page-1},
      {segment:'RIGHT' as const,y:0,height:half,logicalPage:2*page}];
    for(const s of slices){
     const recognized=await renderAndRead(source,dir,page,s.segment,dpi,{x:0,y:s.y,width:w,height:s.height});
     append(recognized,s.segment,s.logicalPage,'OCR');
    }
   }else{
    const recognized=await renderAndRead(source,dir,page,'FULL',dpi);
    append(recognized,'FULL',page,'OCR');
   }
  }
  return {version:'PRESCORE-LOCAL-OCR-0.2',documentId,documentType:kind==='PDF'?'PDF':'IMAGE',pageCount:count,processedFrom:from,processedTo:to,layout,quality,pages,warnings,outboundTransfer:false,creditEngineUpdated:false};
 }finally{active=false;if(dir)await rm(dir,{recursive:true,force:true})}
}
