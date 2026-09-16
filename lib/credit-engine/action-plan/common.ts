export {id,stable,canonical,same,unique,weakest,rank,freeze,finiteTree,validDate} from '../recommendations/common.ts';
import {validDate} from '../recommendations/common.ts';
export const fail=(code:string):never=>{throw Error('ACTION_PLAN_INPUT_INVALID:'+code);};
export function checkpointDate(date:string,days:number):string{if(!validDate(date))fail('ASOF_DATE');const d=new Date(date+'T00:00:00.000Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export const CHECKPOINT_WARNING='PRESCORE_ANALYTICAL_CHECKPOINT_NOT_LEGAL_DEADLINE';
