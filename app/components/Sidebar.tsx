'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function Sidebar() {
  const { data: convos, mutate } = useSWR('/api/conversations', fetcher);
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleNew() {
    setCreating(true);
    const res = await fetch('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: 'Nuova chat' }),
    });
    const convo = await res.json();
    setCreating(false);
    if (res.ok) {
      await mutate();          // aggiorna la lista
      router.push(`/chat/${convo.id}`);
    }
  }

  return (
    <aside className="w-64 shrink-0 border-r bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="flex items-center justify-between p-4">
        <h2 className="font-semibold">Le tue chat</h2>
        <button
          onClick={handleNew}
          disabled={creating}
          className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700"
          title="Nuova chat"
        >
          <Plus size={18} />
        </button>
      </header>

      <nav className="flex-1 overflow-y-auto px-2 space-y-1">
        {convos?.map((c: any) => {
          const active = pathname === `/chat/${c.id}`;
          return (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className={`block truncate rounded-lg px-3 py-2 ${
                active
                  ? 'bg-gray-200 dark:bg-gray-700'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {c.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
