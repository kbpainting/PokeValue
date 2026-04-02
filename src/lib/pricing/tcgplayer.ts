import { PokemonTCG } from 'pokemon-tcg-sdk-typescript';
import * as cheerio from 'cheerio';
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
 *   "Charizard VMAX"       → name:"Charizard VMAX"
 */
export async function searchCards(query: string) {
  try {
    const parts = query.trim().split(/\s+/);
    const qParts: string[] = [];

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

    const lowerQuery = query.toLowerCase();
    for (const setName of knownSets) {
      if (lowerQuery.includes(setName)) {
        setPart = setName;
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

    if (!setPart) {
      for (const p of parts) {
        if (/^\d{1,4}$/.test(p) || /^[A-Z]{1,3}\d{1,4}$/i.test(p) || /^\d+\/\d+$/.test(p)) {
          numberPart = p;
        } else {
          nameParts.push(p);
        }
      }
    }

    if (nameParts.length > 0) {
      qParts.push(`name:"${nameParts.join(' ')}"`);
    }
    if (numberPart) {
      qParts.push(`number:${numberPart}`);
    }
    if (setPart) {
      qParts.push(`set.name:"${setPart}"`);
    }
    if (nameParts.length === 0) {
      qParts.length = 0;
      qParts.push(`name:"${query}"`);
    }

    const q = qParts.join(' ');
    let results: any[] = await PokemonTCG.findCardsByQueries({ q, pageSize: 50 });

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
 * Scrapes the TCGPlayer product page to get condition-level pricing.
 * Returns prices for Near Mint, Lightly Played, Moderately Played, Heavily Played, Damaged.
 */
async function scrapeTCGPlayerConditionPrices(tcgPlayerUrl: string): Promise<SoldListing[]> {
  if (!tcgPlayerUrl) return [];

  try {
    const response = await fetch(tcgPlayerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const listings: SoldListing[] = [];
    const now = new Date().toISOString().split('T')[0];
    const url = response.url || tcgPlayerUrl;

    // TCGPlayer condition pricing table rows
    // Look for price listings by condition
    $('section.price-points tr, .price-point, [class*="price-point"], [class*="condition"]').each((_, el) => {
      const text = $(el).text();
      const conditionMatch = text.match(/(Near Mint|Lightly Played|Moderately Played|Heavily Played|Damaged)/i);
      if (!conditionMatch) return;

      const priceMatch = text.match(/\$[\d,]+\.?\d*/);
      if (!priceMatch) return;

      const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
      if (isNaN(price) || price <= 0) return;

      listings.push({
        title: `RAW — ${conditionMatch[1]}`,
        price,
        date: now,
        url,
        source: 'TCGPLAYER',
      });
    });

    // Also try JSON-LD or script data that TCGPlayer embeds
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        if (json.offers) {
          const offers = Array.isArray(json.offers) ? json.offers : [json.offers];
          for (const offer of offers) {
            if (offer.price && offer.itemCondition) {
              const conditionMap: Record<string, string> = {
                'https://schema.org/NewCondition': 'Near Mint',
                'https://schema.org/UsedCondition': 'Lightly Played',
                'NewCondition': 'Near Mint',
                'UsedCondition': 'Lightly Played',
              };
              const condition = conditionMap[offer.itemCondition] || offer.itemCondition;
              listings.push({
                title: `RAW — ${condition}`,
                price: parseFloat(offer.price),
                date: now,
                url,
                source: 'TCGPLAYER',
              });
            }
          }
        }
      } catch {
        // ignore JSON parse errors
      }
    });

    return listings;
  } catch (error) {
    console.error('TCGPlayer scrape error:', error);
    return [];
  }
}

/**
 * Gets RAW/ungraded card prices from TCGPlayer.
 *
 * Strategy:
 * 1. Use pokemontcg.io API to find the card and get its TCGPlayer URL + base prices
 * 2. Try scraping the TCGPlayer product page for condition-level pricing (NM, LP, MP, HP)
 * 3. Fall back to API data if scraping fails
 *
 * IMPORTANT: TCGPlayer only sells RAW (ungraded) cards. All prices are for raw singles.
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

    let match = results.find(
      (c: any) => c.set?.name?.toLowerCase() === setName.toLowerCase()
    );
    if (!match && results.length > 0) match = results[0];
    if (!match) return [];

    const tcgUrl = match.tcgplayer?.url || '';

    // Try to get condition-level pricing from TCGPlayer page
    const conditionPrices = await scrapeTCGPlayerConditionPrices(tcgUrl);

    if (conditionPrices.length > 0) {
      return conditionPrices.slice(0, 10);
    }

    // Fallback: use API data with condition labels based on price tiers
    const prices = match.tcgplayer?.prices;
    if (!prices) return [];

    const listings: SoldListing[] = [];
    const now = new Date().toISOString().split('T')[0];

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

      // Map API price tiers to approximate condition labels:
      // market ≈ Near Mint, mid ≈ Lightly Played, low ≈ Moderately/Heavily Played
      if (p.market) {
        listings.push({
          title: `RAW ${variantLabel} — Near Mint (Market)`,
          price: p.market,
          date: now,
          url: tcgUrl,
          source: 'TCGPLAYER',
        });
      }
      if (p.mid && p.mid !== p.market) {
        listings.push({
          title: `RAW ${variantLabel} — Lightly Played (Mid)`,
          price: p.mid,
          date: now,
          url: tcgUrl,
          source: 'TCGPLAYER',
        });
      }
      if (p.low && p.low !== p.mid) {
        listings.push({
          title: `RAW ${variantLabel} — Moderately Played (Low)`,
          price: p.low,
          date: now,
          url: tcgUrl,
          source: 'TCGPLAYER',
        });
      }
      if (p.high) {
        listings.push({
          title: `RAW ${variantLabel} — Near Mint (High)`,
          price: p.high,
          date: now,
          url: tcgUrl,
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
