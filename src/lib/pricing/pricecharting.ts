import * as cheerio from 'cheerio';
import type { SoldListing } from '@/types';

/**
 * Scrapes PriceCharting for Pokemon card market values.
 * PriceCharting aggregates 3 months of eBay sold data into market values.
 * Uses multiple selector strategies for resilience.
 */
export async function getPriceChartingData(
  cardName: string,
  setName: string
): Promise<SoldListing[]> {
  try {
    const query = encodeURIComponent(`${cardName} ${setName} pokemon`.trim());
    const searchUrl = `https://www.pricecharting.com/search-products?q=${query}&type=prices`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error('PriceCharting fetch failed:', response.status);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const listings: SoldListing[] = [];
    const now = new Date().toISOString().split('T')[0];

    // Check if we were redirected to a product page (exact match)
    const isProductPage = $('#product_name').length > 0 || $('h1[id="product_name"]').length > 0;

    if (isProductPage) {
      // We're on a specific product page - extract all price tiers
      const productName = $('h1#product_name').text().trim() || cardName;
      const pageUrl = response.url;

      // Price tiers on product pages
      const priceTiers = [
        { selector: '#price_data .price', label: 'Ungraded' },
        { selector: '#complete-price .price', label: 'Complete' },
        { selector: '#graded-price .price', label: 'PSA 10' },
        { selector: '#box-only-price .price', label: 'Box Only' },
        { selector: '#manual-only-price .price', label: 'Manual Only' },
      ];

      for (const tier of priceTiers) {
        const priceText = $(tier.selector).first().text().trim();
        if (!priceText) continue;
        const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
        if (!priceMatch) continue;
        const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
        if (isNaN(price) || price <= 0) continue;

        listings.push({
          title: `${productName} - ${tier.label}`,
          price,
          date: now,
          url: pageUrl,
          source: 'PRICECHARTING',
        });
      }

      // Also try generic price extraction from the page
      if (listings.length === 0) {
        $('td.price span.price, .price_column span.price, .js-price').each((_, el) => {
          if (listings.length >= 10) return;
          const priceText = $(el).text().trim();
          const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
          if (!priceMatch) return;
          const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
          if (isNaN(price) || price <= 0) return;

          listings.push({
            title: `${productName}`,
            price,
            date: now,
            url: pageUrl,
            source: 'PRICECHARTING',
          });
        });
      }
    } else {
      // We're on search results - parse the table
      // Strategy 1: Standard table structure
      $('table tbody tr, .offer_game, .search-result').each((_, el) => {
        if (listings.length >= 10) return;

        const title =
          $(el).find('td.title a, .product_name a, a.product_name').first().text().trim();
        const link =
          $(el).find('td.title a, .product_name a, a.product_name').first().attr('href');

        if (!title) return;

        // Try multiple price columns
        const priceSelectors = [
          'td.price span.price',
          'td.used_price span.price',
          'td.cib_price span.price',
          'td.new_price span.price',
          '.price span',
          '.used_price',
        ];

        for (const sel of priceSelectors) {
          const priceText = $(el).find(sel).first().text().trim();
          if (!priceText) continue;

          const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
          if (!priceMatch) continue;

          const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
          if (isNaN(price) || price <= 0) continue;

          const isGraded = sel.includes('new_price') || sel.includes('cib_price');

          listings.push({
            title: `${title}${isGraded ? ' - Graded' : ' - Ungraded'}`,
            price,
            date: now,
            url: link ? `https://www.pricecharting.com${link.startsWith('/') ? '' : '/'}${link}` : '',
            source: 'PRICECHARTING',
          });
          break; // One price per row
        }
      });
    }

    return listings.slice(0, 10);
  } catch (error) {
    console.error('PriceCharting scraping error:', error);
    return [];
  }
}
