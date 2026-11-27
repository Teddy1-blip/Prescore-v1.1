import test from 'node:test';
import assert from 'node:assert/strict';
import {dossierAnalysisCatalog} from '../lib/workspace/dossier.ts';

test('dossier catalog keeps source-only analyses selectable without listing them as bank versions',async()=>{
 const rows=[
  {id:'source-only',name:'Company',start:'2025-01-01',end:'2025-12-31',payload:JSON.stringify({
   sourceManifest:{bankStatements:[]},transactions:[],metrics:{transactions:0},
  })},
  {id:'bank-v2',name:'Company',start:'2025-01-01',end:'2025-12-31',payload:JSON.stringify({
   sourceManifest:{bankStatements:[{sourceId:'statement-1'}]},transactions:[],metrics:{transactions:0},
  })},
  {id:'bank-legacy',name:'Company',start:'2024-01-01',end:'2024-12-31',payload:JSON.stringify({
   transactions:[{date:'2024-01-01'}],metrics:{transactions:1},
  })},
 ];
 let requested;
 const catalog=await dossierAnalysisCatalog({query:async(sql,values)=>{
  requested={sql,values};
  return {rows};
 }},'owner@example.test','9900000012');

 assert.deepEqual(requested.values,['owner@example.test','9900000012']);
 assert.deepEqual(catalog.analysisIds,['source-only','bank-v2','bank-legacy']);
 assert.deepEqual(catalog.versions.map(v=>v.id),['bank-v2','bank-legacy']);
 assert.equal(Object.hasOwn(catalog.versions[0],'payload'),false);
});

test('dossier catalog surfaces invalid saved payloads instead of silently classifying them',async()=>{
 await assert.rejects(dossierAnalysisCatalog({query:async()=>({rows:[{
  id:'invalid',name:'Company',start:'',end:'',payload:'{',
 }]})},'owner@example.test','9900000012'),SyntaxError);
});
