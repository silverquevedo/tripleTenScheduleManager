'use client';

import { useEffect, useRef, useState } from 'react';

interface FloatingPanelProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  width?: string; // e.g. 'w-80'
  align?: 'left' | 'right';
}

/** A button that opens a floating panel below it. Click outside closes it. */
export function FloatingPanel({
  trigger,
  children,
  width = 'w-80',
  align = 'left',
}: FloatingPanelProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>

      {open && (
        <div
          className={`absolute top-full mt-2 z-30 bg-white border border-[#e5e5e3] rounded-xl shadow-xl overflow-hidden ${width} ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
