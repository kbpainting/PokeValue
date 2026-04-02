'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Search, DollarSign } from 'lucide-react';
import {
  GRADING_COMPANIES,
  GRADES,
  CARD_VARIANTS,
  type GradingCompany,
  type CardVariant,
  type SoldListing,
} from '@/types';

interface TCGSearchResult {
  id: string;
  name: string;
  number: string;
  set: string;
  image: string;
  imageLarge: string;
}

export function AddCardForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fetchingPrices, setFetchingPrices] = useState(false);

  // Form fields
  const [gradingCompany, setGradingCompany] = useState<GradingCompany>('PSA');
  const [grade, setGrade] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [setName, setSetName] = useState('');
  const [cardVariant, setCardVariant] = useState<CardVariant | ''>('');
  const [certNumber, setCertNumber] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');

  // Search results
  const [searchResults, setSearchResults] = useState<TCGSearchResult[]>([]);
  const [selectedCard, setSelectedCard] = useState<TCGSearchResult | null>(null);

  // Pricing data
  const [ebayListings, setEbayListings] = useState<SoldListing[]>([]);
  const [tcgListings, setTcgListings] = useState<SoldListing[]>([]);
  const [pcListings, setPcListings] = useState<SoldListing[]>([]);
  const [ebayMarketPrice, setEbayMarketPrice] = useState<number | null>(null);

  // Debounced search — auto-searches 400ms after user stops typing
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const searchCards = useCallback(async (query?: string) => {
    const q = (query ?? cardName).trim();
    if (!q || q.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/pricing/tcgplayer?search=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }, [cardName]);

  function handleCardNameChange(value: string) {
    setCardName(value);
    // Clear previous timer
    if (searchTimer.current) clearTimeout(searchTimer.current);
    // Auto-search after 400ms of no typing (if 3+ chars)
    if (value.trim().length >= 3) {
      searchTimer.current = setTimeout(() => searchCards(value), 400);
    } else {
      setSearchResults([]);
    }
  }

  function selectCard(card: TCGSearchResult) {
    setSelectedCard(card);
    setCardName(card.name);
    setCardNumber(card.number);
    setSetName(card.set);
    setSearchResults([]);
  }

  // Fetch pricing from all sources
  async function fetchPrices() {
    if (!cardName.trim()) return;
    setFetchingPrices(true);

    try {
      const [ebayRes, tcgRes, pcRes] = await Promise.all([
        fetch(
          `/api/pricing/ebay?cardName=${encodeURIComponent(cardName)}&cardNumber=${encodeURIComponent(cardNumber)}&gradingCompany=${gradingCompany}&grade=${grade}`
        ),
        fetch(
          `/api/pricing/tcgplayer?cardName=${encodeURIComponent(cardName)}&setName=${encodeURIComponent(setName)}&cardNumber=${encodeURIComponent(cardNumber)}`
        ),
        fetch(
          `/api/pricing/pricecharting?cardName=${encodeURIComponent(cardName)}&setName=${encodeURIComponent(setName)}`
        ),
      ]);

      const [ebayData, tcgData, pcData] = await Promise.all([
        ebayRes.json(),
        tcgRes.json(),
        pcRes.json(),
      ]);

      setEbayListings(ebayData.listings || []);
      setEbayMarketPrice(ebayData.marketPrice || null);
      setTcgListings(tcgData.listings || []);
      setPcListings(pcData.listings || []);
    } catch {
      toast.error('Failed to fetch prices');
    } finally {
      setFetchingPrices(false);
    }
  }

  // Auto-fetch prices when card details change
  useEffect(() => {
    if (selectedCard) {
      fetchPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCard, gradingCompany, grade]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cardName.trim() || !cardNumber.trim()) {
      toast.error('Card name and number are required');
      return;
    }
    setLoading(true);

    try {
      // Look up cert image if cert number provided
      let certImageUrl = null;
      if (certNumber && gradingCompany !== 'RAW') {
        const certRes = await fetch(
          `/api/cert/${gradingCompany.toLowerCase()}?certNumber=${encodeURIComponent(certNumber)}`
        );
        if (certRes.ok) {
          const certData = await certRes.json();
          certImageUrl = certData.imageUrl || certData.verificationUrl || null;
        }
      }

      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_name: cardName,
          card_number: cardNumber,
          set_name: setName,
          card_variant: cardVariant || null,
          grading_company: gradingCompany,
          grade: gradingCompany === 'RAW' ? null : grade,
          cert_number: certNumber || null,
          cert_image_url: certImageUrl,
          card_image_url: selectedCard?.imageLarge || selectedCard?.image || null,
          purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
          purchase_date: purchaseDate || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add card');
      }

      // Save price history to the correct endpoint
      const { card } = await res.json();
      const allListings = [...ebayListings, ...tcgListings, ...pcListings];
      if (allListings.length > 0 && card?.id) {
        // Store price records (fire and forget, use correct endpoint)
        const savePromises = allListings.slice(0, 30).map((listing) =>
          fetch('/api/price-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              card_id: card.id,
              source: listing.source,
              price: listing.price,
              sale_date: listing.date,
              listing_title: listing.title,
              listing_url: listing.url,
            }),
          }).catch(() => {})
        );
        // Wait for at least some to complete before navigating
        await Promise.allSettled(savePromises);
      }

      toast.success('Card added to collection!');
      router.push('/collection');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add card');
    } finally {
      setLoading(false);
    }
  }

  const companyGrades = GRADES[gradingCompany] || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Card Search */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Search Card</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={cardName}
              onChange={(e) => handleCardNameChange(e.target.value)}
              placeholder="Start typing a Pokemon card name..."
              className="bg-gray-800 border-gray-700 text-white"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchCards())}
            />
            <Button
              type="button"
              onClick={() => searchCards()}
              disabled={searching}
              variant="outline"
              className="border-gray-700"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
              {searchResults.slice(0, 12).map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => selectCard(card)}
                  className="bg-gray-800 rounded-lg p-2 border border-gray-700 hover:border-yellow-500 transition-colors text-left"
                >
                  {card.image && (
                    <img
                      src={card.image}
                      alt={card.name}
                      className="w-full rounded mb-2"
                    />
                  )}
                  <p className="text-xs text-white font-medium truncate">{card.name}</p>
                  <p className="text-xs text-gray-400">{card.set} #{card.number}</p>
                </button>
              ))}
            </div>
          )}

          {selectedCard && (
            <div className="flex items-center gap-4 bg-gray-800 rounded-lg p-3">
              {selectedCard.image && (
                <img src={selectedCard.image} alt="" className="w-16 rounded" />
              )}
              <div>
                <p className="text-white font-medium">{selectedCard.name}</p>
                <p className="text-gray-400 text-sm">
                  {selectedCard.set} #{selectedCard.number}
                </p>
              </div>
              <Badge className="bg-green-500/10 text-green-500 ml-auto">Selected</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grading Details */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Grading Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Grading Company</Label>
              <Select
                value={gradingCompany}
                onValueChange={(v) => {
                  setGradingCompany(v as GradingCompany);
                  setGrade('');
                }}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADING_COMPANIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {gradingCompany !== 'RAW' && (
              <div className="space-y-2">
                <Label className="text-gray-300">Grade</Label>
                <Select value={grade} onValueChange={(v) => setGrade(v ?? '')}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyGrades.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Card Number</Label>
              <Input
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="e.g. TG03, 12/100"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Set Name</Label>
              <Input
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                placeholder="e.g. Crown Zenith"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Card Variant</Label>
            <Select value={cardVariant} onValueChange={(v) => setCardVariant((v ?? '') as CardVariant | '')}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Select variant (Holo, Non-Holo, etc.)" />
              </SelectTrigger>
              <SelectContent>
                {CARD_VARIANTS.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {gradingCompany !== 'RAW' && (
            <div className="space-y-2">
              <Label className="text-gray-300">Cert Number</Label>
              <Input
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
                placeholder="Enter certification number"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase Info */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Purchase Info (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Purchase Price</Label>
              <Input
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="$0.00"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Purchase Date</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Pricing Preview */}
      {(ebayListings.length > 0 || tcgListings.length > 0 || pcListings.length > 0) && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Market Pricing Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* GRADED VALUE SECTION */}
            {(ebayListings.length > 0 || pcListings.length > 0) && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-green-500/30" />
                  <span className="text-xs font-bold text-green-400 uppercase tracking-wider">
                    {gradingCompany !== 'RAW' ? `${gradingCompany} ${grade} Graded Comps` : 'Raw Card Comps'}
                  </span>
                  <div className="h-px flex-1 bg-green-500/30" />
                </div>

                {ebayMarketPrice && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <p className="text-green-500 font-semibold text-lg">
                      eBay Graded Comp: ${ebayMarketPrice.toFixed(2)}
                    </p>
                    <p className="text-gray-400 text-sm">
                      Based on {ebayListings.length} recent {gradingCompany !== 'RAW' ? `${gradingCompany} ${grade}` : 'raw'} sold listings
                    </p>
                  </div>
                )}

                {/* eBay Sold — Graded Comps */}
                {ebayListings.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      eBay Sold — {gradingCompany !== 'RAW' ? `${gradingCompany} ${grade}` : 'Raw'} ({ebayListings.length})
                    </h4>
                    <div className="space-y-1.5">
                      {ebayListings.slice(0, 5).map((l, i) => (
                        <div key={i} className="flex justify-between items-center text-sm bg-gray-800 rounded px-3 py-2">
                          <span className="text-gray-300 truncate mr-4">{l.title}</span>
                          <span className="text-green-400 font-mono whitespace-nowrap font-semibold">
                            ${l.price.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PriceCharting */}
                {pcListings.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      PriceCharting ({pcListings.length})
                    </h4>
                    <div className="space-y-1.5">
                      {pcListings.slice(0, 5).map((l, i) => (
                        <div key={i} className="flex justify-between items-center text-sm bg-gray-800 rounded px-3 py-2">
                          <span className="text-gray-300 truncate mr-4">{l.title}</span>
                          <span className="text-purple-400 font-mono whitespace-nowrap">
                            ${l.price.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RAW VALUE SECTION — TCGPlayer */}
            {tcgListings.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-blue-500/30" />
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                    Raw (Ungraded) Value
                  </span>
                  <div className="h-px flex-1 bg-blue-500/30" />
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    TCGPlayer — Raw Singles ({tcgListings.length})
                  </h4>
                  <div className="space-y-1.5">
                    {tcgListings.slice(0, 5).map((l, i) => (
                      <div key={i} className="flex justify-between items-center text-sm bg-gray-800 rounded px-3 py-2">
                        <span className="text-gray-300 truncate mr-4">{l.title}</span>
                        <span className="text-blue-400 font-mono whitespace-nowrap">
                          ${l.price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    TCGPlayer prices are for raw (ungraded) singles only
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {fetchingPrices && (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Fetching market prices...
        </div>
      )}

      <Separator className="bg-gray-800" />

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={fetchPrices}
          disabled={fetchingPrices || !cardName.trim()}
          className="border-gray-700"
        >
          {fetchingPrices ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <DollarSign className="w-4 h-4 mr-2" />
          )}
          Fetch Prices
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold flex-1"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Add to Collection
        </Button>
      </div>
    </form>
  );
}
