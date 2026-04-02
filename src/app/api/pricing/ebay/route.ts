import { NextRequest, NextResponse } from 'next/server';
import { getEbaySoldListings, calculateEbayMarketPrice } from '@/lib/pricing/ebay';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cardName = searchParams.get('cardName');
  const gradingCompany = searchParams.get('gradingCompany') || 'RAW';
  const grade = searchParams.get('grade');

  if (!cardName) {
    return NextResponse.json({ error: 'cardName required' }, { status: 400 });
  }

  const listings = await getEbaySoldListings(cardName, gradingCompany, grade);
  const marketPrice = calculateEbayMarketPrice(listings);

  return NextResponse.json({ listings, marketPrice });
}
