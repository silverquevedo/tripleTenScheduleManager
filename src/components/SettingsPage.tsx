'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

type Tab = 'users' | 'programs';
type FeedbackMsg = { text: string; kind: 'success' | 'error' };

function useFeedback() {
  const [feedback, setFeedback] = useState<FeedbackMsg | null>(null);
  const flash = (text: string, kind: FeedbackMsg['kind']) => {
    setFeedback({ text, kind });
    setTimeout(() => setFeedback(null), 4000);
  };
  return { feedback, flash };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveUser {
  kind: 'active';
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  isAdmin: boolean;
  isManager: boolean;
  defaultProgramId: string | null;
}

interface PendingUser {
  kind: 'pending';
  email: string;
  isManager: boolean;
  isLeadInstructor: boolean;
  defaultProgramId: string | null;
}

type UserRow = ActiveUser | PendingUser;

interface ProgramOption {
  id: string;
  name: string;
  userCount: number;
}

// ─── Users tab ────────────────────────────────────────────────────────────────

function UsersTab({ superAdmin, currentEmail }: { superAdmin: boolean; currentEmail?: string | null }) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [settingProgram, setSettingProgram] = useState<string | null>(null);
  const [openMenuEmail, setOpenMenuEmail] = useState<string | null>(null);
  const [confirmRemoveEmail, setConfirmRemoveEmail] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [filterProgramId, setFilterProgramId] = useState<string>('');
  const [sort, setSort] = useState<{ col: 'name' | 'status' | 'role' | 'program'; dir: 'asc' | 'desc' }>({ col: 'name', dir: 'asc' });
  const menuRef = useRef<HTMLDivElement>(null);
  const { feedback, flash } = useFeedback();

  const toggleSort = (col: typeof sort.col) =>
    setSort((s) => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));

  const roleWeight = (row: UserRow) => {
    if (row.isManager) return 3;
    if (row.kind === 'active') return row.isAdmin ? 2 : 1;
    return row.isLeadInstructor ? 2 : 1;
  };
  const rowDisplayName = (row: UserRow) =>
    row.kind === 'active' ? (row.name ?? row.email ?? '') : row.email;
  const rowProgramName = (row: UserRow) =>
    programs.find((p) => p.id === row.defaultProgramId)?.name ?? '';

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'instructor' | 'leadInstructor' | 'manager'>('instructor');
  const [inviteProgramId, setInviteProgramId] = useState<string>('');
  const [inviting, setInviting] = useState(false);
  const inviteInputRef = useRef<HTMLInputElement>(null);

  const fetchData = () =>
    Promise.all([
      fetch('/api/admin/users').then((r) => r.json()),
      fetch('/api/programs').then((r) => r.json()),
    ]).then(([{ registeredUsers, pendingAdmins }, progs]) => {
      const active: ActiveUser[] = (registeredUsers ?? []).map(
        (u: Omit<ActiveUser, 'kind'>) => ({ kind: 'active' as const, ...u })
      );
      const pending: PendingUser[] = (pendingAdmins ?? []).map(
        (p: { email: string; defaultProgramId: string | null; isManager: boolean; isLeadInstructor: boolean }) => ({ kind: 'pending' as const, ...p })
      );
      setRows([...active, ...pending]);
      setPrograms(Array.isArray(progs) ? progs : []);
      setLoading(false);
    });

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (inviteOpen) setTimeout(() => inviteInputRef.current?.focus(), 50); }, [inviteOpen]);
  useEffect(() => {
    if (!openMenuEmail) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuEmail(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuEmail]);

  const toggleAdmin = async (email: string, grant: boolean) => {
    setToggling(email);
    setOpenMenuEmail(null);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, grant }),
    });
    fetchData();
    setToggling(null);
  };

  const toggleManager = async (email: string, grant: boolean) => {
    setToggling(email);
    setOpenMenuEmail(null);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, grantManager: grant }),
    });
    fetchData();
    setToggling(null);
  };

  const setDefaultProgram = async (email: string, defaultProgramId: string) => {
    setSettingProgram(email);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, defaultProgramId }),
    });
    if (!res.ok) flash('Failed to save. Please try again.', 'error');
    else fetchData();
    setSettingProgram(null);
  };

  const removeUser = async () => {
    if (!confirmRemoveEmail) return;
    setRemoving(true);
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: confirmRemoveEmail }),
    });
    const data = await res.json();
    setRemoving(false);
    setConfirmRemoveEmail(null);
    if (!res.ok) flash(data.error ?? 'Failed to remove user.', 'error');
    else { flash(`${confirmRemoveEmail} removed.`, 'success'); fetchData(); }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, programId: inviteProgramId || undefined }),
    });
    const data = await res.json();
    setInviting(false);
    if (!res.ok) { flash(data.error ?? 'Failed to invite.', 'error'); return; }
    flash(
      data.emailSent
        ? `Invite sent to ${inviteEmail.trim()}`
        : `${inviteEmail.trim()} added. (Configure SMTP to send email invites)`,
      'success'
    );
    setInviteEmail('');
    setInviteRole('instructor');
    setInviteProgramId('');
    setInviteOpen(false);
    fetchData();
  };

  const activeCount = rows.filter((r) => r.kind === 'active').length;
  const pendingCount = rows.filter((r) => r.kind === 'pending').length;
  const filteredRows = filterProgramId
    ? rows.filter((r) => r.defaultProgramId === filterProgramId)
    : rows;
  const d = sort.dir === 'asc' ? 1 : -1;
  const sortedRows = [...filteredRows].sort((a, b) => {
    switch (sort.col) {
      case 'name':    return d * rowDisplayName(a).localeCompare(rowDisplayName(b));
      case 'status':  return d * ((a.kind === 'active' ? 0 : 1) - (b.kind === 'active' ? 0 : 1));
      case 'role':    return d * (roleWeight(a) - roleWeight(b));
      case 'program': return d * rowProgramName(a).localeCompare(rowProgramName(b));
      default: return 0;
    }
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1a1a1a]">Users</p>
          {!loading && (
            <p className="text-[11px] text-[#888]">{activeCount} active · {pendingCount} pending</p>
          )}
        </div>
        <button
          onClick={() => setInviteOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium bg-[#1a1a1a] text-white rounded-lg px-3 py-1.5 hover:bg-black transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Invite user
        </button>
      </div>

      {feedback && (
        <div className={`text-sm px-4 py-2.5 rounded-xl border ${
          feedback.kind === 'success'
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {feedback.text}
        </div>
      )}

      {inviteOpen && (
        <div className="bg-white border border-[#e5e5e3] rounded-xl p-4 space-y-3">
          <div className="flex gap-3 flex-wrap">
            {/* Email */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] text-[#888] uppercase tracking-wide font-medium block mb-1.5">
                Email address
              </label>
              <input
                ref={inviteInputRef}
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
                placeholder="name@example.com"
                className="w-full text-sm border border-[#e5e5e3] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>

            {/* Role — managers only */}
            {superAdmin && (
              <div>
                <label className="text-[11px] text-[#888] uppercase tracking-wide font-medium block mb-1.5">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  className="text-sm border border-[#e5e5e3] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="instructor">Instructor</option>
                  <option value="leadInstructor">Lead Instructor</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            )}

            {/* Program */}
            <div>
              <label className="text-[11px] text-[#888] uppercase tracking-wide font-medium block mb-1.5">
                Program
              </label>
              <select
                value={inviteProgramId}
                onChange={(e) => setInviteProgramId(e.target.value)}
                className="text-sm border border-[#e5e5e3] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                <option value="">— None —</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="text-sm px-4 py-2 bg-[#1a1a1a] text-white rounded-lg disabled:opacity-40 hover:bg-black transition-colors"
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
            <button
              onClick={() => { setInviteOpen(false); setInviteEmail(''); setInviteRole('instructor'); setInviteProgramId(''); }}
              className="text-sm px-4 py-2 border border-[#e5e5e3] rounded-lg text-[#888] hover:text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {!loading && programs.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#888] uppercase tracking-wide font-medium">Filter by program</span>
          <select
            value={filterProgramId}
            onChange={(e) => setFilterProgramId(e.target.value)}
            className="text-xs border border-[#e5e5e3] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
          >
            <option value="">All programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {filterProgramId && (
            <button
              onClick={() => setFilterProgramId('')}
              className="text-[11px] text-[#888] hover:text-[#1a1a1a] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#888] text-center py-16">Loading…</p>
      ) : (
        <div className="bg-white border border-[#e5e5e3] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e5e3] bg-[#fafafa]">
                {(['name','status','role','program'] as const).map((col) => (
                  <th key={col} className={`text-left text-[11px] font-medium text-[#888] uppercase tracking-wide py-3 ${col === 'name' ? 'px-5' : 'px-4'}`}>
                    <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-[#1a1a1a] transition-colors">
                      {col.charAt(0).toUpperCase() + col.slice(1)}
                      <span className={`text-[10px] ${sort.col === col ? 'text-[#1a1a1a]' : 'text-[#ccc]'}`}>
                        {sort.col === col ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e3]">
              {sortedRows.map((row) => {
                const isSelf = row.kind === 'active' && row.email === currentEmail;
                const isMenuOpen = openMenuEmail === row.email;
                const isActive = row.kind === 'active';
                const isRowManager = row.isManager;
                const isInstructor = row.kind === 'active' && !row.isAdmin;
                const showMenu = !isSelf && (superAdmin || isInstructor);

                return (
                  <tr key={row.email} className="hover:bg-[#fafafa] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {row.kind === 'active' && row.image ? (
                          <Image
                            src={row.image} alt={row.name ?? ''} width={32} height={32}
                            className="rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-100 border border-[#e5e5e3] flex items-center justify-center text-xs text-[#bbb] flex-shrink-0">
                            {row.email[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          {row.kind === 'active' ? (
                            <>
                              <p className="text-sm font-medium text-[#1a1a1a] truncate">
                                {row.name ?? '—'}
                                {isSelf && <span className="ml-1.5 text-[10px] text-[#888]">(you)</span>}
                              </p>
                              <p className="text-[11px] text-[#888] truncate">{row.email}</p>
                            </>
                          ) : (
                            <p className="text-sm text-[#888] truncate">{row.email}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {row.kind === 'active' ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                          Pending
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        isRowManager
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : isInstructor
                            ? 'bg-gray-100 text-[#888] border-[#e5e5e3]'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {isRowManager
                          ? 'Manager'
                          : row.kind === 'active'
                            ? (row.isAdmin ? 'Lead Instructor' : 'Instructor')
                            : row.isLeadInstructor
                              ? 'Lead Instructor'
                              : 'Instructor'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={row.defaultProgramId ?? ''}
                          disabled={settingProgram === row.email}
                          onChange={(e) => setDefaultProgram(row.email, e.target.value)}
                          className="text-xs border border-[#e5e5e3] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-40 min-w-[140px]"
                        >
                          <option value="">— None (see all) —</option>
                          {programs.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {settingProgram === row.email && (
                          <span className="text-[10px] text-[#888]">Saving…</span>
                        )}
                      </div>
                    </td>

                    <td className="px-2 py-3 relative">
                      {showMenu && (
                        <div ref={isMenuOpen ? menuRef : null} className="relative flex justify-center">
                          <button
                            onClick={() => setOpenMenuEmail(isMenuOpen ? null : row.email)}
                            disabled={toggling === row.email}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#aaa] hover:text-[#1a1a1a] hover:bg-gray-100 transition-colors disabled:opacity-40"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <circle cx="4" cy="10" r="1.5" />
                              <circle cx="10" cy="10" r="1.5" />
                              <circle cx="16" cy="10" r="1.5" />
                            </svg>
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-8 z-20 bg-white border border-[#e5e5e3] rounded-xl shadow-lg py-1 min-w-[180px]">
                              {/* Manager options */}
                              {superAdmin && isActive && isRowManager && (
                                <button
                                  onClick={() => toggleManager(row.email, false)}
                                  className="w-full text-left text-xs px-3 py-2 hover:bg-[#f5f5f4] transition-colors text-[#1a1a1a]"
                                >
                                  Revoke manager
                                </button>
                              )}
                              {superAdmin && isActive && !isRowManager && row.isAdmin && (
                                <>
                                  <button
                                    onClick={() => toggleAdmin(row.email, false)}
                                    className="w-full text-left text-xs px-3 py-2 hover:bg-[#f5f5f4] transition-colors text-[#1a1a1a]"
                                  >
                                    Revoke lead instructor
                                  </button>
                                  <button
                                    onClick={() => toggleManager(row.email, true)}
                                    className="w-full text-left text-xs px-3 py-2 hover:bg-[#f5f5f4] transition-colors text-[#1a1a1a]"
                                  >
                                    Make manager
                                  </button>
                                </>
                              )}
                              {superAdmin && isActive && isInstructor && (
                                <>
                                  <button
                                    onClick={() => toggleAdmin(row.email, true)}
                                    className="w-full text-left text-xs px-3 py-2 hover:bg-[#f5f5f4] transition-colors text-[#1a1a1a]"
                                  >
                                    Make lead instructor
                                  </button>
                                  <button
                                    onClick={() => toggleManager(row.email, true)}
                                    className="w-full text-left text-xs px-3 py-2 hover:bg-[#f5f5f4] transition-colors text-[#1a1a1a]"
                                  >
                                    Make manager
                                  </button>
                                </>
                              )}
                              {superAdmin && !isActive && (
                                <button
                                  onClick={() => toggleManager(row.email, true)}
                                  className="w-full text-left text-xs px-3 py-2 hover:bg-[#f5f5f4] transition-colors text-[#1a1a1a]"
                                >
                                  Make manager
                                </button>
                              )}
                              <button
                                onClick={() => { setOpenMenuEmail(null); setConfirmRemoveEmail(row.email); }}
                                className="w-full text-left text-xs px-3 py-2 hover:bg-red-50 transition-colors text-red-600"
                              >
                                Remove user
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmRemoveEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl border border-[#e5e5e3] p-6 max-w-sm w-full mx-4">
            <h2 className="text-sm font-semibold text-[#1a1a1a] mb-1">Remove user?</h2>
            <p className="text-xs text-[#888] mb-5">
              <span className="font-medium text-[#1a1a1a]">{confirmRemoveEmail}</span> will be removed and lose all access.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRemoveEmail(null)}
                disabled={removing}
                className="text-sm px-4 py-2 border border-[#e5e5e3] rounded-lg text-[#888] hover:text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={removeUser}
                disabled={removing}
                className="text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
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

// ─── Programs tab ─────────────────────────────────────────────────────────────

interface ProgramRow {
  id: string;
  name: string;
  userCount: number;
}

function ProgramsTab({ superAdmin }: { superAdmin: boolean }) {
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ col: 'name' | 'members'; dir: 'asc' | 'desc' }>({ col: 'name', dir: 'asc' });
  const menuRef = useRef<HTMLDivElement>(null);
  const { feedback, flash } = useFeedback();

  const toggleSort = (col: typeof sort.col) =>
    setSort((s) => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));

  const fetchData = () =>
    fetch('/api/programs')
      .then((r) => r.json())
      .then((data) => { setPrograms(Array.isArray(data) ? data : []); setLoading(false); });

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (addOpen) setTimeout(() => addInputRef.current?.focus(), 50); }, [addOpen]);
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
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
    if (!res.ok) { flash(data.error ?? 'Failed to create program.', 'error'); return; }
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
    if (!res.ok) { flash(data.error ?? 'Failed to rename.', 'error'); return; }
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
    if (!res.ok) { flash('Failed to delete program.', 'error'); return; }
    flash('Program deleted.', 'success');
    fetchData();
  };

  const confirmDeleteName = programs.find((p) => p.id === confirmDeleteId)?.name;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1a1a1a]">Programs</p>
          {!loading && (
            <p className="text-[11px] text-[#888]">{programs.length} program{programs.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        {superAdmin && (
          <button
            onClick={() => setAddOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium bg-[#1a1a1a] text-white rounded-lg px-3 py-1.5 hover:bg-black transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add program
          </button>
        )}
      </div>

      {feedback && (
        <div className={`text-sm px-4 py-2.5 rounded-xl border ${
          feedback.kind === 'success'
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {feedback.text}
        </div>
      )}

      {addOpen && superAdmin && (
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

      {loading ? (
        <p className="text-sm text-[#888] text-center py-16">Loading…</p>
      ) : (
        <div className="bg-white border border-[#e5e5e3] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e5e3] bg-[#fafafa]">
                {([['name','Program','px-5'],['members','Members','px-4']] as const).map(([col, label, px]) => (
                  <th key={col} className={`text-left text-[11px] font-medium text-[#888] uppercase tracking-wide ${px} py-3`}>
                    <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-[#1a1a1a] transition-colors">
                      {label}
                      <span className={`text-[10px] ${sort.col === col ? 'text-[#1a1a1a]' : 'text-[#ccc]'}`}>
                        {sort.col === col ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e3]">
              {programs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-sm text-[#888]">
                    No programs yet.
                  </td>
                </tr>
              ) : [...programs].sort((a, b) => {
                const d = sort.dir === 'asc' ? 1 : -1;
                return sort.col === 'members'
                  ? d * (a.userCount - b.userCount)
                  : d * a.name.localeCompare(b.name);
              }).map((p) => {
                const isEditing = editingId === p.id;
                const isMenuOpen = openMenuId === p.id;

                return (
                  <tr key={p.id} className="hover:bg-[#fafafa] transition-colors">
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
                                onClick={() => { setOpenMenuId(null); setEditingId(p.id); setEditName(p.name); }}
                                className="w-full text-left text-xs px-3 py-2 hover:bg-[#f5f5f4] transition-colors text-[#1a1a1a]"
                              >
                                Rename
                              </button>
                              {superAdmin && (
                                <button
                                  onClick={() => { setOpenMenuId(null); setConfirmDeleteId(p.id); }}
                                  className="w-full text-left text-xs px-3 py-2 hover:bg-red-50 transition-colors text-red-600"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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

// ─── Shell ────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { data: session, update } = useSession();
  const superAdmin = session?.user?.isManager ?? false;

  useEffect(() => { update(); }, []);
  const [tab, setTab] = useState<Tab>('users');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'users', label: 'Users' },
    { id: 'programs', label: 'Programs' },
  ];

  return (
    <div className="min-h-screen bg-[#f9f9f8]">
      {/* Top bar */}
      <div className="bg-white border-b border-[#e5e5e3] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#888] hover:text-[#1a1a1a] hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-sm font-semibold text-[#1a1a1a]">Settings</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex gap-6 items-start">
        {/* Sidebar */}
        <nav className="w-44 shrink-0 space-y-0.5 sticky top-6 self-start">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                tab === id
                  ? 'bg-[#1a1a1a] text-white font-medium'
                  : 'text-[#555] hover:bg-gray-100 hover:text-[#1a1a1a]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'users' && (
            <UsersTab superAdmin={superAdmin} currentEmail={session?.user?.email} />
          )}
          {tab === 'programs' && (
            <ProgramsTab superAdmin={superAdmin} />
          )}
        </div>
      </div>
    </div>
  );
}
