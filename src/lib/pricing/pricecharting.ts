import * as cheerio from 'cheerio';
import type { SoldListing } from '@/types';

/**
 * Checks if a PriceCharting result title matches the card we're looking for.
 * Must contain the Pokemon name. If we have a card number, filter by that too.
 */
function isRelevantResult(title: string, cardName: string, cardNumber: string): boolean {
  const t = title.toLowerCase();
  const nameWords = cardName.toLowerCase().split(/\s+/);
  const primaryName = nameWords[0]; // "Pikachu", "Charizard", etc.

  // Must contain the primary Pokemon name
  if (!t.includes(primaryName)) return false;

  // If we have a card number, the result must contain it
  if (cardNumber) {
    const cleanNum = cardNumber.replace(/[/#]/g, '').toLowerCase();
    // Check common formats: #12, /12, 12/, just "12"
    const hasNumber =
      t.includes(`#${cleanNum}`) ||
      t.includes(`/${cleanNum}`) ||
      t.includes(`${cleanNum}/`) ||
      t.includes(` ${cleanNum} `) ||
      t.includes(` ${cleanNum}-`) ||
      t.endsWith(` ${cleanNum}`);

    if (!hasNumber) return false;
  }

  // If the card name has multiple words (e.g., "Pikachu VMAX"), check the second word too
  if (nameWords.length > 1 && nameWords[1].length > 2) {
    if (!t.includes(nameWords[1].toLowerCase())) return false;
  }

  return true;
}

/**
 * Scrapes PriceCharting for Pokemon card market values.
 * Now takes cardNumber for precise matching and filters results strictly.
 */
export async function getPriceChartingData(
  cardName: string,
  cardNumber: string,
  setName: string
): Promise<SoldListing[]> {
  try {
    // Include card number and set in the search for precision
    const searchParts = [cardName];
    if (cardNumber) searchParts.push(cardNumber);
    if (setName) searchParts.push(setName);
    searchParts.push('pokemon');

    const query = encodeURIComponent(searchParts.join(' ').trim());
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

    // Check if redirected to a product page (exact match)
    const isProductPage = $('#product_name').length > 0 || $('h1[id="product_name"]').length > 0;

    if (isProductPage) {
      const productName = $('h1#product_name').text().trim() || cardName;
      const pageUrl = response.url;

      // Only include if relevant to our search
      if (isRelevantResult(productName, cardName, cardNumber)) {
        const priceTiers = [
          { selector: '#price_data .price', label: 'Ungraded' },
          { selector: '#complete-price .price', label: 'Complete' },
          { selector: '#graded-price .price', label: 'PSA 10' },
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

        // Generic price extraction fallback
        if (listings.length === 0) {
          $('td.price span.price, .price_column span.price, .js-price').each((_, el) => {
            if (listings.length >= 5) return;
            const priceText = $(el).text().trim();
            const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
            if (!priceMatch) return;
            const price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
            if (isNaN(price) || price <= 0) return;

            listings.push({
              title: productName,
              price,
              date: now,
              url: pageUrl,
              source: 'PRICECHARTING',
            });
          });
        }
      }
    } else {
      // Search results page — parse table rows and FILTER strictly
      $('table tbody tr, .offer_game, .search-result').each((_, el) => {
        if (listings.length >= 10) return;

        const title =
          $(el).find('td.title a, .product_name a, a.product_name').first().text().trim();
        const link =
          $(el).find('td.title a, .product_name a, a.product_name').first().attr('href');

        if (!title) return;

        // STRICT RELEVANCE CHECK
        if (!isRelevantResult(title, cardName, cardNumber)) return;

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
          break;
        }
      });
    }

    return listings.slice(0, 10);
  } catch (error) {
    console.error('PriceCharting scraping error:', error);
    return [];
  }
}
