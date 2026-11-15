import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {studioResponse} from '../studio/service.mjs';
const host='127.0.0.1',port=Number(process.env.STUDIO_PORT||4317),origin='http://'+host+':'+port;
const root=process.env.STUDIO_DATA_DIR||path.join(os.homedir(),'.prescore-studio-v01');
await fs.mkdir(root,{recursive:true,mode:0o700});
const approvals=path.join(root,'pairing-'+port);
await fs.mkdir(approvals,{recursive:true,mode:0o700});
const arg=process.argv.indexOf('--approve');
if(arg>=0){
 const code=process.argv[arg+1];
 if(!/^[0-9A-F]{8}$/.test(code||''))throw Error('Укажите код запроса из браузера');
 await fs.rename(path.join(approvals,code+'.pending'),path.join(approvals,code+'.approved'));
 console.log('Запрос '+code+' подтверждён владельцем локального хранилища.');process.exit(0);
}
const sessions=new Set(),requests=new Map();
const cookie=(req,name)=>(req.headers.cookie||'').split(/;\s*/).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
const loginHeaders={'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"};
function login(message){return '<!DOCTYPE html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Вход · Prescore Studio</title><body style="font:18px system-ui;background:#111d21;color:#eef6f1;max-width:540px;margin:15vh auto;padding:24px"><p style="color:#71d9b3">Prescore Studio</p><h1>Вход владельца</h1>'+message+'</body></html>';}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==host+':'+port){res.writeHead(403).end();return;}
  const url=new URL(req.url,origin);
  if(!url.pathname.startsWith('/admin/studio')&&url.pathname!=='/login'&&url.pathname!=='/'){res.writeHead(404).end();return;}
  const auth=sessions.has(cookie(req,'studio_session'));
  if(!auth){
   if(req.method!=='GET'||!['/','/admin/studio','/login'].includes(url.pathname)){res.writeHead(403).end();return;}
   const now=Date.now();
   for(const [key,v] of requests)if(v.expires<now){requests.delete(key);for(const ext of ['pending','approved'])await fs.rm(path.join(approvals,v.code+'.'+ext),{force:true});}
   let key=cookie(req,'studio_pending'),ticket=requests.get(key);
   if(!ticket){
    if(requests.size>=32){res.writeHead(429).end();return;}
    key=randomBytes(32).toString('hex');ticket={code:randomBytes(4).toString('hex').toUpperCase(),expires:now+300000};
    await fs.writeFile(path.join(approvals,ticket.code+'.pending'),'',{flag:'wx',mode:0o600});requests.set(key,ticket);
   }
   const approved=path.join(approvals,ticket.code+'.approved');
   try{await fs.unlink(approved);requests.delete(key);const session=randomBytes(32).toString('hex');sessions.add(session);
    res.writeHead(303,{Location:'/admin/studio','Set-Cookie':'studio_session='+session+'; Path=/; HttpOnly; SameSite=Strict','Cache-Control':'no-store'}).end();return;
   }catch(e){if(e.code!=='ENOENT')throw e;}
   res.writeHead(401,{...loginHeaders,'Set-Cookie':'studio_pending='+key+'; Path=/; HttpOnly; SameSite=Strict'});
   res.end(login('<p>Подтвердите этот браузер во втором терминале из папки Prescore. Запрос действует пять минут.</p><p>Номер запроса <strong>'+ticket.code+'</strong></p><pre style="white-space:pre-wrap">node --experimental-strip-types scripts/prescore-studio.mjs --approve '+ticket.code+'</pre><form action="/admin/studio"><button style="padding:10px 18px">Проверить подтверждение</button></form>'));return;
  }
  if(url.pathname==='/'){res.writeHead(302,{Location:'/admin/studio'}).end();return;}
  const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  const request=new Request(url,{headers:req.headers,method:req.method,signal:controller.signal,...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})});
  const response=await studioResponse(request,url.pathname.replace(/^\/admin\/studio\/?/,''),{roles:['ADMIN'],id:'local-owner'},root);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{if(!res.headersSent)res.writeHead(500);res.end();}
});
server.on('error',e=>{console.error('Studio: '+e.code);process.exitCode=1;});
server.listen(port,host,()=>console.log('Prescore Studio: '+origin+'/admin/studio\nЧерновики и локальное подтверждение браузеров: '+root));
