import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {getAuthSession} from '../../lib/auth/server';
export const dynamic='force-dynamic';
export default async function AdminPage() {
  if(process.env.NODE_ENV!=='development'||process.env.PRESCORE_STUDIO_INTERNAL!=='1')notFound();
  const session=await getAuthSession(new Headers(await headers()));
  if(!session?.user.roles.includes('ADMIN'))notFound();
  return <main><h1>Администрирование Prescore</h1><a href="/admin/studio">Prescore Studio</a></main>;
}
