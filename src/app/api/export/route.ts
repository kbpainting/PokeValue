import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Export collection as CSV */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: cards, error } = await supabase
    .from('cards')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build CSV
  const headers = [
    'Card Name', 'Card Number', 'Set', 'Variant', 'Grading Company',
    'Grade', 'Cert Number', 'Purchase Price', 'Purchase Date', 'Notes', 'Date Added'
  ];

  const rows = (cards || []).map((c) => [
    `"${(c.card_name || '').replace(/"/g, '""')}"`,
    `"${c.card_number || ''}"`,
    `"${(c.set_name || '').replace(/"/g, '""')}"`,
    `"${c.card_variant || ''}"`,
    c.grading_company,
    c.grade || '',
    c.cert_number || '',
    c.purchase_price || '',
    c.purchase_date || '',
    `"${(c.notes || '').replace(/"/g, '""')}"`,
    c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : '',
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="pokevalue-collection-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
