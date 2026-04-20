import { prisma } from './db';

/** Returns true if the given email is in the AdminEmail table. */
export async function isAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const record = await prisma.adminEmail.findUnique({ where: { email } });
  return !!record;
}
