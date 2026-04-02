import { NextRequest, NextResponse } from 'next/server';
import { lookupTAGCert } from '@/lib/cert/tag';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const certNumber = searchParams.get('certNumber');

  if (!certNumber) {
    return NextResponse.json({ error: 'certNumber required' }, { status: 400 });
  }

  const result = await lookupTAGCert(certNumber);
  return NextResponse.json(result);
}
