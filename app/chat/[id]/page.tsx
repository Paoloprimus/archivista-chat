'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function ChatPage() {
  /* ——— conversation ID from dynamic route ——— */
  const router = useRouter();
  const { id: sid } = useParams() as { id: string | undefined };

  // Se per qualche motivo l'ID non è presente (non dovrebbe accadere grazie al routing),
  // puoi decidere di redirigere o mostrare un messaggio di errore; qui semplicemente non renderizzi nulla.
  if (!sid) return null;

  /* ——— state & refs ——— */
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* carica lo storico della conversazione */
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/chat/load?session_id=${sid}`);
      if (!res.ok) return;
      const history: Msg[] = await res.json();
      setMsgs(history);
    })();
  }, [sid]);

  /* autoscroll all'ultimo messaggio */
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  /* invia un messaggio */
  async function send() {
    const text = inputRef.current?.value.trim();
    if (!text) return;

    // svuota input e mostra subito il messaggio dell'utente
    inputRef.current!.value = '';
    setMsgs(m => [...m, { role: 'user', content: text }]);

    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ text, session_id: sid }),
    });

    if (!res.body) return;

    const reader = res.body.getReader();
    let assistant = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      assistant += new TextDecoder().decode(value);
      setMsgs(m => {
        const last = m[m.length - 1];
        if (last?.role === 'assistant') {
          // aggiornamento streaming dell'ultimo messaggio assistant
          return [...m.slice(0, -1), { role: 'assistant', content: assistant }];
        }
        return [...m, { role: 'assistant', content: assistant }];
      });
    }
  }

  /* ——— UI ——— */
  return (
    <main className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-3xl mx-auto ${m.role === 'user' ? 'text-right' : 'text-left'}`}
          >
            <p
              className={`inline-block px-4 py-3 rounded-2xl whitespace-pre-wrap shadow-sm text-sm
              ${m.role === 'user' ? 'bg-blue-100 italic' : 'bg-white dark:bg-gray-800 font-normal'}`}
            >
              {m.content}
            </p>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <footer className="p-4 border-t bg-white dark:bg-gray-950">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 border border-gray-300 dark:border-gray-700 p-3 rounded-xl shadow-sm bg-white dark:bg-gray-800 focus:outline-none"
            placeholder="Scrivi qui…"
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button
            onClick={send}
            className="bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Invia
          </button>
        </div>
      </footer>
    </main>
  );
}
