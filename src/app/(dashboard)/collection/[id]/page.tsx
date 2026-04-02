import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { PriceRecord, GradingCompany } from '@/types';

const COMPANY_COLORS: Record<GradingCompany, string> = {
  PSA: 'bg-red-500/20 text-red-400 border-red-500/30',
  CGC: 'bg-green-500/20 text-green-400 border-green-500/30',
  BGS: 'bg-gray-400/20 text-gray-300 border-gray-400/30',
  TAG: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  RAW: 'bg-gray-600/20 text-gray-400 border-gray-600/30',
};

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: card } = await supabase
    .from('cards')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!card) notFound();

  // Get price history
  const { data: priceHistory } = await supabase
    .from('price_history')
    .select('*')
    .eq('card_id', id)
    .order('fetched_at', { ascending: false });

  const prices = (priceHistory || []) as PriceRecord[];
  const ebayPrices = prices.filter((p) => p.source === 'EBAY');
  const tcgPrices = prices.filter((p) => p.source === 'TCGPLAYER');
  const pcPrices = prices.filter((p) => p.source === 'PRICECHARTING');

  // Get population data
  const { data: popData } = await supabase
    .from('population_data')
    .select('*')
    .eq('card_id', id)
    .order('fetched_at', { ascending: false })
    .limit(1);

  const population = popData?.[0] || null;

  // Calculate market value
  const allPrices = prices.map((p) => p.price).filter((p) => p > 0);
  const marketValue = allPrices.length > 0
    ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length
    : null;

  const gainLoss = marketValue && card.purchase_price
    ? marketValue - card.purchase_price
    : null;

  return (
    <div className="max-w-5xl space-y-6">
      <Link
        href="/collection"
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Collection
      </Link>

      <div className="grid md:grid-cols-[300px_1fr] gap-8">
        {/* Card Image */}
        <div>
          <div className="aspect-[2/3] bg-gray-800 rounded-xl overflow-hidden border-2 border-gray-700">
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
          </div>

          {/* Cert image/link */}
          {card.cert_image_url && (
            <a
              href={card.cert_image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-2 text-sm text-blue-400 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Cert Verification
            </a>
          )}
        </div>

        {/* Card Details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{card.card_name}</h1>
              <Badge className={COMPANY_COLORS[card.grading_company as GradingCompany]}>
                {card.grading_company} {card.grade || ''}
              </Badge>
            </div>
            <p className="text-gray-400">
              {card.set_name} #{card.card_number}
            </p>
            {card.cert_number && (
              <p className="text-gray-500 text-sm font-mono mt-1">
                Cert #{card.cert_number}
              </p>
            )}
          </div>

          {/* Value Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4">
                <p className="text-xs text-gray-400 mb-1">Market Value</p>
                <p className="text-xl font-bold text-green-400">
                  {marketValue ? `$${marketValue.toFixed(2)}` : 'N/A'}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4">
                <p className="text-xs text-gray-400 mb-1">Cost Basis</p>
                <p className="text-xl font-bold text-white">
                  {card.purchase_price ? `$${card.purchase_price}` : 'N/A'}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4">
                <p className="text-xs text-gray-400 mb-1">Gain/Loss</p>
                <p className={`text-xl font-bold ${gainLoss && gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {gainLoss != null ? `${gainLoss >= 0 ? '+' : ''}$${gainLoss.toFixed(2)}` : 'N/A'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Population */}
          {population && (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Population</p>
                    <p className="text-2xl font-bold text-yellow-500">{population.population}</p>
                  </div>
                  <Separator orientation="vertical" className="bg-gray-700 h-10" />
                  <div>
                    <p className="text-xs text-gray-400">Pop Higher</p>
                    <p className="text-2xl font-bold text-gray-300">{population.population_higher}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Price Tabs */}
          <Tabs defaultValue="ebay" className="w-full">
            <TabsList className="bg-gray-800 border border-gray-700">
              <TabsTrigger value="ebay" className="data-[state=active]:bg-gray-700">
                eBay ({ebayPrices.length})
              </TabsTrigger>
              <TabsTrigger value="tcg" className="data-[state=active]:bg-gray-700">
                TCGPlayer ({tcgPrices.length})
              </TabsTrigger>
              <TabsTrigger value="pc" className="data-[state=active]:bg-gray-700">
                PriceCharting ({pcPrices.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ebay" className="mt-4 space-y-2">
              {ebayPrices.length === 0 ? (
                <p className="text-gray-500 text-sm">No eBay data yet</p>
              ) : (
                ebayPrices.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex justify-between items-center bg-gray-800 rounded px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-gray-300 truncate">{p.listing_title}</p>
                      <p className="text-gray-500 text-xs">{p.sale_date || 'N/A'}</p>
                    </div>
                    <span className="text-green-400 font-mono whitespace-nowrap">
                      ${p.price.toFixed(2)}
                    </span>
                    {p.listing_url && (
                      <a href={p.listing_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-400">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="tcg" className="mt-4 space-y-2">
              {tcgPrices.length === 0 ? (
                <p className="text-gray-500 text-sm">No TCGPlayer data yet</p>
              ) : (
                tcgPrices.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex justify-between items-center bg-gray-800 rounded px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-gray-300 truncate">{p.listing_title}</p>
                    </div>
                    <span className="text-blue-400 font-mono">${p.price.toFixed(2)}</span>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="pc" className="mt-4 space-y-2">
              {pcPrices.length === 0 ? (
                <p className="text-gray-500 text-sm">No PriceCharting data yet</p>
              ) : (
                pcPrices.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex justify-between items-center bg-gray-800 rounded px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-gray-300 truncate">{p.listing_title}</p>
                    </div>
                    <span className="text-purple-400 font-mono">${p.price.toFixed(2)}</span>
                    {p.listing_url && (
                      <a href={p.listing_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-400">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
