'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const PASSWORD = 'claude.tfs'; // 👈 cambia qui con la tua password

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim() === PASSWORD) {
      router.push('/chat');
    } else {
      setError('Password errata');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-4 w-full max-w-sm">
        <h1 className="text-xl font-semibold text-center">Accesso Archivista</h1>
        <input
          type="password"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Inserisci la password"
          className="w-full border rounded-lg p-2"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800"
        >
          Entra
        </button>
      </form>
    </main>
  );
}
