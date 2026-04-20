'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface ProgramRow {
  id: string;
  name: string;
  userCount: number;
}

type FeedbackMsg = { text: string; kind: 'success' | 'error' };

export function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ellipsis menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [feedback, setFeedback] = useState<FeedbackMsg | null>(null);

  const flash = (text: string, kind: FeedbackMsg['kind']) => {
    setFeedback({ text, kind });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchData = () =>
    fetch('/api/programs')
      .then((r) => r.json())
      .then((data) => {
        setPrograms(Array.isArray(data) ? data : []);
        setLoading(false);
      });

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (addOpen) setTimeout(() => addInputRef.current?.focus(), 50);
  }, [addOpen]);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  const addProgram = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const res = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) {
      flash(data.error ?? 'Failed to create program.', 'error');
      return;
    }
    flash(`"${newName.trim()}" created.`, 'success');
    setNewName('');
    setAddOpen(false);
    fetchData();
  };

  const saveRename = async (id: string) => {
    if (!editName.trim()) return;
    setSavingId(id);
    const res = await fetch(`/api/programs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    });
    const data = await res.json();
    setSavingId(null);
    if (!res.ok) {
      flash(data.error ?? 'Failed to rename.', 'error');
      return;
    }
    flash('Program renamed.', 'success');
    setEditingId(null);
    fetchData();
  };

  const deleteProgram = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/programs/${confirmDeleteId}`, { method: 'DELETE' });
    setDeleting(false);
    setConfirmDeleteId(null);
    if (!res.ok) {
      flash('Failed to delete program.', 'error');
      return;
    }
    flash('Program deleted.', 'success');
    fetchData();
  };

  const confirmDeleteName = programs.find((p) => p.id === confirmDeleteId)?.name;

  return (
    <div className="min-h-screen bg-[#f9f9f8]">
      {/* Top bar */}
      <div className="bg-white border-b border-[#e5e5e3] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#888] hover:text-[#1a1a1a] hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-sm font-semibold text-[#1a1a1a]">Program Settings</h1>
              {!loading && (
                <p className="text-[11px] text-[#888]">{programs.length} program{programs.length !== 1 ? 's' : ''}</p>
              )}
            </div>
          </div>

          <button
            onClick={() => setAddOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium bg-[#1a1a1a] text-white rounded-lg px-3 py-1.5 hover:bg-black transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add program
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-3">

        {/* Feedback */}
        {feedback && (
          <div className={`text-sm px-4 py-2.5 rounded-xl border ${
            feedback.kind === 'success'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {feedback.text}
          </div>
        )}

        {/* Add form */}
        {addOpen && (
          <div className="bg-white border border-[#e5e5e3] rounded-xl p-4 flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[11px] text-[#888] uppercase tracking-wide font-medium block mb-1.5">
                Program name
              </label>
              <input
                ref={addInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addProgram()}
                placeholder="e.g. Data Science"
                className="w-full text-sm border border-[#e5e5e3] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            <div className="flex items-end gap-2 pb-0.5 mt-5">
              <button
                onClick={addProgram}
                disabled={adding || !newName.trim()}
                className="text-sm px-4 py-2 bg-[#1a1a1a] text-white rounded-lg disabled:opacity-40 hover:bg-black transition-colors"
              >
                {adding ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => { setAddOpen(false); setNewName(''); }}
                className="text-sm px-4 py-2 border border-[#e5e5e3] rounded-lg text-[#888] hover:text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p className="text-sm text-[#888] text-center py-16">Loading…</p>
        ) : (
          <div className="bg-white border border-[#e5e5e3] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e5e3] bg-[#fafafa]">
                  <th className="text-left text-[11px] font-medium text-[#888] uppercase tracking-wide px-5 py-3">Program</th>
                  <th className="text-left text-[11px] font-medium text-[#888] uppercase tracking-wide px-4 py-3">Members</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5e3]">
                {programs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-sm text-[#888]">
                      No programs yet. Add one above.
                    </td>
                  </tr>
                ) : (
                  programs.map((p) => {
                    const isEditing = editingId === p.id;
                    const isMenuOpen = openMenuId === p.id;

                    return (
                      <tr key={p.id} className="hover:bg-[#fafafa] transition-colors">

                        {/* Program name / inline rename */}
                        <td className="px-5 py-3">
                          {isEditing ? (
                            <input
                              autoFocus
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename(p.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="text-sm border border-[#e5e5e3] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/10 w-full max-w-xs"
                            />
                          ) : (
                            <p className="text-sm font-medium text-[#1a1a1a]">{p.name}</p>
                          )}
                        </td>

                        {/* Members count */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveRename(p.id)}
                                disabled={savingId === p.id}
                                className="text-xs px-3 py-1.5 bg-[#1a1a1a] text-white rounded-lg disabled:opacity-40 hover:bg-black transition-colors"
                              >
                                {savingId === p.id ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs px-3 py-1.5 border border-[#e5e5e3] rounded-lg text-[#888] hover:text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-gray-100 text-[#888] border-[#e5e5e3]">
                              {p.userCount} members
                            </span>
                          )}
                        </td>

                        {/* Ellipsis menu */}
                        <td className="px-2 py-3 relative">
                          {!isEditing && (
                            <div ref={isMenuOpen ? menuRef : null} className="relative flex justify-center">
                              <button
                                onClick={() => setOpenMenuId(isMenuOpen ? null : p.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#aaa] hover:text-[#1a1a1a] hover:bg-gray-100 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <circle cx="4" cy="10" r="1.5" />
                                  <circle cx="10" cy="10" r="1.5" />
                                  <circle cx="16" cy="10" r="1.5" />
                                </svg>
                              </button>

                              {isMenuOpen && (
                                <div className="absolute right-0 top-8 z-20 bg-white border border-[#e5e5e3] rounded-xl shadow-lg py-1 min-w-[140px]">
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setEditingId(p.id);
                                      setEditName(p.name);
                                    }}
                                    className="w-full text-left text-xs px-3 py-2 hover:bg-[#f5f5f4] transition-colors text-[#1a1a1a]"
                                  >
                                    Rename
                                  </button>
                                  <button
                                    onClick={() => { setOpenMenuId(null); setConfirmDeleteId(p.id); }}
                                    className="w-full text-left text-xs px-3 py-2 hover:bg-red-50 transition-colors text-red-600"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl border border-[#e5e5e3] p-6 max-w-sm w-full mx-4">
            <h2 className="text-sm font-semibold text-[#1a1a1a] mb-1">Delete program?</h2>
            <p className="text-xs text-[#888] mb-5">
              <span className="font-medium text-[#1a1a1a]">{confirmDeleteName}</span> and all its members and shifts will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="text-sm px-4 py-2 border border-[#e5e5e3] rounded-lg text-[#888] hover:text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteProgram}
                disabled={deleting}
                className="text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
