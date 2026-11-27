import {validateEnvironment, ENVIRONMENT_CONTRACT_VERSION} from '../../lib/platform/environment.ts';
// Intentionally offline: no pool, SMTP transport, verification or email send.
const issues = validateEnvironment(process.env);
console.log(JSON.stringify({version: ENVIRONMENT_CONTRACT_VERSION, mode:'OFFLINE_NO_SEND', valid:issues.length === 0, issues}, null, 2));
if (issues.length) process.exitCode = 1;
