/** CPU-only local OCR preview. No AI calls, no remote transfer, no credit writes. */
import {validInn} from '../external/checko-inn.ts';
import {financialTableRows,type PdfFinancialRow} from './financial-layout.ts';
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
export type OcrPage={page:number;segment:'FULL'|'LEFT'|'RIGHT';logicalPage:number;method:'TEXT'|'OCR'|'UNREADABLE';text:string;tables?:PdfFinancialRow[]};
export type OcrResult={version:'PRESCORE-LOCAL-OCR-0.3';documentId:string;documentType:'PDF'|'IMAGE';pageCount:number;processedFrom:number;processedTo:number;layout:OcrLayout;quality:'STANDARD'|'HIGH';pages:OcrPage[];warnings:string[];outboundTransfer:false;creditEngineUpdated:false};
export type OcrOptions={fromPage?:number;toPage?:number;layout?:OcrLayout;quality?:'STANDARD'|'HIGH';maxBatchPages?:number;bureau?:boolean;financial?:boolean;forceRaster?:boolean};

export function ocrFormat(bytes:Uint8Array):'PDF'|'PNG'|'JPEG'{
 const h=Buffer.from(bytes.subarray(0,8));
 if(h.subarray(0,5).toString()==='%PDF-')return 'PDF';
 // Some issuer PDFs are encapsulated in CMS SignedData. Keep the signed
 // original intact; Poppler and PDF.js both understand the embedded PDF.
 const lead=Buffer.from(bytes.subarray(0,1024));
 const cms=Buffer.from('06092a864886f70d010702','hex');
 if(h[0]===0x30&&lead.subarray(0,32).includes(cms)&&lead.indexOf('%PDF-')>0)return 'PDF';
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
    if(err)reject(Object.assign(err,{tool:name}));
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
async function renderAndRead(source:string,dir:string,page:number,segment:'FULL'|'LEFT'|'RIGHT',dpi:number,financial:boolean,bureau:boolean,bounds?:{x:number;y:number;width:number;height:number}){
 const prefix=join(dir,`sheet-${page}-${segment}`);
 const args=['-f',String(page),'-l',String(page),'-singlefile','-r',String(dpi),'-gray','-png'];
 if(bounds)args.push('-x',String(bounds.x),'-y',String(bounds.y),'-W',String(bounds.width),'-H',String(bounds.height));
 await exec('pdftoppm',[...args,source,prefix],15_000);
 return readImage(prefix+'.png',page,dpi,financial,bureau);
}
async function readImage(path:string,page:number,dpi:number,financial:boolean,bureau:boolean) {
 const args=[path,'stdout','-l','rus+eng','--psm',bureau||financial?'6':'1'];
 if(!financial&&!bureau)return {text:await exec('tesseract',args),tables:undefined};
 const tsv=await exec('tesseract',[...args,'tsv']);
 const lines=new Map<string,string[]>();
 const tokens=[];
 const bureauLines=new Map<string,{x:number;w:number;h:number;word:string}[]>();
 for(const row of tsv.split('\n')){
   const [level,,block,paragraph,line,,left,top,width,height,confidence,word]=row.split('\t');
   if(level!=='5'||!word?.trim())continue;
   const key=[block,paragraph,line].join(':');
   const words=lines.get(key)??[];words.push(word);lines.set(key,words);
   if(bureau){
     const row=bureauLines.get(key)??[];
     row.push({x:+left,w:+width,h:+height,word});bureauLines.set(key,row);
     continue;
   }
   const scale=72/dpi;
   // Preserve physical positions in points for the existing PDF column resolver.
   tokens.push({str:Number(confidence)<45&&/\d/.test(word)?'?':word.replace(/^\|(?=\d)|(?<=\d)\|$/g,''),width:Number(width)*scale,
     transform:[1,0,0,Number(height)*scale,Number(left)*scale,-(Number(top)+Number(height))*scale]});
 }
 if(bureau){
   // Use the engine's physical line assignments. Small glyphs (punctuation,
   // lowercase and superscripts) have different vertical centres on the same line.
   let text=[...bureauLines.values()].map(row=>{
     let right=0;
     const heights=row.map(t=>t.h).sort((a,b)=>a-b);
     const median=heights[Math.floor(heights.length/2)];
     return row.sort((a,b)=>a.x-b.x).map((t,i)=>{
       const gap=i&&t.x-right>median*1.5?'   ':i?' ':'';
       right=t.x+t.w;return gap+t.word;
     }).join('');
   }).join('\n');
   // Read a small two-column cover independently of the dense repayment tables.
   // Accept a second-pass INN only from the same physical column as an explicit label.
   if(page===1&&/кредитный отч[её]т/i.test(text)&&!/^\s*ИНН(?:\s|:)/im.test(text)){
     const sparse=await exec('tesseract',[path,'stdout','-l','rus','--psm','11','tsv']);
     const tokens=sparse.split('\n').map(row=>row.split('\t')).filter(t=>t[0]==='5');
     const candidates=new Set<string>();
     for(const label of tokens.filter(t=>/^ИНН:?$/i.test(t[11]))){
       const x=Number(label[6]),y=Number(label[7]),h=Number(label[9]);
       for(const t of tokens){
         const dy=Number(t[7])-y;
         if(dy>0&&dy<=h*4&&Math.abs(Number(t[6])-x)<=h&&/^\d{10}(?:\d{2})?$/.test(t[11])&&validInn(t[11]))candidates.add(t[11]);
       }
     }
     if(candidates.size===1)text+='\nИНН: '+[...candidates][0];
   }
   return {text,tables:undefined};
 }
 const tables=financialTableRows(tokens,page,true);
 for(const row of tables)row.line.confidence='MEDIUM';
 return {text:[...lines.values()].map(words=>words.join(' ')).join('\n'),tables};
}
// Preserve tabular columns and physical-page breaks in native bureau PDFs.
export async function nativeLayoutText(bytes:Uint8Array){
 const dir=await mkdtemp(join(tmpdir(),'prescore-bureau-'));
 try{
   const source=join(dir,'original.pdf');
   await writeFile(source,bytes,{mode:0o600,flag:'wx'});
   return await exec('pdftotext',['-f','1','-l','180','-layout',source,'-'],8*1024*1024);
 }finally{await rm(dir,{recursive:true,force:true});}
}
export async function recognizeLocalDocument(bytes:Uint8Array,options:OcrOptions={}):Promise<OcrResult>{
 if(bytes.length===0||bytes.length>OCR_MAX_BYTES)throw Error('OCR_SIZE_LIMIT');
 const kind=ocrFormat(bytes),layout=options.layout??'SINGLE',quality=options.quality??'STANDARD',dpi=dpiFor(quality);
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
  const pageLimit=options.bureau?180:OCR_MAX_PDF_PAGES;
  const info=kind==='PDF'?await exec('pdfinfo',['-f','1','-l',String(pageLimit),source],65536):'';
  const count=kind==='PDF'?Number(info.match(/^Pages:\s*(\d+)\s*$/m)?.[1]):1;
  if(!Number.isSafeInteger(count)||count<1||count>pageLimit)throw Error('OCR_PAGE_LIMIT');
  const from=options.fromPage??1,to=options.toPage??Math.min(count,from+OCR_BATCH_PAGES-1);
  const maxBatch=options.maxBatchPages??OCR_BATCH_PAGES;
  if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<1||to>count||from>to||to-from+1>maxBatch||maxBatch>OCR_MAX_PDF_PAGES)throw Error('OCR_PAGE_RANGE');
  const pages:OcrPage[]=[],warnings:string[]=[];
  let chars=0;
  for(let page=from;page<=to;page++){
   const append=(text:string,segment:OcrPage['segment'],logicalPage:number,method:OcrPage['method'],tables?:PdfFinancialRow[])=>{
    if(text.length>MAX_PAGE_CHARS){text=text.slice(0,MAX_PAGE_CHARS);warnings.push('OCR_PAGE_TRUNCATED:'+page+':'+segment)}
    chars+=text.length;if(chars>MAX_CHUNK_CHARS)throw Error('OCR_CHUNK_TEXT_LIMIT');
    if(!text.trim())warnings.push('OCR_UNREADABLE:'+page+':'+segment);
    pages.push({page,segment,logicalPage,method:method==='TEXT'||text.trim()?method:'UNREADABLE',text:text.trim(),...(tables?.length?{tables}:{})});
   };
   if(kind!=='PDF'){
    const result=await readImage(source,1,dpi,!!options.financial,!!options.bureau);
    append(result.text,'FULL',1,'OCR',result.tables);continue;
   }
   const native=await exec('pdftotext',['-f',String(page),'-l',String(page),'-layout','-nopgbrk',source,'-'],MAX_PROCESS_BYTES);
   if(layout==='SINGLE'&&native.replace(/\s/g,'').length>=70&&!options.forceRaster){append(native,'FULL',page,'TEXT');continue;}
   pageSize(info,page,dpi); // Reject pathological PDF page sizes before rendering.
   if(layout==='TWO_UP_ROTATED'){
    // Two physical portrait half-sheets become left/right pages after auto rotation.
    // On clockwise-rotated spreads, the lower original half is the left/first page.
    const {w,h}=pageSize(info,page,dpi),half=Math.floor(h/2);
    const slices=[{segment:'LEFT' as const,y:half,height:h-half,logicalPage:2*page-1},
      {segment:'RIGHT' as const,y:0,height:half,logicalPage:2*page}];
    for(const s of slices){
     const recognized=await renderAndRead(source,dir,page,s.segment,dpi,!!options.financial,!!options.bureau,{x:0,y:s.y,width:w,height:s.height});
     append(recognized.text,s.segment,s.logicalPage,'OCR',recognized.tables);
    }
   }else{
    const recognized=await renderAndRead(source,dir,page,'FULL',dpi,!!options.financial,!!options.bureau);
    append(recognized.text,'FULL',page,'OCR',recognized.tables);
   }
  }
  return {version:'PRESCORE-LOCAL-OCR-0.3',documentId,documentType:kind==='PDF'?'PDF':'IMAGE',pageCount:count,processedFrom:from,processedTo:to,layout,quality,pages,warnings,outboundTransfer:false,creditEngineUpdated:false};
 }finally{active=false;if(dir)await rm(dir,{recursive:true,force:true})}
}
