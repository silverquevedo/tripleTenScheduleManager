import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

const COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#65a30d',
  '#0284c7', '#ea580c', '#14b8a6', '#8b5cf6',
];

function nameFromEmail(email: string): string {
  const local = email.split('@')[0];
  return local
    .split('.')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function pickColor(index: number): string {
  return COLORS[index % COLORS.length];
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const programId = searchParams.get('programId');

  // programId is required — never return members from all programs at once
  if (!programId) return NextResponse.json([]);

  // Active users with this program
  const users = await prisma.user.findMany({
    where: { defaultProgramId: programId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, color: true, defaultProgramId: true },
  });

  const registeredEmails = new Set(users.map((u) => u.email ?? ''));

  // Pending: in AdminEmail with defaultProgramId but no User record yet
  const adminEntries = await prisma.adminEmail.findMany({
    where: { defaultProgramId: programId },
    orderBy: { email: 'asc' },
    select: { id: true, email: true, color: true, defaultProgramId: true },
  });
  const pending = adminEntries.filter((a) => !registeredEmails.has(a.email));

  const activeMembers = users.map((u, i) => ({
    id: u.id,
    programId: u.defaultProgramId!,
    displayName: u.name ?? u.email ?? 'Unknown',
    color: u.color ?? pickColor(i),
    email: u.email ?? undefined,
    isPending: false,
  }));

  const pendingMembers = pending.map((a, i) => ({
    id: a.id,
    programId: a.defaultProgramId!,
    displayName: nameFromEmail(a.email),
    color: a.color ?? pickColor(activeMembers.length + i),
    email: a.email,
    isPending: true,
  }));

  return NextResponse.json([...activeMembers, ...pendingMembers]);
}
