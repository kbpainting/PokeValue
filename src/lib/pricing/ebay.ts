import * as cheerio from 'cheerio';
import type { SoldListing } from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Fetches eBay sold/completed listings.
 *
 * Uses ScraperAPI as a PROXY (1 credit per request = 1,000 free/month)
 * instead of their structured endpoint (5 credits = only 200 free/month).
 * We parse the HTML ourselves with cheerio.
 *
 * Falls back to direct fetch if no SCRAPER_API_KEY is set.
 */
export async function getEbaySoldListings(
  cardName: string,
  cardNumber: string,
  cardVariant: string,
  gradingCompany: string,
  grade: string | null
): Promise<{ listings: SoldListing[]; debug: string }> {
  // Build the search query
  const parts: string[] = [cardName];
  if (cardNumber) parts.push(cardNumber);
  if (cardVariant && cardVariant !== 'Other') parts.push(cardVariant);

  if (gradingCompany !== 'RAW' && grade) {
    parts.push(gradingCompany, grade);
  } else if (gradingCompany !== 'RAW') {
    parts.push(gradingCompany);
  } else {
    parts.push('pokemon card -PSA -CGC -BGS -TAG -graded -slab');
  }

  const searchQuery = parts.join(' ');
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=60`;

  const apiKey = process.env.SCRAPER_API_KEY;
  let fetchUrl: string;
  let method: string;

  if (apiKey) {
    // Route through ScraperAPI proxy — 1 credit per request (1,000 free/month)
    fetchUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(ebayUrl)}&country_code=us`;
    method = 'ScraperAPI proxy';
  } else {
    // Direct fetch — will likely get blocked from server IPs
    fetchUrl = ebayUrl;
    method = 'Direct';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s for proxy

    let response: Response;
    try {
      response = await fetch(fetchUrl, {
        signal: controller.signal,
        headers: apiKey ? {} : {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return { listings: [], debug: `${method}: HTTP ${response.status}` };
    }

    const html = await response.text();

    // Check for CAPTCHA/block
    if (html.includes('captcha') || html.includes('Please verify') || html.includes('robot')) {
      return { listings: [], debug: `${method}: eBay CAPTCHA detected${!apiKey ? ' — add SCRAPER_API_KEY for reliable results' : ''}` };
    }

    // Parse with cheerio
    const $ = cheerio.load(html);
    const primaryName = cardName.toLowerCase().split(/\s+/)[0];
    const listings: SoldListing[] = [];

    $('li.s-item, div.s-item').each((_, el) => {
      if (listings.length >= 10) return;

      const rawTitle =
        $(el).find('.s-item__title span[role="heading"]').text().trim() ||
        $(el).find('.s-item__title span').first().text().trim() ||
        $(el).find('.s-item__title').first().text().trim();

      if (!rawTitle) return;

      // Clean title
      const title = rawTitle
        .replace(/Sponsored/gi, '')
        .replace(/Opens in a new window or tab/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      // Skip junk
      if (title.toLowerCase().startsWith('shop on') || title.length < 10) return;

      // Must contain the Pokemon name
      if (!title.toLowerCase().includes(primaryName)) return;

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
        $(el).find('a[href*="ebay.com/itm"]').attr('href') ||
        '';

      // Extract sold date
      let date = new Date().toISOString().split('T')[0];
      const dateText =
        $(el).find('.s-item__title--tagblock .POSITIVE').text().trim() ||
        $(el).find('.s-item__ended-date').text().trim() ||
        $(el).find('.s-item__caption--signal .POSITIVE').text().trim() ||
        '';

      if (dateText) {
        const m = dateText.match(
          /(?:Sold\s+)?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s*\d{2,4})/i
        );
        if (m) {
          const parsed = new Date(m[1]);
          if (!isNaN(parsed.getTime())) date = parsed.toISOString().split('T')[0];
        }
      }

      listings.push({
        title,
        price,
        date,
        url: link ? link.split('?')[0] : '',
        source: 'EBAY',
      });
    });

    const totalItems = $('li.s-item, div.s-item').length;
    return {
      listings,
      debug: `${method}: ${totalItems} items found, ${listings.length} matched "${searchQuery}"`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    if (msg.includes('abort')) {
      return { listings: [], debug: `${method}: timed out after 20s` };
    }
    return { listings: [], debug: `${method} error: ${msg}` };
  }
}

export function calculateEbayMarketPrice(listings: SoldListing[]): number | null {
  if (listings.length === 0) return null;
  const prices = listings.map((l) => l.price).sort((a, b) => a - b);

  if (prices.length >= 5) {
    const trim = Math.max(1, Math.floor(prices.length * 0.1));
    const trimmed = prices.slice(trim, prices.length - trim);
    if (trimmed.length > 0) return trimmed.reduce((s, p) => s + p, 0) / trimmed.length;
  }
  if (prices.length >= 2) {
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
  }
  return prices[0];
}
