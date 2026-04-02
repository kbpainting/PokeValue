import { PokemonTCG } from 'pokemon-tcg-sdk-typescript';
import type { SoldListing } from '@/types';

interface TCGPriceData {
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Smart card search that handles natural queries like:
 *   "Pikachu 005"          → name:Pikachu number:005
 *   "Pikachu Celebrations"  → name:Pikachu set.name:Celebrations
 *   "Pikachu 005 Celebrations" → name:Pikachu number:005 set.name:Celebrations
 *   "Charizard VMAX"       → name:"Charizard VMAX"
 *   "Mewtwo 72"            → name:Mewtwo number:72
 */
export async function searchCards(query: string) {
  try {
    const parts = query.trim().split(/\s+/);
    const qParts: string[] = [];

    // Known set names for matching (common ones)
    const knownSets = [
      'celebrations', 'evolving skies', 'brilliant stars', 'astral radiance',
      'lost origin', 'silver tempest', 'crown zenith', 'scarlet & violet',
      'paldea evolved', 'obsidian flames', '151', 'paradox rift',
      'temporal forces', 'twilight masquerade', 'shrouded fable',
      'stellar crown', 'surging sparks', 'prismatic evolutions',
      'journey together', 'base set', 'jungle', 'fossil', 'team rocket',
      'vivid voltage', 'shining fates', 'chilling reign', 'fusion strike',
      'darkness ablaze', 'rebel clash', 'sword & shield', 'sun & moon',
      'burning shadows', 'guardians rising', 'steam siege', 'evolutions',
      'breakpoint', 'generations', 'ancient origins', 'roaring skies',
      'phantom forces', 'flashfire', 'xy', 'boundaries crossed',
      'plasma storm', 'plasma freeze', 'legendary treasures',
    ];

    let nameParts: string[] = [];
    let numberPart: string | null = null;
    let setPart: string | null = null;

    // Parse the query: separate name, number, and set
    const lowerQuery = query.toLowerCase();
    for (const setName of knownSets) {
      if (lowerQuery.includes(setName)) {
        setPart = setName;
        // Remove set name from parts to process
        const setRegex = new RegExp(setName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const remaining = query.replace(setRegex, '').trim();
        const remainingParts = remaining.split(/\s+/).filter(Boolean);
        for (const p of remainingParts) {
          if (/^\d{1,4}$/.test(p) || /^[A-Z]{0,3}\d{1,4}$/i.test(p) || /^\d+\/\d+$/.test(p)) {
            numberPart = p;
          } else if (p.length > 0) {
            nameParts.push(p);
          }
        }
        break;
      }
    }

    // If no set was found, parse normally
    if (!setPart) {
      for (const p of parts) {
        // Check if this looks like a card number: "005", "72", "TG03", "12/100"
        if (/^\d{1,4}$/.test(p) || /^[A-Z]{1,3}\d{1,4}$/i.test(p) || /^\d+\/\d+$/.test(p)) {
          numberPart = p;
        } else {
          nameParts.push(p);
        }
      }
    }

    // Build the API query
    if (nameParts.length > 0) {
      const name = nameParts.join(' ');
      qParts.push(`name:"${name}"`);
    }
    if (numberPart) {
      // Strip leading zeros for matching but also try with them
      qParts.push(`number:${numberPart}`);
    }
    if (setPart) {
      qParts.push(`set.name:"${setPart}"`);
    }

    // If we only got a number with no name, that's not useful
    if (nameParts.length === 0) {
      qParts.length = 0;
      qParts.push(`name:"${query}"`);
    }

    const q = qParts.join(' ');
    console.log('[TCG Search]', query, '→', q);

    let results: any[] = await PokemonTCG.findCardsByQueries({ q, pageSize: 50 });

    // If exact number match found nothing, retry with just name (broader search)
    if (results.length === 0 && numberPart && nameParts.length > 0) {
      const fallbackQ = `name:"${nameParts.join(' ')}"`;
      results = await PokemonTCG.findCardsByQueries({ q: fallbackQ, pageSize: 50 });
    }

    return results.map((card: any) => ({
      id: card.id,
      name: card.name,
      number: card.number,
      set: card.set?.name || '',
      setId: card.set?.id || '',
      image: card.images?.small || '',
      imageLarge: card.images?.large || '',
      rarity: card.rarity || '',
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
