'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Member, Shift, ShiftType } from '@/types';
import { getBadgeColor } from '@/lib/colors';

interface ScheduleTableProps {
  programId: string | null;
  programName: string;
  members: Member[];
  shiftTypes: ShiftType[];
  refreshTrigger: number;
  isAdmin: boolean;
  toolbar?: React.ReactNode;
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


export function ScheduleTable({
  programId, programName, members, shiftTypes, refreshTrigger, isAdmin, toolbar,
}: ScheduleTableProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  // IDs of shifts hidden optimistically while awaiting the undo window
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  // Tracks which shifts the user clicked Undo on, to cancel the DELETE
  const undoneRef = useRef<Set<string>>(new Set());
  const scrollWrapRef = useRef<HTMLDivElement>(null);
  // Only scroll on program load/change, not on add/delete refreshes
  const shouldScrollRef = useRef(true);

  // Reset isInitialLoad and scroll flag whenever the program selection changes
  useEffect(() => {
    setIsInitialLoad(true);
    shouldScrollRef.current = true;
  }, [programId]);

  // Start at 10:00 by default; if any shift is earlier, expand to cover it
  const slotMins = useMemo(() => {
    const earliest = shifts.length > 0 ? Math.min(...shifts.map((s) => s.startMin)) : DEFAULT_START;
    const start = Math.min(DEFAULT_START, Math.floor(earliest / 30) * 30);
    return Array.from({ length: SLOT_COUNT }, (_, i) => start + i * 30);
  }, [shifts]);

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
      .then((data) => {
        setShifts(Array.isArray(data) ? data : []);
        setIsInitialLoad(false);
      })
      .finally(() => setLoading(false));
  }, [programId]);

  useEffect(() => { fetchShifts(); }, [fetchShifts, refreshTrigger]);


  const colorOf = (name: string) =>
    members.find((m) => m.displayName === name)?.color ?? '#6b7280';

  const labelOf = (code: string) =>
    shiftTypes.find((st) => st.code === code)?.label ?? code;

  const visibleShifts = shifts.filter((s) => !hiddenIds.has(s.id));

  // Map keyed by `${dayOfWeek}|${timeMin}|${memberName}` → Shift
  // Built by expanding each shift across its 30-min slots
  const shiftLookup = useMemo(() => {
    const map = new Map<string, Shift>();
    for (const s of visibleShifts) {
      let t = s.startMin;
      while (t < s.endMin) {
        map.set(`${s.dayOfWeek}|${t}|${s.memberName}`, s);
        t += 30;
      }
    }
    return map;
  }, [visibleShifts]);

  /** Delete a single 30-min slot. If the shift spans multiple slots, splits it. */
  const handleDeleteSlot = (shift: Shift, slotMin: number) => {
    // Optimistically hide the original shift right away
    setHiddenIds((prev) => new Set(prev).add(shift.id));

    // Segments that survive after removing the clicked slot
    const before = slotMin > shift.startMin
      ? { startMin: shift.startMin, endMin: slotMin }
      : null;
    const after = slotMin + 30 < shift.endMin
      ? { startMin: slotMin + 30, endMin: shift.endMin }
      : null;
    const isSplit = before || after;

    const commit = async () => {
      if (undoneRef.current.has(shift.id)) {
        undoneRef.current.delete(shift.id);
        return;
      }
      // Remove original from local state
      setShifts((prev) => prev.filter((s) => s.id !== shift.id));
      setHiddenIds((prev) => { const next = new Set(prev); next.delete(shift.id); return next; });
      await fetch(`/api/shifts/${shift.id}`, { method: 'DELETE' });

      // Re-create the surviving segments
      if (isSplit) {
        const segs = [before, after].filter(Boolean) as { startMin: number; endMin: number }[];
        for (const seg of segs) {
          await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              programId: shift.programId,
              memberNames: [shift.memberName],
              taskCode: shift.taskCode,
              days: [shift.dayOfWeek],
              startMin: seg.startMin,
              endMin: seg.endMin,
              sessions: 1,
            }),
          });
        }
        fetchShifts();
      }
    };

    toast('Slot removed', {
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () => {
          undoneRef.current.add(shift.id);
          setHiddenIds((prev) => { const next = new Set(prev); next.delete(shift.id); return next; });
        },
      },
      onAutoClose: commit,
      onDismiss: commit,
    });
  };

  const skeletonRows = (
    <tbody>
      {Array.from({ length: 12 }).map((_, i) => (
        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
          <td className="py-1 px-3 border-r border-[#e5e5e3] align-top sticky left-0 bg-white z-[1]">
            <div className="h-3 w-9 rounded bg-[#e5e5e3] animate-pulse" />
          </td>
          {DAYS.map((_, j) => {
            const pillCount = (i * 3 + j) % 4 === 0 ? 0 : Math.min(2, members.length);
            return (
              <td key={j} className="py-1 px-1.5 border-r border-[#e5e5e3] last:border-r-0 align-top">
                <div className="flex flex-nowrap gap-1">
                  {Array.from({ length: pillCount }).map((_, k) => {
                    const m = members[k];
                    return (
                      <span
                        key={k}
                        className="inline-block rounded-full animate-pulse"
                        style={{
                          backgroundColor: m ? getBadgeColor(m.color).bg : '#e5e5e3',
                          opacity: 0.5,
                          minWidth: 52,
                          height: 18,
                        }}
                      />
                    );
                  })}
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );

  const dataRows = (
    <tbody>
      {slotMins.map((slotMin, rowIdx) => (
        <tr key={slotMin} data-slot={slotMin} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
          <td className="py-1 px-3 text-[11px] text-[#aaa] font-mono border-r border-[#e5e5e3] whitespace-nowrap align-top sticky left-0 z-[1]"
            style={{ backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
            {minsToTime(slotMin)}
          </td>
          {DAYS.map((_, dayIdx) => {
            if (members.length === 0) {
              // Fallback: show shifts sorted by memberName when no members loaded
              const fallbackShifts = visibleShifts
                .filter((s) => s.dayOfWeek === dayIdx && s.startMin <= slotMin && s.endMin > slotMin)
                .sort((a, b) => a.memberName.localeCompare(b.memberName));
              return (
                <td key={dayIdx}
                  className="py-1 px-1.5 border-r border-[#e5e5e3] last:border-r-0 align-top">
                  <div className="flex flex-nowrap gap-1">
                    {fallbackShifts.map((s) => (
                      <span
                        key={`${s.id}-${slotMin}`}
                        title={`${s.memberName} · ${labelOf(s.taskCode)} · ${minsToTime(s.startMin)}–${minsToTime(s.endMin)}`}
                        className="group inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap border"
                        style={{ backgroundColor: getBadgeColor(colorOf(s.memberName)).bg, borderColor: getBadgeColor(colorOf(s.memberName)).border, color: getBadgeColor(colorOf(s.memberName)).text, fontSize: '10px' }}
                      >
                        <span>{s.memberName.split(' ')[0]}</span>
                        <strong className="mx-0.5">{s.taskCode}</strong>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteSlot(s, slotMin)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity leading-none font-bold"
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
            }

            return (
              <td key={dayIdx}
                className="py-1 px-1.5 border-r border-[#e5e5e3] last:border-r-0 align-top">
                <div className="flex flex-nowrap gap-1">
                  {members.map((m) => {
                    const s = shiftLookup.get(`${dayIdx}|${slotMin}|${m.displayName}`);
                    if (!s) return null;
                    const badge = getBadgeColor(m.color);
                    return (
                      <span
                        key={`${s.id}-${slotMin}`}
                        title={`${s.memberName} · ${labelOf(s.taskCode)} · ${minsToTime(s.startMin)}–${minsToTime(s.endMin)}`}
                        className="group inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap border"
                        style={{ backgroundColor: badge.bg, borderColor: badge.border, color: badge.text, fontSize: '10px' }}
                      >
                        <span>{s.memberName.split(' ')[0]}</span>
                        <strong className="mx-0.5">{s.taskCode}</strong>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteSlot(s, slotMin)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity leading-none font-bold"
                            title="Remove this shift"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );

  const tableGrid = (
    <table className="border-separate border-spacing-0 w-full">
        <thead className="sticky top-0 z-[1]">
          <tr>
            <th className="text-left py-2 px-3 text-[11px] font-medium text-[#888] w-14 border-b border-r border-[#e5e5e3] bg-white sticky left-0 z-[2]">
              Time
            </th>
            {DAYS.map((d, i) => (
              <th key={d}
                className="text-left py-2 px-2 text-[11px] font-medium text-[#888] border-b border-[#e5e5e3] bg-white w-[calc((100%-3.5rem)/7)]">
                <span className="hidden lg:inline">{d}</span>
                <span className="lg:hidden">{DAYS_SHORT[i]}</span>
              </th>
            ))}
          </tr>
        </thead>
        {isInitialLoad && loading ? skeletonRows : dataRows}
      </table>
  );

  const headerBar = (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-[#1a1a1a]">Weekly Schedule</h2>
        {visibleShifts.length > 0 && (
          <span className="text-[11px] bg-gray-100 text-[#888] px-2 py-0.5 rounded-full">
            {visibleShifts.length} shift{visibleShifts.length !== 1 ? 's' : ''}
          </span>
        )}
        {loading && !isInitialLoad && <span className="text-[11px] text-[#bbb]">Loading…</span>}
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

        <div ref={scrollWrapRef} className="overflow-auto max-h-[520px] px-4 pb-4">
          {tableGrid}
        </div>
      </div>

      {/* ── Fullscreen overlay ── */}
      {fullscreen && (
        <div className="fixed inset-0 z-[200] bg-[#f9f9f8] flex flex-col">
          <div className="sticky top-0 bg-white border-b border-[#e5e5e3] px-5 py-3 flex items-center justify-between z-10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-[#1a1a1a]">Weekly Schedule</h2>
              <span className="text-[11px] text-[#888]">{programName}</span>
              {visibleShifts.length > 0 && (
                <span className="text-[11px] bg-gray-100 text-[#888] px-2 py-0.5 rounded-full">
                  {visibleShifts.length} shift{visibleShifts.length !== 1 ? 's' : ''}
                </span>
              )}
              {loading && !isInitialLoad && <span className="text-[11px] text-[#bbb]">Loading…</span>}
            </div>
            <div className="flex items-center gap-2">
            <button
              onClick={() => setFullscreen(false)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#888] border border-[#e5e5e3] rounded-lg px-3 py-1.5 hover:text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto px-5 pb-5">{tableGrid}</div>
        </div>
      )}

    </>
  );
}
