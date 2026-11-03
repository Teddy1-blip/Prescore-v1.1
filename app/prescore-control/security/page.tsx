import {redirect} from 'next/navigation';
import {requireChatGPTUser} from '../../chatgpt-auth';
import {AdminSecurity} from './security-client';
import '../../prescore-ui-v1.css';
import '../../admin/admin.css';

export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function AdminSecurityPage(){
 const user=await requireChatGPTUser('/prescore-control/security');
 if(!user.adminMfa)redirect('/dashboard');
 return <main className="ad-security"><a href="/prescore-control">Управление Prescore</a><h1>Защита административного доступа</h1><AdminSecurity state={user.adminMfa}/><a href="/logout">Выйти</a></main>;
}
