import fs from'node:fs';for(const f of ['.next/BUILD_ID','.next/server/app-paths-manifest.json','.next/standalone/server.js'])if(!fs.existsSync(f))throw Error('NEXT_ARTIFACT_MISSING:'+f);
console.log('Validated standalone Next server artifact; no worker binding required.');
