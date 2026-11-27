import { redirect } from 'next/navigation';
import { requireChatGPTUser } from '../chatgpt-auth';
import AdminDashboard from '../admin/admin-dashboard';
import '../admin/admin.css';
import '../prescore-ui-v1.css';

export const dynamic = 'force-dynamic';
export const metadata = {robots: {index: false, follow: false}};

export default async function ControlPage() {
  const user = await requireChatGPTUser('/prescore-control');
  if (!user.roles.includes('ADMIN')) redirect('/dashboard');
  return <AdminDashboard />;
}
