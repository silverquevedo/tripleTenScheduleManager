import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/admin';

const COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#65a30d',
  '#0284c7', '#ea580c', '#14b8a6', '#8b5cf6',
];

async function assignColor(programId: string): Promise<string> {
  const count = await prisma.user.count({ where: { defaultProgramId: programId } });
  return COLORS[count % COLORS.length];
}

export const dynamic = 'force-dynamic';

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

  const adminEmailMap = new Map(adminEmails.map((a) => [a.email, a]));
  const registeredEmails = new Set(users.map((u) => u.email ?? ''));

  const registeredUsers = users.map((u) => {
    const record = adminEmailMap.get(u.email ?? '');
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      isAdmin: !!record,
      isManager: record?.isManager ?? false,
      defaultProgramId: u.defaultProgramId ?? null,
    };
  });

  const pendingAdmins = adminEmails
    .filter((a) => !registeredEmails.has(a.email))
    .map((a) => ({
      email: a.email,
      defaultProgramId: a.defaultProgramId ?? null,
      isManager: a.isManager,
      isLeadInstructor: a.isLeadInstructor,
    }));

  return NextResponse.json({ registeredUsers, pendingAdmins });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, grant, grantManager, defaultProgramId } = await request.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // Update default program — any admin can do this
  if (defaultProgramId !== undefined) {
    const value = defaultProgramId || null;
    // Auto-assign a color if the user doesn't have one and is being added to a program
    if (value) {
      const user = await prisma.user.findFirst({ where: { email } });
      if (user && !user.color) {
        const color = await assignColor(value);
        await prisma.user.updateMany({ where: { email }, data: { defaultProgramId: value, color } });
      } else {
        await prisma.user.updateMany({ where: { email }, data: { defaultProgramId: value } });
      }
    } else {
      await prisma.user.updateMany({ where: { email }, data: { defaultProgramId: value } });
    }
    await prisma.adminEmail.updateMany({ where: { email }, data: { defaultProgramId: value } });
    return NextResponse.json({ success: true });
  }

  // Manager promotion/demotion — managers only
  if (grantManager !== undefined) {
    if (!session.user?.isManager) {
      return NextResponse.json({ error: 'Only managers can change manager status' }, { status: 403 });
    }
    if (email === session.user?.email) {
      return NextResponse.json({ error: 'Cannot change your own manager status' }, { status: 400 });
    }
    if (grantManager) {
      await prisma.adminEmail.upsert({
        where: { email },
        update: { isManager: true },
        create: { email, isManager: true },
      });
    } else {
      // Revoke manager → keep as lead instructor
      await prisma.adminEmail.updateMany({ where: { email }, data: { isManager: false } });
    }
    return NextResponse.json({ success: true });
  }

  // Lead instructor grant/revoke — managers only
  if (!session.user?.isManager) {
    return NextResponse.json({ error: 'Only managers can change roles' }, { status: 403 });
  }
  if (!grant && email === session.user?.email) {
    return NextResponse.json({ error: 'Cannot revoke your own role' }, { status: 400 });
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

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  if (email === session.user?.email) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }

  // Lead instructors can only remove instructors (non-admins)
  if (!session.user?.isManager) {
    const targetIsAdmin = await isAdmin(email);
    if (targetIsAdmin) {
      return NextResponse.json({ error: 'Only managers can remove admins' }, { status: 403 });
    }
  }

  await prisma.user.deleteMany({ where: { email } });
  await prisma.adminEmail.deleteMany({ where: { email } });

  return NextResponse.json({ success: true });
}
