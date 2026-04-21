/**
 * Imports the UX/UI weekly schedule from the CSV into the database.
 * Clears existing UX/UI shifts, then inserts all from the parsed CSV.
 * Run: npx tsx scripts/import-uxui.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Raw CSV data: each entry is [timeMin, [Mon,Tue,Wed,Thu,Fri,Sat,Sun]]
// "Andres" without a task code → treated as GOH (start of shift)
// ---------------------------------------------------------------------------
const RAW: Array<[number, string[]]> = [
  [600,  ['Isaac 1:1',             'Isaac Rev',                           'Isaac 1:1',                           'Isaac Rev',                           '',                       'Isaac Rev',  '']],
  [630,  ['Isaac 1:1',             'Isaac Rev',                           'Isaac 1:1',                           'Isaac Rev',                           '',                       'Isaac Rev',  '']],
  [660,  ['Isaac Rev',             'Isaac 1:1',                           'Isaac Rev',                           'Isaac 1:1',                           '',                       'Isaac Rev',  '']],
  [690,  ['Isaac Rev',             'Isaac 1:1',                           'Isaac Rev',                           'Isaac 1:1',                           '',                       'Isaac Rev',  '']],
  [720,  ['Isaac Rev, Andres GOH', 'Isaac Rev, Andres GOH',               'Isaac Rev, Andres GOH',               'Isaac Rev, Andres GOH',               'Andres Rev',             'Isaac GOH',  '']],
  [750,  ['Isaac GOH, Andres GOH', 'Isaac GOH, Andres GOH',               'Isaac GOH, Andres GOH',               'Isaac GOH, Andres GOH',               'Andres Rev',             'Isaac GOH',  '']],
  [780,  ['Isaac GOH, Andres GOH', 'Isaac GOH, Andres GOH',               'Isaac GOH, Andres GOH',               'Isaac GOH, Andres GOH',               'Andres Rev',             'Isaac GOH',  '']],
  [810,  ['Isaac GOH, Andres Rev', 'Isaac GOH, Andres Rev',               'Isaac GOH, Andres Rev',               'Isaac GOH, Andres Rev',               'Andres Rev',             'Isaac GOH',  '']],
  [840,  ['Isaac GOH, Andres Rev', 'Isaac GOH, Andres Rev',               'Isaac GOH, Andres Rev',               'Isaac GOH, Andres Rev',               'Andres Rev',             'Isaac Rev',  '']],
  [870,  ['Isaac Rev, Andres Rev', 'Isaac Rev, Andres Rev',               'Isaac Rev, Andres Rev',               'Isaac Rev, Andres Rev',               'Andres Rev',             'Isaac Rev',  '']],
  [900,  ['Isaac Rev, Andres Rev', 'Isaac Rev, Andres Rev',               'Isaac Rev, Andres Rev',               'Isaac Rev, Andres Rev',               'Andres Rev',             'Isaac 1:1',  '']],
  [930,  ['Isaac Rev, Andres 1:1', 'Isaac Rev, Andres 1:1',               'Isaac Rev, Andres 1:1',               'Isaac Rev, Andres 1:1',               'Andres Rev',             'Isaac 1:1',  '']],
  [960,  ['Isaac Rev, Andres 1:1', 'Isaac Rev, Andres 1:1',               'Isaac Rev, Andres 1:1',               'Isaac Rev, Andres 1:1',               'Andres GOH',             'Isaac Rev',  '']],
  [990,  ['Isaac Rev, Andres Rev', 'Isaac 1:1, Andres Rev',               'Isaac Rev, Andres Rev',               'Isaac 1:1, Andres Rev',               'Andres GOH',             'Isaac Rev',  '']],
  [1020, ['Isaac Rev, Andres GOH', 'Isaac 1:1, Andres GOH',               'Isaac Rev, Andres Rev',               'Isaac 1:1, Andres GOH',               'Andres GOH',             'Isaac Rev',  'Jose D Rev']],
  [1050, ['Isaac Rev, Andres GOH', 'Isaac Rev, Andres GOH',               'Isaac Rev, Andres Rev',               'Isaac Rev, Andres GOH',               'Andres GOH',             'Isaac Rev',  'Jose D Rev']],
  [1080, ['Jose D Rev, Andres GOH','Jose D Rev, Andres GOH, Daniel Rev',  'Jose D Rev, Andres Rev, Daniel Rev',  'Jose D Rev, Andres GOH, Daniel Rev',  'Andres Rev, Daniel GOH', 'Daniel GOH', 'Jose D GOH']],
  [1110, ['Jose D Rev, Andres GOH','Jose D Rev, Andres GOH, Daniel Rev',  'Jose D Rev, Andres Rev, Daniel Rev',  'Jose D Rev, Andres GOH, Daniel Rev',  'Andres Rev, Daniel GOH', 'Daniel GOH', 'Jose D GOH']],
  [1140, ['Jose D 1:1, Andres Rev','Jose D GOH, Andres Rev, Daniel 1:1',  'Jose D GOH, Andres Rev, Daniel 1:1',  'Jose D GOH, Andres Rev, Daniel 1:1',  'Andres 1:1, Daniel GOH', 'Daniel GOH', 'Jose D GOH']],
  [1170, ['Jose D 1:1, Andres Rev','Jose D GOH, Andres Rev, Daniel 1:1',  'Jose D GOH, Andres Rev, Daniel 1:1',  'Jose D GOH, Andres Rev, Daniel 1:1',  'Andres 1:1, Daniel GOH', 'Daniel GOH', 'Jose D GOH']],
  [1200, ['Jose D Rev',            'Jose D GOH, Daniel Rev',              'Jose D GOH, Daniel Rev',              'Jose D GOH, Daniel Rev',              'Daniel Rev',             'Daniel Rev', 'Jose D Rev']],
  [1230, ['Jose D GOH',            'Jose D GOH, Daniel Rev',              'Jose D GOH, Daniel Rev',              'Jose D GOH, Daniel Rev',              'Daniel Rev',             'Daniel Rev', 'Jose D Rev']],
  [1260, ['Jose D GOH',            'Jose D Rev, Daniel GOH',              'Jose D Rev, Daniel GOH',              'Jose D Rev, Daniel GOH',              'Daniel Rev',             'Daniel Rev', 'Jose D Rev']],
  [1290, ['Jose D GOH',            'Jose D 1:1, Daniel GOH',              'Jose D 1:1, Daniel GOH',              'Jose D 1:1, Daniel GOH',              'Daniel 1:1',             'Daniel 1:1', 'Jose D 1:1']],
  [1320, ['Jose D GOH',            'Jose D 1:1, Daniel GOH',              'Jose D 1:1, Daniel GOH',              'Jose D 1:1, Daniel GOH',              'Daniel 1:1',             'Daniel 1:1', 'Jose D 1:1']],
  [1350, ['Jose D Rev',            'Jose D Rev, Daniel GOH',              'Jose D Rev, Daniel GOH',              'Jose D Rev, Daniel GOH',              'Daniel Rev',             'Daniel Rev', 'Jose D Rev']],
  [1380, ['Jose D 1:1',            'Jose D 1:1, Daniel Rev',              'Jose D Rev, Daniel Rev',              'Jose D 1:1, Daniel Rev',              'Daniel Rev',             'Daniel Rev', 'Jose D Rev']],
  [1410, ['Jose D 1:1',            'Jose D 1:1, Daniel Rev',              'Jose D Rev, Daniel Rev',              'Jose D 1:1, Daniel Rev',              'Daniel Rev',             'Daniel Rev', 'Jose D Rev']],
  [1440, ['Jose D Rev',            'Jose D Rev, Daniel Rev',              'Jose D Rev, Daniel 1:1',              'Jose D Rev, Daniel Rev',              'Daniel 1:1',             'Daniel Rev', 'Jose D Rev']],
  [1470, ['Jose D Rev',            'Jose D Rev, Daniel Rev',              'Jose D Rev, Daniel 1:1',              'Jose D Rev, Daniel Rev',              'Daniel 1:1',             'Daniel Rev', 'Jose D Rev']],
  [1500, ['Jose D Rev',            'Jose D Rev, Daniel Rev',              'Jose D Rev, Daniel Rev',              'Jose D Rev, Daniel Rev',              'Daniel Rev',             'Daniel Rev', 'Jose D Rev']],
  [1530, ['Jose D Rev',            'Jose D Rev, Daniel Rev',              'Jose D Rev, Daniel Rev',              'Jose D Rev, Daniel Rev',              'Daniel Rev',             'Daniel Rev', 'Jose D Rev']],
];

// ---------------------------------------------------------------------------
// Task code normalisation
// ---------------------------------------------------------------------------
const TASK_MAP: Record<string, string> = { Rev: 'REV', '1:1': '1:1', GOH: 'GOH' };

function parseCell(cell: string): Array<{ csvPerson: string; taskCode: string }> {
  if (!cell.trim()) return [];
  return cell.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const parts = s.split(' ');
    const last = parts[parts.length - 1];
    if (TASK_MAP[last]) {
      return { csvPerson: parts.slice(0, -1).join(' '), taskCode: TASK_MAP[last] };
    }
    // No recognised task — default to GOH
    return { csvPerson: s, taskCode: 'GOH' };
  });
}

// ---------------------------------------------------------------------------
// Build flat list of (dayOfWeek, timeMin, memberName, taskCode) slots
// ---------------------------------------------------------------------------
type Slot = { dayOfWeek: number; timeMin: number; memberName: string; taskCode: string };

function buildSlots(nameMap: Record<string, string>): Slot[] {
  const slots: Slot[] = [];
  for (const [timeMin, days] of RAW) {
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      for (const { csvPerson, taskCode } of parseCell(days[dayIdx])) {
        const memberName = nameMap[csvPerson];
        if (!memberName) {
          console.warn(`  ⚠ No member found for CSV person "${csvPerson}" — skipping`);
          continue;
        }
        slots.push({ dayOfWeek: dayIdx, timeMin, memberName, taskCode });
      }
    }
  }
  return slots;
}

// ---------------------------------------------------------------------------
// Merge consecutive slots with the same (dayOfWeek, memberName, taskCode)
// into single shifts with startMin / endMin
// ---------------------------------------------------------------------------
type ShiftData = { dayOfWeek: number; memberName: string; taskCode: string; startMin: number; endMin: number };

function mergeSlots(slots: Slot[]): ShiftData[] {
  // Sort: day → member → time
  const sorted = [...slots].sort((a, b) =>
    a.dayOfWeek !== b.dayOfWeek ? a.dayOfWeek - b.dayOfWeek :
    a.memberName !== b.memberName ? a.memberName.localeCompare(b.memberName) :
    a.timeMin - b.timeMin
  );

  const shifts: ShiftData[] = [];
  let current: ShiftData | null = null;

  for (const slot of sorted) {
    if (
      current &&
      current.dayOfWeek === slot.dayOfWeek &&
      current.memberName === slot.memberName &&
      current.taskCode === slot.taskCode &&
      current.endMin === slot.timeMin          // consecutive (no gap)
    ) {
      current.endMin = slot.timeMin + 30;
    } else {
      if (current) shifts.push(current);
      current = { dayOfWeek: slot.dayOfWeek, memberName: slot.memberName, taskCode: slot.taskCode, startMin: slot.timeMin, endMin: slot.timeMin + 30 };
    }
  }
  if (current) shifts.push(current);
  return shifts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // 1. Get UX/UI program
  const program = await prisma.program.findUnique({ where: { name: 'UX/UI' } });
  if (!program) throw new Error('UX/UI program not found');
  console.log(`Program: ${program.name} (${program.id})`);

  // 2. Build display name map from active Users + pending AdminEmail entries
  const users = await prisma.user.findMany({ where: { defaultProgramId: program.id } });
  const adminEntries = await prisma.adminEmail.findMany({ where: { defaultProgramId: program.id } });
  const registeredEmails = new Set(users.map(u => u.email ?? ''));

  const memberNames: string[] = [
    ...users.map(u => u.name ?? u.email ?? ''),
    ...adminEntries
      .filter(a => !registeredEmails.has(a.email))
      .map(a => {
        const local = a.email.split('@')[0];
        return local.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      }),
  ];
  console.log('Members:', memberNames);

  // 3. Map CSV short names → display names (match by first name, accent-insensitive)
  const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const nameMap: Record<string, string> = {};
  const CSV_PERSONS = ['Isaac', 'Andres', 'Jose D', 'Daniel'];
  for (const csvPerson of CSV_PERSONS) {
    const firstName = stripAccents(csvPerson.split(' ')[0]);
    const match = memberNames.find(n => stripAccents(n.split(' ')[0]) === firstName);
    if (match) {
      nameMap[csvPerson] = match;
      console.log(`  Mapped "${csvPerson}" → "${match}"`);
    } else {
      console.warn(`  ⚠ No member matched for "${csvPerson}"`);
    }
  }

  // 4. Build and merge slots into shifts
  const slots = buildSlots(nameMap);
  const shifts = mergeSlots(slots);
  console.log(`\nParsed ${slots.length} slots → ${shifts.length} merged shifts`);

  // 5. Clear existing shifts for UX/UI and re-insert
  const deleted = await prisma.shift.deleteMany({ where: { programId: program.id } });
  console.log(`Deleted ${deleted.count} existing shifts`);

  const created = await prisma.shift.createMany({
    data: shifts.map(s => ({ ...s, programId: program.id })),
  });
  console.log(`Created ${created.count} shifts ✓`);

  // Summary
  const byDay = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  for (let d = 0; d < 7; d++) {
    const dayShifts = shifts.filter(s => s.dayOfWeek === d);
    if (dayShifts.length) console.log(`  ${byDay[d]}: ${dayShifts.length} shifts`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
