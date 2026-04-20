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
        session.user.isAdmin = !!adminRecord;

        // Default program: prefer User record; fall back to AdminEmail preset
        try {
          if (user.id) {
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id },
              select: { defaultProgramId: true },
            });
            const effective = dbUser?.defaultProgramId ?? adminRecord?.defaultProgramId ?? null;
            // On first sign-in, copy the preset from AdminEmail into the User row
            if (!dbUser?.defaultProgramId && adminRecord?.defaultProgramId) {
              await prisma.user.update({
                where: { id: user.id },
                data: { defaultProgramId: adminRecord.defaultProgramId },
              });
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
