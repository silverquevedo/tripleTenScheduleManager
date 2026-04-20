import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/admin';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const programId = searchParams.get('programId');

  const shifts = await prisma.shift.findMany({
    where: programId ? { programId } : undefined,
    orderBy: [{ dayOfWeek: 'asc' }, { startMin: 'asc' }],
  });
  return NextResponse.json(shifts);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { programId, memberNames, taskCode, days, startMin, endMin, sessions } = await request.json();
  if (!programId || !memberNames?.length || !taskCode || !days?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // For REV, expand into N consecutive 30-min slots; all other tasks are one record.
  const slots: { slotStart: number; slotEnd: number }[] =
    taskCode === 'REV' && sessions > 1
      ? Array.from({ length: sessions }, (_, i) => ({
          slotStart: startMin + i * 30,
          slotEnd: startMin + (i + 1) * 30,
        }))
      : [{ slotStart: startMin, slotEnd: endMin }];

  let created = 0;
  for (const memberName of memberNames) {
    for (const day of days) {
      for (const { slotStart, slotEnd } of slots) {
        const exists = await prisma.shift.findFirst({
          where: { programId, memberName, taskCode, dayOfWeek: day, startMin: slotStart, endMin: slotEnd },
        });
        if (!exists) {
          await prisma.shift.create({
            data: { programId, memberName, taskCode, dayOfWeek: day, startMin: slotStart, endMin: slotEnd },
          });
          created++;
        }
      }
    }
  }
  return NextResponse.json({ created });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { programId, memberNames, taskCode, days, startMin, endMin } = await request.json();
  if (!programId || !memberNames?.length || !taskCode || !days?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const result = await prisma.shift.deleteMany({
    where: {
      programId,
      memberName: { in: memberNames },
      taskCode,
      dayOfWeek: { in: days },
      startMin,
      endMin,
    },
  });
  return NextResponse.json({ deleted: result.count });
}
