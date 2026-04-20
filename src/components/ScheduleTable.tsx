'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Member, Shift, ShiftType } from '@/types';

interface ScheduleTableProps {
  programId: string | null;
  programName: string;
  members: Member[];
  shiftTypes: ShiftType[];
  refreshTrigger: number;
  isAdmin: boolean;
  toolbar?: React.ReactNode;
}

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_START = 600; // 10:00
const DEFAULT_END = 1560;  // 02:00 next day
const SLOT_COUNT = (DEFAULT_END - DEFAULT_START) / 30; // 32 slots

function minsToTime(m: number) {
  const wrapped = m % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

interface PendingDeletion {
  shift: Shift;
  timeoutId: ReturnType<typeof setTimeout>;
}

export function ScheduleTable({
  programId, programName, members, shiftTypes, refreshTrigger, isAdmin, toolbar,
}: ScheduleTableProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([]);
  const [internalRefresh, setInternalRefresh] = useState(0);
  const pendingRef = useRef(pendingDeletions);
  pendingRef.current = pendingDeletions;
  const scrollWrapRef = useRef<HTMLDivElement>(null);
  // Only scroll on program load/change, not on add/delete refreshes
  const shouldScrollRef = useRef(true);

  // Start at 10:00 by default; if any shift is earlier, expand to cover it
  const slotMins = useMemo(() => {
    const earliest = shifts.length > 0 ? Math.min(...shifts.map((s) => s.startMin)) : DEFAULT_START;
    const start = Math.min(DEFAULT_START, Math.floor(earliest / 30) * 30);
    return Array.from({ length: SLOT_COUNT }, (_, i) => start + i * 30);
  }, [shifts]);

  // Reset scroll flag whenever the program selection changes
  useEffect(() => {
    shouldScrollRef.current = true;
  }, [programId]);

  // Auto-scroll to the first occupied slot (minus one row) — only on program load
  useEffect(() => {
    if (!shouldScrollRef.current) return;
    shouldScrollRef.current = false;

    const container = scrollWrapRef.current;
    if (!container) return;

    const firstMin = shifts.length > 0
      ? Math.min(...shifts.map((s) => s.startMin))
      : slotMins[0];
    const targetSlot = slotMins.find((m) => m >= firstMin) ?? slotMins[0];
    const row = container.querySelector<HTMLTableRowElement>(`[data-slot="${targetSlot}"]`);
    if (!row) return;

    const relativeTop =
      row.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    container.scrollTop = Math.max(0, relativeTop - row.offsetHeight);
  }, [shifts]);

  const fetchShifts = useCallback(() => {
    setLoading(true);
    const url = programId ? `/api/shifts?programId=${programId}` : '/api/shifts';
    fetch(url)
      .then((r) => r.json())
      .then((data) => setShifts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [programId]);

  useEffect(() => { fetchShifts(); }, [fetchShifts, refreshTrigger, internalRefresh]);

  // Flush pending deletes when program changes or component unmounts
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((pd) => {
        clearTimeout(pd.timeoutId);
        fetch(`/api/shifts/${pd.shift.id}`, { method: 'DELETE' });
      });
    };
  }, [programId]);

  const colorOf = (name: string) =>
    members.find((m) => m.displayName === name)?.color ?? '#6b7280';

  const labelOf = (code: string) =>
    shiftTypes.find((st) => st.code === code)?.label ?? code;

  const visibleShifts = shifts.filter(
    (s) => !pendingDeletions.some((p) => p.shift.id === s.id)
  );

  const cellShifts = (slotMin: number, day: number) =>
    visibleShifts.filter((s) => s.dayOfWeek === day && s.startMin <= slotMin && s.endMin > slotMin);

  /** Optimistic delete — waits 8s before calling API so user can undo */
  const handleDeleteShift = (shift: Shift) => {
    const timeoutId = setTimeout(() => {
      fetch(`/api/shifts/${shift.id}`, { method: 'DELETE' }).then(() => {
        setPendingDeletions((prev) => prev.filter((p) => p.shift.id !== shift.id));
        setInternalRefresh((n) => n + 1);
      });
    }, 8000);
    setPendingDeletions((prev) => [...prev, { shift, timeoutId }]);
  };

  const handleUndoAll = () => {
    setPendingDeletions((prev) => {
      prev.forEach((p) => clearTimeout(p.timeoutId));
      return [];
    });
  };

  const confirmAll = () => {
    pendingDeletions.forEach((p) => {
      clearTimeout(p.timeoutId);
      fetch(`/api/shifts/${p.shift.id}`, { method: 'DELETE' });
    });
    setPendingDeletions([]);
    setInternalRefresh((n) => n + 1);
  };

  const tableGrid = (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[720px]">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 text-[11px] font-medium text-[#888] w-14 border-b border-[#e5e5e3]">
              Time
            </th>
            {DAYS.map((d, i) => (
              <th key={d}
                className="text-left py-2 px-2 text-[11px] font-medium text-[#888] border-b border-[#e5e5e3] min-w-[96px]">
                <span className="hidden lg:inline">{d}</span>
                <span className="lg:hidden">{DAYS_SHORT[i]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slotMins.map((slotMin, rowIdx) => (
            <tr key={slotMin} data-slot={slotMin} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
              <td className="py-1 px-3 text-[11px] text-[#aaa] font-mono border-r border-[#e5e5e3] whitespace-nowrap align-top">
                {minsToTime(slotMin)}
              </td>
              {DAYS.map((_, dayIdx) => {
                const cells = cellShifts(slotMin, dayIdx);
                return (
                  <td key={dayIdx}
                    className="py-1 px-1.5 border-r border-[#e5e5e3] last:border-r-0 align-top">
                    <div className="flex flex-wrap gap-1">
                      {cells.map((s) => (
                        <span
                          key={`${s.id}-${slotMin}`}
                          title={`${s.memberName} · ${labelOf(s.taskCode)} · ${minsToTime(s.startMin)}–${minsToTime(s.endMin)}`}
                          className="group inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white font-medium whitespace-nowrap"
                          style={{ backgroundColor: colorOf(s.memberName), fontSize: '10px' }}
                        >
                          <strong>{s.memberName.split(' ')[0]}</strong>
                          <span className="opacity-75 mx-0.5">{s.taskCode}</span>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteShift(s)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity leading-none font-bold text-white/90 hover:text-white"
                              title="Remove this shift"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const handleExport = () => {
    window.location.href = `/api/export/schedule?programId=${programId}`;
  };

  const headerBar = (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-[#1a1a1a]">Weekly Schedule</h2>
        {visibleShifts.length > 0 && (
          <span className="text-[11px] bg-gray-100 text-[#888] px-2 py-0.5 rounded-full">
            {visibleShifts.length} shift{visibleShifts.length !== 1 ? 's' : ''}
          </span>
        )}
        {loading && <span className="text-[11px] text-[#bbb]">Loading…</span>}
      </div>
      <div className="flex items-center gap-2">
        {toolbar && (
          <button
            onClick={() => setToolbarOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 transition-colors ${
              toolbarOpen
                ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                : 'text-[#888] border-[#e5e5e3] hover:text-[#1a1a1a] hover:border-[#1a1a1a]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit shifts
          </button>
        )}
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs font-medium text-[#888] border border-[#e5e5e3] rounded-lg px-3 py-1.5 hover:text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
          title="Download schedule as CSV"
        >
          <DownloadIcon />
          Export CSV
        </button>
        <button
          onClick={() => setFullscreen(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-[#888] border border-[#e5e5e3] rounded-lg px-3 py-1.5 hover:text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
          title="Open fullscreen view"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Expand
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Inline table (always visible) ── */}
      <div className="bg-white border border-[#e5e5e3] rounded-xl">
        <div className="border-b border-[#e5e5e3]">{headerBar}</div>

        {/* Collapsible toolbar — smooth height animation via CSS grid trick */}
        {toolbar && (
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
              toolbarOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className={toolbarOpen ? 'overflow-visible' : 'overflow-hidden'}>{toolbar}</div>
          </div>
        )}

        <div ref={scrollWrapRef} className="overflow-y-auto max-h-[520px] p-4">
          {tableGrid}
        </div>
      </div>

      {/* ── Fullscreen overlay ── */}
      {fullscreen && (
        <div className="fixed inset-0 z-30 bg-[#f9f9f8] flex flex-col">
          <div className="sticky top-0 bg-white border-b border-[#e5e5e3] px-5 py-3 flex items-center justify-between z-10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-[#1a1a1a]">Weekly Schedule</h2>
              <span className="text-[11px] text-[#888]">{programName}</span>
              {visibleShifts.length > 0 && (
                <span className="text-[11px] bg-gray-100 text-[#888] px-2 py-0.5 rounded-full">
                  {visibleShifts.length} shift{visibleShifts.length !== 1 ? 's' : ''}
                </span>
              )}
              {loading && <span className="text-[11px] text-[#bbb]">Loading…</span>}
            </div>
            <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs font-medium text-[#888] border border-[#e5e5e3] rounded-lg px-3 py-1.5 hover:text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
              title="Download schedule as CSV"
            >
              <DownloadIcon />
              Export CSV
            </button>
            <button
              onClick={() => setFullscreen(false)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#888] border border-[#e5e5e3] rounded-lg px-3 py-1.5 hover:text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 9L4 4m0 0h5M4 4v5m11-1V4m0 0h-4m4 0l-5 5M9 15l-5 5m0 0h5m-5 0v-5m16 0v5m0 0h-5m5 0l-5-5" />
              </svg>
              Close
            </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-5">{tableGrid}</div>
        </div>
      )}

      {/* ── Undo toast ── */}
      {pendingDeletions.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#1a1a1a] text-white text-sm px-5 py-3 rounded-xl shadow-xl">
          <span>
            {pendingDeletions.length === 1
              ? '1 shift removed'
              : `${pendingDeletions.length} shifts removed`}
          </span>
          <button onClick={handleUndoAll}
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
            Undo
          </button>
          <div className="w-px h-4 bg-white/20" />
          <button onClick={confirmAll}
            className="text-white/50 hover:text-white/80 text-xs transition-colors">
            Confirm now
          </button>
        </div>
      )}
    </>
  );
}
