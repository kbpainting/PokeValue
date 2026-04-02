import type { SoldListing } from '@/types';

/**
 * Fetches eBay sold/completed listings using ScraperAPI's structured eBay endpoint.
 * This bypasses eBay's anti-bot blocking by routing through ScraperAPI's proxy network.
 *
 * Free tier: 1,000 credits/month (~200 eBay searches at 5 credits each)
 * Endpoint: https://api.scraperapi.com/structured/ebay/search/v2
 * Returns structured JSON — no HTML parsing needed.
 *
 * Falls back to direct scraping if no API key is configured.
 */
export async function getEbaySoldListings(
  cardName: string,
  cardNumber: string,
  cardVariant: string,
  gradingCompany: string,
  grade: string | null
): Promise<{ listings: SoldListing[]; debug: string }> {
  const apiKey = process.env.SCRAPER_API_KEY;

  if (apiKey) {
    return getEbayViaScraperAPI(apiKey, cardName, cardNumber, cardVariant, gradingCompany, grade);
  }

  // No API key — try direct fetch (will likely fail on server IPs)
  return getEbayDirectScrape(cardName, cardNumber, cardVariant, gradingCompany, grade);
}

/**
 * ScraperAPI structured endpoint — returns clean JSON, no parsing needed.
 */
async function getEbayViaScraperAPI(
  apiKey: string,
  cardName: string,
  cardNumber: string,
  cardVariant: string,
  gradingCompany: string,
  grade: string | null
): Promise<{ listings: SoldListing[]; debug: string }> {
  try {
    // Build precise search query
    const parts: string[] = [cardName];
    if (cardNumber) parts.push(cardNumber);
    if (cardVariant && cardVariant !== 'Other') parts.push(cardVariant);

    if (gradingCompany !== 'RAW' && grade) {
      parts.push(gradingCompany, grade);
    } else if (gradingCompany !== 'RAW') {
      parts.push(gradingCompany);
    }

    parts.push('pokemon');

    const query = parts.join(' ');
    const encodedQuery = encodeURIComponent(query);

    const url = `https://api.scraperapi.com/structured/ebay/search/v2?api_key=${apiKey}&query=${encodedQuery}&show_only=sold_items&country_code=us&tld=com`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { listings: [], debug: `ScraperAPI returned HTTP ${response.status}: ${text.substring(0, 100)}` };
    }

    const data = await response.json();
    const results = data.results || data.organic_results || [];

    if (results.length === 0) {
      return { listings: [], debug: `ScraperAPI returned 0 results for "${query}"` };
    }

    const listings: SoldListing[] = results
      .filter((item: any) => {
        // Basic relevance: must contain the Pokemon name
        const title = (item.title || item.product_title || '').toLowerCase();
        const primaryName = cardName.toLowerCase().split(/\s+/)[0];
        return title.includes(primaryName);
      })
      .slice(0, 10)
      .map((item: any) => {
        // Extract price — ScraperAPI returns various price fields
        let price = 0;
        const priceStr = item.price || item.item_price || item.total_price || '';
        if (typeof priceStr === 'number') {
          price = priceStr;
        } else if (typeof priceStr === 'string') {
          const match = priceStr.replace(/[,$]/g, '').match(/[\d.]+/);
          if (match) price = parseFloat(match[0]);
        }

        // Extract date
        const soldDate = item.sold_date || item.end_date || item.date || '';
        let date = new Date().toISOString().split('T')[0];
        if (soldDate) {
          const parsed = new Date(soldDate);
          if (!isNaN(parsed.getTime())) {
            date = parsed.toISOString().split('T')[0];
          }
        }

        return {
          title: (item.title || item.product_title || '').replace(/\s{2,}/g, ' ').trim(),
          price,
          date,
          url: item.url || item.product_url || item.link || '',
          source: 'EBAY' as const,
        };
      })
      .filter((l: SoldListing) => l.price > 0);

    return {
      listings,
      debug: `ScraperAPI: ${results.length} results, ${listings.length} relevant for "${query}"`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    if (msg.includes('abort')) {
      return { listings: [], debug: 'ScraperAPI request timed out after 15s' };
    }
    return { listings: [], debug: `ScraperAPI error: ${msg}` };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Direct eBay scraping fallback — works from residential IPs but will likely
 * get blocked from server IPs (Render, Vercel, etc.)
 */
async function getEbayDirectScrape(
  cardName: string,
  cardNumber: string,
  cardVariant: string,
  gradingCompany: string,
  grade: string | null
): Promise<{ listings: SoldListing[]; debug: string }> {
  try {
    const cheerio = await import('cheerio');

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

    const query = encodeURIComponent(parts.join(' '));
    const url = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=60`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(url, {
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
      return { listings: [], debug: `eBay direct: HTTP ${response.status}` };
    }

    const html = await response.text();
    if (html.includes('captcha') || html.includes('Please verify') || html.includes('robot')) {
      return { listings: [], debug: 'eBay blocked — CAPTCHA detected. Add SCRAPER_API_KEY env var for reliable results.' };
    }

    const $ = cheerio.load(html);
    const listings: SoldListing[] = [];
    const primaryName = cardName.toLowerCase().split(/\s+/)[0];

    $('li.s-item, div.s-item').each((_, el) => {
      if (listings.length >= 10) return;

      const rawTitle =
        $(el).find('.s-item__title span[role="heading"]').text().trim() ||
        $(el).find('.s-item__title span').first().text().trim() ||
        $(el).find('.s-item__title').first().text().trim();

      if (!rawTitle || rawTitle.toLowerCase().startsWith('shop on')) return;

      const title = rawTitle.replace(/Sponsored/gi, '').replace(/Opens in a new window or tab/gi, '').replace(/\s{2,}/g, ' ').trim();
      if (!title.toLowerCase().includes(primaryName)) return;

      const priceText =
        $(el).find('.s-item__price .POSITIVE').text().trim() ||
        $(el).find('.s-item__price').first().text().trim();
      const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
      if (!priceMatch) return;
      const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
      if (isNaN(price) || price === 0) return;

      const link = $(el).find('a.s-item__link').attr('href') || '';
      const dateText = $(el).find('.s-item__title--tagblock .POSITIVE').text().trim();
      let date = new Date().toISOString().split('T')[0];
      if (dateText) {
        const m = dateText.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s*\d{2,4})/i);
        if (m) { const p = new Date(m[1]); if (!isNaN(p.getTime())) date = p.toISOString().split('T')[0]; }
      }

      listings.push({ title, price, date, url: link.split('?')[0], source: 'EBAY' });
    });

    return { listings, debug: `Direct scrape: ${listings.length} results` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    return { listings: [], debug: msg.includes('abort') ? 'eBay timed out. Add SCRAPER_API_KEY for reliable results.' : `Direct scrape error: ${msg}` };
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
