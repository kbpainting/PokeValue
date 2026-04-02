import { NextRequest, NextResponse } from 'next/server';
import { getEbaySoldListings, calculateEbayMarketPrice } from '@/lib/pricing/ebay';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cardName = searchParams.get('cardName');
  const cardNumber = searchParams.get('cardNumber') || '';
  const cardVariant = searchParams.get('cardVariant') || '';
  const gradingCompany = searchParams.get('gradingCompany') || 'RAW';
  const grade = searchParams.get('grade');

  if (!cardName) {
    return NextResponse.json({ error: 'cardName required' }, { status: 400 });
  }

  const { listings, debug } = await getEbaySoldListings(cardName, cardNumber, cardVariant, gradingCompany, grade);
  const marketPrice = calculateEbayMarketPrice(listings);

  return NextResponse.json({ listings, marketPrice, debug });
}
