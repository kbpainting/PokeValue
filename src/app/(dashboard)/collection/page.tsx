import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CollectionMetrics } from '@/components/dashboard/collection-metrics';
import { DashboardCharts } from '@/components/dashboard/charts';
import { CardGrid } from '@/components/collection/card-grid';
import { Separator } from '@/components/ui/separator';
import type { Card } from '@/types';

export default async function CollectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: cards } = await supabase
    .from('cards')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Get latest price for each card from price_history
  const cardList = (cards || []) as Card[];
  const priceMap: Record<string, number> = {};

  if (cardList.length > 0) {
    const cardIds = cardList.map((c) => c.id);
    const { data: prices } = await supabase
      .from('price_history')
      .select('card_id, price, source')
      .in('card_id', cardIds)
      .order('fetched_at', { ascending: false });

    if (prices) {
      // Use the first (most recent) price per card
      for (const p of prices) {
        if (!priceMap[p.card_id]) {
          priceMap[p.card_id] = p.price;
        }
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">My Collection</h1>
        <p className="text-gray-400 mt-1">
          {cardList.length} card{cardList.length !== 1 ? 's' : ''} tracked
        </p>
      </div>

      {/* Metrics */}
      <CollectionMetrics cards={cardList} priceMap={priceMap} />

      {/* Charts */}
      {cardList.length > 0 && (
        <>
          <Separator className="bg-gray-800" />
          <DashboardCharts cards={cardList} priceMap={priceMap} />
        </>
      )}

      {/* Collection Grid */}
      <Separator className="bg-gray-800" />
      <CardGrid cards={cardList} priceMap={priceMap} />
    </div>
  );
}
