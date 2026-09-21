import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import{createRequire}from'node:module';import ts from'typescript';import React from'react';import{renderToStaticMarkup}from'react-dom/server';
const require=createRequire(import.meta.url),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('exports','require',code)(exports,name=>{
  if(name.endsWith('.css'))return{};
  if(name==='next/link')return{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
  if(name==='next/navigation')return{useRouter:()=>({}),useSearchParams:()=>new URLSearchParams(),usePathname:()=>'/'};
  if(name.startsWith('.')){const base=path.resolve(path.dirname(file),name),p=[base,base+'.ts',base+'.tsx',base+'.json',path.join(base,'index.ts')].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());if(!p)throw Error('MISSING_MODULE:'+name);if(p.endsWith('.json'))return JSON.parse(fs.readFileSync(p,'utf8'));return load(p);}
  return require(name);
 });return exports;
}
for(const [file,expected]of [
 ['app/page.tsx','Увидеть в цифрах'],
 ['app/privacy/page.tsx','Политика обработки персональных данных'],
 ['app/offer/page.tsx','оферта'],
 ['app/consent/page.tsx','Согласие'],
 ['app/checkout/checkout-form.tsx','6'],
 ['app/dashboard/page.tsx','АНАЛИЗ'],
 ['app/agent/page.tsx','РАБОТА С КЛИЕНТАМИ'],
 ['app/admin/admin-dashboard.tsx','Загру'],
])test('portable UI static render '+file,()=>{const html=renderToStaticMarkup(React.createElement(load(file).default));assert.ok(html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').toLowerCase().includes(expected.toLowerCase()));assert.ok(html.includes('<main'));assert.doesNotMatch(html,/oai-authenticated|signin-with-chatgpt|RISK-CF-|PRESCORE-RISK-ENGINE/);});
test('standalone sign-in has labelled fields and no demo credentials',()=>{const html=renderToStaticMarkup(React.createElement(load('app/login/credentials.tsx').Credentials,{returnTo:'/dashboard'}));assert.match(html,/type="email"/);assert.match(html,/type="password"/);assert.match(html,/autoComplete="current-password"/);assert.match(html,/<button[^>]*>Войти/);assert.doesNotMatch(html.match(/<input[^>]*type="password"[^>]*>/)[0],/value=/i);});
test('shared responsive and reduced-motion contracts include all requested small widths',()=>{const css=fs.readFileSync('app/components/ui-v2/product-system.css','utf8');for(const width of [360,390,768,1024])assert.ok(css.includes('max-width:'+width+'px'));assert.ok(css.includes('focus-visible'));assert.ok(css.includes('prefers-reduced-motion'));assert.ok(css.includes('@media print'));assert.ok(css.includes('overflow:auto'));});

// Run actual Credentials handlers against a deterministic hook host and captured API.
// This exercises storage and UI transitions without network or mail delivery.
import * as authUx from '../lib/auth/ux.ts';
import {safeReturnPath} from '../lib/auth/contracts.ts';
function credentialsHarness(saved=''){
 const states=[],refs=[],effects=[],calls=[],writes=[],values=new Map(saved?[[authUx.REMEMBERED_EMAIL_KEY,saved]]:[]);
 let cursor=0,refCursor=0,mounted=false,response={data:{},error:null};
 const fakeWindow={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>{writes.push([k,v]);values.set(k,v);},removeItem:k=>values.delete(k)},location:{assign:url=>calls.push(['navigate',url])}};
 const api=async args=>{calls.push(['api',args]);return response;};
 const mockAuth={signIn:{email:api},signUp:{email:api},requestPasswordReset:api,sendVerificationEmail:api};
 const hooks={useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=v;}];},useRef(initial){const i=refCursor++;return refs[i]??=( {current:initial} );},useEffect(fn){if(!mounted)effects.push(fn);}};
 const exports={};const source=fs.readFileSync('app/login/credentials.tsx','utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const originalWindow=globalThis.window;globalThis.window=fakeWindow;
 new Function('exports','require','FormData','window',code)(exports,name=>{
  if(name==='react')return hooks;if(name.includes('/auth/client'))return{authClient:mockAuth};if(name.includes('/auth/contracts'))return{safeReturnPath};if(name.includes('/auth/ux'))return authUx;if(name.includes('/primitives'))return load('app/components/ui-v2/primitives.tsx');return require(name);
 },class{constructor(data){this.data=data;}get(key){return this.data[key];}},fakeWindow);
 const props={returnTo:'https://attacker.invalid'};
 const render=()=>{cursor=0;refCursor=0;return exports.Credentials(props);};
 render();mounted=true;effects.forEach(fn=>fn());
 const nodes=()=>{const out=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}out.push(n);walk(n.props?.children);}walk(render());return out;};
 return{calls,writes,values,props,nodes,render,respond:r=>{response=r;},field:name=>nodes().find(n=>n.props?.name===name),checkbox:()=>nodes().find(n=>n.props?.type==='checkbox'),button:text=>nodes().find(n=>typeof n.props?.onClick==='function'&&n.props.children===text),close(){globalThis.window=originalWindow;}};
}
test('remembered email prefill, opt-out deletion, normalized save and password never stored',async()=>{
 const h=credentialsHarness('saved@example.test');try{
  assert.equal(h.field('email').props.value,'saved@example.test');assert.equal(h.checkbox().props.checked,true);
  h.checkbox().props.onChange({target:{checked:false}});assert.equal(h.values.size,0);
  h.checkbox().props.onChange({target:{checked:true}});
  await h.render().props.onSubmit({preventDefault(){},currentTarget:{email:' New@Example.test ',password:'secret-never-stored'}});
  assert.deepEqual(h.writes,[[authUx.REMEMBERED_EMAIL_KEY,'new@example.test']]);assert.deepEqual(h.calls.at(-1),['navigate','/dashboard']);
 }finally{h.close();}
});
test('auth UI handles unverified sign-in, safe resend, failures, register and reset',async()=>{
 const h=credentialsHarness();try{
  assert.equal(h.checkbox().props.checked,false);h.field('email').props.onChange({target:{value:'test@example.test'}});
  h.respond({error:{code:'EMAIL_NOT_VERIFIED'}});
  await h.render().props.onSubmit({preventDefault(){},currentTarget:{email:'test@example.test',password:'secret'}});
  assert.ok(h.nodes().some(n=>n.props?.children===authUx.authErrorMessage({code:'EMAIL_NOT_VERIFIED'})));
  const resend=h.nodes().find(n=>Array.isArray(n.props?.children)&&n.props.children[0]==='Отправить письмо ещё раз');
  h.respond({data:{status:true}});await resend.props.onClick();
  assert.equal(h.calls.at(-1)[1].callbackURL,'/login?verified=1&returnTo=%2Fdashboard');assert.ok(h.nodes().some(n=>n.props?.children===authUx.RESEND_NOTICE));
  const count=h.calls.length;await h.nodes().find(n=>Array.isArray(n.props?.children)&&n.props.children[0]==='Отправить письмо ещё раз').props.onClick();assert.equal(h.calls.length,count);
  h.button('Забыли пароль?').props.onClick();h.respond({error:{status:429}});
  await h.render().props.onSubmit({preventDefault(){},currentTarget:{email:'test@example.test'}});assert.ok(h.nodes().some(n=>n.props?.children===authUx.authErrorMessage({status:429})));assert.equal(h.values.size,0);
  h.checkbox().props.onChange({target:{checked:true}});h.respond({data:{status:true}});await h.render().props.onSubmit({preventDefault(){},currentTarget:{email:' Test@Example.test '}});assert.equal(h.values.get(authUx.REMEMBERED_EMAIL_KEY),'test@example.test');assert.ok(h.nodes().some(n=>n.props?.children===authUx.RESET_NOTICE));
  h.button('Вернуться ко входу').props.onClick();h.button('Создать аккаунт').props.onClick();assert.equal(h.field('password').props.autoComplete,'new-password');
  h.respond({error:{status:500,message:'private internal detail'}});await h.render().props.onSubmit({preventDefault(){},currentTarget:{email:'test@example.test',password:'secret',name:'Test'}});assert.ok(h.nodes().some(n=>n.props?.children===authUx.authErrorMessage()));
  h.respond({data:{user:{}}});await h.render().props.onSubmit({preventDefault(){},currentTarget:{email:' Register@Example.test ',password:'secret',name:'Test'}});assert.equal(h.values.get(authUx.REMEMBERED_EMAIL_KEY),'register@example.test');assert.equal(h.calls.at(-1)[1].callbackURL,'/login?verified=1&returnTo=%2Fdashboard');assert.ok(h.writes.every(([key,value])=>key===authUx.REMEMBERED_EMAIL_KEY&&!value.includes('secret')));
 }finally{h.close();}
});
test('blocked localStorage is harmless; verification callbacks cannot redirect externally',()=>{
 const previous=globalThis.window;
 try{globalThis.window={get localStorage(){throw Error('blocked');}};assert.equal(authUx.readRememberedEmail(),'');assert.doesNotThrow(()=>authUx.rememberEmail('email@example.test',true));assert.doesNotThrow(()=>authUx.rememberEmail('',false));}finally{globalThis.window=previous;}
 for(const path of ['https://attacker.invalid','//attacker.invalid','/\\attacker.invalid','/api/auth/sign-out'])assert.equal(authUx.verificationReturnPath(path),'/login?verified=1&returnTo=%2Fdashboard');
 assert.equal(authUx.verificationReturnPath('/agent?tab=leads'),'/login?verified=1&returnTo=%2Fagent%3Ftab%3Dleads');
});
test('expired verification takes precedence over verified flag',()=>{const html=renderToStaticMarkup(React.createElement(load('app/login/credentials.tsx').Credentials,{returnTo:'/dashboard',verified:true,verificationError:true}));assert.match(html,/срок её действия истёк/);assert.doesNotMatch(html,/Теперь можно войти/);});

// Landing public routes must retain the existing auth and staging checkout guards.
test('landing V3 preserves public entry points and labels synthetic data',()=>{
 const html=renderToStaticMarkup(React.createElement(load('app/page.tsx').default));
 assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
 for(const route of ['/login','/checkout','/agents','/agent','/admin','/privacy','/offer','/consent'])assert.ok(html.includes('href="'+route+'"'));
 for(const id of ['how','product','pricing','faq'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/синтетических данных/);assert.match(html,/не являются банковским решением/);
 assert.match(html,/aria-controls="landing-navigation"/);assert.match(html,/aria-label="Остановить движение"/);
 assert.equal((html.match(/<details>/g)||[]).length,6);
});
