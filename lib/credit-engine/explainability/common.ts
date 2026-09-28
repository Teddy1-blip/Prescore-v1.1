export {id,stable,canonical,same,unique,weakest,rank,freeze,finiteTree,validDate} from '../recommendations/common.ts';
export const fail=(code:string):never=>{throw Error('EXPLAINABILITY_INVALID:'+code);};
export function at(root:unknown,path:string[]):unknown{let v:unknown=root;for(const k of path){if(k.startsWith('@')){const n=k.indexOf(':');const key=k.slice(1,n),value=k.slice(n+1);v=Array.isArray(v)?v.find(o=>o?.[key]===value):undefined;}else v=v&&typeof v==='object'?(v as Record<string,unknown>)[k]:undefined;}return v;}
export const location=(root:string,field:string,key:string,value:string)=>[root,field,'@'+key+':'+value];
