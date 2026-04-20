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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const programId = searchParams.get('programId');

  const members = await prisma.programMember.findMany({
    where: programId ? { programId } : undefined,
    orderBy: { displayName: 'asc' },
  });
  return NextResponse.json(members);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { programId, displayName } = await request.json();
  if (!programId || !displayName?.trim()) {
    return NextResponse.json({ error: 'programId and displayName required' }, { status: 400 });
  }

  const existing = await prisma.programMember.findMany({ where: { programId } });
  const color = COLORS[existing.length % COLORS.length];

  try {
    const member = await prisma.programMember.create({
      data: { programId, displayName: displayName.trim(), color },
    });
    return NextResponse.json(member, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Member already exists' }, { status: 409 });
    }
    throw err;
  }
}
