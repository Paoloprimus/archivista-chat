'use client';
import { useState, useRef } from 'react';
import { v4 as uuid } from 'uuid';

type Msg = { role: 'user' | 'assistant'; content: string };
export default function ChatPage() {
  const [sid] = useState(() => uuid());
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const input = useRef<HTMLInputElement>(null);

  async function send() {
    const text = input.current?.value.trim();
    if (!text) return;
    input.current!.value = '';
    setMsgs(m => [...m, { role: 'user', content: text }]);

    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ text, session_id: sid })
    });

    const reader = res.body!.getReader();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += new TextDecoder().decode(value);
      setMsgs(m => [...m.filter(x => x.role !== 'assistant'),
                    { role: 'assistant', content: buf }]);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-4 flex flex-col gap-4 h-screen">
      <section className="flex-1 overflow-y-auto space-y-2">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span className="inline-block rounded-xl px-3 py-2
                             bg-gray-200 dark:bg-gray-700 whitespace-pre-wrap">
              {m.content}
            </span>
          </div>
        ))}
      </section>
      <footer className="flex gap-2">
        <input ref={input} className="flex-1 border p-2 rounded-xl"
               placeholder="Scrivi qui…" onKeyDown={e => e.key==='Enter' && send()}/>
        <button onClick={send}
                className="px-4 py-2 rounded-xl bg-black text-white">Invia</button>
      </footer>
    </main>
  );
}
