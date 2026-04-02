import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.card_id || !body.source || body.price == null) {
    return NextResponse.json(
      { error: 'card_id, source, and price are required' },
      { status: 400 }
    );
  }

  // Verify the card belongs to this user
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
    .from('price_history')
    .insert({
      card_id: body.card_id,
      source: body.source,
      price: body.price,
      sale_date: body.sale_date || null,
      listing_title: body.listing_title || null,
      listing_url: body.listing_url || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ priceRecord: data });
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
    .from('price_history')
    .select('*')
    .eq('card_id', cardId)
    .order('fetched_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prices: data });
}
