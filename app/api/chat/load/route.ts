export const runtime = 'nodejs';               // stesso runtime della route POST

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '../../../../lib/supabase'; // ⬅️ 3 livelli su

export async function GET(req: NextRequest) {
  const session_id = req.nextUrl.searchParams.get('session_id');
  if (!session_id) return NextResponse.json([]);

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Errore load:', error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json(data ?? []);
}
