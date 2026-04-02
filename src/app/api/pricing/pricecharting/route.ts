import { NextRequest, NextResponse } from 'next/server';
import { getPriceChartingData } from '@/lib/pricing/pricecharting';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cardName = searchParams.get('cardName');
  const cardNumber = searchParams.get('cardNumber') || '';
  const setName = searchParams.get('setName') || '';

  if (!cardName) {
    return NextResponse.json({ error: 'cardName required' }, { status: 400 });
  }

  const listings = await getPriceChartingData(cardName, cardNumber, setName);
  return NextResponse.json({ listings });
}
