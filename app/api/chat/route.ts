export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseClient } from '../../lib/supabase'; 

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/* ---------------------------------------------------------------------
   Parametri riassunto / gestione contesto
--------------------------------------------------------------------- */
const HARD_LIMIT = 200_000;  // token massimi Sonnet‑4
const KEEP_LAST  = 8_000;    // token da tenere intatti in coda
const SUM_TOKENS = 1_000;    // token riservati al riassunto

// stima super‑veloce dei token (≈ 4 char ≈ 1 token)
const countTok = (s: string) => Math.ceil(s.length / 4);

/* ---------------------------------------------------------------------
   POST /api/chat  – streaming verso Claude 4 Sonnet
   Body atteso: { text: string, conversation_id: string }
   NB: per retro‑compatibilità accetta anche { session_id }
--------------------------------------------------------------------- */
export async function POST(req: NextRequest) {
  const { text, conversation_id, session_id } = await req.json();
  const cid: string | undefined = conversation_id ?? session_id; // fallback

  if (!text || !cid)
    return new Response('text o conversation_id mancante', { status: 400 });

  const supabase = createSupabaseClient();

  /* ----- 1. storico + summary cumulativo ----------------------------- */
  const { data: rows } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', cid)
    .order('created_at', { ascending: true });

  const history: { role: 'user' | 'assistant'; content: string }[] = rows ?? [];

  const { data: summRow } = await supabase
    .from('summaries')
    .select('summary')
    .eq('conversation_id', cid)
    .single();

  let summary = summRow?.summary ?? '';

  /* ----- 2. costruisci prompt ---------------------------------------- */
  let promptMsgs = [...history, { role: 'user', content: text }];
  let tokens = promptMsgs.reduce((n, m) => n + countTok(m.content), 0);

  if (tokens > KEEP_LAST) {
    // porzione da comprimere
    const toSummarize = promptMsgs.splice(0, promptMsgs.length - KEEP_LAST);

    // chiedi riassunto a Haiku (cheap)
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

    // upsert tabella summaries
    await supabase
      .from('summaries')
      .upsert({ conversation_id: cid, summary });

    // prompt finale
    promptMsgs = [
      { role: 'system', content: `Riassunto della conversazione finora:\n${summary}` },
      ...promptMsgs,
    ];

    tokens = promptMsgs.reduce((n, m) => n + countTok(m.content), 0);
  }

  if (tokens > HARD_LIMIT)
    return new Response('Sessione troppo lunga: aprine una nuova.', { status: 400 });

  /* ----- 3. streaming a Sonnet‑4 ------------------------------------ */
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: promptMsgs as any,
  });

  /* ----- 4. salvataggio async --------------------------------------- */
  (async () => {
    // salva messaggio utente
    const { error: userErr } = await supabase
      .from('messages')
      .insert({ conversation_id: cid, role: 'user', content: text });
    if (userErr) console.error('insert user →', userErr.message);

    // accumula risposta assistant
    let output = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') output += chunk.delta.text;
    }

    // salva messaggio assistant
    const { error: aiErr } = await supabase
      .from('messages')
      .insert({ conversation_id: cid, role: 'assistant', content: output });
    if (aiErr) console.error('insert assistant →', aiErr.message);

    // aggiorna updated_at nella tabella conversations
    const { error: convErr } = await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', cid);
    if (convErr) console.error('update conversations →', convErr.message);
  })();

  /* ----- 5. risposta stream al client -------------------------------- */
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
