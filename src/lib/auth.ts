import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './db';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'database',
  },
  callbacks: {
    session: async ({ session, user }) => {
      if (session.user) {
        session.user.id = user.id;
        session.user.defaultProgramId = null;

        // Admin check is independent — never silenced by other errors
        const adminRecord = await prisma.adminEmail.findUnique({
          where: { email: user.email ?? '' },
        });
        const isLeadInstructor = adminRecord?.isLeadInstructor ?? true;
        session.user.isAdmin = !!adminRecord && (adminRecord.isManager || isLeadInstructor);
        session.user.isManager = adminRecord?.isManager ?? false;

        // Default program: prefer User record; fall back to AdminEmail preset
        try {
          if (user.id) {
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id },
              select: { defaultProgramId: true, color: true },
            });
            const effective = dbUser?.defaultProgramId ?? adminRecord?.defaultProgramId ?? null;
            // On first sign-in, copy the preset from AdminEmail into the User row + assign color
            if (!dbUser?.defaultProgramId && adminRecord?.defaultProgramId) {
              const COLORS = [
                '#4f46e5', '#0891b2', '#059669', '#d97706',
                '#dc2626', '#7c3aed', '#db2777', '#65a30d',
                '#0284c7', '#ea580c', '#14b8a6', '#8b5cf6',
              ];
              // Prefer color stored on AdminEmail (set by manager), else auto-assign
              let color = dbUser?.color ?? adminRecord.color ?? null;
              if (!color) {
                const countInProgram = await prisma.user.count({
                  where: { defaultProgramId: adminRecord.defaultProgramId },
                });
                color = COLORS[countInProgram % COLORS.length];
              }
              await prisma.user.update({
                where: { id: user.id },
                data: { defaultProgramId: adminRecord.defaultProgramId, color },
              });
              // Migrate any shifts assigned to the email-derived display name → real User.name
              if (user.name) {
                const derivedName = (user.email ?? '').split('@')[0]
                  .split('.').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
                if (derivedName && derivedName !== user.name) {
                  await prisma.shift.updateMany({
                    where: { programId: adminRecord.defaultProgramId, memberName: derivedName },
                    data: { memberName: user.name },
                  }).catch(() => { /* non-fatal */ });
                }
              }
            }
            session.user.defaultProgramId = effective;
          }
        } catch {
          // non-fatal
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
