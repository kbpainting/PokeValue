'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Card as CardType } from '@/types';

interface BiggestMoversProps {
  cards: CardType[];
  priceMap: Record<string, number>;
}

export function BiggestMovers({ cards, priceMap }: BiggestMoversProps) {
  // Calculate gain/loss for cards that have both purchase price and current value
  const movers = cards
    .filter((c) => c.purchase_price && priceMap[c.id])
    .map((c) => ({
      card: c,
      currentValue: priceMap[c.id],
      purchasePrice: c.purchase_price!,
      gainLoss: priceMap[c.id] - c.purchase_price!,
      gainLossPercent: ((priceMap[c.id] - c.purchase_price!) / c.purchase_price!) * 100,
    }))
    .sort((a, b) => Math.abs(b.gainLossPercent) - Math.abs(a.gainLossPercent));

  const gainers = movers.filter((m) => m.gainLoss > 0).slice(0, 5);
  const losers = movers.filter((m) => m.gainLoss < 0).slice(0, 5);

  if (movers.length === 0) return null;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Top Gainers */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Top Gainers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {gainers.length === 0 ? (
            <p className="text-gray-500 text-sm">No gainers yet — add purchase prices to track</p>
          ) : (
            gainers.map((m) => (
              <div key={m.card.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{m.card.card_name}</p>
                  <p className="text-gray-400 text-xs">{m.card.grading_company} {m.card.grade || ''}</p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-green-400 text-sm font-mono font-semibold">
                    +${m.gainLoss.toFixed(2)}
                  </p>
                  <p className="text-green-400/70 text-xs">+{m.gainLossPercent.toFixed(1)}%</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Top Losers */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Top Losers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {losers.length === 0 ? (
            <p className="text-gray-500 text-sm">No losers — your collection is winning</p>
          ) : (
            losers.map((m) => (
              <div key={m.card.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{m.card.card_name}</p>
                  <p className="text-gray-400 text-xs">{m.card.grading_company} {m.card.grade || ''}</p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-red-400 text-sm font-mono font-semibold">
                    -${Math.abs(m.gainLoss).toFixed(2)}
                  </p>
                  <p className="text-red-400/70 text-xs">{m.gainLossPercent.toFixed(1)}%</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
