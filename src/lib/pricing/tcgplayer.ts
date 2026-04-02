import { PokemonTCG } from 'pokemon-tcg-sdk-typescript';
import type { SoldListing } from '@/types';

interface TCGPriceData {
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function searchCards(query: string) {
  try {
    const results = await PokemonTCG.findCardsByQueries({ q: `name:"${query}"` });
    return (results as any[]).map((card: any) => ({
      id: card.id,
      name: card.name,
      number: card.number,
      set: card.set?.name || '',
      setId: card.set?.id || '',
      image: card.images?.small || '',
      imageLarge: card.images?.large || '',
      tcgplayerPrices: card.tcgplayer?.prices as Record<string, TCGPriceData> | undefined,
      tcgplayerUrl: card.tcgplayer?.url || '',
    }));
  } catch (error) {
    console.error('TCGPlayer search error:', error);
    return [];
  }
}

/**
 * Gets RAW/ungraded card prices from TCGPlayer via the pokemontcg.io API.
 * IMPORTANT: TCGPlayer only sells RAW (ungraded) cards. All prices returned
 * here are for raw singles — NOT graded slabs.
 */
export async function getCardPrices(
  cardName: string,
  setName: string,
  cardNumber: string
): Promise<SoldListing[]> {
  try {
    const q = cardNumber
      ? `name:"${cardName}" number:"${cardNumber}"`
      : `name:"${cardName}"`;

    const results: any[] = await PokemonTCG.findCardsByQueries({ q });

    // Find best match by set name
    let match = results.find(
      (c: any) => c.set?.name?.toLowerCase() === setName.toLowerCase()
    );
    if (!match && results.length > 0) match = results[0];
    if (!match) return [];

    const prices = match.tcgplayer?.prices;
    if (!prices) return [];

    const listings: SoldListing[] = [];
    const now = new Date().toISOString().split('T')[0];

    // Format variant names for display
    const formatVariant = (variant: string): string => {
      const map: Record<string, string> = {
        normal: 'Normal',
        holofoil: 'Holofoil',
        reverseHolofoil: 'Reverse Holo',
        '1stEditionHolofoil': '1st Ed. Holo',
        '1stEditionNormal': '1st Ed. Normal',
        unlimitedHolofoil: 'Unlimited Holo',
      };
      return map[variant] || variant.replace(/([A-Z])/g, ' $1').trim();
    };

    for (const [variant, data] of Object.entries(prices)) {
      const p = data as TCGPriceData;
      const variantLabel = formatVariant(variant);

      // Market price is the most useful — show it first
      if (p.market) {
        listings.push({
          title: `RAW ${variantLabel} — Market Price`,
          price: p.market,
          date: now,
          url: match.tcgplayer?.url || '',
          source: 'TCGPLAYER',
        });
      }
      if (p.low) {
        listings.push({
          title: `RAW ${variantLabel} — Low`,
          price: p.low,
          date: now,
          url: match.tcgplayer?.url || '',
          source: 'TCGPLAYER',
        });
      }
      if (p.mid) {
        listings.push({
          title: `RAW ${variantLabel} — Mid`,
          price: p.mid,
          date: now,
          url: match.tcgplayer?.url || '',
          source: 'TCGPLAYER',
        });
      }
      if (p.high) {
        listings.push({
          title: `RAW ${variantLabel} — High`,
          price: p.high,
          date: now,
          url: match.tcgplayer?.url || '',
          source: 'TCGPLAYER',
        });
      }
    }

    return listings.slice(0, 10);
  } catch (error) {
    console.error('TCGPlayer price fetch error:', error);
    return [];
  }
}
