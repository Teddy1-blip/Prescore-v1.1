import {ApplicationsPage} from '../_components/lists';
export default async function Page({searchParams}:{searchParams:Promise<{action?:string;filter?:string}>}){
  const q=await searchParams;
  return <ApplicationsPage initialFilter={q.filter} create={q.action==='new'}/>;
}
