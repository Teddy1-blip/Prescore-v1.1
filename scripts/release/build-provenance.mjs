import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const PROVENANCE_VERSION='PRESCORE-BUILD-PROVENANCE-1';
export const INPUT_SCOPE='PRESCORE-SOURCE-INPUTS-1';
export const INPUT_ROOTS=['app','lib','public','scripts','db','types','tests'];
export const INPUT_FILES=['package.json','package-lock.json','Dockerfile','.dockerignore','.npmrc','next.config.ts','tsconfig.json','postcss.config.mjs','eslint.config.mjs','proxy.ts','amvera.yml'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const preparedPath=root=>path.join(root,'.prescore-build','inputs.json');
export function fingerprintInputs(root){
 const files=[];
 function walk(relative){
  const file=path.join(root,relative),stat=fs.lstatSync(file);
  if(stat.isSymbolicLink())throw Error('BUILD_INPUT_SYMLINK:'+relative);
  if(stat.isDirectory())for(const name of fs.readdirSync(file).sort())walk(relative+'/'+name);
  else if(stat.isFile())files.push({path:relative,sha256:sha(fs.readFileSync(file))});
  else throw Error('BUILD_INPUT_TYPE:'+relative);
 }
 for(const required of ['app','package.json','package-lock.json','Dockerfile'])if(!fs.existsSync(path.join(root,required)))throw Error('BUILD_INPUT_MISSING:'+required);
 for(const item of [...INPUT_ROOTS,...INPUT_FILES])if(fs.existsSync(path.join(root,item)))walk(item);
 files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 return {scope:INPUT_SCOPE,algorithm:'SHA256_PATH_CONTENT_JSON',sha256:sha(JSON.stringify(files)),fileCount:files.length,lockSha256:files.find(f=>f.path==='package-lock.json').sha256,files};
}
function checkout(root,inputs){
 const git=args=>{const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:16*1024*1024});return r.status===0?r.stdout:null;};
 const commit=git(['rev-parse','HEAD'])?.trim(),tree=git(['rev-parse','HEAD^{tree}'])?.trim();
 const listing=git(['ls-tree','-rz','HEAD']);
 return verifyCheckout(root,inputs,{commit,tree,listing,status:git(['status','--porcelain','--untracked-files=normal'])});
}
// Pure verification seam: fixtures exercise Git output without requiring Git in the build image.
export function verifyCheckout(root,inputs,{commit,tree,listing,status}){
 if(!/^[a-f0-9]{40}$/.test(commit??'')||!/^[a-f0-9]{40}$/.test(tree??''))return {status:'UNAVAILABLE',commit:null,tree:null};
 const tracked=new Map((listing??'').split('\0').filter(Boolean).map(line=>{const tab=line.indexOf('\t');return [line.slice(tab+1),line.slice(0,tab).split(' ')];}));
 const match=inputs.files.every(f=>{
  const row=tracked.get(f.path),bytes=fs.readFileSync(path.join(root,f.path));
  return row?.[1]==='blob'&&createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')===row[2];
 });
 // Do not label a dirty checkout as its HEAD, even when the changed file is outside the scope.
 const clean=status==='';
 return match&&clean?{status:'MATCHED_LOCAL_CHECKOUT',commit,tree}:{status:'UNVERIFIED_DIRTY_CHECKOUT',commit:null,tree:null};
}
export function prepareProvenance(root=process.cwd()){
 const inputs=fingerprintInputs(root),value={version:PROVENANCE_VERSION,preparedAt:new Date().toISOString(),inputs,checkout:checkout(root,inputs)};
 fs.mkdirSync(path.dirname(preparedPath(root)),{recursive:true});
 fs.writeFileSync(preparedPath(root),JSON.stringify(value,null,2)+'\n');
 console.log(JSON.stringify({event:'BUILD_INPUTS_CAPTURED',version:value.version,scope:inputs.scope,sha256:inputs.sha256,lockSha256:inputs.lockSha256,fileCount:inputs.fileCount,checkout:value.checkout}));
 return value;
}
export function packageProvenance(root=process.cwd()){
 const before=JSON.parse(fs.readFileSync(preparedPath(root),'utf8')),now=fingerprintInputs(root);
 if(before.version!==PROVENANCE_VERSION||JSON.stringify(before.inputs)!==JSON.stringify(now))throw Error('BUILD_INPUTS_CHANGED_DURING_BUILD');
 const buildId=fs.readFileSync(path.join(root,'.next','BUILD_ID'),'utf8').trim();
 if(!buildId||!fs.existsSync(path.join(root,'.next','standalone','server.js')))throw Error('BUILD_ARTIFACT_REQUIRED');
 const value={...before,packagedAt:new Date().toISOString(),buildId,publishedImageDigest:null,runningImageDigest:null};
 const output=path.join(root,'.next','standalone','lib','release','build-provenance.json');
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(value,null,2)+'\n');
 console.log(JSON.stringify({event:'BUILD_PROVENANCE_PACKAGED',version:value.version,sourceFingerprint:now.sha256,buildId,checkout:value.checkout}));
 return value;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]!=='prepare'||process.argv.length!==3)throw Error('BUILD_PROVENANCE_COMMAND_INVALID');
 prepareProvenance();
}
