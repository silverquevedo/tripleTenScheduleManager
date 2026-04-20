import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/admin';

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { programId, memberName } = await request.json();
  if (!programId) {
    return NextResponse.json({ error: 'programId required' }, { status: 400 });
  }

  const where = memberName ? { programId, memberName } : { programId };
  const result = await prisma.shift.deleteMany({ where });
  return NextResponse.json({ deleted: result.count });
}
