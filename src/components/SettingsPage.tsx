'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

type Tab = 'users' | 'programs' | 'events';

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
  isActive: boolean;
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
  const [inviteSendNow, setInviteSendNow] = useState(true);
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
        (p: { email: string; defaultProgramId: string | null; isManager: boolean; isLeadInstructor: boolean; isActive: boolean }) => ({ kind: 'pending' as const, ...p })
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
    if (!res.ok) toast.error('Failed to save. Please try again.');
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
    if (!res.ok) toast.error(data.error ?? 'Failed to remove user.');
    else { toast.success(`${confirmRemoveEmail} removed.`); fetchData(); }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, programId: inviteProgramId || undefined, sendInvite: inviteSendNow }),
    });
    const data = await res.json();
    setInviting(false);
    if (!res.ok) { toast.error(data.error ?? 'Failed to add.'); return; }
    toast.success(
      inviteSendNow
        ? (data.emailSent ? `Invite sent to ${inviteEmail.trim()}` : `${inviteEmail.trim()} added with access.`)
        : `${inviteEmail.trim()} added as draft.`
    );
    setInviteEmail('');
    setInviteRole('instructor');
    setInviteProgramId('');
    setInviteSendNow(true);
    setInviteOpen(false);
    fetchData();
  };

  const sendInviteToUser = async (email: string) => {
    setToggling(email);
    setOpenMenuEmail(null);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, sendInvite: true }),
    });
    toast.success(`Access granted to ${email}.`);
    fetchData();
    setToggling(null);
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

          {/* Send invite toggle */}
          <label className="flex items-center gap-2.5 text-xs text-[#555] cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={inviteSendNow}
              onChange={(e) => setInviteSendNow(e.target.checked)}
              className="w-3.5 h-3.5 rounded"
            />
            <span>
              {inviteSendNow
                ? 'Give access now (can sign in immediately)'
                : 'Draft only — add to schedule without access'}
            </span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="text-sm px-4 py-2 bg-[#1a1a1a] text-white rounded-lg disabled:opacity-40 hover:bg-black transition-colors"
            >
              {inviting ? 'Adding…' : inviteSendNow ? 'Send invite' : 'Add as draft'}
            </button>
            <button
              onClick={() => { setInviteOpen(false); setInviteEmail(''); setInviteRole('instructor'); setInviteProgramId(''); setInviteSendNow(true); }}
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
        <div className="bg-white border border-[#e5e5e3] rounded-xl">
          <table className="w-full">
            <thead className="overflow-hidden rounded-t-xl">
              <tr className="border-b border-[#e5e5e3] bg-[#fafafa]">
                {['Name','Status','Role','Program',''].map((h, i) => (
                  <th key={i} className={`py-3 ${i === 0 ? 'px-5' : 'px-4'}`}>
                    {h && <div className="h-3 w-12 rounded bg-[#e5e5e3] animate-pulse" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e3]">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#e5e5e3] animate-pulse flex-shrink-0" />
                      <div className="space-y-1.5">
                        <div className="h-3 rounded bg-[#e5e5e3] animate-pulse" style={{ width: 80 + (i * 17) % 60 }} />
                        <div className="h-2.5 rounded bg-[#e5e5e3] animate-pulse" style={{ width: 120 + (i * 11) % 40 }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><div className="h-5 w-14 rounded-full bg-[#e5e5e3] animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-[#e5e5e3] animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-7 w-36 rounded-lg bg-[#e5e5e3] animate-pulse" /></td>
                  <td className="px-2 py-3"><div className="w-7 h-7 rounded-lg bg-[#e5e5e3] animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-[#e5e5e3] rounded-xl">
          <table className="w-full">
            <thead className="sticky top-14 z-[2] overflow-hidden rounded-t-xl">
              <tr className="border-b border-[#e5e5e3] bg-[#fafafa]">
                {(['name','status','role','program'] as const).map((col) => (
                  <th key={col} className={`text-left text-[11px] font-medium text-[#888] uppercase tracking-wide py-3 bg-[#fafafa] ${col === 'name' ? 'px-5' : 'px-4'}`}>
                    <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-[#1a1a1a] transition-colors">
                      {col.charAt(0).toUpperCase() + col.slice(1)}
                      <span className={`text-[10px] ${sort.col === col ? 'text-[#1a1a1a]' : 'text-[#ccc]'}`}>
                        {sort.col === col ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="w-10 px-4 py-3 bg-[#fafafa]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e3]">
              {sortedRows.map((row) => {
                const isSelf = row.kind === 'active' && row.email === currentEmail;
                const isMenuOpen = openMenuEmail === row.email;
                const isRegistered = row.kind === 'active';
                const isDraft = row.kind === 'pending' && !row.isActive;
                const isPending = row.kind === 'pending' && row.isActive;
                const isRowManager = row.isManager;
                const isInstructor = row.kind === 'active' && !row.isAdmin;
                const isPendingRegular = row.kind === 'pending' && !row.isManager && !row.isLeadInstructor;
                const showMenu = !isSelf && (superAdmin || isInstructor || isPendingRegular);

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
                      {isRegistered ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
                          Active
                        </span>
                      ) : isDraft ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-gray-100 text-[#888] border-[#e5e5e3]">
                          Draft
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
                          : isRegistered
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
                              {/* Draft → activate access; Pending → resend email */}
                              {(isDraft || isPending) && (
                                <button
                                  onClick={() => sendInviteToUser(row.email)}
                                  className="w-full text-left text-xs px-3 py-2 hover:bg-[#f5f5f4] transition-colors text-[#1a1a1a]"
                                >
                                  {isDraft ? 'Send invite' : 'Resend invite'}
                                </button>
                              )}
                              {/* Registered user role options */}
                              {superAdmin && isRegistered && isRowManager && (
                                <button
                                  onClick={() => toggleManager(row.email, false)}
                                  className="w-full text-left text-xs px-3 py-2 hover:bg-[#f5f5f4] transition-colors text-[#1a1a1a]"
                                >
                                  Revoke manager
                                </button>
                              )}
                              {superAdmin && isRegistered && !isRowManager && row.isAdmin && (
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
                              {superAdmin && isRegistered && isInstructor && (
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
    if (!res.ok) { toast.error(data.error ?? 'Failed to create program.'); return; }
    toast.success(`"${newName.trim()}" created.`);
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
    if (!res.ok) { toast.error(data.error ?? 'Failed to rename.'); return; }
    toast.success('Program renamed.');
    setEditingId(null);
    fetchData();
  };

  const deleteProgram = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/programs/${confirmDeleteId}`, { method: 'DELETE' });
    setDeleting(false);
    setConfirmDeleteId(null);
    if (!res.ok) { toast.error('Failed to delete program.'); return; }
    toast.success('Program deleted.');
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
        <div className="bg-white border border-[#e5e5e3] rounded-xl">
          <table className="w-full">
            <thead className="overflow-hidden rounded-t-xl">
              <tr className="border-b border-[#e5e5e3] bg-[#fafafa]">
                {['Program','Members',''].map((h, i) => (
                  <th key={i} className={`py-3 ${i === 0 ? 'px-5' : 'px-4'}`}>
                    {h && <div className="h-3 w-14 rounded bg-[#e5e5e3] animate-pulse" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e3]">
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-3"><div className="h-3.5 rounded bg-[#e5e5e3] animate-pulse" style={{ width: 60 + (i * 23) % 50 }} /></td>
                  <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-[#e5e5e3] animate-pulse" /></td>
                  <td className="px-2 py-3"><div className="w-7 h-7 rounded-lg bg-[#e5e5e3] animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-[#e5e5e3] rounded-xl">
          <table className="w-full">
            <thead className="sticky top-14 z-[2] overflow-hidden rounded-t-xl">
              <tr className="border-b border-[#e5e5e3] bg-[#fafafa]">
                {([['name','Program','px-5'],['members','Members','px-4']] as const).map(([col, label, px]) => (
                  <th key={col} className={`text-left text-[11px] font-medium text-[#888] uppercase tracking-wide ${px} py-3 bg-[#fafafa]`}>
                    <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-[#1a1a1a] transition-colors">
                      {label}
                      <span className={`text-[10px] ${sort.col === col ? 'text-[#1a1a1a]' : 'text-[#ccc]'}`}>
                        {sort.col === col ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="w-10 px-4 py-3 bg-[#fafafa]"></th>
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

// ─── Events tab ───────────────────────────────────────────────────────────────

interface EventTypeRow {
  code: string;
  label: string;
  durationMin: number;
  durationLocked: boolean;
  shiftCount: number;
}

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hr',   value: 60 },
  { label: '1.5 hrs', value: 90 },
  { label: '2 hrs',  value: 120 },
  { label: '3 hrs',  value: 180 },
  { label: '4 hrs',  value: 240 },
  { label: '8 hrs',  value: 480 },
];

function EventsTab({ superAdmin }: { superAdmin: boolean }) {
  const [events, setEvents] = useState<EventTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDuration, setNewDuration] = useState(30);
  const [newLocked, setNewLocked] = useState(false);
  const [adding, setAdding] = useState(false);
  const addCodeRef = useRef<HTMLInputElement>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editDuration, setEditDuration] = useState(30);
  const [editLocked, setEditLocked] = useState(false);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = () =>
    fetch('/api/shift-types').then((r) => r.json()).then((data) => {
      setEvents(Array.isArray(data) ? data : []);
      setLoading(false);
    });

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (addOpen) setTimeout(() => addCodeRef.current?.focus(), 50); }, [addOpen]);

  const addEvent = async () => {
    if (!newCode.trim() || !newLabel.trim()) return;
    setAdding(true);
    const res = await fetch('/api/shift-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newCode.trim(), label: newLabel.trim(), durationMin: newDuration, durationLocked: newLocked }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) { toast.error(data.error ?? 'Failed to create event type.'); return; }
    toast.success(`"${newCode.trim().toUpperCase()}" created.`);
    setNewCode(''); setNewLabel(''); setNewDuration(30); setNewLocked(false); setAddOpen(false);
    fetchData();
  };

  const startEdit = (ev: EventTypeRow) => {
    setEditingCode(ev.code);
    setEditCode(ev.code);
    setEditLabel(ev.label);
    setEditDuration(ev.durationMin);
    setEditLocked(ev.durationLocked);
  };

  const saveEdit = async (code: string) => {
    setSavingCode(code);
    try {
      const res = await fetch(`/api/shift-types/${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: editCode, label: editLabel, durationMin: editDuration, durationLocked: editLocked }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save.'); return; }
      toast.success('Event type updated.');
      setEditingCode(null);
      fetchData();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSavingCode(null);
    }
  };

  const deleteEvent = async () => {
    if (!confirmDeleteCode) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/shift-types/${encodeURIComponent(confirmDeleteCode)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to delete.'); return; }
      toast.success('Event type deleted.');
      fetchData();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setDeleting(false);
      setConfirmDeleteCode(null);
    }
  };

  const confirmDeleteName = events.find((e) => e.code === confirmDeleteCode)?.label;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1a1a1a]">Event Types</p>
          {!loading && <p className="text-[11px] text-[#888]">{events.length} type{events.length !== 1 ? 's' : ''}</p>}
        </div>
        {superAdmin && (
          <button
            onClick={() => setAddOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium bg-[#1a1a1a] text-white rounded-lg px-3 py-1.5 hover:bg-black transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add event type
          </button>
        )}
      </div>

      {addOpen && superAdmin && (
        <div className="bg-white border border-[#e5e5e3] rounded-xl p-4 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="text-[11px] text-[#888] uppercase tracking-wide font-medium block mb-1.5">Code</label>
              <input
                ref={addCodeRef}
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && addEvent()}
                placeholder="e.g. MTG"
                maxLength={8}
                className="w-24 text-sm border border-[#e5e5e3] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 font-mono uppercase"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-[11px] text-[#888] uppercase tracking-wide font-medium block mb-1.5">Label</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEvent()}
                placeholder="e.g. Team Meeting"
                className="w-full text-sm border border-[#e5e5e3] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#888] uppercase tracking-wide font-medium block mb-1.5">Duration</label>
              <select
                value={newDuration}
                onChange={(e) => setNewDuration(Number(e.target.value))}
                className="text-sm border border-[#e5e5e3] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col justify-end pb-2">
              <label className="flex items-center gap-2 text-xs text-[#555] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newLocked}
                  onChange={(e) => setNewLocked(e.target.checked)}
                  className="w-3.5 h-3.5 rounded"
                />
                Lock duration
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addEvent} disabled={adding || !newCode.trim() || !newLabel.trim()} className="text-sm px-4 py-2 bg-[#1a1a1a] text-white rounded-lg disabled:opacity-40 hover:bg-black transition-colors">
              {adding ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => { setAddOpen(false); setNewCode(''); setNewLabel(''); setNewDuration(30); setNewLocked(false); }} className="text-sm px-4 py-2 border border-[#e5e5e3] rounded-lg text-[#888] hover:text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-[#e5e5e3] rounded-xl">
          <table className="w-full">
            <thead className="overflow-hidden rounded-t-xl">
              <tr className="border-b border-[#e5e5e3] bg-[#fafafa]">
                {['Code', 'Label', 'Duration', 'Locked', 'In use', ''].map((h, i) => (
                  <th key={i} className={`py-3 ${i === 0 ? 'px-5' : 'px-4'}`}>
                    {h && <div className="h-3 w-14 rounded bg-[#e5e5e3] animate-pulse" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e3]">
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-3"><div className="h-3.5 w-10 rounded bg-[#e5e5e3] animate-pulse font-mono" /></td>
                  <td className="px-4 py-3"><div className="h-3.5 rounded bg-[#e5e5e3] animate-pulse" style={{ width: 80 + i * 30 }} /></td>
                  <td className="px-4 py-3"><div className="h-5 w-14 rounded-full bg-[#e5e5e3] animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-[#e5e5e3] animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-8 rounded-full bg-[#e5e5e3] animate-pulse" /></td>
                  <td className="px-2 py-3"><div className="w-7 h-7 rounded-lg bg-[#e5e5e3] animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-[#e5e5e3] rounded-xl">
          <table className="w-full">
            <thead className="sticky top-14 z-[2] overflow-hidden rounded-t-xl">
              <tr className="border-b border-[#e5e5e3] bg-[#fafafa]">
                <th className="text-left text-[11px] font-medium text-[#888] uppercase tracking-wide px-5 py-3 bg-[#fafafa]">Code</th>
                <th className="text-left text-[11px] font-medium text-[#888] uppercase tracking-wide px-4 py-3 bg-[#fafafa]">Label</th>
                <th className="text-left text-[11px] font-medium text-[#888] uppercase tracking-wide px-4 py-3 bg-[#fafafa]">Duration</th>
                <th className="text-left text-[11px] font-medium text-[#888] uppercase tracking-wide px-4 py-3 bg-[#fafafa]">Duration locked</th>
                <th className="text-left text-[11px] font-medium text-[#888] uppercase tracking-wide px-4 py-3 bg-[#fafafa]">In use</th>
                <th className="w-10 px-4 py-3 bg-[#fafafa]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e3]">
              {events.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[#888]">No event types yet.</td></tr>
              ) : events.map((ev) => {
                const isEditing = editingCode === ev.code;
                return (
                  <tr key={ev.code} className="hover:bg-[#fafafa] transition-colors">
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                          onKeyDown={(e) => { if (e.key === 'Escape') setEditingCode(null); }}
                          maxLength={8}
                          className="w-20 text-sm border border-[#e5e5e3] rounded-lg px-2 py-1.5 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      ) : (
                        <span className="text-sm font-mono font-medium text-[#1a1a1a]">{ev.code}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          autoFocus
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(ev.code); if (e.key === 'Escape') setEditingCode(null); }}
                          className="text-sm border border-[#e5e5e3] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/10 w-full max-w-xs"
                        />
                      ) : (
                        <span className="text-sm text-[#1a1a1a]">{ev.label}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editDuration}
                          onChange={(e) => setEditDuration(Number(e.target.value))}
                          className="text-xs border border-[#e5e5e3] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                        >
                          {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-gray-100 text-[#888] border-[#e5e5e3]">
                          {DURATION_OPTIONS.find((o) => o.value === ev.durationMin)?.label ?? `${ev.durationMin} min`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <label className="flex items-center gap-2 text-xs text-[#555] cursor-pointer select-none">
                          <input type="checkbox" checked={editLocked} onChange={(e) => setEditLocked(e.target.checked)} className="w-3.5 h-3.5 rounded" />
                          Locked
                        </label>
                      ) : (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          ev.durationLocked
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-gray-100 text-[#888] border-[#e5e5e3]'
                        }`}>
                          {ev.durationLocked ? 'Locked' : 'Flexible'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ev.shiftCount > 0 ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                          {ev.shiftCount} shift{ev.shiftCount !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#ccc]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {superAdmin && (
                        isEditing ? (
                          <div className="flex gap-1.5">
                            <button onClick={() => saveEdit(ev.code)} disabled={savingCode === ev.code} className="text-xs px-2.5 py-1.5 bg-[#1a1a1a] text-white rounded-lg disabled:opacity-40 hover:bg-black transition-colors">
                              {savingCode === ev.code ? '…' : 'Save'}
                            </button>
                            <button onClick={() => setEditingCode(null)} className="text-xs px-2.5 py-1.5 border border-[#e5e5e3] rounded-lg text-[#888] hover:text-[#1a1a1a] transition-colors">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => startEdit(ev)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#aaa] hover:text-[#1a1a1a] hover:bg-gray-100 transition-colors" title="Edit">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <div className="relative group">
                              <button
                                onClick={() => ev.shiftCount === 0 && setConfirmDeleteCode(ev.code)}
                                disabled={ev.shiftCount > 0}
                                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                                  ev.shiftCount > 0
                                    ? 'text-[#ddd] cursor-not-allowed'
                                    : 'text-[#aaa] hover:text-red-600 hover:bg-red-50'
                                }`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              {ev.shiftCount > 0 && (
                                <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover:flex whitespace-nowrap">
                                  <span className="bg-[#1a1a1a] text-white text-[10px] font-medium px-2 py-1 rounded-lg shadow-md">
                                    In use by {ev.shiftCount} shift{ev.shiftCount !== 1 ? 's' : ''}
                                  </span>
                                  <span className="absolute top-full right-2.5 -translate-x-1/2 border-4 border-transparent border-t-[#1a1a1a]" />
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmDeleteCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl border border-[#e5e5e3] p-6 max-w-sm w-full mx-4">
            <h2 className="text-sm font-semibold text-[#1a1a1a] mb-1">Delete event type?</h2>
            <p className="text-xs text-[#888] mb-5">
              <span className="font-medium text-[#1a1a1a]">{confirmDeleteCode} — {confirmDeleteName}</span> will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDeleteCode(null)} disabled={deleting} className="text-sm px-4 py-2 border border-[#e5e5e3] rounded-lg text-[#888] hover:text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors">Cancel</button>
              <button onClick={deleteEvent} disabled={deleting} className="text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40">
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
    { id: 'events', label: 'Events' },
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
          {tab === 'events' && (
            <EventsTab superAdmin={superAdmin} />
          )}
        </div>
      </div>
    </div>
  );
}
