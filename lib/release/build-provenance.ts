import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

export type PackagedProvenance={version:'PRESCORE-BUILD-PROVENANCE-1';preparedAt:string;packagedAt:string;buildId:string;inputs:{scope:'PRESCORE-SOURCE-INPUTS-1';algorithm:'SHA256_PATH_CONTENT_JSON';sha256:string;lockSha256:string;fileCount:number;files:{path:string;sha256:string}[]};checkout:{status:'MATCHED_LOCAL_CHECKOUT'|'UNAVAILABLE'|'UNVERIFIED_DIRTY_CHECKOUT';commit:string|null;tree:string|null}};
const hex64=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const hex40=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
export function readPackagedProvenance(file:string):PackagedProvenance|null{
 try{
  const m=JSON.parse(readFileSync(file,'utf8')) as PackagedProvenance;
  if(m.version!=='PRESCORE-BUILD-PROVENANCE-1'||m.inputs.scope!=='PRESCORE-SOURCE-INPUTS-1'||m.inputs.algorithm!=='SHA256_PATH_CONTENT_JSON'||!hex64(m.inputs.sha256)||!hex64(m.inputs.lockSha256)||!Array.isArray(m.inputs.files)||m.inputs.fileCount!==m.inputs.files.length)return null;
  const files=m.inputs.files;
  if(files.some((f,i)=>typeof f.path!=='string'||!hex64(f.sha256)||(i>0&&files[i-1].path>=f.path)))return null;
  if(createHash('sha256').update(JSON.stringify(files)).digest('hex')!==m.inputs.sha256||files.find(f=>f.path==='package-lock.json')?.sha256!==m.inputs.lockSha256)return null;
  if(!m.buildId||typeof m.buildId!=='string'||m.buildId.length>200||!Number.isFinite(Date.parse(m.preparedAt))||!Number.isFinite(Date.parse(m.packagedAt)))return null;
  if(m.checkout.status==='MATCHED_LOCAL_CHECKOUT'){if(!hex40(m.checkout.commit)||!hex40(m.checkout.tree))return null;}
  else if(!['UNAVAILABLE','UNVERIFIED_DIRTY_CHECKOUT'].includes(m.checkout.status)||m.checkout.commit!==null||m.checkout.tree!==null)return null;
  return m;
 }catch{return null;}
}
// Fixed artifact path, read once. No runtime environment variable chooses data or identity.
export const packagedProvenance=readPackagedProvenance(join(process.cwd(),'lib','release','build-provenance.json'));
