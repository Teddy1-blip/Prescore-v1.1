import {clientUrl} from './workflow';
type Query=Record<string,string|string[]|undefined>;
export function previousAgentUrl(query:Query){
  const v=typeof query.view==='string'?query.view:'';
  const id=typeof query.analysisId==='string'?query.analysisId:'';
  const parts:Record<string,string>={home:'',analysis:'credit-profile',banking:'finance',obligations:'credit-profile',documents:'documents',applications:'applications',financing:'financing'};
  if(id){
    const old=typeof query.dossierView==='string'?query.dossierView:'home';
    const params=new URLSearchParams({analysisId:id});
    if(old==='obligations')params.set('section','obligations');
    else if(typeof query.section==='string')params.set('section',query.section);
    return clientUrl(id,v==='documents'?'documents':parts[old]??'')+'?'+params;
  }
  const routes:Record<string,string>={home:'/agent',clients:'/agent/clients',applications:'/agent/applications',documents:'/agent/documents',
    pipeline:'/agent/pipeline',partners:'/agent/network',partnership:'/agent/network',billing:'/agent/commissions'};
  if(!Object.hasOwn(routes,v))return null;
  const p=new URLSearchParams();
  for(const key of ['page','billingPage','filter'])if(typeof query[key]==='string')p.set(key,query[key]);
  return routes[v]+(p.size?'?'+p:'');
}
