import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [programs, users, adminEntries] = await Promise.all([
    prisma.program.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: { defaultProgramId: { not: null } },
      select: { email: true, defaultProgramId: true },
    }),
    prisma.adminEmail.findMany({
      where: { defaultProgramId: { not: null } },
      select: { email: true, defaultProgramId: true },
    }),
  ]);

  // Count unique people per program — deduplicate by email (User takes precedence over AdminEmail)
  const registeredEmails = new Set(users.map((u) => u.email ?? ''));
  const countMap = new Map<string, number>();

  for (const u of users) {
    if (u.defaultProgramId)
      countMap.set(u.defaultProgramId, (countMap.get(u.defaultProgramId) ?? 0) + 1);
  }
  for (const a of adminEntries) {
    if (a.defaultProgramId && !registeredEmails.has(a.email))
      countMap.set(a.defaultProgramId, (countMap.get(a.defaultProgramId) ?? 0) + 1);
  }

  return NextResponse.json(programs.map((p) => ({ ...p, userCount: countMap.get(p.id) ?? 0 })));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user?.isManager) {
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
