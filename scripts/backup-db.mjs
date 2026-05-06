import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function backup() {
  console.log('Connecting to database…');

  const [
    users,
    accounts,
    sessions,
    verificationTokens,
    programs,
    shifts,
    shiftTypes,
    adminEmails,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.account.findMany(),
    prisma.session.findMany(),
    prisma.verificationToken.findMany(),
    prisma.program.findMany(),
    prisma.shift.findMany(),
    prisma.shiftType.findMany(),
    prisma.adminEmail.findMany(),
  ]);

  const snapshot = {
    _meta: {
      createdAt: new Date().toISOString(),
      counts: {
        users: users.length,
        accounts: accounts.length,
        sessions: sessions.length,
        verificationTokens: verificationTokens.length,
        programs: programs.length,
        shifts: shifts.length,
        shiftTypes: shiftTypes.length,
        adminEmails: adminEmails.length,
      },
    },
    users,
    accounts,
    sessions,
    verificationTokens,
    programs,
    shifts,
    shiftTypes,
    adminEmails,
  };

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = join(__dirname, `backup-${ts}.json`);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  console.log('\n✓ Backup complete');
  console.table(snapshot._meta.counts);
  console.log(`\nSaved to: ${outPath}`);
}

backup()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
