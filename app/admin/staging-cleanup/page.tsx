import { notFound } from 'next/navigation';
import { getChatGPTUser } from '../../chatgpt-auth';
import { ADMIN, ORIGIN } from '../../../lib/staging-cleanup';
import Panel from './panel';
export const dynamic='force-dynamic';
export default async function Page(){const u=await getChatGPTUser();if(process.env.PRESCORE_BASE_URL!==ORIGIN||u?.email!==ADMIN||!u.roles.includes('ADMIN'))notFound();return <Panel/>;}
