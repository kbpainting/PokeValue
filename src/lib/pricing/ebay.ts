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
 * Checks if an eBay listing title is relevant to the card we searched for.
 * Uses the card name and card number to validate.
 */
function isRelevantListing(
  title: string,
  cardName: string,
  cardNumber: string
): boolean {
  const t = title.toLowerCase();

  // Must not be eBay junk
  if (
    t === 'shop on ebay' ||
    t === 'results matching fewer words' ||
    t.length < 10 ||
    t.startsWith('shop on')
  ) {
    return false;
  }

  // If we have a card number, the listing MUST contain it
  // Card numbers like "005", "TG03", "72/100", "#005" etc.
  if (cardNumber) {
    const cleanNum = cardNumber.replace(/[/#]/g, '').toLowerCase();
    // Check for the number with common formats: #005, 005/165, /005, TG03
    const numPatterns = [
      cleanNum,
      `#${cleanNum}`,
      `/${cleanNum}`,
      `${cleanNum}/`,
    ];

    const hasNumber = numPatterns.some((p) => t.includes(p));
    if (!hasNumber) return false;
  }

  // Must contain at least part of the Pokemon name (first word)
  const nameWords = cardName.toLowerCase().split(/\s+/);
  const primaryName = nameWords[0]; // e.g., "Pikachu", "Charizard", "Mewtwo"
  if (!t.includes(primaryName)) return false;

  return true;
}

/**
 * Extracts the sold date from eBay listing text.
 * Looks for patterns like "Sold  Mar 28, 2025" or "Mar 28, 2025"
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDate(el: any, $: cheerio.CheerioAPI): string {
  const now = new Date().toISOString().split('T')[0];

  // Try dedicated date selectors
  const dateText =
    $(el).find('.s-item__title--tagblock .POSITIVE').text().trim() ||
    $(el).find('.s-item__ended-date').text().trim() ||
    $(el).find('.s-item__endedDate').text().trim() ||
    $(el).find('.s-item__caption--signal .POSITIVE').text().trim() ||
    '';

  if (!dateText) return now;

  // Match "Sold  Mar 28, 2025" or just "Mar 28, 2025"
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
 * Scrapes eBay sold/completed listings for EXACT card matches.
 *
 * Search strategy: "{cardName} {cardNumber} {gradingCompany} {grade}"
 * e.g., "Pikachu 005 PSA 10" — then post-filters results to ensure
 * the card number appears in the listing title.
 */
export async function getEbaySoldListings(
  cardName: string,
  cardNumber: string,
  gradingCompany: string,
  grade: string | null
): Promise<SoldListing[]> {
  try {
    // Build a precise search query using card name + number + grade
    const parts: string[] = [cardName];

    // Always include card number for precision
    if (cardNumber) {
      parts.push(cardNumber);
    }

    if (gradingCompany !== 'RAW' && grade) {
      parts.push(gradingCompany, grade);
    } else if (gradingCompany !== 'RAW') {
      parts.push(gradingCompany);
    } else {
      // RAW: exclude graded keywords
      parts.push('pokemon card -PSA -CGC -BGS -TAG -graded -slab');
    }

    const query = encodeURIComponent(parts.join(' '));
    const url = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=60`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error('eBay fetch failed:', response.status);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const listings: SoldListing[] = [];

    $('li.s-item, div.s-item').each((_, el) => {
      if (listings.length >= 15) return; // Collect extra, then take top 10 after filtering

      // Extract title
      let rawTitle =
        $(el).find('.s-item__title span[role="heading"]').text().trim() ||
        $(el).find('.s-item__title span').first().text().trim() ||
        $(el).find('.s-item__title').first().text().trim();

      if (!rawTitle) return;

      const title = cleanTitle(rawTitle);

      // STRICT RELEVANCE CHECK — must match card name + number
      if (!isRelevantListing(title, cardName, cardNumber)) return;

      // Extract price
      const priceText =
        $(el).find('.s-item__price .POSITIVE').text().trim() ||
        $(el).find('.s-item__price span.POSITIVE').text().trim() ||
        $(el).find('.s-item__price').first().text().trim();

      const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
      if (!priceMatch) return;
      const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
      if (isNaN(price) || price === 0) return;

      // Extract link
      const link =
        $(el).find('a.s-item__link').attr('href') ||
        $(el).find('.s-item__info a').attr('href') ||
        $(el).find('a[href*="ebay.com/itm"]').attr('href') ||
        '';

      // Extract sold date
      const date = extractDate($(el), $);

      listings.push({
        title,
        price,
        date,
        url: link ? link.split('?')[0] : '',
        source: 'EBAY',
      });
    });

    return listings.slice(0, 10);
  } catch (error) {
    console.error('eBay scraping error:', error);
    return [];
  }
}

export function calculateEbayMarketPrice(listings: SoldListing[]): number | null {
  if (listings.length === 0) return null;

  const prices = listings.map((l) => l.price).sort((a, b) => a - b);

  // Remove outliers (top and bottom 10% if we have enough data)
  if (prices.length >= 5) {
    const trimCount = Math.max(1, Math.floor(prices.length * 0.1));
    const trimmed = prices.slice(trimCount, prices.length - trimCount);
    if (trimmed.length > 0) {
      return trimmed.reduce((sum, p) => sum + p, 0) / trimmed.length;
    }
  }

  // Median for small datasets
  if (prices.length >= 2) {
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 === 0
      ? (prices[mid - 1] + prices[mid]) / 2
      : prices[mid];
  }

  return prices[0];
}
