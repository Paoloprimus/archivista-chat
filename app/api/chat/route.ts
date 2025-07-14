export const runtime = 'edge';

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseClient } from '@/lib/supabase';
import { StreamingTextResponse, LangChainStream } from 'ai';

const openai = new OpenAI();
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
    return new Response('Conversation too long for model context. Split the chat.', { status: 400 });
  }

  const { stream, handlers } = LangChainStream();
  openai.chat.completions
    .create({ model: 'gpt-4o-mini', messages: prompt, stream: true })
    .then(handlers);

  (async () => {
    await supabase.from('messages').insert([
      { session_id, role: 'user', content: text },
      { session_id, role: 'assistant', content: '' }
    ]);
    let answer = '';
    for await (const chunk of stream) answer += chunk;
    await supabase
      .from('messages')
      .update({ content: answer })
      .match({ session_id, role: 'assistant', content: '' });
  })();

  return new StreamingTextResponse(stream);
}
