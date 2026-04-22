'use client';

import { useEffect, useRef, useState } from 'react';
import { Member, ShiftType } from '@/types';

interface ShiftManagerProps {
  members: Member[];
  shiftTypes: ShiftType[];
  programId: string;
  onShiftChange: () => void;
}

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hr',   value: 60 },
  { label: '2 hrs',  value: 120 },
  { label: '3 hrs',  value: 180 },
  { label: '4 hrs',  value: 240 },
  { label: '8 hrs',  value: 480 },
];

function minsToTime(m: number) {
  const w = m % (24 * 60);
  return `${String(Math.floor(w / 60)).padStart(2, '0')}:${String(w % 60).padStart(2, '0')}`;
}

function startOptions(duration: number) {
  const maxStart = 1560 - duration; // window ends at 02:00 (1560 min)
  const count = Math.floor((maxStart - 480) / 30) + 1;
  return Array.from({ length: count }, (_, i) => 480 + i * 30);
}

type FeedbackMsg = { text: string; kind: 'success' | 'error' };

export function ShiftManager({ members, shiftTypes, programId, onShiftChange }: ShiftManagerProps) {
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const [taskCode, setTaskCode] = useState('');
  const [startMin, setStartMin] = useState(480);
  const [duration, setDuration] = useState(60);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMsg | null>(null);

  const selectedType = shiftTypes.find((st) => st.code === taskCode);
  const isLocked = selectedType?.durationLocked ?? false;
  const safeDuration = Number.isFinite(duration) ? duration : 30;
  const endMin = startMin + safeDuration;

  // When task changes, set duration from the type's durationMin
  useEffect(() => {
    if (!selectedType) return;
    const dur = selectedType.durationMin ?? 30;
    setDuration(dur);
    const opts = startOptions(dur);
    if (opts.length > 0 && !opts.includes(startMin)) setStartMin(opts[opts.length - 1]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskCode]);

  // Clamp start when duration changes
  useEffect(() => {
    const opts = startOptions(duration);
    if (opts.length > 0 && !opts.includes(startMin)) setStartMin(opts[opts.length - 1]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(e.target as Node)) {
        setEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const flash = (text: string, kind: FeedbackMsg['kind']) => {
    setFeedback({ text, kind });
    setTimeout(() => setFeedback(null), 4000);
  };

  const toggleMember = (name: string) =>
    setSelectedMembers((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));

  const toggleDay = (d: number) =>
    setSelectedDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  const handleAction = async (action: 'add' | 'remove') => {
    if (!programId || !selectedMembers.length || !taskCode || !selectedDays.length) {
      flash('Select at least one employee, a task, and one day.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/shifts', {
        method: action === 'add' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, memberNames: selectedMembers, taskCode, days: selectedDays, startMin, endMin, sessions: 1 }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.error ?? 'An error occurred.', 'error'); return; }
      flash(
        action === 'add' ? `Added ${data.created} shift(s).` : `Removed ${data.deleted} shift(s).`,
        'success'
      );
      onShiftChange();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 bg-white border-b border-[#e5e5e3]">

      {/* ── Employees ── */}
      <div className="relative flex-shrink-0" ref={employeeDropdownRef}>
        <button
          onClick={() => setEmployeeDropdownOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs border border-[#e5e5e3] rounded-lg px-2.5 py-1.5 bg-white hover:border-[#1a1a1a] transition-colors min-w-[130px]"
        >
          {selectedMembers.length === 0 ? (
            <span className="text-[#888]">Select instructors…</span>
          ) : selectedMembers.length === 1 ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: members.find((m) => m.displayName === selectedMembers[0])?.color }} />
              <span className="text-[#1a1a1a] truncate max-w-[80px]">{selectedMembers[0]}</span>
            </>
          ) : (
            <>
              <div className="flex -space-x-1">
                {selectedMembers.slice(0, 3).map((name) => (
                  <span key={name} className="w-2.5 h-2.5 rounded-full border border-white flex-shrink-0" style={{ backgroundColor: members.find((m) => m.displayName === name)?.color }} />
                ))}
              </div>
              <span className="text-[#1a1a1a]">{selectedMembers.length} selected</span>
            </>
          )}
          <svg className="w-3 h-3 text-[#aaa] ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {employeeDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e5e3] rounded-xl shadow-lg z-20 min-w-[170px] py-1">
            {members.length === 0 && <p className="text-[11px] text-[#bbb] px-3 py-2">No members</p>}
            {members.map((m) => (
              <button key={m.id} onClick={() => toggleMember(m.displayName)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-xs text-left">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                <span className="flex-1 text-[#1a1a1a]">{m.displayName}</span>
                {selectedMembers.includes(m.displayName) && (
                  <svg className="w-3 h-3 text-[#1a1a1a] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-[#e5e5e3] flex-shrink-0" />

      {/* ── Event type chips ── */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {shiftTypes.map((st) => (
          <button
            key={st.code}
            onClick={() => setTaskCode(taskCode === st.code ? '' : st.code)}
            title={st.label}
            className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full border transition-colors ${
              taskCode === st.code
                ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                : 'bg-white text-[#666] border-[#e5e5e3] hover:border-[#1a1a1a]'
            }`}
          >
            {st.code}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-[#e5e5e3] flex-shrink-0" />

      {/* ── Start time + duration (if not locked) ── */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <select
          value={startMin}
          onChange={(e) => setStartMin(Number(e.target.value))}
          className="text-xs border border-[#e5e5e3] rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          {startOptions(duration).map((m) => (
            <option key={m} value={m}>{minsToTime(m)}</option>
          ))}
        </select>
        {taskCode && !isLocked && (
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="text-xs border border-[#e5e5e3] rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
          >
            {DURATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        {taskCode && (
          <span className="text-[11px] font-mono text-[#888]">
            {minsToTime(startMin)}–{minsToTime(endMin)}
          </span>
        )}
      </div>

      <div className="w-px h-4 bg-[#e5e5e3] flex-shrink-0" />

      {/* ── Days ── */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d, i) => (
          <button
            key={d}
            onClick={() => toggleDay(i)}
            className={`w-7 h-6 text-[10px] font-medium rounded border transition-colors ${
              selectedDays.includes(i)
                ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                : 'bg-white text-[#888] border-[#e5e5e3] hover:border-[#1a1a1a]'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-[#e5e5e3] flex-shrink-0" />

      {/* ── Actions ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => handleAction('add')} disabled={loading || !programId} className="text-xs px-3 py-1.5 bg-[#1a1a1a] text-white rounded-lg disabled:opacity-40 hover:bg-black transition-colors">
          Add
        </button>
        <button onClick={() => handleAction('remove')} disabled={loading || !programId} className="text-xs px-3 py-1.5 bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca] rounded-lg disabled:opacity-40 hover:bg-red-100 transition-colors">
          Remove
        </button>
      </div>

      {feedback && (
        <span className={`text-[11px] px-2.5 py-1 rounded-lg border flex-shrink-0 ${
          feedback.kind === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {feedback.text}
        </span>
      )}
    </div>
  );
}
