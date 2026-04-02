import { NextRequest, NextResponse } from 'next/server';
import { lookupPSACert } from '@/lib/cert/psa';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const certNumber = searchParams.get('certNumber');

  if (!certNumber) {
    return NextResponse.json({ error: 'certNumber required' }, { status: 400 });
  }

  const result = await lookupPSACert(certNumber);

  // Return in a format the form expects
  return NextResponse.json({
    ...result,
    // The form looks for imageUrl
    imageUrl: result.imageUrl,
    verificationUrl: `https://www.psacard.com/cert/${result.certNumber}`,
  });
}
