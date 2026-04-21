import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(request: Request, { params }: { params: { code: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user?.isManager) return NextResponse.json({ error: 'Managers only' }, { status: 403 });

  const code = decodeURIComponent(params.code);
  const { label, durationMin, durationLocked } = await request.json();
  const data: Record<string, unknown> = {};
  if (label !== undefined) data.label = label.trim();
  if (durationMin !== undefined) data.durationMin = Number(durationMin);
  if (durationLocked !== undefined) data.durationLocked = Boolean(durationLocked);

  try {
    const updated = await prisma.shiftType.update({ where: { code }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Event type not found.' }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { code: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user?.isManager) return NextResponse.json({ error: 'Managers only' }, { status: 403 });

  const code = decodeURIComponent(params.code);
  const inUse = await prisma.shift.findFirst({ where: { taskCode: code } });
  if (inUse) {
    return NextResponse.json(
      { error: 'This event type is in use by existing shifts and cannot be deleted.' },
      { status: 409 }
    );
  }

  try {
    await prisma.shiftType.delete({ where: { code } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Event type not found.' }, { status: 404 });
  }
}
