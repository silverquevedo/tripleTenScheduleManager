import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import { isSuperAdmin } from '@/lib/super-admins';

/** GET /api/admin/users
 *  Returns registered users with isAdmin status + pending admin emails not yet signed in.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [users, adminEmails] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
    prisma.adminEmail.findMany(),
  ]);

  const adminEmailSet = new Set(adminEmails.map((a) => a.email));
  const registeredEmails = new Set(users.map((u) => u.email ?? ''));

  const registeredUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    isAdmin: adminEmailSet.has(u.email ?? ''),
    defaultProgramId: u.defaultProgramId ?? null,
  }));

  const pendingAdmins = adminEmails
    .filter((a) => !registeredEmails.has(a.email))
    .map((a) => ({ email: a.email, defaultProgramId: a.defaultProgramId ?? null }));

  return NextResponse.json({ registeredUsers, pendingAdmins });
}

/** PATCH /api/admin/users
 *  Body: { email: string; grant: boolean }
 *  Grants or revokes admin role for the given email.
 */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, grant, defaultProgramId } = await request.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // Update default program — any admin can do this
  if (defaultProgramId !== undefined) {
    const value = defaultProgramId || null;
    // Update User record if they have signed in
    await prisma.user.updateMany({ where: { email }, data: { defaultProgramId: value } });
    // Also update AdminEmail so pending users have it ready for first login
    await prisma.adminEmail.updateMany({ where: { email }, data: { defaultProgramId: value } });
    return NextResponse.json({ success: true });
  }

  // Role changes — only super admins
  if (!isSuperAdmin(session.user?.email)) {
    return NextResponse.json({ error: 'Only super admins can change roles' }, { status: 403 });
  }

  // Prevent removing your own admin
  if (!grant && email === session.user?.email) {
    return NextResponse.json({ error: 'Cannot revoke your own admin role' }, { status: 400 });
  }

  if (grant) {
    await prisma.adminEmail.upsert({
      where: { email },
      update: {},
      create: { email },
    });
  } else {
    await prisma.adminEmail.deleteMany({ where: { email } });
  }

  return NextResponse.json({ success: true });
}

/** DELETE /api/admin/users
 *  Body: { email: string }
 *  Removes a user entirely (User row + AdminEmail row). Super admins only.
 */
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSuperAdmin(session.user?.email)) {
    return NextResponse.json({ error: 'Only super admins can remove users' }, { status: 403 });
  }

  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  if (email === session.user?.email) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }

  await prisma.user.deleteMany({ where: { email } });
  await prisma.adminEmail.deleteMany({ where: { email } });

  return NextResponse.json({ success: true });
}
