'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Card as CardType } from '@/types';

interface SetCompletionProps {
  cards: CardType[];
}

interface SetInfo {
  name: string;
  owned: number;
  value: number;
}

export function SetCompletion({ cards }: SetCompletionProps) {
  // Group cards by set
  const setMap: Record<string, SetInfo> = {};

  for (const card of cards) {
    const set = card.set_name || 'Unknown';
    if (!setMap[set]) {
      setMap[set] = { name: set, owned: 0, value: 0 };
    }
    setMap[set].owned += 1;
  }

  const sets = Object.values(setMap)
    .sort((a, b) => b.owned - a.owned)
    .slice(0, 10);

  if (sets.length === 0) return null;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white text-base">Set Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sets.map((set) => (
          <div key={set.name} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white text-sm truncate">{set.name}</p>
                <Badge className="bg-yellow-500/20 text-yellow-400 text-xs ml-2">
                  {set.owned} cards
                </Badge>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-yellow-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (set.owned / Math.max(set.owned, 200)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
