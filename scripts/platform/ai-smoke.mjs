import {configuredProvider} from '../../lib/ai/providers/index.ts';
try {
 const provider=configuredProvider();
 const result=provider?await provider.health():{available:false,reason:'AI_CONFIGURATION_MISSING'};
 console.log(JSON.stringify(result));if(!result.available)process.exitCode=1;
}catch{console.log(JSON.stringify({available:false,reason:'AI_CONFIGURATION_INVALID'}));process.exitCode=1;}
