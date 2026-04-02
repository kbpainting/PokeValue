import type { SoldListing } from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Fetches eBay sold/completed listings using ScraperAPI's structured eBay endpoint.
 *
 * Uses the structured endpoint (5 credits each = 200 searches/month free)
 * BUT with aggressive Supabase caching: same card lookup within 24 hours
 * returns cached results (0 credits). Effectively ~200 UNIQUE card lookups/month.
 *
 * Falls back to direct scraping if no API key.
 */
export async function getEbaySoldListings(
  cardName: string,
  cardNumber: string,
  cardVariant: string,
  gradingCompany: string,
  grade: string | null
): Promise<{ listings: SoldListing[]; debug: string }> {
  // Build search query — order matters for eBay relevance
  const parts: string[] = [];
  parts.push(cardName);
  if (cardNumber) parts.push(cardNumber);

  if (gradingCompany !== 'RAW' && grade) {
    parts.push(gradingCompany, grade);
  } else if (gradingCompany !== 'RAW') {
    return { listings: [], debug: 'Select a grade to search eBay graded comps' };
  }

  if (cardVariant && cardVariant !== 'Other' && cardVariant !== 'Non-Holo') {
    parts.push(cardVariant);
  }

  if (gradingCompany === 'RAW') {
    parts.push('pokemon -PSA -CGC -BGS -TAG -graded -slab');
  } else {
    parts.push('pokemon');
  }

  const searchQuery = parts.join(' ');
  const apiKey = process.env.SCRAPER_API_KEY;

  if (apiKey) {
    return getEbayViaStructuredAPI(apiKey, searchQuery, cardName);
  }

  return getEbayDirectScrape(searchQuery, cardName);
}

/**
 * ScraperAPI structured eBay endpoint — returns parsed JSON directly.
 * 5 credits per call, but guaranteed to return results (no HTML parsing needed).
 */
async function getEbayViaStructuredAPI(
  apiKey: string,
  searchQuery: string,
  cardName: string
): Promise<{ listings: SoldListing[]; debug: string }> {
  try {
    const url = `https://api.scraperapi.com/structured/ebay/search?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}&ebay_domain=ebay.com&sold_items=true`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { listings: [], debug: `ScraperAPI HTTP ${response.status}: ${errText.substring(0, 150)}` };
    }

    const data = await response.json();

    // ScraperAPI structured endpoint returns { organic_results: [...] } or { results: [...] }
    const results = data.organic_results || data.results || data.sold_items || [];

    if (!Array.isArray(results) || results.length === 0) {
      // Log the response shape for debugging
      const keys = Object.keys(data).join(', ');
      return { listings: [], debug: `ScraperAPI returned 0 sold results. Response keys: ${keys}. Query: "${searchQuery}"` };
    }

    const primaryName = cardName.toLowerCase().split(/\s+/)[0];

    const listings: SoldListing[] = results
      .filter((item: any) => {
        const title = (item.title || item.name || '').toLowerCase();
        return title.includes(primaryName);
      })
      .slice(0, 10)
      .map((item: any) => {
        // Parse price from various ScraperAPI response formats
        let price = 0;
        const rawPrice = item.price || item.sold_price || item.total_price || item.item_price || '';
        if (typeof rawPrice === 'number') {
          price = rawPrice;
        } else if (typeof rawPrice === 'string') {
          const match = rawPrice.replace(/[,$]/g, '').match(/[\d.]+/);
          if (match) price = parseFloat(match[0]);
        }
        // Also check nested price object
        if (price === 0 && item.price_info) {
          const pi = item.price_info;
          price = pi.amount || pi.value || pi.total || 0;
        }

        // Parse date
        let date = new Date().toISOString().split('T')[0];
        const soldDate = item.sold_date || item.date_sold || item.end_date || '';
        if (soldDate) {
          const parsed = new Date(soldDate);
          if (!isNaN(parsed.getTime())) date = parsed.toISOString().split('T')[0];
        }

        return {
          title: (item.title || item.name || '').replace(/\s{2,}/g, ' ').trim().substring(0, 200),
          price,
          date,
          url: item.link || item.url || item.product_url || '',
          source: 'EBAY' as const,
        };
      })
      .filter((l: SoldListing) => l.price > 0);

    return {
      listings,
      debug: `ScraperAPI: ${results.length} total, ${listings.length} matched for "${searchQuery}"`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    if (msg.includes('abort')) {
      return { listings: [], debug: 'ScraperAPI timed out after 25s' };
    }
    return { listings: [], debug: `ScraperAPI error: ${msg}` };
  }
}

/**
 * Direct eBay scraping fallback — works from residential IPs only.
 */
async function getEbayDirectScrape(
  searchQuery: string,
  cardName: string
): Promise<{ listings: SoldListing[]; debug: string }> {
  try {
    const cheerio = await import('cheerio');
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=60`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(ebayUrl, {
        signal: controller.signal,
        headers: {
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
      return { listings: [], debug: `Direct: HTTP ${response.status}` };
    }

    const html = await response.text();
    if (html.includes('captcha') || html.includes('robot')) {
      return { listings: [], debug: 'eBay blocked — add SCRAPER_API_KEY for reliable results' };
    }

    const $ = cheerio.load(html);
    const primaryName = cardName.toLowerCase().split(/\s+/)[0];
    const listings: SoldListing[] = [];

    $('li.s-item, div.s-item').each((_, el) => {
      if (listings.length >= 10) return;

      const rawTitle =
        $(el).find('.s-item__title span[role="heading"]').text().trim() ||
        $(el).find('.s-item__title span').first().text().trim() ||
        $(el).find('.s-item__title').first().text().trim();

      if (!rawTitle || rawTitle.toLowerCase().startsWith('shop on')) return;
      const title = rawTitle.replace(/Sponsored/gi, '').replace(/Opens in a new window or tab/gi, '').replace(/\s{2,}/g, ' ').trim();
      if (!title.toLowerCase().includes(primaryName)) return;

      const priceText = $(el).find('.s-item__price').first().text().trim();
      const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
      if (!priceMatch) return;
      const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
      if (isNaN(price) || price === 0) return;

      const link = $(el).find('a.s-item__link').attr('href') || '';

      let date = new Date().toISOString().split('T')[0];
      const dateText = $(el).find('.s-item__title--tagblock .POSITIVE').text().trim();
      if (dateText) {
        const m = dateText.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s*\d{2,4})/i);
        if (m) { const p = new Date(m[1]); if (!isNaN(p.getTime())) date = p.toISOString().split('T')[0]; }
      }

      listings.push({ title, price, date, url: link.split('?')[0], source: 'EBAY' });
    });

    return { listings, debug: `Direct: ${listings.length} results` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    return { listings: [], debug: msg.includes('abort') ? 'eBay timed out' : `Direct error: ${msg}` };
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
