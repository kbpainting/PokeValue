import * as cheerio from 'cheerio';
import type { SoldListing } from '@/types';

export async function getEbaySoldListings(
  cardName: string,
  gradingCompany: string,
  grade: string | null
): Promise<SoldListing[]> {
  try {
    const gradeStr = grade && gradingCompany !== 'RAW' ? ` ${gradingCompany} ${grade}` : '';
    const query = encodeURIComponent(`${cardName}${gradeStr} pokemon card`);
    const url = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=60`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      console.error('eBay fetch failed:', response.status);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const listings: SoldListing[] = [];

    $('li.s-item').each((_, el) => {
      const title = $(el).find('.s-item__title span').first().text().trim();
      const priceText = $(el).find('.s-item__price').first().text().trim();
      const dateText = $(el).find('.s-item__title--tagblock .POSITIVE').text().trim();
      const link = $(el).find('.s-item__link').attr('href') || '';

      if (!title || title === 'Shop on eBay') return;

      // Parse price - handle "to" ranges by taking the first price
      const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
      if (!priceMatch) return;
      const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
      if (isNaN(price) || price === 0) return;

      // Parse date
      let date = new Date().toISOString().split('T')[0];
      if (dateText) {
        const dateMatch = dateText.match(/([\w]+\s+\d+,?\s*\d*)/);
        if (dateMatch) {
          const parsed = new Date(dateMatch[1]);
          if (!isNaN(parsed.getTime())) {
            date = parsed.toISOString().split('T')[0];
          }
        }
      }

      listings.push({
        title,
        price,
        date,
        url: link.split('?')[0],
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
    const trimCount = Math.floor(prices.length * 0.1);
    const trimmed = prices.slice(trimCount, prices.length - trimCount);
    return trimmed.reduce((sum, p) => sum + p, 0) / trimmed.length;
  }

  return prices.reduce((sum, p) => sum + p, 0) / prices.length;
}
