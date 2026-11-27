// Use the actual App Router page and nested layouts in the isolated browser fixture.
// The protected outer layout is exercised by broker-connection and the Next build.
import fs from 'node:fs';
import path from 'node:path';
export function agentFixtureRoutes(root){
  const base=path.join(root,'app/agent');
  const files=fs.readdirSync(base,{recursive:true})
    .map(file=>file.split(path.sep).join('/'))
    .filter(file=>path.posix.basename(file)==='page.tsx').sort();
  const imports=["import {AgentShell} from './app/agent/_components/shell.tsx';"];
  const routes=files.map((file,i)=>{
    const dir=path.posix.dirname(file),route='/agent'+(dir==='.'?'':'/'+dir);
    imports.push("import Page"+i+" from './app/agent/"+file+"';");
    const layout=dir.includes('[')?dir.split('/').slice(0,2).join('/'):null;
    if(layout)imports.push("import Layout"+i+" from './app/agent/"+layout+"/layout.tsx';");
    const fileText=fs.readFileSync(path.join(base,file),'utf8');
    return '{path:'+JSON.stringify(route)+',page:Page'+i+',server:'+(/export default async|from 'next\/navigation'/.test(fileText)?'true':'false')+',layout:'+(layout?'Layout'+i:'null')+'}';
  });
  return imports.join('\n')+`
    const agentRoutes=[${routes.join(',')}];
    async function agentFixture(){
      const actual=location.pathname.split('/');
      for(const route of agentRoutes){
        const parts=route.path.split('/');if(parts.length!==actual.length)continue;
        const params={};if(!parts.every((s,i)=>{if(s.startsWith('[')){params[s.slice(1,-1)]=decodeURIComponent(actual[i]);return true;}return s===actual[i];}))continue;
        const props={params:Promise.resolve(params),searchParams:Promise.resolve(Object.fromEntries(new URLSearchParams(location.search)))};
        let content=route.server?await route.page(props):React.createElement(route.page);
        if(route.layout)content=await route.layout({...props,children:content});
        return React.createElement(AgentShell,null,content);
      }
      throw Error('Missing fixture route '+location.pathname);
    }`;
}
