export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '../../../lib/supabase';

// Inizializziamo una sola volta il client, valido per tutte le invocazioni
const supabase = createSupabaseClient();

/**
 * GET  /api/conversations → lista conversazioni ordinate per updated_at DESC
 */
export async function GET() {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

/**
 * POST /api/conversations → crea nuova conversazione (body: { title })
 */
export async function POST(req: NextRequest) {
  const { title } = await req.json();

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'Missing "title" in body' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({ title })
    .select('id, title, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
