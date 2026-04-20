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

  // Shift types (MTI merged into 1:1)
  const shiftTypes = [
    { code: '1:1', label: '1:1 & MTI' },
    { code: 'REV', label: 'Review' },
    { code: 'GOH', label: 'Group Office Hours' },
  ];
  for (const st of shiftTypes) {
    await prisma.shiftType.upsert({
      where: { code: st.code },
      update: { label: st.label },
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

  // UX/UI members
  const uxui = await prisma.program.findUnique({ where: { name: 'UX/UI' } });
  if (uxui) {
    const members = [
      { displayName: 'Isaac Tovar', color: COLORS[0] },
      { displayName: 'Jose D. Ortiz', color: COLORS[1] },
      { displayName: 'Daniel Otero', color: COLORS[2] },
      { displayName: 'Andres Quevedo', color: COLORS[3] },
    ];
    for (const m of members) {
      await prisma.programMember.upsert({
        where: { programId_displayName: { programId: uxui.id, displayName: m.displayName } },
        update: {},
        create: { programId: uxui.id, ...m },
      });
    }
  }

  // Admin emails
  const adminEmails = [
    'natia.tchintcharauli@tripleten.com',
    'andres.quevedo@tripleten.com',
    'me@andresquevedo.com',
    'devin.jaggernauth@tripleten.com',
    'gerardo.flores@tripleten.com',
    'abygayle.ivey@tripleten.com',
    'alex.lalama@tripleten.com',
    'eugenia.rubio@tripleten.com',
    'rodrigo.silva@tripleten.com',
  ];
  for (const email of adminEmails) {
    await prisma.adminEmail.upsert({
      where: { email },
      update: {},
      create: { email },
    });
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
