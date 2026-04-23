'use client';

import { useEffect, useRef, useState } from 'react';
import { Member } from '@/types';
import { BADGE_PALETTE, getBadgeColor } from '@/lib/colors';

interface TeamMembersProps {
  members: Member[];
  programId: string;
  isAdmin: boolean;
  onMembersChange: () => void;
}

export function TeamMembers({ members, programId, isAdmin, onMembersChange }: TeamMembersProps) {
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [localColors, setLocalColors] = useState<Record<string, string>>({});
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const customInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpenPickerId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const saveColor = (member: Member, color: string) => {
    setLocalColors((prev) => ({ ...prev, [member.id]: color }));
    clearTimeout(debounceTimers.current[member.id]);
    debounceTimers.current[member.id] = setTimeout(async () => {
      await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      });
      onMembersChange();
    }, 300);
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    setRemoving(true);
    await fetch(`/api/members/${confirmRemove.id}`, { method: 'DELETE' });
    setRemoving(false);
    setConfirmRemove(null);
    onMembersChange();
  };

  return (
    <div className="p-4 space-y-1">
      {members.length === 0 && (
        <p className="text-[11px] text-[#bbb] py-2 text-center">
          No instructors assigned to this program yet.
          <br />
          <span className="text-[10px]">Assign instructors in Settings → Users.</span>
        </p>
      )}

      {members.map((m) => {
        const displayColor = localColors[m.id] ?? m.color;
        const badge = getBadgeColor(displayColor);
        const isOpen = openPickerId === m.id;

        return (
          <div key={m.id} className="flex items-center gap-2.5 px-1 py-1.5 rounded-lg hover:bg-[#f9f9f8] group">

            {/* Color swatch + palette picker */}
            <div className="relative flex-shrink-0" ref={isOpen ? pickerRef : undefined}>
              <button
                disabled={!isAdmin}
                onClick={() => setOpenPickerId(isOpen ? null : m.id)}
                className="w-5 h-5 rounded-full border-2 disabled:cursor-default transition-transform hover:scale-110"
                style={{ backgroundColor: badge.bg, borderColor: badge.border }}
                title={isAdmin ? 'Change color' : m.displayName}
              />

              {isOpen && (
                <div className="absolute left-0 top-7 z-30 bg-white border border-[#e5e5e3] rounded-xl shadow-lg p-2.5 w-[168px]">
                  <div className="grid grid-cols-5 gap-1.5 mb-2">
                    {BADGE_PALETTE.map((c) => (
                      <button
                        key={c.bg}
                        title={c.name}
                        onClick={() => { saveColor(m, c.bg); setOpenPickerId(null); }}
                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none"
                        style={{
                          backgroundColor: c.bg,
                          borderColor: displayColor === c.bg ? c.text : c.border,
                          outline: displayColor === c.bg ? `2px solid ${c.text}` : undefined,
                          outlineOffset: '1px',
                        }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => customInputRefs.current[m.id]?.click()}
                    className="w-full text-[10px] text-[#888] hover:text-[#1a1a1a] py-1 border border-[#e5e5e3] rounded-lg transition-colors hover:border-[#1a1a1a]"
                  >
                    Custom color
                  </button>
                  <input
                    ref={(el) => { customInputRefs.current[m.id] = el; }}
                    type="color"
                    value={displayColor}
                    onChange={(e) => saveColor(m, e.target.value)}
                    className="sr-only"
                    aria-label={`Custom color for ${m.displayName}`}
                  />
                </div>
              )}
            </div>

            <span className="flex-1 text-sm text-[#1a1a1a] truncate">{m.displayName}</span>
            {m.isPending && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex-shrink-0">
                pending
              </span>
            )}

            {isAdmin && (
              <button
                onClick={() => setConfirmRemove(m)}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded text-[#bbb] hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                title={`Remove ${m.displayName} from program`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      {isAdmin && members.length > 0 && (
        <p className="text-[10px] text-[#bbb] pt-2 border-t border-[#f0f0ef]">
          Click a color dot to customize. Assign instructors in Settings → Users.
        </p>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center z-50">
          <div className="bg-white border border-[#e5e5e3] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-[#1a1a1a] mb-1">Remove from program?</h3>
            <p className="text-sm text-[#888] mb-5">
              <strong>{confirmRemove.displayName}</strong> will be removed from this program and all their scheduled shifts will be deleted. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                disabled={removing}
                className="text-sm px-4 py-2 border border-[#e5e5e3] rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="text-sm px-4 py-2 bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca] rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40"
              >
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
