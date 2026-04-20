'use client';

import { useState } from 'react';
import { Member } from '@/types';

interface TeamMembersProps {
  members: Member[];
  programId: string;
  onMembersChange: () => void;
}

export function TeamMembers({ members, programId, onMembersChange }: TeamMembersProps) {
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Member | null>(null);

  const handleAdd = async () => {
    if (!newName.trim() || !programId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, displayName: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to add member'); return; }
      setNewName('');
      onMembersChange();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (member: Member) => {
    await fetch(`/api/members/${member.id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    onMembersChange();
  };

  return (
    /* No outer card — rendered inside a <details> wrapper in Dashboard */
    <div className="p-4">
      {/* Pill badges */}
      <div className="flex flex-wrap gap-2 mb-4 min-h-[36px]">
        {members.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: m.color }}
          >
            {m.displayName}
            <button
              onClick={() => setConfirmDelete(m)}
              className="ml-0.5 leading-none opacity-80 hover:opacity-100 transition-opacity text-sm"
              title={`Remove ${m.displayName}`}
            >
              ×
            </button>
          </span>
        ))}
        {members.length === 0 && (
          <span className="text-[11px] text-[#bbb]">No members yet</span>
        )}
      </div>

      {/* Add member */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Full name…"
          disabled={loading || !programId}
          className="flex-1 text-sm border border-[#e5e5e3] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50"
        />
        <button
          onClick={handleAdd}
          disabled={loading || !newName.trim() || !programId}
          className="text-sm px-4 py-2 bg-[#1a1a1a] text-white rounded-lg disabled:opacity-40 hover:bg-black transition-colors"
        >
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center z-50">
          <div className="bg-white border border-[#e5e5e3] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-[#1a1a1a] mb-1">Remove member?</h3>
            <p className="text-sm text-[#888] mb-5">
              Remove <strong>{confirmDelete.displayName}</strong> and all their scheduled shifts? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="text-sm px-4 py-2 border border-[#e5e5e3] rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="text-sm px-4 py-2 bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca] rounded-lg hover:bg-red-100 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
