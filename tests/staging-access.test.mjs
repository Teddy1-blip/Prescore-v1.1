import test from 'node:test';
import assert from 'node:assert/strict';
import { stagingFullAccessEnabled } from '../lib/platform/staging-access.ts';
import { resolveAnalysisTier } from '../lib/entitlements.ts';
const origin = 'https://prescore-staging-dorogovab.amvera.io';
test('free FULL requires explicit RC mode, flag and exact staging origin', () => {
  for (const env of [{}, {PRESCORE_BASE_URL:origin}, {PRESCORE_STAGING_FREE_FULL:'1'},
    {PRESCORE_STAGING_FREE_FULL:'1',PRESCORE_BASE_URL:'https://prescore.ru'},
    {PRESCORE_STAGING_FREE_FULL:'0',PRESCORE_BASE_URL:origin},
    {PRESCORE_STAGING_FREE_FULL:'1',PRESCORE_BASE_URL:origin+'.evil.invalid'}]) {
    assert.equal(stagingFullAccessEnabled(env), false);
  }
  assert.equal(stagingFullAccessEnabled({PRESCORE_RUNTIME_MODE:'release-candidate',PRESCORE_STAGING_FREE_FULL:'1',PRESCORE_BASE_URL:origin}),true);
});
test('staging FULL is temporary, owner-scoped and does not write paid entitlements', async () => {
  const saved = {flag:process.env.PRESCORE_STAGING_FREE_FULL,base:process.env.PRESCORE_BASE_URL,mode:process.env.PRESCORE_RUNTIME_MODE};
  let writes=0;
  const db={prepare(sql){let args;return {bind(...v){args=v;return this;},async run(){writes++;},async first(){
    if(sql.startsWith('SELECT id FROM analyses')) return args[0]==='owned' && args[1]==='client@example.test' ? {id:'owned'}:null;
    return null;
  }}}};
  try {
    process.env.PRESCORE_RUNTIME_MODE='release-candidate';process.env.PRESCORE_STAGING_FREE_FULL='1';process.env.PRESCORE_BASE_URL=origin;
    const input={analysisId:'owned',userEmail:'client@example.test',companyInn:'123'};
    assert.equal(await resolveAnalysisTier(db,input),'FULL');assert.equal(writes,0);
    assert.equal(await resolveAnalysisTier(db,{...input,analysisId:'other'}),'FREE');
    process.env.PRESCORE_STAGING_FREE_FULL='0';
    assert.equal(await resolveAnalysisTier(db,input),'FREE');
  } finally {
    for(const [key,value] of [['PRESCORE_STAGING_FREE_FULL',saved.flag],['PRESCORE_BASE_URL',saved.base],['PRESCORE_RUNTIME_MODE',saved.mode]]) {
      if(value===undefined) delete process.env[key];else process.env[key]=value;
    }
  }
});

import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
test('checkout bypass preserves selected analysis and still requires login; disabled mode renders checkout', async () => {
  let enabled=true, loggedIn=true, requiredTarget;
  const code=ts.transpileModule(fs.readFileSync('app/checkout/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};
  new Function('exports','require',code)(exports,name=>{
    // This test verifies routing/auth decisions, not React rendering.
    if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
    if(name==='next/navigation')return {redirect(target){throw new Error('REDIRECT:'+target);}};
    if(name.includes('staging-access'))return {stagingFullAccessEnabled:()=>enabled};
    if(name.includes('chatgpt-auth'))return {async requireChatGPTUser(target){requiredTarget=target;if(!loggedIn)throw new Error('LOGIN_REQUIRED');}};
    if(name==='./checkout-form')return {default:function CheckoutForm(){}};
    return require(name);
  });
  const input={searchParams:Promise.resolve({analysisId:'owned/one'})};
  await assert.rejects(exports.default(input),{message:'REDIRECT:/dashboard?view=report&analysisId=owned%2Fone'});
  assert.equal(requiredTarget,'/dashboard?view=report&analysisId=owned%2Fone');
  loggedIn=false;await assert.rejects(exports.default(input),{message:'LOGIN_REQUIRED'});
  enabled=false;requiredTarget=undefined;
  const result=await exports.default(input);assert.equal(result.type.name,'CheckoutForm');assert.equal(requiredTarget,undefined);
});
