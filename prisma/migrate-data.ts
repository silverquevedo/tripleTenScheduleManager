/**
 * Safe data migration — no data is deleted.
 * Run once: npx tsx prisma/migrate-data.ts
 *
 * What it does:
 * 1. Merges MTI into 1:1 (re-labels 1:1 → "1:1 & MTI", migrates any MTI shifts)
 * 2. Updates GOH label → "Group Office Hours"
 * 3. Seeds admin emails
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAILS = [
  'natia.tchintcharauli@tripleten.com',
  'andres.quevedo@tripleten.com',
  'me@andresquevedo.com',          // personal / test account
  'devin.jaggernauth@tripleten.com',
  'gerardo.flores@tripleten.com',
  'abygayle.ivey@tripleten.com',
  'alex.lalama@tripleten.com',
  'eugenia.rubio@tripleten.com',
  'rodrigo.silva@tripleten.com',
];

async function main() {
  // ── 1. Merge MTI into 1:1 ─────────────────────────────────────────────────
  await prisma.shiftType.upsert({
    where: { code: '1:1' },
    update: { label: '1:1 & MTI' },
    create: { code: '1:1', label: '1:1 & MTI' },
  });

  // Re-point any existing MTI shifts to 1:1
  const migrated = await prisma.shift.updateMany({
    where: { taskCode: 'MTI' },
    data: { taskCode: '1:1' },
  });
  if (migrated.count > 0) console.log(`Migrated ${migrated.count} MTI shifts → 1:1`);

  // Remove the MTI entry (safe — no shifts reference it anymore)
  await prisma.shiftType.deleteMany({ where: { code: 'MTI' } });

  // ── 2. Update GOH label ───────────────────────────────────────────────────
  await prisma.shiftType.upsert({
    where: { code: 'GOH' },
    update: { label: 'Group Office Hours' },
    create: { code: 'GOH', label: 'Group Office Hours' },
  });

  // ── 3. Seed admin emails ──────────────────────────────────────────────────
  for (const email of ADMIN_EMAILS) {
    await prisma.adminEmail.upsert({
      where: { email },
      update: {},
      create: { email },
    });
  }

  console.log('Data migration complete.');
  console.log('Shift types:', await prisma.shiftType.findMany());
  console.log('Admin count:', await prisma.adminEmail.count());
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
