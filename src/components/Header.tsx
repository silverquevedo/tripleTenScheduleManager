'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Program } from '@/types';

interface HeaderProps {
  programs: Program[];
  selectedProgram: Program | null;
  onProgramChange: (p: Program | null) => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export function Header({ programs, selectedProgram, onProgramChange, isAdmin, isSuperAdmin }: HeaderProps) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="bg-white border-b border-[#e5e5e3] sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-[#1a1a1a] whitespace-nowrap">
            TripleTen Schedule Manager
          </h1>
          {programs.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#888] uppercase tracking-wide hidden sm:block">
                Program
              </span>
              <select
                value={selectedProgram?.id ?? ''}
                onChange={(e) => {
                  const p = programs.find((p) => p.id === e.target.value);
                  if (p) onProgramChange(p);
                }}
                className="text-sm border border-[#e5e5e3] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 cursor-pointer"
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right */}
        {session?.user && (
          <div className="flex items-center gap-3">
            {/* Role badge */}
            <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
              isSuperAdmin
                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                : isAdmin
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-gray-100 text-[#888] border border-[#e5e5e3]'
            }`}>
              {isSuperAdmin ? 'Manager' : isAdmin ? 'Lead Instructor' : 'Instructor'}
            </span>

            {/* User dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors"
              >
                {session.user.image && (
                  <Image
                    src={session.user.image}
                    alt={session.user.name ?? 'User'}
                    width={28}
                    height={28}
                    className="rounded-full ring-1 ring-[#e5e5e3]"
                  />
                )}
                <span className="text-sm text-[#1a1a1a] hidden md:block max-w-[140px] truncate">
                  {session.user.name}
                </span>
                <svg className="w-3 h-3 text-[#aaa]" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-[#e5e5e3] rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                  {/* User info */}
                  <div className="px-3 py-2.5 border-b border-[#e5e5e3]">
                    <p className="text-sm font-medium text-[#1a1a1a] truncate">{session.user.name}</p>
                    <p className="text-[11px] text-[#888] truncate">{session.user.email}</p>
                  </div>

                  {/* Settings — admins only */}
                  {isAdmin && (
                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#1a1a1a] hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-[#888]" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </Link>
                  )}

                  {/* Logout */}
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
