import {redirect} from 'next/navigation';
import {previousAgentUrl} from '../../lib/agent/legacy-links';
import {AgentDesk} from './_components/desk';
export default async function AgentHome({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const dest=previousAgentUrl(await searchParams);
  if(dest)redirect(dest);
  return <AgentDesk/>;
}
