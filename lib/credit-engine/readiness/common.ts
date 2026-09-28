export {id,stable,validDate,unique,weakest,rank} from '../index/common.ts';
import {stable} from '../index/common.ts';
export function freeze<T>(x:T):T{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
export function canonicalClone<T>(x:T):T{return JSON.parse(stable(x)) as T;}
export function finiteTree(x:unknown):void{if(typeof x==='number'&&!Number.isFinite(x))throw Error('READINESS_INPUT_INVALID:NONFINITE');if(x&&typeof x==='object')Object.values(x).forEach(finiteTree);}
export const levelRank={UNKNOWN:-1,NOT_READY:-1,LOW:0,MEDIUM:1,HIGH:2};
