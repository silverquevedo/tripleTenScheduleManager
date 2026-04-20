'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isAdmin: boolean;
  defaultProgramId: string | null;
}

interface ProgramOption {
  id: string;
  name: string;
}

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AdminPanel({ open, onClose }: AdminPanelProps) {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [settingProgram, setSettingProgram] = useState<string | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then(({ registeredUsers, pendingAdmins }) => {
        setUsers(registeredUsers ?? []);
        setPending(pendingAdmins ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    fetchUsers();
    fetch('/api/programs')
      .then((r) => r.json())
      .then((data) => setPrograms(Array.isArray(data) ? data : []));
  }, [open]);

  const toggle = async (email: string, grant: boolean) => {
    setToggling(email);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, grant }),
    });
    await fetchUsers();
    setToggling(null);
  };

  const setDefaultProgram = async (email: string, defaultProgramId: string) => {
    setSettingProgram(email);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, defaultProgramId }),
    });
    setUsers((prev) =>
      prev.map((u) => u.email === email ? { ...u, defaultProgramId: defaultProgramId || null } : u)
    );
    setSettingProgram(null);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed top-0 right-0 h-full w-full max-w-sm bg-white border-l border-[#e5e5e3] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5e3]">
          <div>
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Admin Panel</h2>
            <p className="text-[11px] text-[#888] mt-0.5">Manage user roles</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#888] hover:text-[#1a1a1a] hover:bg-gray-100 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {loading ? (
            <p className="text-sm text-[#888] text-center py-8">Loading…</p>
          ) : (
            <>
              {/* Registered users */}
              <section>
                <h3 className="text-[11px] text-[#888] uppercase tracking-wide font-medium mb-3">
                  Registered users ({users.length})
                </h3>
                <ul className="space-y-2">
                  {users.map((u) => {
                    const isSelf = u.email === session?.user?.email;
                    return (
                      <li
                        key={u.id}
                        className="flex flex-col gap-2.5 p-3 rounded-xl border border-[#e5e5e3] bg-[#fafafa]"
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          {u.image ? (
                            <Image
                              src={u.image}
                              alt={u.name ?? ''}
                              width={32}
                              height={32}
                              className="rounded-full flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-[#888] flex-shrink-0">
                              {(u.name ?? u.email ?? '?')[0].toUpperCase()}
                            </div>
                          )}

                          {/* Name + email */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1a1a1a] truncate">
                              {u.name ?? '—'}
                              {isSelf && (
                                <span className="ml-1.5 text-[10px] text-[#888]">(you)</span>
                              )}
                            </p>
                            <p className="text-[11px] text-[#888] truncate">{u.email}</p>
                          </div>

                          {/* Role badge + toggle */}
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                              u.isAdmin
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-gray-100 text-[#888] border-[#e5e5e3]'
                            }`}>
                              {u.isAdmin ? 'Admin' : 'Viewer'}
                            </span>
                            {!isSelf && (
                              <button
                                onClick={() => toggle(u.email!, !u.isAdmin)}
                                disabled={toggling === u.email}
                                className={`text-[11px] px-2 py-0.5 rounded-lg border transition-colors disabled:opacity-40 ${
                                  u.isAdmin
                                    ? 'text-red-600 border-red-200 hover:bg-red-50'
                                    : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                                }`}
                              >
                                {u.isAdmin ? 'Revoke' : 'Make admin'}
                              </button>
                            )}
                            {isSelf && (
                              <span className="text-[10px] text-[#bbb]">can't edit self</span>
                            )}
                          </div>
                        </div>

                        {/* Default program */}
                        {programs.length > 0 && (
                          <div className="flex items-center gap-2 pl-11">
                            <span className="text-[11px] text-[#888] flex-shrink-0">Default program:</span>
                            <select
                              value={u.defaultProgramId ?? ''}
                              disabled={settingProgram === u.email}
                              onChange={(e) => setDefaultProgram(u.email!, e.target.value)}
                              className="flex-1 text-[11px] border border-[#e5e5e3] rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-40"
                            >
                              <option value="">— None —</option>
                              {programs.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Pending admins (invited but not yet signed in) */}
              {pending.length > 0 && (
                <section>
                  <h3 className="text-[11px] text-[#888] uppercase tracking-wide font-medium mb-1">
                    Pending admin invite ({pending.length})
                  </h3>
                  <p className="text-[11px] text-[#bbb] mb-3">
                    These emails are listed as admins but haven't signed in yet.
                  </p>
                  <ul className="space-y-1">
                    {pending.map((email) => (
                      <li
                        key={email}
                        className="flex items-center justify-between text-[11px] text-[#888] py-1.5 px-3 rounded-lg bg-[#fafafa] border border-[#e5e5e3]"
                      >
                        <span className="truncate">{email}</span>
                        <button
                          onClick={() => toggle(email, false)}
                          disabled={toggling === email}
                          className="ml-2 text-[10px] text-red-500 hover:text-red-700 flex-shrink-0 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
