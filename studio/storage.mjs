import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {digest,requireThat} from './methodology.mjs';
// Append-only server-side records, partitioned by authenticated principal.
// link() publishes a complete file atomically without replacing an existing revision.
export class FileStudioStore {
 constructor(root,owner){this.root=path.join(root,digest(owner));}
 async put(kind,value){
  const dir=path.join(this.root,kind),id=randomUUID();await fs.mkdir(dir,{recursive:true,mode:0o700});
  const temp=path.join(dir,'.'+id),target=path.join(dir,id+'.json');
  try{await fs.writeFile(temp,JSON.stringify(value),{flag:'wx',mode:0o600});await fs.link(temp,target);}finally{await fs.rm(temp,{force:true});}
  return id;
 }
 async get(kind,id){requireThat(/^[a-f0-9-]{36}$/.test(id),'Неизвестная версия');return JSON.parse(await fs.readFile(path.join(this.root,kind,id+'.json'),'utf8'));}
 async versions(){let files;try{files=await fs.readdir(path.join(this.root,'versions'));}catch(e){if(e.code==='ENOENT')return [];throw e;}
  const all=await Promise.all(files.filter(s=>s.endsWith('.json')&&!s.startsWith('.')).map(async s=>{const id=s.slice(0,-5),v=await this.get('versions',id);return {id,name:v.draft.name,revision:v.draft.revision,at:v.at,state:v.run?'VALIDATED':'DRAFT',company:v.draft.scenario.company};}));return all.sort((a,b)=>b.at.localeCompare(a.at));}
}
