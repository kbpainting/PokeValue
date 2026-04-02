'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { PortfolioSnapshot } from '@/types';

const TIME_RANGES = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 9999 },
];

interface PortfolioChartProps {
  currentValue: number;
  currentCost: number;
  currentCards: number;
}

export function PortfolioChart({ currentValue, currentCost, currentCards }: PortfolioChartProps) {
  const [range, setRange] = useState(30);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSnapshots() {
      setLoading(true);
      try {
        const res = await fetch(`/api/snapshots?days=${range}`);
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchSnapshots();
  }, [range]);

  // Save today's snapshot whenever component mounts
  useEffect(() => {
    if (currentValue > 0) {
      fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_value: currentValue,
          total_cards: currentCards,
          total_cost: currentCost,
        }),
      }).catch(() => {});
    }
  }, [currentValue, currentCards, currentCost]);

  // Build chart data — include today's value
  const chartData = [
    ...snapshots.map((s) => ({
      date: s.snapshot_date,
      value: Number(s.total_value),
      cost: Number(s.total_cost),
    })),
  ];

  // Add today if not already included
  const today = new Date().toISOString().split('T')[0];
  if (!chartData.find((d) => d.date === today) && currentValue > 0) {
    chartData.push({ date: today, value: currentValue, cost: currentCost });
  }

  // Calculate period change
  const firstValue = chartData.length > 0 ? chartData[0].value : currentValue;
  const periodChange = currentValue - firstValue;
  const periodChangePercent = firstValue > 0 ? (periodChange / firstValue) * 100 : 0;
  const isPositive = periodChange >= 0;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-yellow-500" />
              Portfolio Value
            </CardTitle>
            {chartData.length > 1 && (
              <p className={`text-sm mt-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{periodChange.toFixed(2)} ({isPositive ? '+' : ''}{periodChangePercent.toFixed(1)}%)
                <span className="text-gray-500 ml-1">
                  {TIME_RANGES.find((r) => r.days === range)?.label || ''}
                </span>
              </p>
            )}
          </div>
          <div className="flex gap-1">
            {TIME_RANGES.map((r) => (
              <Button
                key={r.label}
                variant="ghost"
                size="sm"
                onClick={() => setRange(r.days)}
                className={`text-xs px-2 h-7 ${
                  range === r.days
                    ? 'bg-yellow-500/20 text-yellow-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center text-gray-500">
            Loading chart...
          </div>
        ) : chartData.length < 2 ? (
          <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
            Portfolio chart will appear after 2+ days of tracking.
            <br />
            <span className="text-gray-600 text-xs">Current value: ${currentValue.toFixed(2)}</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                fontSize={11}
                tickFormatter={(d) => {
                  const date = new Date(d + 'T00:00:00');
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Value']}
                labelFormatter={(label) => {
                  const d = new Date(label + 'T00:00:00');
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }}
              />
              <Area type="monotone" dataKey="value" stroke="#EAB308" fill="url(#valueGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
