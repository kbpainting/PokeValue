import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CollectionMetrics } from '@/components/dashboard/collection-metrics';
import { DashboardCharts } from '@/components/dashboard/charts';
import { PortfolioChart } from '@/components/dashboard/portfolio-chart';
import { BiggestMovers } from '@/components/dashboard/biggest-movers';
import { SetCompletion } from '@/components/dashboard/set-completion';
import { CardGrid } from '@/components/collection/card-grid';
import { Separator } from '@/components/ui/separator';
import type { Card } from '@/types';

export const revalidate = 0;

export default async function CollectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

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
    const cardPrices: Record<string, { price: number; source: string }> = {};
    const sourcePriority: Record<string, number> = { GOLDIN: 4, EBAY: 3, PRICECHARTING: 2, TCGPLAYER: 1 };

    for (const p of pricesResult.data) {
      if (!cardIdSet.has(p.card_id)) continue;
      const existing = cardPrices[p.card_id];
      if (!existing || (sourcePriority[p.source] || 0) > (sourcePriority[existing.source] || 0)) {
        cardPrices[p.card_id] = { price: p.price, source: p.source };
      }
    }
    for (const [cardId, data] of Object.entries(cardPrices)) {
      priceMap[cardId] = data.price;
    }
  }

  const totalValue = Object.values(priceMap).reduce((sum, p) => sum + p, 0);
  const totalCost = cardList.reduce((sum, c) => sum + (c.purchase_price || 0), 0);

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

      {/* Portfolio value over time */}
      <PortfolioChart currentValue={totalValue} currentCost={totalCost} currentCards={cardList.length} />

      {/* Biggest Movers */}
      <BiggestMovers cards={cardList} priceMap={priceMap} />

      {/* Charts + Set Completion */}
      {cardList.length > 0 && (
        <>
          <Separator className="bg-gray-800" />
          <div className="grid lg:grid-cols-[1fr_300px] gap-6">
            <DashboardCharts cards={cardList} priceMap={priceMap} />
            <SetCompletion cards={cardList} />
          </div>
        </>
      )}

      {/* Collection Grid */}
      <Separator className="bg-gray-800" />
      <CardGrid cards={cardList} priceMap={priceMap} />
    </div>
  );
}
