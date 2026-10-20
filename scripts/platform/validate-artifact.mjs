import fs from 'node:fs';

const required=[
 '.next/BUILD_ID',
 '.next/server/app-paths-manifest.json',
 '.next/standalone/server.js',
 '.next/standalone/scripts/release/start.mjs',
 '.next/standalone/scripts/release/startup-diagnostic.mjs',
 '.next/standalone/scripts/platform/db-migrate.mjs',
 '.next/standalone/scripts/billing/payout-worker.mjs',
 '.next/standalone/scripts/release/backup.mjs',
 '.next/standalone/scripts/release/analysis-archive.mjs',
 '.next/standalone/lib/release/migrations.ts',
 '.next/standalone/lib/release/analysis-archive.ts',
 '.next/standalone/lib/db/migrations/0009_analysis_archive.sql',
];
const missing=required.filter(file=>!fs.existsSync(file));
if(missing.length)throw Error('RUNTIME_ARTIFACT_MISSING:'+missing.join(','));
console.log(JSON.stringify({status:'VALID',standalone:true,runtimeAssets:required.length,schema:'0009_analysis_archive.sql'}));
