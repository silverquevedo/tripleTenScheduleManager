import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { AdminPage } from '@/components/AdminPage';

export default async function AdminRoute() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!(await isAdmin(session.user?.email))) redirect('/');
  return <AdminPage />;
}
