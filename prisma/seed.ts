import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COLORS = [
  '#4f46e5', // indigo
  '#0891b2', // cyan
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#7c3aed', // violet
  '#db2777', // pink
  '#65a30d', // lime
  '#0284c7', // sky
  '#ea580c', // orange
];

async function main() {
  console.log('Seeding database…');

  // Shift types
  const shiftTypes = [
    { code: '1:1', label: '1:1 & MTI',          durationMin: 60,  durationLocked: true  },
    { code: 'REV', label: 'Review',              durationMin: 30,  durationLocked: false },
    { code: 'GOH', label: 'Group Office Hours',  durationMin: 120, durationLocked: true  },
  ];
  for (const st of shiftTypes) {
    await prisma.shiftType.upsert({
      where: { code: st.code },
      update: { label: st.label, durationMin: st.durationMin, durationLocked: st.durationLocked },
      create: st,
    });
  }

  // Programs
  const programNames = ['UX/UI', 'QA', 'AI', 'BIA'];
  for (const name of programNames) {
    await prisma.program.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const uxui = await prisma.program.findUnique({ where: { name: 'UX/UI' } });

  // Admin emails
  type AdminEmailEntry = {
    email: string;
    isManager?: boolean;
    isLeadInstructor?: boolean;
    defaultProgramId?: string | null;
    color?: string | null;
  };
  const adminEmails: AdminEmailEntry[] = [
    { email: 'natia.tchintcharauli@tripleten.com', isManager: true },
    { email: 'andres.quevedo@tripleten.com', isManager: true, defaultProgramId: uxui?.id },
    { email: 'me@andresquevedo.com' },
    { email: 'devin.jaggernauth@tripleten.com' },
    { email: 'gerardo.flores@tripleten.com' },
    { email: 'abygayle.ivey@tripleten.com' },
    { email: 'alex.lalama@tripleten.com' },
    { email: 'eugenia.rubio@tripleten.com' },
    { email: 'rodrigo.silva@tripleten.com' },
    // Pending instructors for UX/UI — pre-assign colors (COLORS[0..2] already taken by Andres)
    { email: 'isaac.tovar@tripleten.com',  isLeadInstructor: false, defaultProgramId: uxui?.id, color: COLORS[1] },
    { email: 'daniel.otero@tripleten.com', isLeadInstructor: false, defaultProgramId: uxui?.id, color: COLORS[2] },
    { email: 'jose.ortiz@tripleten.com',   isLeadInstructor: false, defaultProgramId: uxui?.id, color: COLORS[4] },
  ];

  for (const { email, isManager = false, isLeadInstructor = true, defaultProgramId = null, color = null } of adminEmails) {
    await prisma.adminEmail.upsert({
      where: { email },
      update: { isManager, isLeadInstructor, ...(defaultProgramId !== null ? { defaultProgramId } : {}), ...(color ? { color } : {}) },
      create: { email, isManager, isLeadInstructor, defaultProgramId, ...(color ? { color } : {}) },
    });
  }

  // Assign colors to existing User records that have defaultProgramId
  // Map known names → colors to preserve the existing schedule display
  if (uxui) {
    const colorMap: Record<string, string> = {
      'Isaac Tovar':    COLORS[0],
      'Jose D. Ortiz':  COLORS[1],
      'Daniel Otero':   COLORS[2],
      'Andres Quevedo': COLORS[3],
    };

    const uxuiUsers = await prisma.user.findMany({
      where: { defaultProgramId: uxui.id },
    });

    for (const user of uxuiUsers) {
      if (!user.color && user.name) {
        const color = colorMap[user.name] ?? COLORS[uxuiUsers.indexOf(user) % COLORS.length];
        await prisma.user.update({
          where: { id: user.id },
          data: { color },
        });
        console.log(`  Assigned color ${color} to ${user.name}`);
      }
    }

    // Ensure andres.quevedo has defaultProgramId and color on their User record
    const andresUser = await prisma.user.findUnique({
      where: { email: 'andres.quevedo@tripleten.com' },
    });
    if (andresUser) {
      await prisma.user.update({
        where: { id: andresUser.id },
        data: {
          defaultProgramId: andresUser.defaultProgramId ?? uxui.id,
          color: andresUser.color ?? COLORS[3],
        },
      });
      console.log('  Updated andres.quevedo with UX/UI program and color');

      // Migrate existing shifts: normalize memberName variants → actual User.name
      // Covers accented vs non-accented name discrepancies
      if (andresUser.name) {
        const normalized = andresUser.name; // e.g. "Andrés Quevedo"
        const allShifts = await prisma.shift.findMany({
          where: { programId: uxui.id },
          select: { id: true, memberName: true },
        });
        // Compare first and last tokens ignoring accents/case
        const stripAccents = (s: string) =>
          s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const normFirst = stripAccents(normalized.split(' ')[0]);
        const normLast  = stripAccents(normalized.split(' ').slice(-1)[0]);
        const toUpdate = allShifts.filter((s) =>
          s.memberName !== normalized &&
          stripAccents(s.memberName.split(' ')[0]) === normFirst &&
          stripAccents(s.memberName.split(' ').slice(-1)[0]) === normLast
        );
        if (toUpdate.length > 0) {
          await prisma.shift.updateMany({
            where: { id: { in: toUpdate.map((s) => s.id) } },
            data: { memberName: normalized },
          });
          console.log(`  Migrated ${toUpdate.length} shift(s) from "${toUpdate[0].memberName}" → "${normalized}"`);
        }
      }
    }
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
