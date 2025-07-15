'use client';

import { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Menu } from 'lucide-react';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar overlay (mobile) & static (desktop) */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Mobile top‑bar */}
        <header className="md:hidden h-12 flex items-center border-b px-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Apri menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="ml-3 font-semibold text-sm">Archivist</h1>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
