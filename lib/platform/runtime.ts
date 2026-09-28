import {getDatabase} from '../db/client.ts';
export function getRuntime(){return {...process.env,DB:getDatabase()};}
