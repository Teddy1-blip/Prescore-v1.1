import fs from 'node:fs';
import {fingerprintInputs} from '../release/build-provenance.mjs';

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
 '.next/standalone/lib/release/build-provenance.json',
 '.next/standalone/lib/db/migrations/0009_analysis_archive.sql',
 '.next/standalone/lib/db/migrations/0010_decision_revisions.sql',
 '.next/standalone/lib/db/migrations/0011_company_dossiers.sql',
];
const missing=required.filter(file=>!fs.existsSync(file));
if(missing.length)throw Error('RUNTIME_ARTIFACT_MISSING:'+missing.join(','));
const provenance=JSON.parse(fs.readFileSync('.next/standalone/lib/release/build-provenance.json','utf8'));
if(JSON.stringify(provenance.inputs)!==JSON.stringify(fingerprintInputs(process.cwd())))throw Error('RUNTIME_ARTIFACT_SOURCE_MISMATCH');
if(provenance.buildId!==fs.readFileSync('.next/BUILD_ID','utf8').trim())throw Error('RUNTIME_ARTIFACT_BUILD_ID_MISMATCH');
console.log(JSON.stringify({status:'VALID',standalone:true,runtimeAssets:required.length,schema:'0011_company_dossiers.sql'}));
