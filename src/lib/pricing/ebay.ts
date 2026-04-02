import * as cheerio from 'cheerio';
import type { SoldListing } from '@/types';

/**
 * Scrapes eBay sold/completed listings for GRADED slabs.
 * Searches for exact grading company + grade comps (e.g., "Charizard PSA 10").
 * For RAW cards, searches without grading terms.
 * Uses multiple selector strategies since eBay frequently changes their HTML.
 */
export async function getEbaySoldListings(
  cardName: string,
  gradingCompany: string,
  grade: string | null
): Promise<SoldListing[]> {
  try {
    // Build search query — for graded cards, include exact company + grade for precise comps
    let searchTerms: string;
    if (gradingCompany !== 'RAW' && grade) {
      // Search for exact graded slab comps: "Charizard VMAX PSA 10 pokemon"
      searchTerms = `${cardName} ${gradingCompany} ${grade} pokemon`;
    } else if (gradingCompany !== 'RAW') {
      // Graded but no specific grade selected: "Charizard VMAX PSA pokemon"
      searchTerms = `${cardName} ${gradingCompany} pokemon`;
    } else {
      // RAW: search without grading terms, exclude graded keywords
      searchTerms = `${cardName} pokemon card -PSA -CGC -BGS -TAG -graded -slab`;
    }
    const query = encodeURIComponent(searchTerms);

    // Use eBay's sold listings search
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

    // Strategy 1: Standard s-item selectors
    $('li.s-item, div.s-item').each((_, el) => {
      if (listings.length >= 10) return;

      // Try multiple title selectors
      let title =
        $(el).find('.s-item__title span[role="heading"]').text().trim() ||
        $(el).find('.s-item__title span').first().text().trim() ||
        $(el).find('.s-item__title').first().text().trim();

      if (!title || title === 'Shop on eBay' || title === 'Results matching fewer words') return;

      // Try multiple price selectors
      const priceText =
        $(el).find('.s-item__price .POSITIVE').text().trim() ||
        $(el).find('.s-item__price span.POSITIVE').text().trim() ||
        $(el).find('.s-item__price').first().text().trim();

      const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
      if (!priceMatch) return;
      const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
      if (isNaN(price) || price === 0) return;

      // Try multiple link selectors
      const link =
        $(el).find('a.s-item__link').attr('href') ||
        $(el).find('.s-item__info a').attr('href') ||
        $(el).find('a[href*="ebay.com/itm"]').attr('href') ||
        '';

      // Parse date from various formats
      let date = new Date().toISOString().split('T')[0];
      const dateText =
        $(el).find('.s-item__title--tagblock .POSITIVE').text().trim() ||
        $(el).find('.s-item__ended-date').text().trim() ||
        $(el).find('.s-item__endedDate').text().trim();

      if (dateText) {
        const dateMatch = dateText.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s*\d{0,4})/i);
        if (dateMatch) {
          const parsed = new Date(dateMatch[1]);
          if (!isNaN(parsed.getTime())) {
            date = parsed.toISOString().split('T')[0];
          }
        }
      }

      listings.push({
        title: title.substring(0, 200),
        price,
        date,
        url: link ? link.split('?')[0] : '',
        source: 'EBAY',
      });
    });

    // Strategy 2: If strategy 1 found nothing, try srp-results structure
    if (listings.length === 0) {
      $('[data-viewport]').each((_, el) => {
        if (listings.length >= 10) return;

        const title = $(el).find('[role="heading"]').text().trim();
        if (!title) return;

        const priceText = $(el).text();
        const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
        if (!priceMatch) return;

        const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
        if (isNaN(price) || price === 0 || price > 100000) return;

        const link = $(el).find('a[href*="ebay.com/itm"]').attr('href') || '';

        listings.push({
          title: title.substring(0, 200),
          price,
          date: new Date().toISOString().split('T')[0],
          url: link ? link.split('?')[0] : '',
          source: 'EBAY',
        });
      });
    }

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
