export const runtime = 'edge';

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseClient } from '../../../lib/supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  const { text, session_id } = await req.json();
  const supabase = createSupabaseClient();

  const { data } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  const history = data ?? [];
  const prompt = [...history, { role: 'user', content: text }];
  const systemPrompt = "Sei Archivista AI. Hai memoria persistente. Ricorda sempre tutto finché la sessione lo permette.";

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: prompt.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Salva messaggio utente
  await supabase.from('messages').insert({
    session_id,
    role: 'user',
    content: text,
  });

  // Preparazione streaming e raccolta contenuto
  const encoder = new TextEncoder();
  let assistantReply = '';

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          const text = chunk.delta.text;
          assistantReply += text;
          controller.enqueue(encoder.encode(text));
        }
      }

      // Salva messaggio assistente
      await supabase.from('messages').insert({
        session_id,
        role: 'assistant',
        content: assistantReply,
      });

      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
