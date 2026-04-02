'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card as UICard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Grid3X3, List, Search, Plus, Trash2 } from 'lucide-react';
import { GRADING_COMPANIES, type Card, type GradingCompany } from '@/types';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const COMPANY_COLORS: Record<GradingCompany, string> = {
  PSA: 'border-red-500 bg-red-500/10',
  CGC: 'border-green-500 bg-green-500/10',
  BGS: 'border-gray-400 bg-gray-400/10',
  TAG: 'border-purple-500 bg-purple-500/10',
  RAW: 'border-gray-600 bg-gray-600/10',
};

const COMPANY_BADGE_COLORS: Record<GradingCompany, string> = {
  PSA: 'bg-red-500/20 text-red-400',
  CGC: 'bg-green-500/20 text-green-400',
  BGS: 'bg-gray-400/20 text-gray-300',
  TAG: 'bg-purple-500/20 text-purple-400',
  RAW: 'bg-gray-600/20 text-gray-400',
};

interface CardGridProps {
  cards: Card[];
  priceMap?: Record<string, number>;
}

export function CardGrid({ cards, priceMap = {} }: CardGridProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const router = useRouter();

  const filtered = cards
    .filter((card) => {
      const matchesSearch =
        card.card_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.card_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.set_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCompany =
        filterCompany === 'all' || card.grading_company === filterCompany;
      return matchesSearch && matchesCompany;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':
          return a.card_name.localeCompare(b.card_name);
        case 'value-high': {
          const va = priceMap[a.id] || 0;
          const vb = priceMap[b.id] || 0;
          return vb - va;
        }
        case 'value-low': {
          const va = priceMap[a.id] || 0;
          const vb = priceMap[b.id] || 0;
          return va - vb;
        }
        default:
          return 0;
      }
    });

  async function deleteCard(id: string) {
    try {
      const res = await fetch(`/api/cards?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Card removed');
        router.refresh();
      } else {
        toast.error('Failed to delete');
      }
    } catch {
      toast.error('Failed to delete');
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards..."
            className="pl-9 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <Select value={filterCompany} onValueChange={(v) => setFilterCompany(v ?? 'all')}>
          <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700 text-white">
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {GRADING_COMPANIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v ?? 'newest')}>
          <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="value-high">Value High-Low</SelectItem>
            <SelectItem value="value-low">Value Low-High</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border border-gray-700 rounded-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'text-yellow-500' : 'text-gray-400'}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'text-yellow-500' : 'text-gray-400'}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
        <Link href="/add">
          <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
            <Plus className="w-4 h-4 mr-1" /> Add Card
          </Button>
        </Link>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-400">
        {filtered.length} card{filtered.length !== 1 ? 's' : ''} in collection
      </p>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((card) => (
            <UICard
              key={card.id}
              className={`bg-gray-900 border-2 ${COMPANY_COLORS[card.grading_company]} overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer relative group`}
            >
              <Link href={`/collection/${card.id}`}>
                <div className="aspect-[2/3] bg-gray-800 relative">
                  {card.card_image_url ? (
                    <img
                      src={card.card_image_url}
                      alt={card.card_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      No Image
                    </div>
                  )}
                  {/* Grade badge */}
                  {card.grade && (
                    <Badge
                      className={`absolute top-2 right-2 ${COMPANY_BADGE_COLORS[card.grading_company]} font-bold`}
                    >
                      {card.grading_company} {card.grade}
                    </Badge>
                  )}
                  {card.grading_company === 'RAW' && (
                    <Badge className="absolute top-2 right-2 bg-gray-600/80 text-gray-200">
                      RAW
                    </Badge>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-white text-sm font-medium truncate">{card.card_name}</p>
                  <p className="text-gray-400 text-xs truncate">
                    {card.set_name} #{card.card_number}
                  </p>
                  {priceMap[card.id] && (
                    <p className="text-green-400 text-sm font-mono mt-1">
                      ${priceMap[card.id].toFixed(2)}
                    </p>
                  )}
                </div>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  deleteCard(card.id);
                }}
                className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/20 p-1 h-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </UICard>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {filtered.map((card) => (
            <Link key={card.id} href={`/collection/${card.id}`}>
              <div className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors">
                <div className="w-12 h-16 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                  {card.card_image_url ? (
                    <img
                      src={card.card_image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                      N/A
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{card.card_name}</p>
                  <p className="text-gray-400 text-xs">
                    {card.set_name} #{card.card_number}
                  </p>
                </div>
                <Badge className={COMPANY_BADGE_COLORS[card.grading_company]}>
                  {card.grading_company} {card.grade || ''}
                </Badge>
                {card.cert_number && (
                  <span className="text-gray-500 text-xs font-mono">
                    Cert #{card.cert_number}
                  </span>
                )}
                {priceMap[card.id] && (
                  <span className="text-green-400 font-mono text-sm">
                    ${priceMap[card.id].toFixed(2)}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteCard(card.id);
                  }}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/20 p-1 h-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg mb-4">No cards in your collection yet</p>
          <Link href="/add">
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
              <Plus className="w-4 h-4 mr-2" /> Add Your First Card
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
