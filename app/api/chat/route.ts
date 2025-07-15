export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseClient } from '../../../lib/supabase';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/*  parametri riassunto  */
const HARD_LIMIT = 200_000;   // contesto massimo Sonnet-4
const KEEP_LAST  = 8_000;     // token “grezzi” da tenere sempre
const SUM_TOKENS = 1_000;     // token riservati al riassunto

/*  funzione di stima token ultra-rapida  */
const countTok = (s: string) => Math.ceil(s.length / 4);

export async function POST(req: NextRequest) {
  const { text, session_id } = await req.json();
  const supabase = createSupabaseClient();

  /* ----- 1. storico + summary cumulativo --------------------------------- */
  const { data: rows } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  const history: { role: 'user' | 'assistant'; content: string }[] = rows ?? [];

  const { data: summRow } = await supabase
    .from('summaries')
    .select('summary')
    .eq('session_id', session_id)
    .single();

  let summary = summRow?.summary ?? '';

  /* ----- (il resto del codice rimane invariato) -------------------------- */


  /* ----- 2. costruisci prompt -------------------------------------------- */
  let promptMsgs = [...history, { role: 'user', content: text }];
  let tokens = promptMsgs.reduce((n, m) => n + countTok(m.content), 0);

  if (tokens > KEEP_LAST) {
    // prendi messaggi da comprimere
    const toSummarize = promptMsgs.splice(0, promptMsgs.length - KEEP_LAST);

    // chiedi un breve riassunto a Haiku
    const haiku = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: SUM_TOKENS,
      system: 'Riassumi in modo fedele e conciso mantenendo i punti chiave.',
      messages: [
        {
          role: 'user',
          content:
            `Ecco la parte di dialogo da comprimere:\n\n` +
            toSummarize.map(m => `${m.role}: ${m.content}`).join('\n') +
            `\n\nGenera un riassunto.`,
        },
      ],
    });

    const newSummary = haiku.content[0].text.trim();
    summary = summary
      ? `${summary}\n\n[Riassunto aggiuntivo]\n${newSummary}`
      : newSummary;

    // salva / aggiorna la tabella summaries
    await supabase.from('summaries').upsert({ session_id, summary });

    // prompt finale
    promptMsgs = [
      { role: 'system', content: `Riassunto della conversazione finora:\n${summary}` },
      ...promptMsgs,
    ];

    // ricalcola token totali
    tokens = promptMsgs.reduce((n, m) => n + countTok(m.content), 0);
  }

  if (tokens > HARD_LIMIT) {
    return new Response('Sessione troppo lunga: aprine una nuova.', { status: 400 });
  }

  /* ----- 3. streaming a Sonnet-4 ---------------------------------------- */
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: promptMsgs,
  });

  /* ----- 4. salvataggio async ------------------------------------------- */
  (async () => {
    // salva messaggio user
    const { error: userErr } = await supabase
      .from('messages')
      .insert({ session_id, role: 'user', content: text });
    if (userErr) console.error('insert user →', userErr.message);

    // accumula risposta assistant
    let output = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') output += chunk.delta.text;
    }

    // salva messaggio assistant
    const { error: aiErr } = await supabase
      .from('messages')
      .insert({ session_id, role: 'assistant', content: output });
    if (aiErr) console.error('insert assistant →', aiErr.message);
  })();

  /* ----- 5. risposta stream al client ----------------------------------- */
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta')
          controller.enqueue(encoder.encode(chunk.delta.text));
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
