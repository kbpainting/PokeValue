'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { Card as CardType, GradingCompany } from '@/types';

const COMPANY_CHART_COLORS: Record<GradingCompany, string> = {
  PSA: '#E31837',
  CGC: '#00A651',
  BGS: '#9CA3AF',
  TAG: '#8B5CF6',
  RAW: '#6B7280',
};

interface ChartsProps {
  cards: CardType[];
  priceMap: Record<string, number>;
}

export function DashboardCharts({ cards, priceMap }: ChartsProps) {
  // Grade distribution
  const gradeCount: Record<string, number> = {};
  for (const card of cards) {
    const g = card.grade || 'RAW';
    gradeCount[g] = (gradeCount[g] || 0) + 1;
  }
  const gradeData = Object.entries(gradeCount)
    .sort((a, b) => {
      const numA = parseFloat(a[0]);
      const numB = parseFloat(b[0]);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a[0].localeCompare(b[0]);
    })
    .map(([grade, count]) => ({ grade, count }));

  // Company breakdown
  const companyCount: Record<string, number> = {};
  const companyValue: Record<string, number> = {};
  for (const card of cards) {
    companyCount[card.grading_company] = (companyCount[card.grading_company] || 0) + 1;
    companyValue[card.grading_company] =
      (companyValue[card.grading_company] || 0) + (priceMap[card.id] || 0);
  }
  const companyData = Object.entries(companyCount).map(([company, count]) => ({
    company,
    count,
    value: companyValue[company] || 0,
    fill: COMPANY_CHART_COLORS[company as GradingCompany] || '#6B7280',
  }));

  // Top 10 cards by value
  const topCards = [...cards]
    .filter((c) => priceMap[c.id])
    .sort((a, b) => (priceMap[b.id] || 0) - (priceMap[a.id] || 0))
    .slice(0, 10)
    .map((c) => ({
      name: `${c.card_name.substring(0, 20)}`,
      value: priceMap[c.id] || 0,
    }));

  // Value by set
  const setValue: Record<string, number> = {};
  for (const card of cards) {
    const set = card.set_name || 'Unknown';
    setValue[set] = (setValue[set] || 0) + (priceMap[card.id] || 0);
  }
  const setData = Object.entries(setValue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([set, value]) => ({ set: set.substring(0, 20), value }));

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Grade Distribution */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Grade Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={gradeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="grade" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#F3F4F6' }}
                itemStyle={{ color: '#EAB308' }}
              />
              <Bar dataKey="count" fill="#EAB308" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Company Breakdown */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-base">By Grading Company</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={companyData}
                dataKey="count"
                nameKey="company"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name} (${value})`}
              >
                {companyData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                formatter={(value) => [`${value} cards`]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Cards by Value */}
      {topCards.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Top Cards by Value</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topCards} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" stroke="#9CA3AF" fontSize={11} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Value']}
                />
                <Bar dataKey="value" fill="#22C55E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Value by Set */}
      {setData.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Value by Set</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={setData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="set" stroke="#9CA3AF" fontSize={11} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Value']}
                />
                <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
