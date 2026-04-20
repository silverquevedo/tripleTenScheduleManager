import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function minsToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const programId = req.nextUrl.searchParams.get('programId');
  if (!programId) {
    return NextResponse.json({ error: 'programId required' }, { status: 400 });
  }

  const [program, shifts] = await Promise.all([
    prisma.program.findUnique({ where: { id: programId } }),
    prisma.shift.findMany({
      where: { programId },
      orderBy: [{ dayOfWeek: 'asc' }, { startMin: 'asc' }],
    }),
  ]);

  if (!program) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  }

  // Build CSV
  const rows: string[] = [
    // Header row
    ['Program', 'Day', 'Member', 'Task', 'Start', 'End'].join(','),
    // Data rows
    ...shifts.map((s) =>
      [
        `"${program.name}"`,
        DAYS[s.dayOfWeek],
        `"${s.memberName}"`,
        s.taskCode,
        minsToTime(s.startMin),
        minsToTime(s.endMin),
      ].join(',')
    ),
  ];

  const csv = rows.join('\n');
  const filename = `schedule_${program.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
