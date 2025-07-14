export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { createSupabaseClient } from '../../../lib/supabase';
import { StreamingTextResponse } from 'ai';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const HARD_LIMIT = 128_000;

export async function POST(req: NextRequest) {
  const { text, session_id } = await req.json();
  const supabase = createSupabaseClient();

  const { data: history = [] } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  const prompt = [...history, { role: 'user', content: text }];
  const tokens = prompt.reduce((n, m) => n + Math.ceil(m.content.length / 4), 0);
  if (tokens > HARD_LIMIT) {
    return new Response('Prompt troppo lungo per il modello Claude', { status: 400 });
  }

  const systemPrompt = "Sei un assistente AI chiamato Archivista AI, con memoria persistente fino a 200.000 token.";
  const stream = await anthropic.messages.stream({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 4096,
    system: systemPrompt,
    messages: prompt.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    })),
  });

  // Salvataggio async su Supabase
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

  // stream risposta a frontend
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    }
  });

  return new StreamingTextResponse(readable);
}
