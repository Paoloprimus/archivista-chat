// app/chat/page.tsx — server component
// Punto d’ingresso “/chat”: reindirizza alla conversazione più recente

import { redirect } from 'next/navigation';
import { createSupabaseClient } from '../../lib/supabase';

export default async function ChatHome() {
  const supabase = createSupabaseClient();

  // Prendi la conversazione più recente (se esiste)
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (!error && data) {
    redirect(`/chat/${data.id}`);
  }

  // Nessuna conversazione: crea un placeholder “empty”
  redirect('/chat/empty');
}
