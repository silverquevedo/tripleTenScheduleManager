import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [types, counts] = await Promise.all([
    prisma.shiftType.findMany({ orderBy: { code: 'asc' } }),
    prisma.shift.groupBy({ by: ['taskCode'], _count: { _all: true } }),
  ]);
  const countMap = new Map(counts.map((c) => [c.taskCode, c._count._all]));
  const result = types.map((t) => ({ ...t, shiftCount: countMap.get(t.code) ?? 0 }));
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user?.isManager) return NextResponse.json({ error: 'Managers only' }, { status: 403 });

  const { code, label, durationMin, durationLocked } = await request.json();
  if (!code?.trim() || !label?.trim()) {
    return NextResponse.json({ error: 'code and label are required' }, { status: 400 });
  }

  const existing = await prisma.shiftType.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (existing) return NextResponse.json({ error: 'Event type code already exists' }, { status: 409 });

  const type = await prisma.shiftType.create({
    data: {
      code: code.trim().toUpperCase(),
      label: label.trim(),
      durationMin: Number(durationMin) || 30,
      durationLocked: Boolean(durationLocked),
    },
  });
  return NextResponse.json(type, { status: 201 });
}
