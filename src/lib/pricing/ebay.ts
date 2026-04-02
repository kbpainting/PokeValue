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

    // ScraperAPI can return results in multiple formats:
    // - Array at top level: [item0, item1, ...] (keys are 0, 1, 2...)
    // - Object with results: { organic_results: [...] } or { results: [...] }
    let results: any[];
    if (Array.isArray(data)) {
      results = data;
    } else {
      results = data.organic_results || data.results || data.sold_items || data.items || [];
    }

    if (!Array.isArray(results) || results.length === 0) {
      const keys = Object.keys(data).slice(0, 10).join(', ');
      return { listings: [], debug: `ScraperAPI returned 0 sold results. Response keys: ${keys}. Query: "${searchQuery}"` };
    }

    const primaryName = cardName.toLowerCase().split(/\s+/)[0];

    // Debug: log first item's keys and sample values so we can see the response shape
    const sampleItem = results[0] || {};
    const sampleKeys = Object.keys(sampleItem).slice(0, 15).join(', ');
    const sampleTitle = sampleItem.title || sampleItem.name || sampleItem.product_title || sampleItem.heading || JSON.stringify(sampleItem).substring(0, 100);

    const listings: SoldListing[] = results
      .filter((item: any) => {
        // Try every possible title field
        const title = (item.title || item.name || item.product_title || item.heading || '').toLowerCase();
        return title.includes(primaryName);
      })
      .slice(0, 10)
      .map((item: any) => {
        // Extract price — try every possible field format
        let price = 0;
        // Direct numeric fields
        for (const key of ['price', 'sold_price', 'total_price', 'item_price', 'current_price', 'amount']) {
          const val = item[key];
          if (typeof val === 'number' && val > 0) { price = val; break; }
          if (typeof val === 'string') {
            const m = val.replace(/[,$]/g, '').match(/[\d.]+/);
            if (m) { price = parseFloat(m[0]); if (price > 0) break; }
          }
        }
        // Nested price objects
        if (price === 0) {
          const nested = item.price_info || item.pricing || item.sold_for || {};
          if (typeof nested === 'object') {
            const rawVal = nested.amount || nested.value || nested.total || nested.raw || 0;
            if (typeof rawVal === 'string') {
              const m = rawVal.replace(/[,$]/g, '').match(/[\d.]+/);
              price = m ? parseFloat(m[0]) : 0;
            } else if (typeof rawVal === 'number') {
              price = rawVal;
            }
          }
        }
        // Worst case: scan entire item JSON for a dollar amount
        if (price === 0) {
          const json = JSON.stringify(item);
          const priceMatches = json.match(/\$[\d,]+\.?\d*/g);
          if (priceMatches && priceMatches.length > 0) {
            price = parseFloat(priceMatches[0].replace(/[$,]/g, ''));
          }
        }

        // Extract date
        let date = new Date().toISOString().split('T')[0];
        const soldDate = item.sold_date || item.date_sold || item.end_date || item.date || item.sold || '';
        if (soldDate) {
          const parsed = new Date(soldDate);
          if (!isNaN(parsed.getTime())) date = parsed.toISOString().split('T')[0];
        }

        const title = (item.title || item.name || item.product_title || item.heading || '')
          .replace(/\s{2,}/g, ' ').trim().substring(0, 200);

        return {
          title,
          price,
          date,
          url: item.link || item.url || item.product_url || item.href || '',
          source: 'EBAY' as const,
        };
      })
      .filter((l: SoldListing) => l.price > 0);

    return {
      listings,
      debug: listings.length > 0
        ? `ScraperAPI: ${results.length} results, ${listings.length} matched`
        : `ScraperAPI: ${results.length} results, 0 matched. Item keys: [${sampleKeys}]. Sample: ${sampleTitle}`,
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
