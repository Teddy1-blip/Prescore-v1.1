import {CONTEXT_RULES_VERSION,type ContextRule,type ContextFactV1} from '../../contracts/context.ts';
export const n=(fs:ContextFactV1[],code:string)=>Number(fs.find(f=>f.semanticCode===code)?.value);
export const v=(fs:ContextFactV1[],code:string)=>fs.find(f=>f.semanticCode===code)?.value;
export function rule(code:string,domain:ContextRule['domain'],effect:ContextRule['effect'],requiredInputs:string[],targetRiskCodes:string[],calculationBasis:string,evaluate:ContextRule['evaluate']=()=>true,perSubject=false):ContextRule{return {code:`CTX-${code}`,version:CONTEXT_RULES_VERSION,domain,effect,requiredInputs,targetRiskCodes,calculationBasis,evaluate,perSubject};}
