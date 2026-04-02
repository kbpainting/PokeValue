import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');
  const portfolioId = searchParams.get('portfolio_id');

  const since = new Date();
  since.setDate(since.getDate() - days);

  let query = supabase
    .from('portfolio_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .gte('snapshot_date', since.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true });

  if (portfolioId) {
    query = query.eq('portfolio_id', portfolioId);
  } else {
    query = query.is('portfolio_id', null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshots: data });
}

/** Take a snapshot of current portfolio value */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .upsert({
      user_id: user.id,
      portfolio_id: body.portfolio_id || null,
      snapshot_date: today,
      total_value: body.total_value || 0,
      total_cards: body.total_cards || 0,
      total_cost: body.total_cost || 0,
    }, { onConflict: 'user_id,portfolio_id,snapshot_date' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshot: data });
}
