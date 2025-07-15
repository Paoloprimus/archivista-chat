'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function ChatPage() {
  /* ───────── session ID cross-device ───────── */
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sid] = useState(() => {
    const urlSid = searchParams.get('sid');
    if (urlSid) {
      if (typeof window !== 'undefined') localStorage.setItem('chat-session-id', urlSid);
      return urlSid;
    }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('chat-session-id') : null;
    if (saved) {
      router.replace(`/chat?sid=${saved}`);
      return saved;
    }
    const fresh = crypto.randomUUID();
    if (typeof window !== 'undefined') localStorage.setItem('chat-session-id', fresh);
    router.replace(`/chat?sid=${fresh}`);
    return fresh;
  });

  /* ───────── stato & ref ───────── */
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* carica lo storico */
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/chat/load?session_id=${sid}`);
      const history = await res.json();
      setMsgs(history);
    })();
  }, [sid]);

  /* autoscroll */
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  /* invio messaggio */
  async function send() {
    const text = inputRef.current?.value.trim();
    if (!text) return;
    inputRef.current!.value = '';
    setMsgs(m => [...m, { role: 'user', content: text }]);

    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ text, session_id: sid }),
    });

    const reader = res.body!.getReader();
    let assistant = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assistant += new TextDecoder().decode(value);
      setMsgs(m => {
        const last = m[m.length - 1];
        if (last?.role === 'assistant') {
          return [...m.slice(0, -1), { role: 'assistant', content: assistant }];
        }
        return [...m, { role: 'assistant', content: assistant }];
      });
    }
  }

  /* ───────── UI ───────── */
  return (
    <main className="flex flex-col h-screen bg-gray-50">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-3xl mx-auto ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <p
              className={`inline-block px-4 py-3 rounded-2xl whitespace-pre-wrap shadow-sm text-sm
              ${m.role === 'user' ? 'bg-blue-100 italic' : 'bg-white font-normal'}`}
            >
              {m.content}
            </p>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <footer className="p-4 border-t bg-white">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 border border-gray-300 p-3 rounded-xl shadow-sm"
            placeholder="Scrivi qui…"
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button
            onClick={send}
            className="bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800"
          >
            Invia
          </button>
        </div>
      </footer>
    </main>
  );
}
