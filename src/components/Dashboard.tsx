'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Header } from './Header';
import { TeamMembers } from './TeamMembers';
import { ShiftManager } from './ShiftManager';
import { ScheduleTable } from './ScheduleTable';
import { ClearSchedule } from './ClearSchedule';
import { FloatingPanel } from './FloatingPanel';
import { Member, Program, ShiftType } from '@/types';

export function Dashboard() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;
  const isSuperAdmin = session?.user?.isManager ?? false;

  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [scheduleRefresh, setScheduleRefresh] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(true);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    // Run exactly once, after the session is known (avoids re-running on session refresh)
    if (bootstrappedRef.current) return;
    if (status === 'loading') return;
    bootstrappedRef.current = true;

    Promise.all([
      fetch('/api/programs').then((r) => r.json()),
      fetch('/api/shift-types').then((r) => r.json()),
    ]).then(([progs, types]) => {
      const programList: Program[] = Array.isArray(progs) ? progs : [];
      setPrograms(programList);
      setShiftTypes(Array.isArray(types) ? types : []);
      if (programList.length > 0) {
        const defaultId = session?.user?.defaultProgramId;
        const match = defaultId ? programList.find((p) => p.id === defaultId) : null;
        setSelectedProgram(match ?? programList[0]);
      }
      setBootstrapping(false);
    });
  }, [status, session]);

  const fetchMembers = useCallback((programId: string | null) => {
    const url = programId ? `/api/members?programId=${programId}` : '/api/members';
    fetch(url)
      .then((r) => r.json())
      .then((data) => setMembers(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    if (!selectedProgram) return;
    fetchMembers(selectedProgram.id);
  }, [selectedProgram, fetchMembers]);

  const refreshMembers = useCallback(() => {
    if (selectedProgram) fetchMembers(selectedProgram.id);
  }, [selectedProgram, fetchMembers]);

  const triggerScheduleRefresh = useCallback(() => setScheduleRefresh((n) => n + 1), []);

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-[#f9f9f8] flex items-center justify-center">
        <p className="text-sm text-[#888]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f9f8]">
      <Header
        programs={programs}
        selectedProgram={selectedProgram}
        onProgramChange={(p) => { setSelectedProgram(p); setMembers([]); }}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">

        {/* ── Admin action buttons — Team Members + Clear Schedule ── */}
        {isAdmin && selectedProgram && (
          <div className="flex items-center gap-3">

            <FloatingPanel
              width="w-96"
              trigger={
                <button className="flex items-center gap-2 text-sm font-medium bg-white border border-[#e5e5e3] rounded-xl px-4 py-2.5 hover:border-[#1a1a1a] transition-colors shadow-sm">
                  <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Instructors</span>
                  <div className="flex items-center gap-0.5 ml-1">
                    {members.slice(0, 5).map((m) => (
                      <span key={m.id} className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: m.color }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-[#888]">({members.length})</span>
                  <svg className="w-3 h-3 text-[#aaa] ml-0.5" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              }
            >
              <div className="px-1 py-1">
                <p className="text-[11px] text-[#888] uppercase tracking-wide font-medium px-3 pt-2 pb-1">
                  Instructors
                </p>
                <TeamMembers
                  members={members}
                  programId={selectedProgram.id}
                  isAdmin={isAdmin}
                  onMembersChange={refreshMembers}
                />
              </div>
            </FloatingPanel>

            <FloatingPanel
              width="w-72"
              trigger={
                <button className="flex items-center gap-2 text-sm font-medium bg-[#fffbeb] border border-[#fcd34d] text-[#92400e] rounded-xl px-4 py-2.5 hover:bg-yellow-100 transition-colors shadow-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear schedule
                  <svg className="w-3 h-3 text-amber-500 ml-0.5" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              }
            >
              <div className="px-1 py-1">
                <p className="text-[11px] text-[#888] uppercase tracking-wide font-medium px-3 pt-2 pb-1">
                  Clear schedule
                </p>
                <ClearSchedule
                  members={members}
                  programId={selectedProgram.id}
                  onCleared={triggerScheduleRefresh}
                />
              </div>
            </FloatingPanel>
          </div>
        )}

        {/* ── Weekly schedule — toolbar embedded inside ── */}
        {programs.length > 0 && (
          <ScheduleTable
            programId={selectedProgram?.id ?? null}
            programName={selectedProgram?.name ?? 'All Programs'}
            members={members}
            shiftTypes={shiftTypes}
            refreshTrigger={scheduleRefresh}
            isAdmin={isAdmin}
            toolbar={isAdmin && selectedProgram ? (
              <ShiftManager
                members={members}
                shiftTypes={shiftTypes}
                programId={selectedProgram.id}
                onShiftChange={triggerScheduleRefresh}
              />
            ) : undefined}
          />
        )}
      </main>
    </div>
  );
}
