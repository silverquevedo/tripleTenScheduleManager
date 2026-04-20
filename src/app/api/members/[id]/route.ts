import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/admin';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { color } = await request.json();
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return NextResponse.json({ error: 'Valid hex color required' }, { status: 400 });
  }

  // Try User first, then AdminEmail
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (user) {
    await prisma.user.update({ where: { id: params.id }, data: { color } });
    return NextResponse.json({ success: true });
  }

  const adminEntry = await prisma.adminEmail.findUnique({ where: { id: params.id } });
  if (adminEntry) {
    await prisma.adminEmail.update({ where: { id: params.id }, data: { color } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Try User first
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (user) {
    if (user.defaultProgramId && user.name) {
      await prisma.shift.deleteMany({
        where: { programId: user.defaultProgramId, memberName: user.name },
      });
    }
    await prisma.user.update({ where: { id: params.id }, data: { defaultProgramId: null } });
    return NextResponse.json({ success: true });
  }

  // Try AdminEmail (pending user)
  const adminEntry = await prisma.adminEmail.findUnique({ where: { id: params.id } });
  if (adminEntry) {
    // Derive their display name and delete any shifts assigned to them
    if (adminEntry.defaultProgramId) {
      const displayName = adminEntry.email.split('@')[0]
        .split('.')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
      await prisma.shift.deleteMany({
        where: { programId: adminEntry.defaultProgramId, memberName: displayName },
      });
    }
    await prisma.adminEmail.update({ where: { id: params.id }, data: { defaultProgramId: null, color: null } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
