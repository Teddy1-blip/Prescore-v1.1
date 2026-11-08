import {AssistantPage} from '../_components/assistant';
export default async function Page({searchParams}:{searchParams:Promise<{client?:string;analysisId?:string}>}){
  const q=await searchParams;
  return <AssistantPage client={q.client} analysisId={q.analysisId}/>;
}
