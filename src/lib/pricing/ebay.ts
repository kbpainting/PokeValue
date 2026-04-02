import * as cheerio from 'cheerio';
import type { SoldListing } from '@/types';

/**
 * Cleans eBay listing titles by removing common junk text.
 */
function cleanTitle(raw: string): string {
  return raw
    .replace(/Sponsored/gi, '')
    .replace(/Opens in a new window or tab/gi, '')
    .replace(/Brand New/gi, '')
    .replace(/Free Shipping/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Scores how relevant an eBay listing is to the card we searched for.
 * Returns 0 for irrelevant, higher scores for better matches.
 */
function relevanceScore(
  title: string,
  cardName: string,
  cardNumber: string
): number {
  const t = title.toLowerCase();

  // Must not be eBay junk
  if (
    t === 'shop on ebay' ||
    t === 'results matching fewer words' ||
    t.length < 10 ||
    t.startsWith('shop on')
  ) {
    return 0;
  }

  let score = 0;
  const nameWords = cardName.toLowerCase().split(/\s+/);
  const primaryName = nameWords[0]; // "Pikachu", "Charizard", etc.

  // Must contain the primary Pokemon name
  if (!t.includes(primaryName)) return 0;
  score += 10;

  // Bonus for matching additional name words
  for (let i = 1; i < nameWords.length; i++) {
    if (nameWords[i].length > 2 && t.includes(nameWords[i])) {
      score += 5;
    }
  }

  // Bonus for matching card number
  if (cardNumber) {
    const cleanNum = cardNumber.replace(/^0+/, '').toLowerCase(); // strip leading zeros
    const rawNum = cardNumber.toLowerCase();
    if (
      t.includes(`#${rawNum}`) || t.includes(`#${cleanNum}`) ||
      t.includes(`/${rawNum}`) || t.includes(`/${cleanNum}`) ||
      t.includes(`${rawNum}/`) || t.includes(`${cleanNum}/`) ||
      t.includes(` ${rawNum} `) || t.includes(` ${cleanNum} `) ||
      t.endsWith(` ${rawNum}`) || t.endsWith(` ${cleanNum}`)
    ) {
      score += 20; // Strong signal
    }
  }

  return score;
}

/**
 * Extracts the sold date from eBay listing elements.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDate(el: any, $: cheerio.CheerioAPI): string {
  const now = new Date().toISOString().split('T')[0];

  const dateText =
    $(el).find('.s-item__title--tagblock .POSITIVE').text().trim() ||
    $(el).find('.s-item__ended-date').text().trim() ||
    $(el).find('.s-item__endedDate').text().trim() ||
    $(el).find('.s-item__caption--signal .POSITIVE').text().trim() ||
    '';

  if (!dateText) return now;

  const dateMatch = dateText.match(
    /(?:Sold\s+)?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s*\d{2,4})/i
  );

  if (dateMatch) {
    const parsed = new Date(dateMatch[1]);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }

  return now;
}

/**
 * Scrapes eBay sold/completed listings with a timeout.
 * Uses relevance scoring instead of hard filtering — returns
 * best matches sorted by relevance.
 */
export async function getEbaySoldListings(
  cardName: string,
  cardNumber: string,
  gradingCompany: string,
  grade: string | null
): Promise<{ listings: SoldListing[]; debug: string }> {
  try {
    const parts: string[] = [cardName];
    if (cardNumber) parts.push(cardNumber);

    if (gradingCompany !== 'RAW' && grade) {
      parts.push(gradingCompany, grade);
    } else if (gradingCompany !== 'RAW') {
      parts.push(gradingCompany);
    } else {
      parts.push('pokemon card -PSA -CGC -BGS -TAG -graded -slab');
    }

    const query = encodeURIComponent(parts.join(' '));
    const url = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=60`;

    // 10-second timeout to prevent hanging
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return { listings: [], debug: `eBay returned HTTP ${response.status}` };
    }

    const html = await response.text();

    // Check for captcha/block pages
    if (html.includes('captcha') || html.includes('Please verify') || html.includes('robot')) {
      return { listings: [], debug: 'eBay returned CAPTCHA/block page — server IP is blocked' };
    }

    const $ = cheerio.load(html);

    // Collect ALL candidate listings with relevance scores
    const candidates: { listing: SoldListing; score: number }[] = [];

    $('li.s-item, div.s-item').each((_, el) => {
      const rawTitle =
        $(el).find('.s-item__title span[role="heading"]').text().trim() ||
        $(el).find('.s-item__title span').first().text().trim() ||
        $(el).find('.s-item__title').first().text().trim();

      if (!rawTitle) return;

      const title = cleanTitle(rawTitle);
      const score = relevanceScore(title, cardName, cardNumber);
      if (score === 0) return;

      // Extract price
      const priceText =
        $(el).find('.s-item__price .POSITIVE').text().trim() ||
        $(el).find('.s-item__price span.POSITIVE').text().trim() ||
        $(el).find('.s-item__price').first().text().trim();

      const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
      if (!priceMatch) return;
      const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
      if (isNaN(price) || price === 0) return;

      const link =
        $(el).find('a.s-item__link').attr('href') ||
        $(el).find('.s-item__info a').attr('href') ||
        $(el).find('a[href*="ebay.com/itm"]').attr('href') ||
        '';

      const date = extractDate($(el), $);

      candidates.push({
        listing: {
          title,
          price,
          date,
          url: link ? link.split('?')[0] : '',
          source: 'EBAY',
        },
        score,
      });
    });

    // Sort by relevance score (highest first), take top 10
    candidates.sort((a, b) => b.score - a.score);
    const listings = candidates.slice(0, 10).map((c) => c.listing);

    const totalItems = $('li.s-item, div.s-item').length;
    const debug = `Found ${totalItems} eBay items, ${candidates.length} relevant, returning ${listings.length}`;

    return { listings, debug };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('abort')) {
      return { listings: [], debug: 'eBay request timed out after 10s' };
    }
    return { listings: [], debug: `eBay error: ${msg}` };
  }
}

export function calculateEbayMarketPrice(listings: SoldListing[]): number | null {
  if (listings.length === 0) return null;

  const prices = listings.map((l) => l.price).sort((a, b) => a - b);

  if (prices.length >= 5) {
    const trimCount = Math.max(1, Math.floor(prices.length * 0.1));
    const trimmed = prices.slice(trimCount, prices.length - trimCount);
    if (trimmed.length > 0) {
      return trimmed.reduce((sum, p) => sum + p, 0) / trimmed.length;
    }
  }

  if (prices.length >= 2) {
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 === 0
      ? (prices[mid - 1] + prices[mid]) / 2
      : prices[mid];
  }

  return prices[0];
}
