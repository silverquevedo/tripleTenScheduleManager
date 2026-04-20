import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { SettingsPage } from '@/components/SettingsPage';

export default async function SettingsRoute() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!(await isAdmin(session.user?.email))) redirect('/');
  return <SettingsPage />;
}
