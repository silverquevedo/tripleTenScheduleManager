'use client';

import { useState } from 'react';
import { Member } from '@/types';

interface ClearScheduleProps {
  members: Member[];
  programId: string;
  onCleared: () => void;
}

type FeedbackMsg = { text: string; kind: 'success' | 'error' };

export function ClearSchedule({ members, programId, onCleared }: ClearScheduleProps) {
  const [selectedMember, setSelectedMember] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMsg | null>(null);

  const flash = (text: string, kind: FeedbackMsg['kind']) => {
    setFeedback({ text, kind });
    setTimeout(() => setFeedback(null), 4000);
  };

  const isAll = selectedMember === '__all__';

  const handleClear = async () => {
    if (!programId || !selectedMember) return;
    setLoading(true);
    setConfirmOpen(false);
    try {
      const res = await fetch('/api/shifts/clear', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, memberName: isAll ? null : selectedMember }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.error ?? 'Failed to clear.', 'error'); return; }
      flash(
        isAll
          ? `Cleared all ${data.deleted} shift(s) in this program.`
          : `Cleared ${data.deleted} shift(s) for ${selectedMember}.`,
        'success',
      );
      onCleared();
    } finally {
      setLoading(false);
    }
  };

  return (
    /* No outer card — this is rendered inside a <details> wrapper in Dashboard */
    <div className="p-4 space-y-3">
      <div>
        <label className="text-[11px] text-[#888] uppercase tracking-wide block mb-1.5">
          Employee
        </label>
        <select
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
          className="w-full text-sm border border-[#e5e5e3] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          <option value="">Select employee…</option>
          <option value="__all__">All employees</option>
          {members.map((m) => (
            <option key={m.id} value={m.displayName}>{m.displayName}</option>
          ))}
        </select>
      </div>

      <button
        onClick={() => setConfirmOpen(true)}
        disabled={!selectedMember || loading || !programId}
        className="w-full text-sm px-4 py-2 bg-[#fffbeb] text-[#92400e] border border-[#fcd34d] rounded-lg disabled:opacity-40 hover:bg-yellow-100 transition-colors"
      >
        Clear all shifts
      </button>

      {feedback && (
        <p className={`text-sm px-3 py-2 rounded-lg border ${
          feedback.kind === 'success'
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {feedback.text}
        </p>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center z-50">
          <div className="bg-white border border-[#e5e5e3] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-[#1a1a1a] mb-1">
              {isAll ? 'Clear entire schedule?' : 'Clear all shifts?'}
            </h3>
            <p className="text-sm text-[#888] mb-5">
              {isAll ? (
                <>
                  <strong className="text-red-600">All shifts for every employee</strong> in this program will be permanently deleted. This action cannot be undone.
                </>
              ) : (
                <>All shifts for <strong>{selectedMember}</strong> in this program will be permanently deleted.</>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmOpen(false)}
                className="text-sm px-4 py-2 border border-[#e5e5e3] rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleClear}
                className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                  isAll
                    ? 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100'
                    : 'bg-[#fffbeb] text-[#92400e] border border-[#fcd34d] hover:bg-yellow-100'
                }`}>
                {isAll ? 'Delete everything' : 'Clear shifts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
