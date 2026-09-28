export {id,stable,unique,weakest,rank,validDate} from '../index/common.ts';
export {freeze,finiteTree} from '../readiness/common.ts';
import {stable} from '../index/common.ts';
// All arrays in these canonical projection records are unordered sets of references,
// facts, reasons or evidence; their source records themselves remain unmodified.
export function canonical<T>(v:T):T{if(Array.isArray(v))return v.map(canonical).sort((a,b)=>stable(a).localeCompare(stable(b))) as T;if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical((v as Record<string,unknown>)[k])])) as T;return v;}
export const same=(a:unknown,b:unknown)=>stable(canonical(a))===stable(canonical(b));
