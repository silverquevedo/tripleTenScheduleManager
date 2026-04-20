'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { isSuperAdmin } from '@/lib/super-admins';

interface ActiveUser {
  kind: 'active';
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  isAdmin: boolean;
  defaultProgramId: string | null;
}

interface PendingUser {
  kind: 'pending';
  email: string;
  defaultProgramId: string | null;
}

type TableRow = ActiveUser | PendingUser;

interface ProgramOption {
  id: string;
  name: string;
}

type FeedbackMsg = { text: string; kind: 'success' | 'error' };

export function AdminPage() {
  const { data: session } = useSession();
  const canManageRoles = isSuperAdmin(session?.user?.email);

  const [rows, setRows] = useState<TableRow[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [settingProgram, setSettingProgram] = useState<string | null>(null);
  const [openMenuEmail, setOpenMenuEmail] = useState<string | null>(null);
  const [confirmRemoveEmail, setConfirmRemoveEmail] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Invite form
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMsg | null>(null);
  const inviteInputRef = useRef<HTMLInputElement>(null);

  const flash = (text: string, kind: FeedbackMsg['kind']) => {
    setFeedback({ text, kind });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchData = () => {
    Promise.all([
      fetch('/api/admin/users').then((r) => r.json()),
      fetch('/api/programs').then((r) => r.json()),
    ]).then(([{ registeredUsers, pendingAdmins }, progs]) => {
      const active: ActiveUser[] = (registeredUsers ?? []).map((u: Omit<ActiveUser, 'kind'>) => ({
        kind: 'active' as const, ...u,
      }));
      const pending: PendingUser[] = (pendingAdmins ?? []).map(
        (p: { email: string; defaultProgramId: string | null }) => ({
          kind: 'pending' as const,
          email: p.email,
          defaultProgramId: p.defaultProgramId,
        })
      );
      setRows([...active, ...pending]);
      setPrograms(Array.isArray(progs) ? progs : []);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (inviteOpen) setTimeout(() => inviteInputRef.current?.focus(), 50);
  }, [inviteOpen]);

  // Close ellipsis menu on outside click
  useEffect(() => {
    if (!openMenuEmail) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuEmail(null);
      }
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

  const setDefaultProgram = async (email: string, defaultProgramId: string) => {
    setSettingProgram(email);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, defaultProgramId }),
    });
    if (res.ok) {
      fetchData();
    } else {
      flash('Failed to save. Please try again.', 'error');
    }
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
    if (!res.ok) {
      flash(data.error ?? 'Failed to remove user.', 'error');
    } else {
      flash(`${confirmRemoveEmail} removed.`, 'success');
      fetchData();
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });
    const data = await res.json();
    setInviting(false);
    if (!res.ok) {
      flash(data.error ?? 'Failed to invite.', 'error');
      return;
    }
    flash(
      data.emailSent
        ? `Invite sent to ${inviteEmail.trim()}`
        : `${inviteEmail.trim()} added. (Configure SMTP to send email invites)`,
      'success'
    );
    setInviteEmail('');
    setInviteOpen(false);
    fetchData();
  };

  const activeCount = rows.filter((r) => r.kind === 'active').length;
  const pendingCount = rows.filter((r) => r.kind === 'pending').length;

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
              <h1 className="text-sm font-semibold text-[#1a1a1a]">User Management</h1>
              {!loading && (
                <p className="text-[11px] text-[#888]">{activeCount} active · {pendingCount} pending</p>
              )}
            </div>
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
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-3">

        {/* Feedback toast */}
        {feedback && (
          <div className={`text-sm px-4 py-2.5 rounded-xl border ${
            feedback.kind === 'success'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {feedback.text}
          </div>
        )}

        {/* Invite form */}
        {inviteOpen && (
          <div className="bg-white border border-[#e5e5e3] rounded-xl p-4 flex items-center gap-3">
            <div className="flex-1">
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
            <div className="flex items-end gap-2 pb-0.5 mt-5">
              <button
                onClick={sendInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="text-sm px-4 py-2 bg-[#1a1a1a] text-white rounded-lg disabled:opacity-40 hover:bg-black transition-colors"
              >
                {inviting ? 'Sending…' : 'Send invite'}
              </button>
              <button
                onClick={() => { setInviteOpen(false); setInviteEmail(''); }}
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
                  <th className="text-left text-[11px] font-medium text-[#888] uppercase tracking-wide px-5 py-3">User</th>
                  <th className="text-left text-[11px] font-medium text-[#888] uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="text-left text-[11px] font-medium text-[#888] uppercase tracking-wide px-4 py-3">Role</th>
                  <th className="text-left text-[11px] font-medium text-[#888] uppercase tracking-wide px-4 py-3">Default Program</th>
                  {canManageRoles && (
                    <th className="text-[11px] font-medium text-[#888] uppercase tracking-wide px-4 py-3 w-10"></th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5e3]">
                {rows.map((row) => {
                  const isSelf = row.kind === 'active' && row.email === session?.user?.email;
                  const isMenuOpen = openMenuEmail === row.email;
                  const isActive = row.kind === 'active';

                  return (
                    <tr key={row.email} className="hover:bg-[#fafafa] transition-colors">

                      {/* User */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {row.kind === 'active' && row.image ? (
                            <Image src={row.image} alt={row.name ?? ''} width={32} height={32} className="rounded-full flex-shrink-0" />
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

                      {/* Status */}
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

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          row.kind === 'active' && !row.isAdmin
                            ? 'bg-gray-100 text-[#888] border-[#e5e5e3]'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {row.kind === 'active' ? (row.isAdmin ? 'Admin' : 'Viewer') : 'Admin'}
                        </span>
                      </td>

                      {/* Default program */}
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

                      {/* Actions — ellipsis menu (super admins only, not self) */}
                      {canManageRoles && (
                        <td className="px-2 py-3 relative">
                          {!isSelf ? (
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
                                <div className="absolute right-0 top-8 z-20 bg-white border border-[#e5e5e3] rounded-xl shadow-lg py-1 min-w-[160px]">
                                  {isActive && (
                                    <button
                                      onClick={() => toggleAdmin(row.email, !row.isAdmin)}
                                      className="w-full text-left text-xs px-3 py-2 hover:bg-[#f5f5f4] transition-colors text-[#1a1a1a]"
                                    >
                                      {row.isAdmin ? 'Revoke admin' : 'Make admin'}
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
                          ) : (
                            <span />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm remove modal */}
      {confirmRemoveEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl border border-[#e5e5e3] p-6 max-w-sm w-full mx-4">
            <h2 className="text-sm font-semibold text-[#1a1a1a] mb-1">Remove user?</h2>
            <p className="text-xs text-[#888] mb-5">
              <span className="font-medium text-[#1a1a1a]">{confirmRemoveEmail}</span> will be removed from the app and lose all access.
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
