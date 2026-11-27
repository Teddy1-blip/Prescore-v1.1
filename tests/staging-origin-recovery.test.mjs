import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingFullAccessEnabled} from '../lib/platform/staging-access.ts';
import {resolveAnalysisTier} from '../lib/entitlements.ts';
const current='https://prescore-staging-dorogovab.msk1.amvera.tech';
const legacy='https://prescore-staging-dorogovab.amvera.io';
const rc={PRESCORE_RUNTIME_MODE:'release-candidate',PRESCORE_STAGING_FREE_FULL:'1',PRESCORE_BASE_URL:current};
for(const origin of [current,legacy,current+'/',legacy+'/'])test(`explicit RC test access recognizes ${origin}`,()=>{assert.equal(stagingFullAccessEnabled({...rc,PRESCORE_BASE_URL:origin}),true);});
for(const mode of [undefined,'production','development','test','staging','RELEASE-CANDIDATE'])test(`non-RC mode ${mode} never enables test FULL`,()=>{assert.equal(stagingFullAccessEnabled({...rc,PRESCORE_RUNTIME_MODE:mode}),false);});
for(const flag of [undefined,'0','true','yes'])test(`test FULL flag ${flag} fails closed`,()=>{assert.equal(stagingFullAccessEnabled({...rc,PRESCORE_STAGING_FREE_FULL:flag}),false);});
for(const origin of ['https://prescore.ru',current+'.evil.invalid',current+'/dashboard',current+'?x=1',current+'#anything',current.replace('https:','http:'),current.replace('https://','https://user:password@'),current+':8443','https://evil.invalid/?next='+current,'not a URL',''])test(`unapproved or non-origin URL ${origin} fails closed`,()=>{assert.equal(stagingFullAccessEnabled({...rc,PRESCORE_BASE_URL:origin}),false);});
test('current staging grants only temporary owned access; production and flag removal do not preserve it',async()=>{
 const saved=Object.fromEntries(Object.keys(rc).map(k=>[k,process.env[k]])),queries=[];let writes=0;
 const db={prepare(sql){let args;queries.push(sql);return{bind(...values){args=values;return this;},run:async()=>{writes++;},first:async()=>sql.startsWith('SELECT id FROM analyses')&&args[0]==='owned'&&args[1]==='owner@example.test'?{id:'owned'}:null};}};
 const input={analysisId:'owned',userEmail:'owner@example.test',companyInn:'9900000012',readOnly:true};
 try{
  Object.assign(process.env,rc);
  assert.equal(await resolveAnalysisTier(db,input),'FULL');assert.equal(writes,0);
  assert.equal(await resolveAnalysisTier(db,{...input,analysisId:'someone-else'}),'FREE');
  assert.equal(await resolveAnalysisTier(db,{...input,userEmail:'other@example.test'}),'FREE');
  process.env.PRESCORE_RUNTIME_MODE='production';assert.equal(await resolveAnalysisTier(db,input),'FREE');
  process.env.PRESCORE_RUNTIME_MODE='release-candidate';process.env.PRESCORE_STAGING_FREE_FULL='0';assert.equal(await resolveAnalysisTier(db,input),'FREE');
  assert.equal(writes,0);assert.ok(queries.every(sql=>sql.startsWith('SELECT')));
 }finally{for(const [key,value]of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
