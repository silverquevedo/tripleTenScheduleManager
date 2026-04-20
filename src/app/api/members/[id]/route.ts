import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/admin';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const member = await prisma.programMember.findUnique({ where: { id: params.id } });
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.shift.deleteMany({
    where: { programId: member.programId, memberName: member.displayName },
  });
  await prisma.programMember.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
