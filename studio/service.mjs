import fs from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {defaults,initial,validateDraft,makePackage,importPackage} from './runtime.mjs';
import {graph,connectPorts} from './graph.mjs';
import {digest,requireThat} from './methodology.mjs';
import {FileStudioStore} from './storage.mjs';
const assets={'':'index.html','board.js':'board.js','ui.js':'ui.js','theme.css':'theme.css','state.js':'state.js'};
const mime={html:'text/html',js:'application/javascript',css:'text/css'};
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
const json=(body,status=200)=>Response.json(body,{status,headers});
export function calculate(draft,owner,signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(Error('Запуск отменён'));return;}
  const w=new Worker(new URL('worker.mjs',import.meta.url),{workerData:{draft,owner},execArgv:['--experimental-strip-types']});
  const abort=()=>{void w.terminate();reject(Error('Запуск отменён'));};
  signal?.addEventListener('abort',abort,{once:true});
  w.once('message',r=>r.error?reject(Error(r.error)):resolve(r.run));w.once('error',reject);
  w.once('exit',code=>{signal?.removeEventListener('abort',abort);if(code)reject(Error('Расчёт прерван'));});
 });
}
async function body(req){
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw Error('Ожидался JSON');
 const reader=req.body?.getReader();requireThat(reader,'Пустой запрос');const parts=[];let bytes=0;
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>160000){await reader.cancel();throw Error('Слишком большой пакет');}parts.push(value);}
 return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
export async function studioResponse(req,route,principal,root){
 if(!principal?.roles?.includes('ADMIN')||!principal.id)return json({error:'Доступ только для внутреннего администратора'},403);
 const store=new FileStudioStore(root,principal.id),method=req.method;
 try{
  if(method==='GET'){
   if(Object.hasOwn(assets,route)){const name=assets[route];return new Response(await fs.readFile(new URL('ui/'+name,import.meta.url),'utf8'),{headers:{...headers,'Content-Type':mime[name.split('.').pop()]+'; charset=utf-8'}});}
   if(route==='bootstrap')return json({...defaults,initial:initial(),versions:await store.versions(),samples:['formula','source']});
   if(route==='graph')return json(graph());
   if(route==='versions')return json(await store.versions());
   if(route.startsWith('version/'))return json(await store.get('versions',route.slice(8)));
   if(route.startsWith('run/'))return json(await store.get('runs',route.slice(4)));
   if(['sample/formula','sample/source'].includes(route))return json(JSON.parse(await fs.readFile(new URL('samples/'+route.slice(7)+'.json',import.meta.url),'utf8')));
  }
  if(method==='POST'){
   if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Недопустимый origin'},403);
   const b=await body(req);
   if(route==='import')return json(importPackage(b));
   if(route==='connect'){validateDraft(b.draft);const method=connectPorts(b.draft.method,b.edge);validateDraft({...b.draft,method});return json(method);}
   if(route==='validate'){validateDraft(b);return json({status:'VALIDATED',hash:digest(b.method)});}
   if(route==='graph'){validateDraft(b);return json(graph(b.method));}
   if(route==='calculate'){validateDraft(b);const run=await calculate(b,principal.id,req.signal);const id=await store.put('runs',run);return json({id,...run});}
   if(route==='save'||route==='export'){
    const d=b.draft;validateDraft(d);
    const run=b.run?await store.get('runs',b.run):null;
    if(run)requireThat(run.status==='COMPLETE'&&run.draftHash===digest(d),'Результат относится к другой ревизии');
    if(route==='export')return json(makePackage(d,run));
    return json({id:await store.put('versions',{draft:d,run:b.run||null,at:new Date().toISOString()})});
   }
  }
  return json({error:'Неизвестный маршрут'},404);
 }catch(e){return json({error:e.code==='ENOENT'?'Запись не найдена':e.code?'Ошибка изолированного хранилища':e.message},e.code==='ENOENT'?404:422);}
}
