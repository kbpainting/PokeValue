'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface PriceHistoryChartProps {
  cardId: string;
}

interface PricePoint {
  date: string;
  price: number;
  source: string;
}

export function PriceHistoryChart({ cardId }: PriceHistoryChartProps) {
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch(`/api/price-history?card_id=${cardId}`);
        const data = await res.json();
        const records = (data.prices || []).map((p: { sale_date: string; fetched_at: string; price: number; source: string }) => ({
          date: p.sale_date || p.fetched_at?.split('T')[0] || '',
          price: Number(p.price),
          source: p.source,
        }));
        // Sort by date ascending and dedupe
        records.sort((a: PricePoint, b: PricePoint) => a.date.localeCompare(b.date));
        setPrices(records);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchPrices();
  }, [cardId]);

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4">
          <div className="h-[150px] flex items-center justify-center text-gray-500 text-sm">
            Loading price history...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (prices.length < 2) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4">
          <div className="h-[100px] flex items-center justify-center text-gray-500 text-sm">
            Price chart will appear with more pricing data over time.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-500" />
          Price History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={prices}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9CA3AF" fontSize={10}
              tickFormatter={(d) => {
                const date = new Date(d + 'T00:00:00');
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis stroke="#9CA3AF" fontSize={10} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value) => [`$${Number(value).toFixed(2)}`]}
            />
            <Line type="monotone" dataKey="price" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
