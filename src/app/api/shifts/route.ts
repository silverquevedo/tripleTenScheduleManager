import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
  if (!session.user?.isAdmin) {
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

  // Fetch all existing shifts for the affected members/days upfront — avoids N+1 per slot
  const existing = await prisma.shift.findMany({
    where: { programId, memberName: { in: memberNames }, dayOfWeek: { in: days } },
    select: { memberName: true, taskCode: true, dayOfWeek: true, startMin: true, endMin: true },
  });

  // Index exact duplicates for O(1) lookup
  const exactSet = new Set(
    existing.map((s) => `${s.memberName}|${s.dayOfWeek}|${s.taskCode}|${s.startMin}|${s.endMin}`)
  );

  let created = 0;
  let skipped = 0;
  const toCreate: { programId: string; memberName: string; taskCode: string; dayOfWeek: number; startMin: number; endMin: number }[] = [];

  for (const memberName of memberNames) {
    for (const day of days) {
      // Shifts for this member+day, used for overlap checks
      const memberDayShifts = existing.filter((s) => s.memberName === memberName && s.dayOfWeek === day);

      for (const { slotStart, slotEnd } of slots) {
        if (exactSet.has(`${memberName}|${day}|${taskCode}|${slotStart}|${slotEnd}`)) continue;

        const overlaps = memberDayShifts.some((s) => s.startMin < slotEnd && s.endMin > slotStart);
        if (overlaps) { skipped++; continue; }

        toCreate.push({ programId, memberName, taskCode, dayOfWeek: day, startMin: slotStart, endMin: slotEnd });
        // Add to in-memory list so subsequent slots in this batch see it
        memberDayShifts.push({ memberName, taskCode, dayOfWeek: day, startMin: slotStart, endMin: slotEnd });
        created++;
      }
    }
  }

  if (toCreate.length > 0) {
    await prisma.shift.createMany({ data: toCreate });
  }
  return NextResponse.json({ created, skipped });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user?.isAdmin) {
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
