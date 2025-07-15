import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '../../lib/supabase';   

/**
 * GET  /api/conversations      → lista ordinata per updated_at DESC
 * POST /api/conversations      → crea nuova conversazione (body: { title })
 */
export async function GET() {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { title } = await req.json();
  const { data, error } = await supabase
    .from('conversations')
    .insert({ title })
    .select('id, title, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
