import {cp,mkdir} from 'node:fs/promises';
// The same immutable standalone artifact carries app, worker, migrations and recovery CLI.
for(const p of ['lib/db','lib/release','lib/billing','lib/platform/environment.ts','lib/storage','scripts/platform','scripts/release','scripts/billing']){await mkdir('.next/standalone/'+p.split('/').slice(0,-1).join('/'),{recursive:true});await cp(p,'.next/standalone/'+p,{recursive:true});}
