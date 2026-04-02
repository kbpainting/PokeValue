import { NextRequest, NextResponse } from 'next/server';
import { lookupPSACert } from '@/lib/cert/psa';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const certNumber = searchParams.get('certNumber');

  if (!certNumber) {
    return NextResponse.json({ error: 'certNumber required' }, { status: 400 });
  }

  const result = await lookupPSACert(certNumber);
  return NextResponse.json(result);
}
