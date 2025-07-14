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

  const { data: history = [] } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  const prompt = [...history, { role: 'user', content: text }];
  const systemPrompt = "Sei Archivista AI. Hai memoria persistente. Ricorda sempre tutto finché la sessione lo permette.";

  const stream = await anthropic.messages.stream({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 4096,
    system: systemPrompt,
    messages: prompt.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Salvataggio asincrono nel DB
  (async () => {
    await supabase.from('messages').insert([
      { session_id, role: 'user', content: text },
      { session_id, role: 'assistant', content: '' },
    ]);

    let output = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        output += chunk.delta.text;
      }
    }

    await supabase
      .from('messages')
      .update({ content: output })
      .match({ session_id, role: 'assistant', content: '' });
  })();

  // Risposta in streaming al client
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
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
