import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Population data API.
 * PSA pop data comes from the PSA API (same token, shared 100/day limit).
 * For CGC/BGS/TAG, population data must be entered manually for now.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.card_id || !body.grading_company || !body.grade) {
    return NextResponse.json(
      { error: 'card_id, grading_company, and grade are required' },
      { status: 400 }
    );
  }

  // Verify card belongs to user
  const { data: card } = await supabase
    .from('cards')
    .select('id')
    .eq('id', body.card_id)
    .eq('user_id', user.id)
    .single();

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('population_data')
    .insert({
      card_id: body.card_id,
      grading_company: body.grading_company,
      grade: body.grade,
      population: body.population || 0,
      population_higher: body.population_higher || 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ populationData: data });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get('card_id');

  if (!cardId) {
    return NextResponse.json({ error: 'card_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('population_data')
    .select('*')
    .eq('card_id', cardId)
    .order('fetched_at', { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ population: data?.[0] || null });
}
