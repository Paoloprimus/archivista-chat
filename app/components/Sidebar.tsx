'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import useSWR from 'swr';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function Sidebar({ open, onClose }: SidebarProps) {
  const { data: convos } = useSWR('/api/conversations', fetcher, {
    refreshInterval: 15_000, // aggiorna ogni 15 s per riflettere nuovi update
  });

  /* ---------- MOBILE OVERLAY ---------- */
  const overlay = open ? (
    <div
      className="fixed inset-0 z-40 bg-black/50 md:hidden"
      onClick={onClose}
    />
  ) : null;

  return (
    <>
      {overlay}

      <aside
        className={
          `fixed inset-y-0 left-0 z-50 w-64 transform bg-gray-50 dark:bg-gray-900 ` +
          `transition-transform duration-200 ease-in-out ` +
          `${open ? 'translate-x-0' : '-translate-x-full'} ` +
          `md:static md:translate-x-0 md:flex md:flex-col md:border-r`
        }
      >
        {/* Header + close btn (mobile) */}
        <header className="flex items-center justify-between p-4 md:hidden">
          <h2 className="font-semibold">Le tue chat</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <X size={20} />
          </button>
        </header>

        {/* Desktop header */}
        <header className="hidden md:flex p-4 font-semibold border-b dark:border-gray-800">
          Le tue chat
        </header>

        <nav className="flex-1 overflow-y-auto px-2 space-y-1 py-2">
          {convos?.map((c: any) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className="block truncate rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={onClose}
            >
              {c.title}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
