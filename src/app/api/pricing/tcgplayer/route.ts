import { NextRequest, NextResponse } from 'next/server';
import { getCardPrices, searchCards } from '@/lib/pricing/tcgplayer';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cardName = searchParams.get('cardName');
  const setName = searchParams.get('setName') || '';
  const cardNumber = searchParams.get('cardNumber') || '';
  const search = searchParams.get('search');

  if (search) {
    const results = await searchCards(search);
    return NextResponse.json({ results });
  }

  if (!cardName) {
    return NextResponse.json({ error: 'cardName required' }, { status: 400 });
  }

  const listings = await getCardPrices(cardName, setName, cardNumber);
  return NextResponse.json({ listings });
}
