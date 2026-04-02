'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Hash, DollarSign, Award, Crown } from 'lucide-react';
import type { Card as CardType, GradingCompany } from '@/types';

interface MetricsProps {
  cards: CardType[];
  priceMap: Record<string, number>;
}

export function CollectionMetrics({ cards, priceMap }: MetricsProps) {
  const totalCards = cards.length;
  const totalValue = Object.values(priceMap).reduce((sum, p) => sum + p, 0);
  const totalCost = cards.reduce((sum, c) => sum + (c.purchase_price || 0), 0);
  const gainLoss = totalValue - totalCost;
  const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;
  const isPositive = gainLoss >= 0;

  // Average grade (numeric grades only)
  const numericGrades = cards
    .filter((c) => c.grade && !isNaN(parseFloat(c.grade)))
    .map((c) => parseFloat(c.grade!));
  const avgGrade =
    numericGrades.length > 0
      ? numericGrades.reduce((a, b) => a + b, 0) / numericGrades.length
      : null;

  // Highest value card
  let highestCard: CardType | null = null;
  let highestValue = 0;
  for (const card of cards) {
    const val = priceMap[card.id] || 0;
    if (val > highestValue) {
      highestValue = val;
      highestCard = card;
    }
  }

  // By company
  const byCompany: Record<string, number> = {};
  for (const card of cards) {
    byCompany[card.grading_company] = (byCompany[card.grading_company] || 0) + 1;
  }

  const metrics = [
    {
      label: 'Total Value',
      value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Total Cards',
      value: totalCards.toString(),
      icon: Hash,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Gain / Loss',
      value: `${isPositive ? '+' : ''}$${gainLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: totalCost > 0 ? `${isPositive ? '+' : ''}${gainLossPercent.toFixed(1)}%` : undefined,
      icon: isPositive ? TrendingUp : TrendingDown,
      color: isPositive ? 'text-green-500' : 'text-red-500',
      bgColor: isPositive ? 'bg-green-500/10' : 'bg-red-500/10',
    },
    {
      label: 'Avg Grade',
      value: avgGrade ? avgGrade.toFixed(1) : 'N/A',
      icon: Award,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      label: 'Top Card',
      value: highestCard
        ? `$${highestValue.toFixed(2)}`
        : 'N/A',
      subtitle: highestCard?.card_name,
      icon: Crown,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Total Invested',
      value: `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${metric.bgColor}`}>
                <metric.icon className={`w-4 h-4 ${metric.color}`} />
              </div>
              <span className="text-xs text-gray-400">{metric.label}</span>
            </div>
            <p className={`text-lg font-bold ${metric.color}`}>{metric.value}</p>
            {metric.subtitle && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{metric.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
