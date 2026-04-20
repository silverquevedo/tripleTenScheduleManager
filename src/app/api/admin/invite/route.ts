import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import nodemailer from 'nodemailer';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/admin';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(session.user?.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email } = await request.json();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  // Add to AdminEmail (idempotent)
  await prisma.adminEmail.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  // Send invite email if SMTP is configured
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, NEXTAUTH_URL } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const appUrl = NEXTAUTH_URL ?? 'http://localhost:3000';
    const from = EMAIL_FROM ?? `TripleTen Schedule Manager <${SMTP_USER}>`;

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
          <p style="color:#666;font-size:14px;margin:0 0 24px">
            ${session.user?.name ?? 'An admin'} has given you access to TripleTen Schedule Manager, a weekly shift scheduling tool.
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

  // SMTP not configured — user was added but no email sent
  return NextResponse.json({ success: true, emailSent: false });
}
