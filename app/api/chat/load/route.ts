import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session_id = req.nextUrl.searchParams.get('session_id');
  if (!session_id) return NextResponse.json([]);

  const supabase = createSupabaseClient();
  const { data } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  return NextResponse.json(data ?? []);
}
