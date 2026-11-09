import {cp,mkdir} from 'node:fs/promises';
import {packageProvenance} from './build-provenance.mjs';
// The same immutable standalone artifact carries app, worker, migrations and recovery CLI.
for(const p of ['lib/db','lib/release','lib/billing','lib/platform/environment.ts','lib/storage','scripts/platform','scripts/release','scripts/billing']){await mkdir('.next/standalone/'+p.split('/').slice(0,-1).join('/'),{recursive:true});await cp(p,'.next/standalone/'+p,{recursive:true});}

// Ship the internal, opt-in synthetic Vision probe; the web service never starts it.
for(const p of ['scripts/document-poc.mjs','node_modules/fflate','lib/document-poc','lib/ai/providers/index.ts',
  'lib/credit-engine/server/document-extraction.ts','lib/credit-engine/contracts/financial-statements.ts',
  ...['integrity','periods','normalizer'].map(name=>'lib/credit-engine/financial-analysis/'+name+'.ts')]){
  await mkdir('.next/standalone/'+p.split('/').slice(0,-1).join('/'),{recursive:true});
  await cp(p,'.next/standalone/'+p,{recursive:true});
}

// Next standalone excludes browser assets; keep every launch path self-contained.
await cp('.next/static','.next/standalone/.next/static',{recursive:true});
await cp('public','.next/standalone/public',{recursive:true});
packageProvenance();
