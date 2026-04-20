import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isSuperAdmin } from '@/lib/super-admins';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [programs, userCounts, adminCounts] = await Promise.all([
    prisma.program.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.groupBy({
      by: ['defaultProgramId'],
      _count: { _all: true },
      where: { defaultProgramId: { not: null } },
    }),
    prisma.adminEmail.groupBy({
      by: ['defaultProgramId'],
      _count: { _all: true },
      where: { defaultProgramId: { not: null } },
    }),
  ]);

  const countMap = new Map<string, number>();
  for (const row of [...userCounts, ...adminCounts]) {
    if (row.defaultProgramId) {
      countMap.set(row.defaultProgramId, (countMap.get(row.defaultProgramId) ?? 0) + row._count._all);
    }
  }

  return NextResponse.json(programs.map((p) => ({ ...p, userCount: countMap.get(p.id) ?? 0 })));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSuperAdmin(session.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  try {
    const program = await prisma.program.create({ data: { name: name.trim() } });
    return NextResponse.json(program, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'A program with that name already exists' }, { status: 409 });
  }
}
