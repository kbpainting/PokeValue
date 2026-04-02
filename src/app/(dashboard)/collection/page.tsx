import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CollectionMetrics } from '@/components/dashboard/collection-metrics';
import { DashboardCharts } from '@/components/dashboard/charts';
import { CardGrid } from '@/components/collection/card-grid';
import { Separator } from '@/components/ui/separator';
import type { Card } from '@/types';

export const revalidate = 0; // Always fresh data

export default async function CollectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch cards and prices in parallel for speed
  const [cardsResult, pricesResult] = await Promise.all([
    supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('price_history')
      .select('card_id, price, source, fetched_at')
      .order('fetched_at', { ascending: false }),
  ]);

  const cardList = (cardsResult.data || []) as Card[];
  const priceMap: Record<string, number> = {};

  if (pricesResult.data && cardList.length > 0) {
    const cardIdSet = new Set(cardList.map((c) => c.id));

    // Build best price per card:
    // Priority: EBAY (graded comps) > PRICECHARTING > TCGPLAYER (raw)
    const cardPrices: Record<string, { price: number; source: string; time: string }> = {};

    for (const p of pricesResult.data) {
      if (!cardIdSet.has(p.card_id)) continue;

      const existing = cardPrices[p.card_id];
      if (!existing) {
        // First price we find (already sorted by fetched_at desc = most recent)
        cardPrices[p.card_id] = { price: p.price, source: p.source, time: p.fetched_at };
      } else {
        // Prefer graded comp sources over raw
        const sourcePriority: Record<string, number> = {
          EBAY: 3,
          PRICECHARTING: 2,
          TCGPLAYER: 1,
          GOLDIN: 4,
        };
        const existingPriority = sourcePriority[existing.source] || 0;
        const newPriority = sourcePriority[p.source] || 0;

        if (newPriority > existingPriority) {
          cardPrices[p.card_id] = { price: p.price, source: p.source, time: p.fetched_at };
        }
      }
    }

    for (const [cardId, data] of Object.entries(cardPrices)) {
      priceMap[cardId] = data.price;
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
