import * as cheerio from 'cheerio';
import type { SoldListing } from '@/types';

export async function getPriceChartingData(
  cardName: string,
  setName: string
): Promise<SoldListing[]> {
  try {
    const query = encodeURIComponent(`${cardName} ${setName} pokemon`);
    const searchUrl = `https://www.pricecharting.com/search-products?q=${query}&type=prices`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const listings: SoldListing[] = [];
    const now = new Date().toISOString().split('T')[0];

    // Look for price table rows on the search results page
    $('table#games_table tbody tr').each((_, el) => {
      const title = $(el).find('td.title a').text().trim();
      const priceText = $(el).find('td.price.used_price span.price').text().trim();
      const link = $(el).find('td.title a').attr('href');

      if (!title || !priceText) return;

      const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
      if (!priceMatch) return;

      const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
      if (isNaN(price) || price === 0) return;

      listings.push({
        title: `${title} - Ungraded`,
        price,
        date: now,
        url: link ? `https://www.pricecharting.com${link}` : '',
        source: 'PRICECHARTING',
      });
    });

    // Also check for graded prices if available
    $('table#games_table tbody tr').each((_, el) => {
      const gradedPriceText = $(el)
        .find('td.price.graded_price span.price')
        .text()
        .trim();
      const title = $(el).find('td.title a').text().trim();
      const link = $(el).find('td.title a').attr('href');

      if (!gradedPriceText || !title) return;

      const priceMatch = gradedPriceText.match(/\$[\d,]+\.?\d*/);
      if (!priceMatch) return;

      const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
      if (isNaN(price) || price === 0) return;

      listings.push({
        title: `${title} - PSA 10`,
        price,
        date: now,
        url: link ? `https://www.pricecharting.com${link}` : '',
        source: 'PRICECHARTING',
      });
    });

    return listings.slice(0, 10);
  } catch (error) {
    console.error('PriceCharting scraping error:', error);
    return [];
  }
}
