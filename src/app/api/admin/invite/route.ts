import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import nodemailer from 'nodemailer';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/admin';

const COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#65a30d',
  '#0284c7', '#ea580c', '#14b8a6', '#8b5cf6',
];

async function assignColor(programId: string): Promise<string> {
  const [userCount, adminCount] = await Promise.all([
    prisma.user.count({ where: { defaultProgramId: programId } }),
    prisma.adminEmail.count({ where: { defaultProgramId: programId } }),
  ]);
  return COLORS[(userCount + adminCount) % COLORS.length];
}

type InviteRole = 'instructor' | 'leadInstructor' | 'manager';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, role = 'instructor', programId, sendInvite = true } = await request.json() as {
    email: string;
    role?: InviteRole;
    programId?: string;
    sendInvite?: boolean;
  };
  const isActive = Boolean(sendInvite);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  // Only managers can invite Lead Instructors or Managers
  if ((role === 'leadInstructor' || role === 'manager') && !session.user?.isManager) {
    return NextResponse.json({ error: 'Only managers can invite lead instructors or managers' }, { status: 403 });
  }

  const defaultProgramId = programId || null;

  if (role === 'instructor') {
    const color = defaultProgramId ? await assignColor(defaultProgramId) : null;
    await prisma.adminEmail.upsert({
      where: { email },
      update: { isManager: false, isLeadInstructor: false, isActive, ...(defaultProgramId ? { defaultProgramId } : {}), ...(color ? { color } : {}) },
      create: { email, isManager: false, isLeadInstructor: false, isActive, defaultProgramId, ...(color ? { color } : {}) },
    });
    if (defaultProgramId) {
      const user = await prisma.user.findFirst({ where: { email } });
      if (user) {
        const color = user.color ?? await assignColor(defaultProgramId);
        await prisma.user.update({ where: { id: user.id }, data: { defaultProgramId, color } });
      }
    }
  } else if (role === 'manager') {
    await prisma.adminEmail.upsert({
      where: { email },
      update: { isManager: true, isLeadInstructor: true, isActive, ...(defaultProgramId ? { defaultProgramId } : {}) },
      create: { email, isManager: true, isLeadInstructor: true, isActive, defaultProgramId },
    });
  } else {
    // leadInstructor
    await prisma.adminEmail.upsert({
      where: { email },
      update: { isLeadInstructor: true, isActive, ...(defaultProgramId ? { defaultProgramId } : {}) },
      create: { email, isLeadInstructor: true, isActive, defaultProgramId },
    });
  }

  // Send invite email only when granting access, and only if SMTP is configured
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, NEXTAUTH_URL } = process.env;
  if (isActive && SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const appUrl = NEXTAUTH_URL ?? 'http://localhost:3000';
    const from = EMAIL_FROM ?? `TripleTen Schedule Manager <${SMTP_USER}>`;
    const roleLabel = role === 'manager' ? 'Manager' : role === 'leadInstructor' ? 'Lead Instructor' : 'Instructor';

    await transporter.sendMail({
      from,
      to: email,
      subject: 'You\'ve been invited to TripleTen Schedule Manager',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
          <div style="width:40px;height:40px;background:#1a1a1a;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:24px">
            <span style="color:white;font-size:20px">📅</span>
          </div>
          <h1 style="font-size:20px;font-weight:700;margin:0 0 8px">You're invited to TripleTen Schedule Manager</h1>
          <p style="color:#666;font-size:14px;margin:0 0 8px">
            ${session.user?.name ?? 'An admin'} has given you access as <strong>${roleLabel}</strong>.
          </p>
          <p style="color:#666;font-size:14px;margin:0 0 24px">
            Sign in with your Google account to get started.
          </p>
          <a href="${appUrl}/login"
            style="display:inline-block;background:#1a1a1a;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500">
            Sign in with Google →
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">
            Sign in using this email address: <strong>${email}</strong>
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, emailSent: true });
  }

  return NextResponse.json({ success: true, emailSent: false });
}
